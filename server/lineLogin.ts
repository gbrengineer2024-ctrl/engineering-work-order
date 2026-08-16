import { createHash, randomBytes, randomUUID } from "crypto";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const LINE_STATE_COOKIE = "line_login_state";
const LINE_VERIFIER_COOKIE = "line_login_verifier";
const TEN_MINUTES_MS = 10 * 60 * 1000;

type LineIdentity = { userId: string; displayName: string; pictureUrl?: string };

function base64Url(value: Buffer) {
  return value.toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

function readCookie(req: Request, key: string) {
  return parseCookieHeader(req.headers.cookie ?? "")[key];
}

/**
 * Browser traffic reaches the app through a TLS-terminating proxy. Express may
 * therefore report `req.protocol` as HTTP even when the public URL is HTTPS.
 * LINE validates redirect_uri byte-for-byte, so use the forwarded protocol when
 * available and default non-local hosts to HTTPS.
 */
export function getLineCallbackUri(req: Request) {
  const forwardedHost = req.headers["x-forwarded-host"];
  const host = (Array.isArray(forwardedHost) ? forwardedHost[0] : forwardedHost) ?? req.get("host");
  if (!host) throw new Error("Unable to determine public host for LINE Login");

  const forwardedProto = req.headers["x-forwarded-proto"];
  const protoValue = Array.isArray(forwardedProto) ? forwardedProto[0] : forwardedProto;
  const forwardedScheme = protoValue?.split(",")[0]?.trim().toLowerCase();
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const scheme = forwardedScheme === "https" || (!isLocal && forwardedScheme !== "http") || (!isLocal && req.protocol === "http")
    ? "https"
    : req.protocol;

  return `${scheme}://${host}/api/auth/line/callback`;
}

async function exchangeLineCode(code: string, redirectUri: string, verifier: string): Promise<LineIdentity> {
  const tokenBody = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: ENV.lineLoginChannelId,
    client_secret: ENV.lineLoginChannelSecret,
    code_verifier: verifier,
  });
  const tokenResponse = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: tokenBody,
  });
  if (!tokenResponse.ok) throw new Error(`LINE token exchange failed (${tokenResponse.status})`);
  const token = await tokenResponse.json() as { id_token?: string; access_token?: string };
  if (!token.id_token) throw new Error("LINE did not return an ID token");

  const verifyBody = new URLSearchParams({ id_token: token.id_token, client_id: ENV.lineLoginChannelId });
  const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyBody,
  });
  if (!verifyResponse.ok) throw new Error(`LINE ID token verification failed (${verifyResponse.status})`);
  const claims = await verifyResponse.json() as { sub?: string; name?: string; picture?: string };
  if (!claims.sub || !claims.name) throw new Error("LINE identity is incomplete");
  return { userId: claims.sub, displayName: claims.name, pictureUrl: claims.picture };
}

export function registerLineLoginRoutes(app: Express) {
  app.get("/api/auth/line/start", (req: Request, res: Response) => {
    if (!ENV.lineLoginChannelId || !ENV.lineLoginChannelSecret) {
      res.status(503).json({ error: "LINE Login is not configured" });
      return;
    }
    const state = randomUUID();
    const verifier = base64Url(randomBytes(48));
    const challenge = base64Url(createHash("sha256").update(verifier).digest());
    const redirectUri = getLineCallbackUri(req);
    const cookieOptions = getSessionCookieOptions(req);
    res.cookie(LINE_STATE_COOKIE, JSON.stringify({ state, returnTo: safeReturnTo(req.query.returnTo) }), { ...cookieOptions, maxAge: TEN_MINUTES_MS });
    res.cookie(LINE_VERIFIER_COOKIE, verifier, { ...cookieOptions, maxAge: TEN_MINUTES_MS });
    const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", ENV.lineLoginChannelId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("nonce", randomUUID());
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    res.redirect(302, url.toString());
  });

  app.get("/api/auth/line/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : "";
    const state = typeof req.query.state === "string" ? req.query.state : "";
    const saved = readCookie(req, LINE_STATE_COOKIE);
    const verifier = readCookie(req, LINE_VERIFIER_COOKIE);
    const cookieOptions = getSessionCookieOptions(req);
    res.clearCookie(LINE_STATE_COOKIE, cookieOptions);
    res.clearCookie(LINE_VERIFIER_COOKIE, cookieOptions);
    if (!code || !state || !saved || !verifier) { res.status(400).json({ error: "Invalid LINE Login session" }); return; }
    let flow: { state?: string; returnTo?: string };
    try { flow = JSON.parse(saved); } catch { res.status(400).json({ error: "Invalid LINE Login state" }); return; }
    if (flow.state !== state) { res.status(403).json({ error: "Invalid LINE Login state" }); return; }
    try {
      const redirectUri = getLineCallbackUri(req);
      const identity = await exchangeLineCode(code, redirectUri, verifier);
      const openId = `line_${identity.userId}`;
      await db.upsertUser({ openId, name: identity.displayName, loginMethod: "LINE", lastSignedIn: new Date() });
      await db.touchLineProfile(openId);
      const sessionToken = await sdk.createSessionToken(openId, { name: identity.displayName, expiresInMs: ONE_YEAR_MS });
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      res.redirect(302, safeReturnTo(flow.returnTo));
    } catch (error) {
      console.error("[LINE Login] Callback failed", error);
      res.status(500).json({ error: "LINE Login failed" });
    }
  });
}

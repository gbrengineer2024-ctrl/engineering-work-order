import type { Hono } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import * as db from "./db";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const LINE_STATE_COOKIE = "line_login_state";
const LINE_VERIFIER_COOKIE = "line_login_verifier";
const TEN_MINUTES_MS = 10 * 60 * 1000;

type LineIdentity = { userId: string; displayName: string; pictureUrl?: string };

function base64Url(value: ArrayBuffer | Uint8Array) {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function sha256(input: string) {
  const data = new TextEncoder().encode(input);
  return crypto.subtle.digest("SHA-256", data);
}

function randomBytesB64Url(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

function safeReturnTo(value: unknown) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

/**
 * Browser traffic reaches the app through Cloudflare's TLS-terminating edge.
 * LINE validates redirect_uri byte-for-byte, so always build an https:// URL
 * for anything that isn't localhost.
 */
export function getLineCallbackUri(req: Request): string {
  const url = new URL(req.url);
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = forwardedHost ?? url.host;
  const hostname = host.replace(/^\[|\]$/g, "").split(":")[0].toLowerCase();
  const isLocal = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1";
  const scheme = isLocal ? url.protocol.replace(":", "") : "https";
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
  const token = (await tokenResponse.json()) as { id_token?: string; access_token?: string };
  if (!token.id_token) throw new Error("LINE did not return an ID token");

  const verifyBody = new URLSearchParams({ id_token: token.id_token, client_id: ENV.lineLoginChannelId });
  const verifyResponse = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: verifyBody,
  });
  if (!verifyResponse.ok) throw new Error(`LINE ID token verification failed (${verifyResponse.status})`);
  const claims = (await verifyResponse.json()) as { sub?: string; name?: string; picture?: string };
  if (!claims.sub || !claims.name) throw new Error("LINE identity is incomplete");
  return { userId: claims.sub, displayName: claims.name, pictureUrl: claims.picture };
}

export function registerLineLoginRoutes(app: Hono<any>) {
  app.get("/api/auth/line/start", async c => {
    if (!ENV.lineLoginChannelId || !ENV.lineLoginChannelSecret) {
      return c.json({ error: "LINE Login is not configured" }, 503);
    }
    const state = crypto.randomUUID();
    const verifier = randomBytesB64Url(48);
    const challenge = base64Url(await sha256(verifier));
    const redirectUri = getLineCallbackUri(c.req.raw);
    const cookieOptions = getSessionCookieOptions(c.req.raw);
    const returnTo = safeReturnTo(c.req.query("returnTo"));

    setCookie(c, LINE_STATE_COOKIE, JSON.stringify({ state, returnTo }), {
      ...cookieOptions,
      maxAge: TEN_MINUTES_MS / 1000,
    });
    setCookie(c, LINE_VERIFIER_COOKIE, verifier, { ...cookieOptions, maxAge: TEN_MINUTES_MS / 1000 });

    const url = new URL("https://access.line.me/oauth2/v2.1/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", ENV.lineLoginChannelId);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("state", state);
    url.searchParams.set("scope", "openid profile");
    url.searchParams.set("nonce", crypto.randomUUID());
    url.searchParams.set("code_challenge", challenge);
    url.searchParams.set("code_challenge_method", "S256");
    return c.redirect(url.toString(), 302);
  });

  app.get("/api/auth/line/callback", async c => {
    const code = c.req.query("code") ?? "";
    const state = c.req.query("state") ?? "";
    const saved = getCookie(c, LINE_STATE_COOKIE);
    const verifier = getCookie(c, LINE_VERIFIER_COOKIE);
    const cookieOptions = getSessionCookieOptions(c.req.raw);
    deleteCookie(c, LINE_STATE_COOKIE, cookieOptions);
    deleteCookie(c, LINE_VERIFIER_COOKIE, cookieOptions);

    if (!code || !state || !saved || !verifier) {
      return c.json({ error: "Invalid LINE Login session" }, 400);
    }
    let flow: { state?: string; returnTo?: string };
    try {
      flow = JSON.parse(saved);
    } catch {
      return c.json({ error: "Invalid LINE Login state" }, 400);
    }
    if (flow.state !== state) return c.json({ error: "Invalid LINE Login state" }, 403);

    try {
      const redirectUri = getLineCallbackUri(c.req.raw);
      const identity = await exchangeLineCode(code, redirectUri, verifier);
      const openId = `line_${identity.userId}`;
      await db.upsertUser({ openId, name: identity.displayName, loginMethod: "LINE", lastSignedIn: new Date() });
      await db.touchLineProfile(openId);
      const sessionToken = await sdk.createSessionToken(openId, { name: identity.displayName, expiresInMs: ONE_YEAR_MS });
      setCookie(c, COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS / 1000 });
      return c.redirect(safeReturnTo(flow.returnTo), 302);
    } catch (error) {
      console.error("[LINE Login] Callback failed", error);
      return c.json({ error: "LINE Login failed" }, 500);
    }
  });
}

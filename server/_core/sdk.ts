import { COOKIE_NAME, ONE_YEAR_MS, decodeOAuthState } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import { parse as parseCookieHeader } from "cookie";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { ENV } from "./env";
import type {
  ExchangeTokenRequest,
  ExchangeTokenResponse,
  GetUserInfoResponse,
  GetUserInfoWithJwtRequest,
  GetUserInfoWithJwtResponse,
} from "./types/manusTypes";

// NOTE: The Manus platform's own OAuth login ("login with Manus account") is
// implemented here for completeness, but ENV.oAuthServerUrl will be empty
// once this app is running outside Manus, so that path is inert. The real
// login used by staff/technicians is LINE Login (server/lineLogin.ts), which
// does not depend on this file's OAuthService at all -- only on
// sdk.createSessionToken/verifySession below, which are self-contained JWT
// helpers with no external dependency.

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0;

export type SessionPayload = {
  openId: string;
  appId: string;
  name: string;
};

const EXCHANGE_TOKEN_PATH = `/webdev.v1.WebDevAuthPublicService/ExchangeToken`;
const GET_USER_INFO_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfo`;
const GET_USER_INFO_WITH_JWT_PATH = `/webdev.v1.WebDevAuthPublicService/GetUserInfoWithJwt`;

class OAuthService {
  private decodeState(state: string): string {
    return decodeOAuthState(state).redirectUri;
  }

  private async post<T>(path: string, payload: unknown): Promise<T> {
    if (!ENV.oAuthServerUrl) {
      throw new Error("OAUTH_SERVER_URL is not configured");
    }
    const resp = await fetch(`${ENV.oAuthServerUrl.replace(/\/+$/, "")}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!resp.ok) {
      const msg = await resp.text().catch(() => resp.statusText);
      throw new Error(`OAuth request failed (${resp.status}): ${msg}`);
    }
    return (await resp.json()) as T;
  }

  async getTokenByCode(code: string, state: string): Promise<ExchangeTokenResponse> {
    const payload: ExchangeTokenRequest = {
      clientId: ENV.appId,
      grantType: "authorization_code",
      code,
      redirectUri: this.decodeState(state),
    };
    return this.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);
  }

  async getUserInfoByToken(token: ExchangeTokenResponse): Promise<GetUserInfoResponse> {
    return this.post<GetUserInfoResponse>(GET_USER_INFO_PATH, { accessToken: token.accessToken });
  }

  async getUserInfoWithJwt(payload: GetUserInfoWithJwtRequest): Promise<GetUserInfoWithJwtResponse> {
    return this.post<GetUserInfoWithJwtResponse>(GET_USER_INFO_WITH_JWT_PATH, payload);
  }
}

class SDKServer {
  private readonly oauthService = new OAuthService();

  private deriveLoginMethod(platforms: unknown, fallback: string | null | undefined): string | null {
    if (fallback && fallback.length > 0) return fallback;
    if (!Array.isArray(platforms) || platforms.length === 0) return null;
    const set = new Set<string>(platforms.filter((p): p is string => typeof p === "string"));
    if (set.has("REGISTERED_PLATFORM_EMAIL")) return "email";
    if (set.has("REGISTERED_PLATFORM_GOOGLE")) return "google";
    if (set.has("REGISTERED_PLATFORM_APPLE")) return "apple";
    if (set.has("REGISTERED_PLATFORM_MICROSOFT") || set.has("REGISTERED_PLATFORM_AZURE")) return "microsoft";
    if (set.has("REGISTERED_PLATFORM_GITHUB")) return "github";
    const first = Array.from(set)[0];
    return first ? first.toLowerCase() : null;
  }

  async exchangeCodeForToken(code: string, state: string): Promise<ExchangeTokenResponse> {
    return this.oauthService.getTokenByCode(code, state);
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const data = await this.oauthService.getUserInfoByToken({ accessToken } as ExchangeTokenResponse);
    const loginMethod = this.deriveLoginMethod((data as any)?.platforms, (data as any)?.platform ?? data.platform ?? null);
    return { ...(data as any), platform: loginMethod, loginMethod } as GetUserInfoResponse;
  }

  private parseCookies(cookieHeader: string | undefined | null) {
    if (!cookieHeader) return new Map<string, string>();
    const parsed = parseCookieHeader(cookieHeader);
    return new Map(Object.entries(parsed));
  }

  private getSessionSecret() {
    const secret = ENV.cookieSecret;
    return new TextEncoder().encode(secret);
  }

  /** Create a session token for a user openId (works for both LINE and Manus OAuth logins). */
  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}): Promise<string> {
    return this.signSession({ openId, appId: ENV.appId, name: options.name || "" }, options);
  }

  async signSession(payload: SessionPayload, options: { expiresInMs?: number } = {}): Promise<string> {
    const issuedAt = Date.now();
    const expiresInMs = options.expiresInMs ?? ONE_YEAR_MS;
    const expirationSeconds = Math.floor((issuedAt + expiresInMs) / 1000);
    const secretKey = this.getSessionSecret();

    return new SignJWT({ openId: payload.openId, appId: payload.appId, name: payload.name })
      .setProtectedHeader({ alg: "HS256", typ: "JWT" })
      .setExpirationTime(expirationSeconds)
      .sign(secretKey);
  }

  async verifySession(cookieValue: string | undefined | null): Promise<{ openId: string; appId: string; name: string } | null> {
    if (!cookieValue) {
      console.warn("[Auth] Missing session cookie");
      return null;
    }

    try {
      const secretKey = this.getSessionSecret();
      const { payload } = await jwtVerify(cookieValue, secretKey, { algorithms: ["HS256"] });
      const { openId, appId, name } = payload as Record<string, unknown>;

      if (!isNonEmptyString(openId) || !isNonEmptyString(appId) || !isNonEmptyString(name)) {
        console.warn("[Auth] Session payload missing required fields");
        return null;
      }

      return { openId, appId, name };
    } catch (error) {
      console.warn("[Auth] Session verification failed", String(error));
      return null;
    }
  }

  async getUserInfoWithJwt(jwtToken: string): Promise<GetUserInfoWithJwtResponse> {
    const payload: GetUserInfoWithJwtRequest = { jwtToken, projectId: ENV.appId };
    return this.oauthService.getUserInfoWithJwt(payload);
  }

  /**
   * Authenticate a Fetch API Request using the session cookie (or bearer
   * fallback for the preview-iframe auto-login path). LINE-login users are
   * always already present in the DB by the time this runs (see
   * lineLogin.ts callback), so the "sync from OAuth server" branch below
   * only ever triggers for the (optional, Manus-only) OAuth login path.
   */
  async authenticateRequest(req: Request): Promise<AuthenticatedUser> {
    const cookies = this.parseCookies(req.headers.get("cookie"));
    let sessionToken = cookies.get(COOKIE_NAME);

    if (!sessionToken) {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        sessionToken = authHeader.slice(7);
      }
    }

    const session = await this.verifySession(sessionToken);

    if (!session) {
      throw ForbiddenError("Invalid session cookie");
    }

    if (session.openId.startsWith(CRON_OPEN_ID_PREFIX)) {
      const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
      const taskUid = userInfo.taskUid ?? null;
      if (!taskUid) {
        throw ForbiddenError("Cron session missing task_uid");
      }
      return buildCronUser(userInfo);
    }

    const sessionUserId = session.openId;
    const signedInAt = new Date();
    let user = await db.getUserByOpenId(sessionUserId);

    // If the user isn't in the DB yet, this can only be a Manus-OAuth login
    // (LINE logins upsert the user row before the session cookie is ever
    // set). Only attempt the remote sync if OAuth is actually configured.
    if (!user && ENV.oAuthServerUrl) {
      try {
        const userInfo = await this.getUserInfoWithJwt(sessionToken ?? "");
        await db.upsertUser({
          openId: userInfo.openId,
          name: userInfo.name || null,
          email: userInfo.email ?? null,
          loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
          lastSignedIn: signedInAt,
        });
        user = await db.getUserByOpenId(userInfo.openId);
      } catch (error) {
        console.error("[Auth] Failed to sync user from OAuth:", error);
        throw ForbiddenError("Failed to sync user info");
      }
    }

    if (!user) {
      throw ForbiddenError("User not found");
    }

    await db.upsertUser({ openId: user.openId, lastSignedIn: signedInAt });

    return user;
  }
}

const CRON_OPEN_ID_PREFIX = "cron_";

export type AuthenticatedUser = User & {
  taskUid?: string;
  isCron?: boolean;
};

function buildCronUser(userInfo: GetUserInfoWithJwtResponse): AuthenticatedUser {
  const now = new Date();
  return {
    id: -1,
    openId: userInfo.openId,
    name: userInfo.name || "Scheduled Task",
    email: null,
    loginMethod: null,
    role: "REPORTER",
    createdAt: now,
    updatedAt: now,
    lastSignedIn: now,
    taskUid: userInfo.taskUid ?? undefined,
    isCron: true,
  } as AuthenticatedUser;
}

export const sdk = new SDKServer();

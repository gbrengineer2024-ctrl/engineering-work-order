// Cookie option helper, ported from Express Request to the Fetch API Request
// used by Hono/Workers.

export type SessionCookieOptions = {
  httpOnly: boolean;
  path: string;
  sameSite: "Strict" | "Lax" | "None";
  secure: boolean;
};

function isSecureRequest(req: Request) {
  const url = new URL(req.url);
  if (url.protocol === "https:") return true;

  const forwardedProto = req.headers.get("x-forwarded-proto");
  if (!forwardedProto) return false;

  return forwardedProto
    .split(",")
    .some(proto => proto.trim().toLowerCase() === "https");
}

export function getSessionCookieOptions(req: Request): SessionCookieOptions {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "None",
    secure: isSecureRequest(req),
  };
}

/** Build a Set-Cookie header string, replacing Express's res.cookie(). */
export function serializeCookie(
  name: string,
  value: string,
  options: SessionCookieOptions & { maxAge?: number },
): string {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  parts.push(`Path=${options.path}`);
  if (options.httpOnly) parts.push("HttpOnly");
  if (options.secure) parts.push("Secure");
  parts.push(`SameSite=${options.sameSite}`);
  if (typeof options.maxAge === "number") {
    parts.push(`Max-Age=${Math.floor(options.maxAge / 1000)}`);
  }
  return parts.join("; ");
}

/** Build a Set-Cookie header string that clears a cookie, replacing Express's res.clearCookie(). */
export function clearCookie(name: string, options: SessionCookieOptions): string {
  return serializeCookie(name, "", { ...options, maxAge: 0 });
}

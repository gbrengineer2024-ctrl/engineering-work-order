import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "line",
    role: "REPORTER",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: new Request("https://example.com/api/trpc/auth.logout"),
    responseCookies: [],
  };

  return { ctx };
}

describe("auth.logout", () => {
  it("clears the session cookie and reports success", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(ctx.responseCookies).toHaveLength(1);
    const cookie = ctx.responseCookies[0];
    expect(cookie).toContain(`${COOKIE_NAME}=`);
    expect(cookie).toContain("Max-Age=0");
    expect(cookie).toContain("Secure");
    expect(cookie).toContain("SameSite=None");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Path=/");
  });
});

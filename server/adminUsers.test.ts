import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "ADMIN" | "REPORTER" | "SUPERVISOR" | "TECHNICIAN", openId = "line-test-user") {
  return {
    user: {
      id: 99,
      openId,
      email: null,
      name: "Test User",
      loginMethod: "LINE",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: new Request("https://example.com"),
    responseCookies: [],
  } as TrpcContext;
}

describe("Admin Users API", () => {
  it("blocks non-admin users from viewing user accounts", async () => {
    const caller = appRouter.createCaller(contextFor("REPORTER"));
    await expect(caller.users.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("blocks an admin from suspending their own account", async () => {
    const caller = appRouter.createCaller(contextFor("ADMIN", "line-owner"));
    await expect(caller.users.update({ userId: "line-owner", values: { isActive: false } })).rejects.toThrow("SELF_ADMIN_PROTECTION");
  });

  it("blocks an admin from removing their own ADMIN role", async () => {
    const caller = appRouter.createCaller(contextFor("ADMIN", "line-owner"));
    await expect(caller.users.update({ userId: "line-owner", values: { roleCode: "REPORTER" } })).rejects.toThrow("SELF_ADMIN_PROTECTION");
  });

  it("validates that an update includes at least one changed field", async () => {
    const caller = appRouter.createCaller(contextFor("ADMIN"));
    await expect(caller.users.update({ userId: "line-another-user", values: {} })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("validates the search keyword before querying user data", async () => {
    const caller = appRouter.createCaller(contextFor("ADMIN"));
    await expect(caller.users.list({ search: "x".repeat(121) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

const dbMocks = vi.hoisted(() => ({
  completeLineProfile: vi.fn(),
  createWorkOrder: vi.fn(),
  getMaintenanceProfile: vi.fn(),
}));

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    completeLineProfile: dbMocks.completeLineProfile,
    createWorkOrder: dbMocks.createWorkOrder,
    getMaintenanceProfile: dbMocks.getMaintenanceProfile,
  };
});

import { appRouter } from "./routers";

function authenticatedContext(openId = "line-authenticated"): TrpcContext {
  return {
    user: {
      id: 88,
      openId,
      name: "ช่างทดสอบ",
      email: null,
      loginMethod: "LINE",
      role: "REPORTER",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: new Request("https://example.com"),
    responseCookies: [],
  };
}

describe("LINE profile registration and requester flow", () => {
  it("reports registration as required only when the authenticated LINE account has no maintenance profile", async () => {
    dbMocks.getMaintenanceProfile.mockResolvedValueOnce(null);
    const withoutProfile = appRouter.createCaller(authenticatedContext());
    await expect(withoutProfile.profile.me()).resolves.toEqual({ profile: null, needsRegistration: true });

    const profile = { userId: "line-authenticated", displayName: "คุณบอม", department: "ENGINEERING", roleCode: "REPORTER", isActive: true };
    dbMocks.getMaintenanceProfile.mockResolvedValueOnce(profile);
    const withProfile = appRouter.createCaller(authenticatedContext());
    await expect(withProfile.profile.me()).resolves.toEqual({ profile, needsRegistration: false });
  });

  it("validates required registration data before calling the database", async () => {
    const caller = appRouter.createCaller(authenticatedContext());
    await expect(caller.profile.completeRegistration({ displayName: "ก", department: "" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(dbMocks.completeLineProfile).not.toHaveBeenCalled();
  });

  it("binds the completed profile to the authenticated LINE user", async () => {
    dbMocks.completeLineProfile.mockResolvedValueOnce({ userId: "line-authenticated" });
    const caller = appRouter.createCaller(authenticatedContext());
    await caller.profile.completeRegistration({ displayName: "คุณบอม", department: "ENGINEERING" });
    expect(dbMocks.completeLineProfile).toHaveBeenCalledWith({
      userId: "line-authenticated",
      displayName: "คุณบอม",
      department: "ENGINEERING",
    });
  });

  it("trims registration data before binding it to the authenticated LINE user", async () => {
    dbMocks.completeLineProfile.mockResolvedValueOnce({ userId: "line-authenticated" });
    const caller = appRouter.createCaller(authenticatedContext());
    await caller.profile.completeRegistration({ displayName: "  คุณบอม  ", department: "  ENGINEERING  " });
    expect(dbMocks.completeLineProfile).toHaveBeenCalledWith({
      userId: "line-authenticated",
      displayName: "คุณบอม",
      department: "ENGINEERING",
    });
  });

  it("ignores a forged requesterUserId and uses the authenticated user for a work order", async () => {
    dbMocks.getMaintenanceProfile.mockResolvedValueOnce({ isActive: true, lineUserId: "U_REAL_LINE" });
    dbMocks.createWorkOrder.mockResolvedValueOnce({ woId: "WO-TEST" });
    const caller = appRouter.createCaller(authenticatedContext());
    await caller.workOrders.create({
      woId: "WO-TEST",
      requesterUserId: "forged-user",
      lineUserId: "forged-line-id",
      locationId: "LOC-001",
      categoryCode: "ELECTRICAL",
      priorityCode: "LOW",
      description: "ทดสอบการระบุผู้แจ้งจาก session",
    });
    expect(dbMocks.createWorkOrder).toHaveBeenCalledWith(expect.objectContaining({
      requesterUserId: "line-authenticated",
      lineUserId: "U_REAL_LINE",
      statusCode: "OPEN",
    }));
  });
});

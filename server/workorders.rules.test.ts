import { describe, expect, it } from "vitest";
import { appRouter, auditActor, canChangeStatus, canCreate, canEdit, canManage, canSetTechnicianAvailability, requiresAfterPhoto } from "./routers";
import { isWorkloadActive, nextWorkOrderId, technicianSyncPlan, workOrderDateSegment, workloadDelta } from "./db";
import type { TrpcContext } from "./_core/context";

type Role = "ADMIN" | "REPORTER" | "SUPERVISOR" | "TECHNICIAN";

function createContext(role: Role | null = null): TrpcContext {
  return {
    user: role ? { id: 1, openId: `test-${role}`, name: role, email: `${role.toLowerCase()}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("work order system contracts", () => {
  it("exposes the required English status lifecycle", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.access.statuses()).resolves.toEqual(["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_PARTS", "COMPLETED", "CLOSED"]);
  });

  it("exposes the required English role set", async () => {
    const caller = appRouter.createCaller(createContext());
    await expect(caller.access.roles()).resolves.toEqual(["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"]);
  });

  it("binds audit identity to ctx.user instead of client input", () => {
    expect(auditActor({ openId: "USER-REAL" }, "CLIENT-FORGED")).toBe("USER-REAL");
    expect(auditActor(null, "CLIENT-VALUE")).toBe("CLIENT-VALUE");
    expect(auditActor(null)).toBe("SYSTEM");
  });

  it("blocks protected mutation paths without an authenticated user", async () => {
    const caller = appRouter.createCaller(createContext());
    const base = { woId: "WO-AUTH", requesterUserId: "client", locationId: "LOC-001", categoryCode: "PLUMBING", priorityCode: "LOW", description: "Auth boundary check" };
    await expect(caller.workOrders.create(base)).rejects.toThrow();
    await expect(caller.workOrders.assign({ woId: "WO-AUTH", techId: "TECH-001", actorUserId: "client" })).rejects.toThrow();
    await expect(caller.workOrders.changeStatus({ woId: "WO-AUTH", toStatus: "IN_PROGRESS", actorUserId: "client" })).rejects.toThrow();
  });

  it("covers the create/edit/assignment permission matrix", () => {
    expect(canCreate(null)).toBe(false);
    expect(canCreate({ role: "REPORTER" })).toBe(true);
    expect(canCreate({ role: "TECHNICIAN" })).toBe(true);
    expect(canEdit({ role: "TECHNICIAN" })).toBe(true);
    expect(canEdit({ role: "REPORTER" })).toBe(true);
    expect(canManage({ role: "SUPERVISOR" })).toBe(true);
    expect(canManage({ role: "ADMIN" })).toBe(true);
    expect(canManage({ role: "REPORTER" })).toBe(false);
  });

  it("applies the intended permission matrix to parts and part issue operations", () => {
    // Requesting a part is available to every authenticated operational role.
    expect(canCreate({ role: "REPORTER" })).toBe(true);
    expect(canCreate({ role: "TECHNICIAN" })).toBe(true);
    expect(canCreate({ role: "SUPERVISOR" })).toBe(true);
    expect(canCreate({ role: "ADMIN" })).toBe(true);

    // Creating/editing stock and approving or issuing parts require management access.
    expect(canManage({ role: "ADMIN" })).toBe(true);
    expect(canManage({ role: "SUPERVISOR" })).toBe(true);
    expect(canManage({ role: "REPORTER" })).toBe(false);
    expect(canManage({ role: "TECHNICIAN" })).toBe(false);
    expect(canManage(null)).toBe(false);
  });

  it("rejects stock management and approval API calls from a reporter", async () => {
    const caller = appRouter.createCaller(createContext("REPORTER"));
    await expect(caller.parts.create({
      partCode: "P-001", partNameTh: "หลอดไฟ", categoryCode: "ELECTRICAL", unit: "ชิ้น", currentStockQty: 5, minStockQty: 1, reservedQty: 0, unitCostThb: 20,
    })).rejects.toThrow("FORBIDDEN");
    await expect(caller.parts.update({ partId: "P-001", values: { partNameTh: "หลอดไฟ LED" } })).rejects.toThrow("FORBIDDEN");
    await expect(caller.partIssues.approve({ issueId: "PI-001", qtyApproved: 1 })).rejects.toThrow("FORBIDDEN");
    await expect(caller.partIssues.issue({ issueId: "PI-001", qtyIssued: 1 })).rejects.toThrow("FORBIDDEN");
  });

  it("covers workload transitions assign → in-progress → completed/closed", () => {
    expect(isWorkloadActive("OPEN")).toBe(false);
    expect(isWorkloadActive("ASSIGNED")).toBe(true);
    expect(workloadDelta("OPEN", "ASSIGNED")).toBe(1);
    expect(workloadDelta("ASSIGNED", "IN_PROGRESS")).toBe(0);
    expect(workloadDelta("IN_PROGRESS", "COMPLETED")).toBe(-1);
    expect(workloadDelta("IN_PROGRESS", "CLOSED")).toBe(-1);
    expect(workloadDelta("IN_PROGRESS", "PENDING_PARTS")).toBe(-1);
    expect(workloadDelta("ASSIGNED", "OPEN")).toBe(-1);
    expect(workloadDelta("OPEN", "OPEN")).toBe(0);
  });

  it("covers status transition permissions including close", () => {
    expect(canChangeStatus({ role: "REPORTER" }, "IN_PROGRESS")).toBe(true);
    expect(canChangeStatus({ role: "TECHNICIAN" }, "COMPLETED")).toBe(true);
    expect(canChangeStatus({ role: "TECHNICIAN" }, "CLOSED")).toBe(false);
    expect(canChangeStatus({ role: "SUPERVISOR" }, "CLOSED")).toBe(true);
    expect(canChangeStatus({ role: "TECHNICIAN" }, "PENDING_PARTS")).toBe(true);
    expect(canChangeStatus({ role: "REPORTER" }, "PENDING_PARTS")).toBe(false);
    expect(canChangeStatus(null, "OPEN")).toBe(false);
  });

  it("requires an after-work photo only when completing a work order", () => {
    expect(requiresAfterPhoto("IN_PROGRESS")).toBe(false);
    expect(requiresAfterPhoto("COMPLETED")).toBe(true);
    expect(requiresAfterPhoto("CLOSED")).toBe(false);
    expect(requiresAfterPhoto("PENDING_PARTS")).toBe(false);
  });

  it("allows a technician to update only their own availability while supervisors and admins manage all technicians", () => {
    expect(canSetTechnicianAvailability({ openId: "line-tech-1", role: "TECHNICIAN" }, "line-tech-1")).toBe(true);
    expect(canSetTechnicianAvailability({ openId: "line-tech-1", role: "TECHNICIAN" }, "line-tech-2")).toBe(false);
    expect(canSetTechnicianAvailability({ openId: "line-supervisor", role: "SUPERVISOR" }, "line-tech-2")).toBe(true);
    expect(canSetTechnicianAvailability({ openId: "line-reporter", role: "REPORTER" }, "line-tech-2")).toBe(false);
  });

  it("creates a sequential work-order number on the Bangkok business date", () => {
    expect(workOrderDateSegment(new Date("2026-08-15T00:30:00.000Z"))).toBe("20260815");
    expect(nextWorkOrderId("WO-20260815", ["WO-20260815-0001", "WO-20260815-0009", "WO-20260814-9999"])).toBe("WO-20260815-0010");
  });

  it("creates or deactivates a technician record from the maintenance TECHNICIAN role", () => {
    expect(technicianSyncPlan({ userId: "line_tech-9", lineUserId: "tech-9", displayName: "ช่างบี", department: "Engineering", roleCode: "TECHNICIAN", isActive: true })).toEqual({ action: "UPSERT", techId: "line_tech-9", techName: "ช่างบี", teamCode: "Engineering", lineUserId: "tech-9", isActive: true });
    expect(technicianSyncPlan({ userId: "line_reporter-2", lineUserId: "reporter-2", displayName: "พนักงานเอ", department: "Front Office", roleCode: "REPORTER", isActive: true })).toEqual({ action: "DEACTIVATE", techId: "line_reporter-2" });
  });
});

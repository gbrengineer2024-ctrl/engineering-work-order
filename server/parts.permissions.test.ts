import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createPart: vi.fn().mockResolvedValue({ partId: "PART-TEST" }),
    updatePart: vi.fn().mockResolvedValue({ partId: "PART-TEST" }),
    requestPartIssue: vi.fn().mockResolvedValue({ issueId: "ISSUE-TEST" }),
    approvePartIssue: vi.fn().mockResolvedValue({ issueId: "ISSUE-TEST", issueStatus: "APPROVED" }),
    issuePart: vi.fn().mockResolvedValue({ issueId: "ISSUE-TEST", issueStatus: "ISSUED" }),
    getWorkOrder: vi.fn().mockImplementation(async (woId: string) => ({ workOrder: { woId, requesterUserId: "line-REPORTER", assignedTechId: "TECH-TEST" } })),
    getTechnicianIdForUser: vi.fn().mockResolvedValue("TECH-TEST"),
    listWorkOrders: vi.fn().mockResolvedValue([]),
    updateTechnicianAvailability: vi.fn().mockResolvedValue([]),
  };
});

import { appRouter } from "./routers";
import { approvePartIssue, createPart, getTechnicianIdForUser, getWorkOrder, issuePart, listWorkOrders, requestPartIssue, updatePart, updateTechnicianAvailability } from "./db";
import { canChangeStatus } from "./routers";

type Role = "ADMIN" | "REPORTER" | "SUPERVISOR" | "TECHNICIAN";
const managedPart = { partCode: "PART-TEST", partNameTh: "หลอดไฟ LED", categoryCode: "ELECTRICAL", unit: "ชิ้น", currentStockQty: 12, minStockQty: 2, reservedQty: 0, unitCostThb: 45 };

function createContext(role: Role | null): TrpcContext {
  return {
    user: role ? { id: 1, openId: `line-${role}`, name: role, email: `${role.toLowerCase()}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
    req: new Request("https://example.com"),
    responseCookies: [],
  };
}

describe("สิทธิ์ API คลังอะไหล่", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each<Role>(["ADMIN", "SUPERVISOR"])("อนุญาต %s สร้างและแก้ไขข้อมูลคลังอะไหล่", async role => {
    const caller = appRouter.createCaller(createContext(role));
    await expect(caller.parts.create(managedPart)).resolves.toEqual({ partId: "PART-TEST" });
    await expect(caller.parts.update({ partId: "PART-TEST", values: { minStockQty: 3 } })).resolves.toEqual({ partId: "PART-TEST" });
    expect(createPart).toHaveBeenCalledOnce();
    expect(updatePart).toHaveBeenCalledOnce();
  });

  it.each<Role>(["ADMIN", "SUPERVISOR"])("อนุญาต %s อนุมัติและจ่ายอะไหล่", async role => {
    const caller = appRouter.createCaller(createContext(role));
    await expect(caller.partIssues.approve({ issueId: "ISSUE-TEST", qtyApproved: 2 })).resolves.toMatchObject({ issueStatus: "APPROVED" });
    await expect(caller.partIssues.issue({ issueId: "ISSUE-TEST", qtyIssued: 2 })).resolves.toMatchObject({ issueStatus: "ISSUED" });
    expect(approvePartIssue).toHaveBeenCalledWith({ issueId: "ISSUE-TEST", qtyApproved: 2, approvedByUserId: `line-${role}` });
    expect(issuePart).toHaveBeenCalledWith({ issueId: "ISSUE-TEST", qtyIssued: 2 });
  });

  it.each<Role>(["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"])("อนุญาต %s ส่งคำขอเบิกอะไหล่", async role => {
    await expect(appRouter.createCaller(createContext(role)).partIssues.request({ woId: "WO-TEST", partId: "PART-TEST", qtyRequested: 1 })).resolves.toEqual({ issueId: "ISSUE-TEST" });
    expect(requestPartIssue).toHaveBeenCalledWith({ woId: "WO-TEST", partId: "PART-TEST", qtyRequested: 1, requestedByUserId: `line-${role}` });
  });

  it("ปฏิเสธผู้ใช้ที่ไม่มีสิทธิ์เข้าถึงใบงานจากการขอเบิกอะไหล่", async () => {
    vi.mocked(getWorkOrder).mockResolvedValueOnce({
      workOrder: { woId: "WO-OTHER", requesterUserId: "another-user", assignedTechId: null },
    } as any);
    const caller = appRouter.createCaller(createContext("REPORTER"));
    await expect(caller.partIssues.request({ woId: "WO-OTHER", partId: "PART-TEST", qtyRequested: 1 })).rejects.toThrow("FORBIDDEN");
    expect(requestPartIssue).not.toHaveBeenCalled();
  });

  it("ปฏิเสธผู้ใช้ทั่วไปเมื่อขอรายการเบิกทั้งหมดโดยไม่ระบุใบงาน", async () => {
    const caller = appRouter.createCaller(createContext("REPORTER"));
    await expect(caller.partIssues.list()).rejects.toThrow("WO_ID_REQUIRED");
  });

  it("อนุญาตช่างที่ผูกกับ techId ให้เปิดใบงานที่ได้รับมอบหมาย", async () => {
    const caller = appRouter.createCaller(createContext("TECHNICIAN"));
    await expect(caller.workOrders.detail({ woId: "WO-ASSIGNED" })).resolves.toMatchObject({
      workOrder: { assignedTechId: "TECH-TEST" },
    });
    expect(getTechnicianIdForUser).toHaveBeenCalledWith("line-TECHNICIAN");
  });

  it("กรองรายการใบงานของช่างด้วย techId ที่ผูกกับบัญชี", async () => {
    const caller = appRouter.createCaller(createContext("TECHNICIAN"));
    await caller.workOrders.list();
    expect(listWorkOrders).toHaveBeenCalledWith({ assignedTechId: "TECH-TEST" });
  });

  it("อนุญาตช่างเปลี่ยนสถานะเวรของตนเองด้วย techId", async () => {
    const caller = appRouter.createCaller(createContext("TECHNICIAN"));
    await expect(caller.technicians.setAvailability({ techId: "TECH-TEST", availabilityStatus: "ON_DUTY" })).resolves.toEqual([]);
    expect(updateTechnicianAvailability).toHaveBeenCalledWith("TECH-TEST", "ON_DUTY");
  });

  it("จำกัดการเปลี่ยนสถานะตามบทบาท", () => {
    expect(canChangeStatus({ role: "REPORTER" }, "ASSIGNED")).toBe(false);
    expect(canChangeStatus({ role: "REPORTER" }, "IN_PROGRESS")).toBe(false);
    expect(canChangeStatus({ role: "TECHNICIAN" }, "IN_PROGRESS")).toBe(true);
    expect(canChangeStatus({ role: "SUPERVISOR" }, "ASSIGNED")).toBe(true);
    expect(canChangeStatus({ role: "TECHNICIAN" }, "CLOSED")).toBe(false);
  });

  it("ปฏิเสธการขอเบิกเมื่อยังไม่ได้เข้าสู่ระบบ", async () => {
    await expect(appRouter.createCaller(createContext(null)).partIssues.request({ woId: "WO-TEST", partId: "PART-TEST", qtyRequested: 1 })).rejects.toThrow();
  });

  it.each<Role>(["REPORTER", "TECHNICIAN"])("ปฏิเสธ %s จาก API จัดการคลัง อนุมัติ และจ่ายอะไหล่", async role => {
    const caller = appRouter.createCaller(createContext(role));
    await expect(caller.parts.create(managedPart)).rejects.toThrow("FORBIDDEN");
    await expect(caller.parts.update({ partId: "PART-TEST", values: { minStockQty: 3 } })).rejects.toThrow("FORBIDDEN");
    await expect(caller.partIssues.approve({ issueId: "ISSUE-TEST", qtyApproved: 1 })).rejects.toThrow("FORBIDDEN");
    await expect(caller.partIssues.issue({ issueId: "ISSUE-TEST", qtyIssued: 1 })).rejects.toThrow("FORBIDDEN");
  });

  it("ปฏิเสธผู้ที่ยังไม่เข้าสู่ระบบจาก API จัดการคลังและรายการเบิก", async () => {
    const caller = appRouter.createCaller(createContext(null));
    await expect(caller.parts.create(managedPart)).rejects.toThrow();
    await expect(caller.parts.update({ partId: "PART-TEST", values: { minStockQty: 3 } })).rejects.toThrow();
    await expect(caller.partIssues.approve({ issueId: "ISSUE-TEST", qtyApproved: 1 })).rejects.toThrow();
    await expect(caller.partIssues.issue({ issueId: "ISSUE-TEST", qtyIssued: 1 })).rejects.toThrow();
  });
});

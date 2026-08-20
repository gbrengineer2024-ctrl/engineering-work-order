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
  };
});

import { appRouter } from "./routers";
import { approvePartIssue, createPart, issuePart, requestPartIssue, updatePart } from "./db";

type Role = "ADMIN" | "REPORTER" | "SUPERVISOR" | "TECHNICIAN";
const managedPart = { partCode: "PART-TEST", partNameTh: "หลอดไฟ LED", categoryCode: "ELECTRICAL", unit: "ชิ้น", currentStockQty: 12, minStockQty: 2, reservedQty: 0, unitCostThb: 45 };

function createContext(role: Role | null): TrpcContext {
  return {
    user: role ? { id: 1, openId: `line-${role}`, name: role, email: `${role.toLowerCase()}@example.com`, loginMethod: "test", role, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
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

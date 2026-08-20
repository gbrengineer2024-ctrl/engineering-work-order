import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    hasWorkOrderAttachmentType: vi.fn(),
    addStatusLog: vi.fn(),
    getWorkOrder: vi.fn(),
  };
});

import { appRouter } from "./routers";
import { addStatusLog, getWorkOrder, hasWorkOrderAttachmentType } from "./db";

function createTechnicianContext(): TrpcContext {
  return {
    user: { id: 1, openId: "line-tech-01", name: "ช่างหนึ่ง", email: "tech@example.com", loginMethod: "test", role: "TECHNICIAN", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: new Request("https://example.com"),
    responseCookies: [],
  };
}

const sampleWorkOrderDetail = {
  workOrder: { woId: "WO-AFTER-TEST", statusCode: "IN_PROGRESS", assignedTechId: "line-tech-01", requesterUserId: "line-reporter-01" },
  logs: [],
  attachments: [],
  notifications: [],
  requester: null,
} as never;

describe("รูปหลังงานก่อนปิดสถานะ COMPLETED", () => {
  const baseInput = { woId: "WO-AFTER-TEST", fromStatus: "IN_PROGRESS" as const, toStatus: "COMPLETED" as const, actorUserId: "client-supplied-id", comment: "ดำเนินการเสร็จแล้ว" };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getWorkOrder).mockResolvedValue(sampleWorkOrderDetail);
  });

  it("ปฏิเสธการเปลี่ยนเป็น COMPLETED เมื่อไม่มีรูป AFTER", async () => {
    vi.mocked(hasWorkOrderAttachmentType).mockResolvedValue(false);
    const caller = appRouter.createCaller(createTechnicianContext());

    await expect(caller.workOrders.changeStatus(baseInput)).rejects.toThrow("AFTER_PHOTO_REQUIRED");
    expect(hasWorkOrderAttachmentType).toHaveBeenCalledWith("WO-AFTER-TEST", "AFTER");
    expect(addStatusLog).not.toHaveBeenCalled();
  });

  it("อนุญาต COMPLETED เมื่อมีรูป AFTER และบันทึกตัวตนช่างจาก session", async () => {
    vi.mocked(hasWorkOrderAttachmentType).mockResolvedValue(true);
    vi.mocked(addStatusLog).mockResolvedValue({ woId: "WO-AFTER-TEST", statusCode: "COMPLETED" } as never);
    const caller = appRouter.createCaller(createTechnicianContext());

    await expect(caller.workOrders.changeStatus(baseInput)).resolves.toMatchObject({ statusCode: "COMPLETED" });
    expect(addStatusLog).toHaveBeenCalledWith(expect.objectContaining({ woId: "WO-AFTER-TEST", toStatus: "COMPLETED", actorUserId: "line-tech-01" }));
  });

  it("ไม่ต้องตรวจรูป AFTER เมื่อช่างเริ่มดำเนินงาน", async () => {
    vi.mocked(getWorkOrder).mockResolvedValue({
      ...sampleWorkOrderDetail,
      workOrder: { ...sampleWorkOrderDetail.workOrder, statusCode: "ASSIGNED" },
    } as never);
    vi.mocked(addStatusLog).mockResolvedValue({ woId: "WO-AFTER-TEST", statusCode: "IN_PROGRESS" } as never);
    const caller = appRouter.createCaller(createTechnicianContext());

    await expect(caller.workOrders.changeStatus({ ...baseInput, toStatus: "IN_PROGRESS" })).resolves.toMatchObject({ statusCode: "IN_PROGRESS" });
    expect(hasWorkOrderAttachmentType).not.toHaveBeenCalled();
  });
});

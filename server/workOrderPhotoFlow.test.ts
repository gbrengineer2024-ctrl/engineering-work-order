import { createWorkOrderWithBeforePhoto } from "../client/src/lib/workOrderPhotoFlow";
import { describe, expect, it, vi } from "vitest";

const draft = {
  locationId: "ROOM-101",
  categoryCode: "PLUMBING",
  priorityCode: "MEDIUM",
  description: "ท่อน้ำรั่วใต้ซิงก์",
  subCategory: "ท่อน้ำทิ้ง",
};

describe("การสร้างใบงานพร้อมรูปก่อนงาน", () => {
  it("ใช้เลขใบงานที่เซิร์ฟเวอร์สร้างเพื่อแนบรูปก่อนงาน", async () => {
    const uploads: string[] = [];
    const result = await createWorkOrderWithBeforePhoto({
      draft,
      uploadedBy: "line-user-1",
      beforePhotos: [{ fileName: "leak.jpg", mimeType: "image/jpeg", fileDataBase64: "data:image/jpeg;base64,abc" }],
      createWorkOrder: async values => {
        expect(values.woId).toBeUndefined();
        return { woId: "WO-20260814-00001" };
      },
      uploadAttachment: async values => { uploads.push(`${values.attachmentType}:${values.woId}:${values.fileName}`); },
    });

    expect(uploads).toEqual(["BEFORE:WO-20260814-00001:leak.jpg"]);
    expect(result).toEqual({ workOrderCreated: true, beforePhotosAttached: 1 });
  });

  it("อัปโหลดรูปก่อนงานทุกไฟล์ที่ผู้ใช้เลือก", async () => {
    const uploadAttachment = vi.fn();
    const result = await createWorkOrderWithBeforePhoto({
      draft,
      uploadedBy: "line-user-1",
      beforePhotos: [
        { fileName: "leak-a.jpg", mimeType: "image/jpeg", fileDataBase64: "a" },
        { fileName: "leak-b.jpg", mimeType: "image/jpeg", fileDataBase64: "b" },
      ],
      createWorkOrder: async () => ({ woId: "WO-20260814-00002" }),
      uploadAttachment,
    });

    expect(uploadAttachment).toHaveBeenCalledTimes(2);
    expect(uploadAttachment).toHaveBeenNthCalledWith(1, expect.objectContaining({ woId: "WO-20260814-00002", fileName: "leak-a.jpg" }));
    expect(uploadAttachment).toHaveBeenNthCalledWith(2, expect.objectContaining({ woId: "WO-20260814-00002", fileName: "leak-b.jpg" }));
    expect(result).toEqual({ workOrderCreated: true, beforePhotosAttached: 2 });
  });

  it("สร้างใบงานได้โดยไม่เรียกอัปโหลดเมื่อผู้ใช้ไม่แนบรูป", async () => {
    const uploadAttachment = vi.fn();
    const result = await createWorkOrderWithBeforePhoto({
      draft,
      uploadedBy: "line-user-1",
      beforePhotos: [],
      createWorkOrder: async () => ({ woId: "WO-20260814-00003" }),
      uploadAttachment,
    });

    expect(uploadAttachment).not.toHaveBeenCalled();
    expect(result).toEqual({ workOrderCreated: true, beforePhotosAttached: 0 });
  });

  it("หยุดและรายงานข้อผิดพลาดเมื่อเซิร์ฟเวอร์ไม่คืนเลขใบงานแต่มีรูปต้องอัปโหลด", async () => {
    await expect(createWorkOrderWithBeforePhoto({
      draft,
      uploadedBy: "line-user-1",
      beforePhotos: [{ fileName: "leak.jpg", mimeType: "image/jpeg", fileDataBase64: "abc" }],
      createWorkOrder: async () => undefined,
      uploadAttachment: async () => undefined,
    })).rejects.toThrow("WORK_ORDER_ID_REQUIRED");
  });
});

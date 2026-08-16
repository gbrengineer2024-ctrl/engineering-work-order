import { describe, expect, it } from "vitest";
import { getBeforePhotoValidationError, MAX_WORK_ORDER_PHOTO_BYTES } from "../client/src/lib/workOrderPhotos";

describe("รูปก่อนงานในฟอร์มสร้างใบงาน", () => {
  it("ยอมรับไฟล์รูปภาพที่ขนาดไม่เกิน 8 MB", () => {
    expect(getBeforePhotoValidationError({ type: "image/jpeg", size: MAX_WORK_ORDER_PHOTO_BYTES })).toBeNull();
  });

  it("ปฏิเสธไฟล์ที่ไม่ใช่รูปภาพ", () => {
    expect(getBeforePhotoValidationError({ type: "application/pdf", size: 1_024 })).toBe("กรุณาเลือกไฟล์รูปภาพเท่านั้น");
  });

  it("ปฏิเสธรูปภาพที่เกินขนาดสูงสุด", () => {
    expect(getBeforePhotoValidationError({ type: "image/png", size: MAX_WORK_ORDER_PHOTO_BYTES + 1 })).toBe("รูปภาพต้องมีขนาดไม่เกิน 8 MB");
  });
});

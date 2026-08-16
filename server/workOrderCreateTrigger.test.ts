import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
describe("การเชื่อมปุ่มสร้างใบงานแบบตรง", () => {
  it("ส่ง callback เปิดฟอร์มจาก ModernHome ไปยังหน้า operations โดยไม่มี click interception", () => {
    const source = readFileSync("client/src/pages/ModernHome.tsx", "utf8");
    expect(source).toContain("onCreateWorkOrder={() => setCreateOpen(true)}");
    expect(source).not.toContain("onClickCapture");
  });

  it("กำหนด onClick ให้ปุ่มสร้างใบงานและปุ่มคลังอะไหล่ในหน้า operations", () => {
    const source = readFileSync("client/src/pages/HotelOperationsHome.tsx", "utf8");
    expect(source).toContain("onClick={onCreateWorkOrder}");
    expect(source).toContain("onClick={onOpenPartsManager}");
    expect(source).not.toContain('data-create-work-order="true"');
  });
});

import { describe, expect, it } from "vitest";
import { inventoryAfterApproval } from "./db";

describe("กฎจำนวนคงเหลือของคลังอะไหล่", () => {
  it("หักสต็อกจริงทันทีเมื่ออนุมัติ และไม่กันยอดซ้ำ", () => {
    expect(inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, 4)).toEqual({
      currentStockQty: 8,
      reservedQty: 2,
      availableQty: 6,
    });
  });

  it("ไม่อนุมัติจำนวนที่มากกว่าสต็อกพร้อมใช้", () => {
    expect(() => inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, 11)).toThrow("INSUFFICIENT_STOCK");
  });

  it("ไม่ยอมรับจำนวนอนุมัติเป็นศูนย์หรือติดลบ", () => {
    expect(() => inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, 0)).toThrow("QTY_MUST_BE_POSITIVE");
    expect(() => inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, -1)).toThrow("QTY_MUST_BE_POSITIVE");
  });
});

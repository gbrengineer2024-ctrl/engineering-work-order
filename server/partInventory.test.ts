import { describe, expect, it } from "vitest";
import { inventoryAfterApproval, inventoryAfterIssuance } from "./db";

describe("กฎจำนวนคงเหลือของคลังอะไหล่", () => {
  it("กันจำนวนที่อนุมัติและลดจำนวนพร้อมใช้โดยไม่ลดสต็อกจริง", () => {
    expect(inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, 4)).toEqual({ currentStockQty: 12, reservedQty: 6, availableQty: 6 });
  });

  it("ไม่อนุมัติจำนวนที่มากกว่าสต็อกพร้อมใช้", () => {
    expect(() => inventoryAfterApproval({ currentStockQty: 12, reservedQty: 2, availableQty: 10 }, 11)).toThrow("INSUFFICIENT_STOCK");
  });

  it("ตัดสต็อกตามจำนวนที่จ่ายและคืนยอดกันไว้ส่วนที่ไม่ได้จ่าย", () => {
    expect(inventoryAfterIssuance({ currentStockQty: 12, reservedQty: 6 }, 4, 3)).toEqual({ currentStockQty: 9, reservedQty: 2, availableQty: 7 });
  });

  it("ไม่จ่ายเกินจำนวนที่อนุมัติ", () => {
    expect(() => inventoryAfterIssuance({ currentStockQty: 12, reservedQty: 6 }, 4, 5)).toThrow("INVALID_ISSUE_QTY");
  });
});

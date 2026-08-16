import { describe, expect, it } from "vitest";
import { selectWorkOrderDeepLinkTarget } from "../client/src/lib/workOrderDeepLink";

describe("selectWorkOrderDeepLinkTarget", () => {
  const woId = "WO-20260814-5215";
  const row = {} as HTMLElement;
  const button = {} as HTMLElement;

  it("เลือกปุ่มรายละเอียดแทนแถวตารางที่มีรหัสใบงานเดียวกัน", () => {
    const result = selectWorkOrderDeepLinkTarget([
      { kind: "row", text: `${woId} งานทดสอบ`, element: row },
      { kind: "button", text: `${woId} งานทดสอบ`, element: button },
    ], woId);

    expect(result?.element).toBe(button);
  });

  it("ไม่เลือก trigger เมื่อไม่มีรหัสใบงานในข้อความ", () => {
    const result = selectWorkOrderDeepLinkTarget([
      { kind: "button", text: "WO-OTHER", element: button },
    ], woId);

    expect(result).toBeNull();
  });
});

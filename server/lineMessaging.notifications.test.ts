import { describe, expect, it } from "vitest";
import { formatLineAssignmentMessage, formatLineCompletionMessage, getWorkOrderDeepLink, missingLineRecipientReason, resolveDispatchRecipient, resolveTechnicianLineRecipient } from "./lineMessaging";

describe("LINE event notification messages", () => {
  it("สร้างข้อความมอบหมายงานที่ระบุใบงาน พื้นที่ และรายละเอียดให้ช่าง", () => {
    expect(formatLineAssignmentMessage({
      woId: "WO-20260815-001",
      locationId: "ROOM-1705",
      description: "แอร์ไม่เย็น",
    })).toContain("[มอบหมายงาน] ใบงาน WO-20260815-001");
    expect(formatLineAssignmentMessage({
      woId: "WO-20260815-001",
      locationId: "ROOM-1705",
      description: "แอร์ไม่เย็น",
    })).toContain("พื้นที่: ROOM-1705");
    expect(formatLineAssignmentMessage({ woId: "WO-20260815-001", locationId: "ROOM-1705", description: "แอร์ไม่เย็น" })).toContain("https://hotelmaintai-e5vycneh.manus.space/?woId=WO-20260815-001");
  });

  it("สร้างข้อความงานเสร็จสำหรับผู้แจ้งพร้อมหมายเหตุเมื่อมี", () => {
    const text = formatLineCompletionMessage({
      woId: "WO-20260815-002",
      locationId: "LOBBY-01",
      comment: "เปลี่ยนอะไหล่และทดสอบแล้ว",
    });
    expect(text).toContain("[งานเสร็จสิ้น] ใบงาน WO-20260815-002");
    expect(text).toContain("หมายเหตุ: เปลี่ยนอะไหล่และทดสอบแล้ว");
    expect(text).toContain("เปิดใบงาน: https://hotelmaintai-e5vycneh.manus.space/?woId=WO-20260815-002");
  });

  it("ไม่แสดงส่วนหมายเหตุเมื่อผู้ปิดงานไม่ได้กรอกข้อความ", () => {
    const text = formatLineCompletionMessage({ woId: "WO-20260815-003", locationId: "POOL-01" });
    expect(text).not.toContain("หมายเหตุ:");
  });

  it("เลือก LINE user ID จากระเบียนช่างก่อนข้อมูลผู้ใช้ที่เชื่อมกัน", () => {
    expect(resolveTechnicianLineRecipient(" U-tech ", "U-linked")).toBe("U-tech");
  });

  it("fallback ไปยัง LINE user ID ของผู้ใช้ที่เชื่อมกับช่างเมื่อระเบียนช่างว่าง", () => {
    expect(resolveTechnicianLineRecipient(null, " U-linked ")).toBe("U-linked");
    expect(resolveTechnicianLineRecipient("   ", "U-linked")).toBe("U-linked");
  });

  it("ไม่เลือกผู้รับเมื่อทั้งระเบียนช่างและผู้ใช้ที่เชื่อมกันไม่มี LINE user ID", () => {
    expect(resolveTechnicianLineRecipient(null, " ")).toBeNull();
  });

  it("ระบุสาเหตุชัดเจนเมื่อช่างที่มอบหมายยังไม่ได้เชื่อม LINE Login", () => {
    expect(missingLineRecipientReason("ASSIGNED")).toContain("ช่างที่ได้รับมอบหมาย");
    expect(missingLineRecipientReason("ASSIGNED")).toContain("LINE User ID");
  });

  it("ใช้ User หรือ Group ID จากการตั้งค่าเป็นทางสำรองเฉพาะการแจ้งมอบหมายเมื่อช่างยังไม่มี LINE Login", () => {
    expect(resolveDispatchRecipient("ASSIGNED", null, "configured-group-id")).toEqual({ recipient: "configured-group-id", usedFallback: true });
    expect(resolveDispatchRecipient("COMPLETED", null, "configured-group-id")).toEqual({ recipient: "", usedFallback: false });
  });

  it("สร้าง deep link โดยเข้ารหัสรหัสใบงานก่อนใส่ใน URL", () => {
    expect(getWorkOrderDeepLink(" WO/2026 08 ")).toBe("https://hotelmaintai-e5vycneh.manus.space/?woId=WO%2F2026%2008");
  });
});

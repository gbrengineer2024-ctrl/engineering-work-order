import { describe, expect, it } from "vitest";
import { decryptLineValue, encryptLineValue, maskLineValue } from "./lineMessaging";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

describe("LINE integration secret protection", () => {
  it("encrypts Channel Access Token without preserving the original text", () => {
    const token = "test-channel-access-token-123456";
    const encrypted = encryptLineValue(token);

    expect(encrypted).not.toContain(token);
    expect(encrypted.split(".")).toHaveLength(3);
    expect(decryptLineValue(encrypted)).toBe(token);
  });

  it("uses a fresh initialization vector for each encrypted value", () => {
    const recipientId = "U0123456789abcdef0123456789abcdef";
    const first = encryptLineValue(recipientId);
    const second = encryptLineValue(recipientId);

    expect(first).not.toBe(second);
    expect(decryptLineValue(first)).toBe(recipientId);
    expect(decryptLineValue(second)).toBe(recipientId);
  });

  it("rejects malformed encrypted values", () => {
    expect(() => decryptLineValue("not-an-encrypted-value")).toThrow("รูปแบบข้อมูลการตั้งค่า LINE ไม่ถูกต้อง");
  });

  it("only exposes the final four characters in public status", () => {
    expect(maskLineValue("test-channel-token-7890")).toBe("••••••7890");
    expect(maskLineValue(null)).toBeNull();
  });

  it("blocks non-admin users before they can read LINE settings", async () => {
    const ctx = {
      user: {
        id: 2,
        openId: "staff-user",
        email: "staff@example.com",
        name: "Staff User",
        loginMethod: "manus",
        role: "STAFF",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
      },
      req: { protocol: "https", headers: {} },
      res: {},
    } as TrpcContext;

    const caller = appRouter.createCaller(ctx);
    await expect(caller.integrations.line.settings()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

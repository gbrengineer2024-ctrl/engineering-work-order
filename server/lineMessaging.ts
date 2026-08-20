import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { lineIntegrationSettings } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { getDb } from "./db";

const INTEGRATION_KEY = "LINE_MESSAGING";
const PUBLIC_APP_BASE_URL = "https://hotelmaintai-e5vycneh.manus.space";

type StoredSettings = {
  id: number;
  integrationKey: string;
  isEnabled: boolean;
  alertUrgent: boolean;
  alertOverdue: boolean;
  channelAccessTokenEncrypted: string | null;
  recipientIdEncrypted: string | null;
  updatedByUserId: string | null;
  lastTestAt: Date | null;
  lastDeliveryAt: Date | null;
  lastDeliveryStatus: string | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function encryptionKey() {
  if (!ENV.cookieSecret) throw new Error("ไม่พบคีย์ระบบสำหรับเข้ารหัสการตั้งค่า LINE");
  return createHash("sha256").update(ENV.cookieSecret).digest();
}

export function encryptLineValue(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

export function decryptLineValue(value: string) {
  const [ivText, tagText, encryptedText] = value.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("รูปแบบข้อมูลการตั้งค่า LINE ไม่ถูกต้อง");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function maskLineValue(value: string | null) {
  if (!value) return null;
  return `••••••${value.slice(-4)}`;
}

async function findSettings() {
  const db = await getDb();
  if (!db) throw new Error("ไม่สามารถเชื่อมต่อฐานข้อมูลได้");
  const [settings] = await db.select().from(lineIntegrationSettings).where(eq(lineIntegrationSettings.integrationKey, INTEGRATION_KEY)).limit(1);
  return { db, settings: settings as StoredSettings | undefined };
}

export async function getLineIntegrationPublicSettings() {
  const { settings } = await findSettings();
  if (!settings) return { configured: false, isEnabled: false, alertUrgent: true, alertOverdue: true, tokenMasked: null, recipientMasked: null, lastTestAt: null, lastDeliveryAt: null, lastDeliveryStatus: null, lastError: null };
  let tokenMasked: string | null = null;
  let recipientMasked: string | null = null;
  try {
    tokenMasked = maskLineValue(settings.channelAccessTokenEncrypted ? decryptLineValue(settings.channelAccessTokenEncrypted) : null);
    recipientMasked = maskLineValue(settings.recipientIdEncrypted ? decryptLineValue(settings.recipientIdEncrypted) : null);
  } catch {
    // Existing encrypted values may have been created with a rotated system key.
  }
  return {
    configured: Boolean(tokenMasked && recipientMasked),
    isEnabled: settings.isEnabled,
    alertUrgent: settings.alertUrgent,
    alertOverdue: settings.alertOverdue,
    tokenMasked,
    recipientMasked,
    lastTestAt: settings.lastTestAt,
    lastDeliveryAt: settings.lastDeliveryAt,
    lastDeliveryStatus: settings.lastDeliveryStatus,
    lastError: settings.lastError,
  };
}

export async function saveLineIntegrationSettings(input: { channelAccessToken?: string; recipientId?: string; isEnabled: boolean; alertUrgent: boolean; alertOverdue: boolean; updatedByUserId: string }) {
  const { db, settings } = await findSettings();
  const update: Record<string, unknown> = { isEnabled: input.isEnabled, alertUrgent: input.alertUrgent, alertOverdue: input.alertOverdue, updatedByUserId: input.updatedByUserId, updatedAt: new Date() };
  if (input.channelAccessToken?.trim()) update.channelAccessTokenEncrypted = encryptLineValue(input.channelAccessToken.trim());
  if (input.recipientId?.trim()) update.recipientIdEncrypted = encryptLineValue(input.recipientId.trim());
  if (!settings) {
    await db.insert(lineIntegrationSettings).values({ integrationKey: INTEGRATION_KEY, isEnabled: input.isEnabled, alertUrgent: input.alertUrgent, alertOverdue: input.alertOverdue, channelAccessTokenEncrypted: (update.channelAccessTokenEncrypted as string | undefined) ?? null, recipientIdEncrypted: (update.recipientIdEncrypted as string | undefined) ?? null, updatedByUserId: input.updatedByUserId });
  } else {
    await db.update(lineIntegrationSettings).set(update).where(eq(lineIntegrationSettings.id, settings.id));
  }
  return getLineIntegrationPublicSettings();
}

async function sendPushMessage(token: string, to: string, text: string) {
  const response = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ to, messages: [{ type: "text", text: text.slice(0, 5000) }] }),
  });
  if (!response.ok) throw new Error(`LINE API ตอบกลับ ${response.status}: ${(await response.text()).slice(0, 240)}`);
}

type LineDispatchKind = "TEST" | "URGENT" | "OVERDUE" | "ASSIGNED" | "COMPLETED";

export function missingLineRecipientReason(kind: LineDispatchKind) {
  if (kind === "ASSIGNED") return "ช่างที่ได้รับมอบหมายยังไม่มี LINE User ID จากการเข้าสู่ระบบ LINE";
  if (kind === "COMPLETED") return "ผู้แจ้งยังไม่มี LINE User ID จากการเข้าสู่ระบบ LINE";
  return "ไม่พบ LINE User ID ของผู้รับข้อความ";
}

export function resolveDispatchRecipient(kind: LineDispatchKind, recipientOverride: string | null | undefined, configuredRecipient: string) {
  const directRecipient = recipientOverride?.trim() ?? "";
  if (recipientOverride === undefined) return { recipient: configuredRecipient.trim(), usedFallback: false };
  if (directRecipient) return { recipient: directRecipient, usedFallback: false };
  if (kind === "ASSIGNED") return { recipient: configuredRecipient.trim(), usedFallback: Boolean(configuredRecipient.trim()) };
  return { recipient: "", usedFallback: false };
}

async function dispatch(kind: LineDispatchKind, text: string, recipientOverride?: string | null) {
  const { db, settings } = await findSettings();
  if (!settings) throw new Error("ยังไม่ได้ตั้งค่า LINE Messaging API");
  if (!settings.isEnabled && kind !== "TEST") return { sent: false, skipped: true, reason: "disabled" };
  if (kind === "URGENT" && !settings.alertUrgent) return { sent: false, skipped: true, reason: "urgent-disabled" };
  if (kind === "OVERDUE" && !settings.alertOverdue) return { sent: false, skipped: true, reason: "overdue-disabled" };
  try {
    const token = settings.channelAccessTokenEncrypted ? decryptLineValue(settings.channelAccessTokenEncrypted) : "";
    const configuredRecipient = settings.recipientIdEncrypted ? decryptLineValue(settings.recipientIdEncrypted) : "";
    const { recipient, usedFallback } = resolveDispatchRecipient(kind, recipientOverride, configuredRecipient);
    if (!recipient) {
      const reason = missingLineRecipientReason(kind);
      await db.update(lineIntegrationSettings).set({ lastDeliveryAt: new Date(), lastDeliveryStatus: "SKIPPED", lastError: reason }).where(eq(lineIntegrationSettings.id, settings.id));
      return { sent: false, skipped: true, reason };
    }
    if (!token) throw new Error("กรุณาระบุ Channel Access Token ก่อนส่งข้อความ");
    await sendPushMessage(token, recipient, text);
    await db.update(lineIntegrationSettings).set({ lastDeliveryAt: new Date(), lastDeliveryStatus: usedFallback ? "SENT_FALLBACK" : "SENT", lastError: null }).where(eq(lineIntegrationSettings.id, settings.id));
    return { sent: true, skipped: false, usedFallback };
  } catch (error) {
    const message = error instanceof Error ? error.message : "ไม่สามารถส่งข้อความ LINE ได้";
    await db.update(lineIntegrationSettings).set({ lastDeliveryAt: new Date(), lastDeliveryStatus: "FAILED", lastError: message.slice(0, 1000) }).where(eq(lineIntegrationSettings.id, settings.id));
    if (kind === "TEST") throw new Error(message);
    console.warn(`[LINE ${kind}] ${message}`);
    return { sent: false, skipped: false, reason: message };
  }
}

export async function testLineIntegration() {
  const result = await dispatch("TEST", "[ทดสอบระบบ] เชื่อมต่อ LINE Messaging API สำเร็จจากระบบศูนย์งานซ่อมบำรุงโรงแรม");
  return { ...result, testedAt: new Date() };
}

export async function sendLineUrgentAlert(woId: string, description: string) {
  return dispatch("URGENT", `[เร่งด่วน] ใบงาน ${woId}\n${description}`);
}

export async function sendLineOverdueAlert(woId: string, dueAt: Date | null) {
  const dueText = dueAt ? dueAt.toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }) : "ไม่ระบุวันครบกำหนด";
  return dispatch("OVERDUE", `[เกิน SLA] ใบงาน ${woId}\nครบกำหนด: ${dueText}\nกรุณาตรวจสอบและดำเนินการโดยเร็ว`);
}

export function formatLineAssignmentMessage(input: { woId: string; locationId: string; description: string }) {
  return `[มอบหมายงาน] ใบงาน ${input.woId}\nพื้นที่: ${input.locationId}\nรายละเอียด: ${input.description}\nกรุณาเปิดระบบเพื่อรับงานและอัปเดตสถานะ\nเปิดใบงาน: ${getWorkOrderDeepLink(input.woId)}`;
}

export function formatLineCompletionMessage(input: { woId: string; locationId: string; comment?: string | null }) {
  const note = input.comment?.trim() ? `\nหมายเหตุ: ${input.comment.trim()}` : "";
  return `[งานเสร็จสิ้น] ใบงาน ${input.woId}\nพื้นที่: ${input.locationId}\nช่างดำเนินงานเสร็จแล้ว กรุณาตรวจสอบผลการซ่อม${note}\nเปิดใบงาน: ${getWorkOrderDeepLink(input.woId)}`;
}

export function getWorkOrderDeepLink(woId: string) {
  return `${PUBLIC_APP_BASE_URL}/?woId=${encodeURIComponent(woId.trim())}`;
}

export function resolveTechnicianLineRecipient(technicianLineUserId?: string | null, linkedUserLineUserId?: string | null) {
  return technicianLineUserId?.trim() || linkedUserLineUserId?.trim() || null;
}

export async function sendLineAssignmentAlert(input: { woId: string; technicianLineUserId: string | null; locationId: string; description: string }) {
  return dispatch("ASSIGNED", formatLineAssignmentMessage(input), input.technicianLineUserId);
}

export async function sendLineCompletionAlert(input: { woId: string; requesterLineUserId: string | null; locationId: string; comment?: string | null }) {
  return dispatch("COMPLETED", formatLineCompletionMessage(input), input.requesterLineUserId);
}

import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { clearCookie, getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addAttachment, addStatusLog as changeStatusInDb, approvePartIssue, assignWorkOrder, completeLineProfile, createLocation, createPart, createTechnician, createWorkOrder, getDashboardStats, getGoogleDriveIntegrationSettings, getMaintenanceProfile, getWorkOrder, getTechnicianIdForUser, hasWorkOrderAttachmentType, issueConsumablePart, issuePart, listLocations, listLookups, listMaintenanceUsers, listNotifications, listPartIssues, listParts, listTechnicians, listWorkOrders, markNotificationRead, requestPartIssue, saveGoogleDriveIntegrationSettings, setWorkOrderPendingParts, updateLocation, updateMaintenanceUser, updatePart, updateTechnician, updateTechnicianAvailability, updateWorkOrder } from "./db";
import { getLineIntegrationPublicSettings, saveLineIntegrationSettings, testLineIntegration } from "./lineMessaging";
import { storagePut } from "./storage";
import { appsScriptStoragePut, appsScriptStoragePutPdfFromHtml } from "./googleAppsScript";
import { ENV } from "./_core/env";

const statusSchema = z.enum(["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_PARTS", "COMPLETED", "CLOSED"]);
const roleSchema = z.enum(["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"]);
const technicianAvailabilitySchema = z.enum(["ON_DUTY", "OFF_DUTY", "ON_LEAVE"]);
const dateInput = z.coerce.date().optional();
const actorSchema = z.string().min(1);
const googleDriveFolderUrlSchema = z.string().trim().url().max(500).refine(value => {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "drive.google.com" && /\/folders\//.test(url.pathname);
  } catch { return false; }
}, "ต้องเป็นลิงก์โฟลเดอร์ Google Drive ที่ปลอดภัย");
const googleDriveFolderIdSchema = z.string().trim().regex(/^[a-zA-Z0-9_-]{10,200}$/, "Folder ID ไม่ถูกต้อง");

function hasRole(user: { role?: string } | null, roles: string[]) { return Boolean(user?.role && roles.includes(user.role)); }
export function canCreate(user: { role?: string } | null) { return hasRole(user, ["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"]); }
export function auditActor(user: { openId?: string } | null, clientValue?: string) { return user?.openId ?? clientValue ?? "SYSTEM"; }
export function canManage(user: { role?: string } | null) { return hasRole(user, ["ADMIN", "SUPERVISOR"]); }
export function canEdit(user: { role?: string } | null) { return hasRole(user, ["REPORTER", "TECHNICIAN", "SUPERVISOR", "ADMIN"]); }
export function canSetWorkOrderCategory(user: { role?: string } | null) { return hasRole(user, ["TECHNICIAN", "SUPERVISOR", "ADMIN"]); }
export function canChangeStatus(user: { role?: string } | null, nextStatus: string) {
  if (!user) return false;
  if (nextStatus === "ASSIGNED" || nextStatus === "CLOSED") return hasRole(user, ["ADMIN", "SUPERVISOR"]);
  if (["IN_PROGRESS", "PENDING_PARTS", "COMPLETED"].includes(nextStatus)) return hasRole(user, ["TECHNICIAN", "SUPERVISOR", "ADMIN"]);
  return false;
}
export function requiresAfterPhoto(nextStatus: string) { return nextStatus === "COMPLETED"; }
export async function canSetTechnicianAvailability(user: { openId?: string; role?: string } | null, techId: string) {
  if (!user) return false;
  if (hasRole(user, ["ADMIN", "SUPERVISOR"])) return true;
  if (user.role !== "TECHNICIAN" || !user.openId) return false;
  return (await getTechnicianIdForUser(user.openId)) === techId;
}

function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function assertWorkOrderAccess(user: { openId: string; role?: string }, woId: string) {
  const detail = await getWorkOrder(woId);
  if (!detail) throw new Error("WORK_ORDER_NOT_FOUND");
  const order = detail.workOrder;
  if (hasRole(user, ["ADMIN", "SUPERVISOR"])) return detail;
  if (user.role === "REPORTER" && order.requesterUserId === user.openId) return detail;
  if (user.role === "TECHNICIAN" && order.assignedTechId === await getTechnicianIdForUser(user.openId)) return detail;
  throw new Error("FORBIDDEN");
}

const allowedTransitions: Record<string, string[]> = { OPEN: ["ASSIGNED", "IN_PROGRESS", "PENDING_PARTS"], ASSIGNED: ["IN_PROGRESS", "PENDING_PARTS"], IN_PROGRESS: ["PENDING_PARTS", "COMPLETED"], PENDING_PARTS: ["IN_PROGRESS", "COMPLETED"], COMPLETED: ["CLOSED"], CLOSED: [] };

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.responseCookies.push(clearCookie(COOKIE_NAME, cookieOptions));
      return { success: true } as const;
    }),
  }),
  profile: router({
    me: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getMaintenanceProfile(ctx.user.openId);
      return { profile: profile ?? null, needsRegistration: !profile };
    }),
    completeRegistration: protectedProcedure.input(z.object({ displayName: z.string().trim().min(2).max(160), department: z.string().trim().min(1).max(120) })).mutation(({ input, ctx }) => completeLineProfile({ userId: ctx.user.openId, displayName: input.displayName, department: input.department })),
  }),
  users: router({
    list: adminProcedure.input(z.object({ search: z.string().trim().max(120).optional() }).optional()).query(({ input }) => listMaintenanceUsers(input?.search)),
    update: adminProcedure.input(z.object({
      userId: z.string().min(1).max(64),
      values: z.object({
        displayName: z.string().trim().min(2).max(160).optional(),
        department: z.string().trim().max(120).nullable().optional(),
        roleCode: roleSchema.optional(),
        isActive: z.boolean().optional(),
        notes: z.string().trim().max(2000).nullable().optional(),
      }).refine(values => Object.keys(values).length > 0, "ต้องระบุข้อมูลที่ต้องการแก้ไขอย่างน้อยหนึ่งรายการ"),
    })).mutation(({ input, ctx }) => {
      const removesOwnAdminAccess = input.userId === ctx.user.openId && (input.values.isActive === false || (input.values.roleCode !== undefined && input.values.roleCode !== "ADMIN"));
      if (removesOwnAdminAccess) throw new Error("SELF_ADMIN_PROTECTION");
      return updateMaintenanceUser(input.userId, input.values);
    }),
  }),
  dashboard: router({ stats: protectedProcedure.query(() => getDashboardStats()) }),
  workOrders: router({
    list: protectedProcedure.input(z.object({ status: z.string().optional(), priority: z.string().optional(), category: z.string().optional(), location: z.string().optional(), from: dateInput, to: dateInput, search: z.string().optional() }).optional()).query(async ({ input, ctx }) => {
      const filters = { ...(input ?? {}) };
      if (ctx.user.role === "REPORTER") return listWorkOrders({ ...filters, requesterUserId: ctx.user.openId });
      if (ctx.user.role === "TECHNICIAN") {
        const techId = await getTechnicianIdForUser(ctx.user.openId);
        return techId ? listWorkOrders({ ...filters, assignedTechId: techId }) : [];
      }
      return listWorkOrders(filters);
    }),
    detail: protectedProcedure.input(z.object({ woId: z.string().min(1) })).query(({ input, ctx }) => assertWorkOrderAccess(ctx.user, input.woId)),
    create: protectedProcedure.input(z.object({ woId: z.string().optional(), requesterUserId: z.string().optional(), lineUserId: z.string().optional(), locationId: z.string().min(1), categoryCode: z.string().min(1).default("UNSPECIFIED"), subCategory: z.string().optional(), priorityCode: z.string().min(1), description: z.string().min(3), assignedTeam: z.string().optional(), slaHours: z.coerce.number().optional(), dueAt: z.coerce.date().optional(), sourceChannel: z.string().default("WEBAPP"), customerVisible: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      if (!canCreate(ctx.user)) throw new Error("FORBIDDEN");
      const profile = await getMaintenanceProfile(ctx.user.openId);
      if (!profile?.isActive) throw new Error("PROFILE_INCOMPLETE");
      return createWorkOrder({ ...input, woId: undefined, requesterUserId: ctx.user.openId, lineUserId: profile.lineUserId ?? undefined, categoryCode: input.categoryCode, slaHours: input.slaHours === undefined ? undefined : String(input.slaHours), statusCode: "OPEN" });
    }),
    update: protectedProcedure.input(z.object({ woId: z.string().min(1), values: z.object({ description: z.string().optional(), priorityCode: z.string().optional(), categoryCode: z.string().optional(), locationId: z.string().optional(), assignedTeam: z.string().nullable().optional(), costEstimateThb: z.coerce.number().nullable().optional(), actualCostThb: z.coerce.number().nullable().optional(), customerVisible: z.boolean().optional(), closeNote: z.string().nullable().optional() }) })).mutation(async ({ input, ctx }) => {
      if (!canEdit(ctx.user)) throw new Error("FORBIDDEN");
      await assertWorkOrderAccess(ctx.user, input.woId);
      if (input.values.categoryCode !== undefined && !canSetWorkOrderCategory(ctx.user)) throw new Error("FORBIDDEN");
      return updateWorkOrder(input.woId, input.values as any);
    }),
    assign: protectedProcedure.input(z.object({ woId: z.string().min(1), techId: z.string().nullable(), assignedTeam: z.string().nullable().optional(), actorUserId: actorSchema, comment: z.string().optional() })).mutation(({ input, ctx }) => canManage(ctx.user) ? assignWorkOrder({ ...input, actorUserId: auditActor(ctx.user, input.actorUserId) }) : Promise.reject(new Error("FORBIDDEN"))),
    changeStatus: protectedProcedure.input(z.object({ woId: z.string().min(1), fromStatus: statusSchema.nullable().optional(), toStatus: statusSchema, actorUserId: actorSchema, comment: z.string().optional(), nextAction: z.string().optional(), isCustomerVisible: z.boolean().default(false) })).mutation(async ({ input, ctx }) => {
      if (!canChangeStatus(ctx.user, input.toStatus)) throw new Error("FORBIDDEN");
      const detail=await assertWorkOrderAccess(ctx.user,input.woId);
      const currentStatus=detail.workOrder.statusCode;
      if(!allowedTransitions[currentStatus]?.includes(input.toStatus)) throw new Error(`INVALID_STATUS_TRANSITION:${currentStatus}->${input.toStatus}`);
      if (requiresAfterPhoto(input.toStatus) && !(await hasWorkOrderAttachmentType(input.woId, "AFTER"))) throw new Error("AFTER_PHOTO_REQUIRED");
      return changeStatusInDb({ logId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2,8)}`, ...input, actorUserId: auditActor(ctx.user, input.actorUserId), fromStatus: currentStatus });
    }),
    setPendingParts: protectedProcedure.input(z.object({ woId: z.string().min(1), comment: z.string().trim().max(2000).optional() })).mutation(async ({ input, ctx }) => {
      if (!canChangeStatus(ctx.user, "PENDING_PARTS")) throw new Error("FORBIDDEN");
      await assertWorkOrderAccess(ctx.user,input.woId);
      return setWorkOrderPendingParts({ ...input, actorUserId: auditActor(ctx.user) });
    }),
    createPendingPartsReportPdf: protectedProcedure.input(z.object({ woId: z.string().min(1) })).mutation(async ({ input, ctx }) => {
      if (!canChangeStatus(ctx.user, "PENDING_PARTS")) throw new Error("FORBIDDEN");
      const detail = await assertWorkOrderAccess(ctx.user, input.woId);
      if (detail.workOrder.statusCode !== "PENDING_PARTS") throw new Error("REPORT_REQUIRES_PENDING_PARTS_STATUS");
      const driveSettings = await getGoogleDriveIntegrationSettings();
      if (!driveSettings.isEnabled || !driveSettings.rootFolderId) throw new Error("กรุณาเปิด Google Drive และกำหนดโฟลเดอร์ปลายทางในเมนูตั้งค่าก่อนสร้าง PDF");
      if (!ENV.googleAppsScriptUrl || !ENV.googleAppsScriptToken) throw new Error("Google Drive ยังไม่ได้ตั้งค่า Apps Script: GOOGLE_APPS_SCRIPT_URL และ GOOGLE_APPS_SCRIPT_TOKEN");
      const [issueRows, locationRows, technicianRows] = await Promise.all([
        listPartIssues({ woId: input.woId }),
        listLocations(),
        listTechnicians(),
      ]);
      const order = detail.workOrder;
      const locationName = locationRows.find(location => location.locationId === order.locationId)?.areaName ?? order.locationId;
      const technicianName = technicianRows.find(technician => technician.techId === order.assignedTechId)?.techName ?? "ยังไม่มอบหมาย";
      const issueHtml = issueRows.length
        ? issueRows.map(issue => `<tr><td>${escapeHtml(issue.partCode)}</td><td>${escapeHtml(issue.partNameTh)}</td><td class="num">${issue.qtyRequested} ${escapeHtml(issue.unit)}</td><td class="num">${issue.qtyApproved} ${escapeHtml(issue.unit)}</td><td class="num">${issue.qtyIssued} ${escapeHtml(issue.unit)}</td><td>${escapeHtml(issue.issueStatus)}</td></tr>`).join("")
        : "<tr><td colspan=\"6\" class=\"empty\">ยังไม่มีรายการขอเบิกอะไหล่</td></tr>";
      const reportDate = new Date().toLocaleDateString("th-TH");
      const workDate = new Date(order.createdAt).toLocaleDateString("th-TH");
      const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><style>
        @page{size:A4;margin:18mm 16mm}
        *{box-sizing:border-box}
        body{font-family:Arial,"Noto Sans Thai",sans-serif;color:#171717;margin:0;font-size:11pt;line-height:1.5}
        .top{display:flex;justify-content:space-between;align-items:flex-start;gap:24px;padding-bottom:16px;border-bottom:1px solid #999}
        .hotel{font-size:16pt;font-weight:700;margin:0 0 4px}
        .department{font-size:11pt;margin:0;color:#333}
        .doc-title{text-align:right;font-size:15pt;font-weight:700;white-space:nowrap}
        .doc-date{text-align:right;margin-top:4px;font-size:10pt}
        .meta{display:grid;grid-template-columns:1fr 1fr;column-gap:24px;row-gap:8px;margin:24px 0 18px}
        .meta-row{display:flex;gap:5px;min-width:0}
        .meta-label{white-space:nowrap}
        .meta-value{font-weight:500;overflow-wrap:anywhere}
        .job-title{font-size:12pt;font-weight:700;margin:8px 0 10px}
        .job-details{border-top:1px solid #999;padding-top:10px;min-height:46px;white-space:pre-wrap;overflow-wrap:anywhere}
        .status{display:inline-block;margin-top:16px;padding:4px 10px;border-radius:3px;background:#fff0df;color:#9a3412;font-size:9pt;font-weight:700}
        .parts-title{font-size:12pt;font-weight:700;margin:22px 0 8px}
        table{border-collapse:collapse;width:100%;table-layout:fixed;margin-top:8px}
        th,td{border:1px solid #b8c0c8;padding:8px 7px;text-align:left;font-size:9pt;overflow-wrap:anywhere}
        th{background:#f1f3f5;font-weight:700}
        td.num{text-align:center}
        .empty{text-align:center;color:#666;padding:16px}
        footer{margin-top:26px;padding-top:8px;border-top:1px solid #ddd;color:#777;font-size:8pt}
        @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
      </style></head><body>
        <header class="top">
          <div><p class="hotel">Tara Bangkok Riverside</p><p class="department">Engineering Department</p></div>
          <div><div class="doc-title">MAINTENANCE WORK ORDER</div><div class="doc-date">Date : ${escapeHtml(reportDate)}</div></div>
        </header>
        <section class="meta">
          <div class="meta-row"><span class="meta-label">Rooms or Locations :</span><span class="meta-value">${escapeHtml(locationName)}</span></div>
          <div class="meta-row"><span class="meta-label">Technician :</span><span class="meta-value">${escapeHtml(technicianName)}</span></div>
          <div class="meta-row"><span class="meta-label">Status :</span><span class="meta-value">Pending Parts</span></div>
          <div class="meta-row"><span class="meta-label">Work Type :</span><span class="meta-value">${escapeHtml(order.categoryCode ?? "—")}</span></div>
        </section>
        <h2 class="job-title">Job Details</h2>
        <div class="job-details">${escapeHtml(order.description)}</div>
        <div class="meta-row" style="margin-top:10px"><span class="meta-label">Work Order :</span><span class="meta-value">${escapeHtml(order.woId)}</span></div>
        <div class="meta-row"><span class="meta-label">Date Opened :</span><span class="meta-value">${escapeHtml(workDate)}</span></div>
        <div class="status">รออะไหล่ / PENDING PARTS</div>
        <h2 class="parts-title">รายการอะไหล่ / วัสดุที่ขอเบิก</h2>
        <table><thead><tr><th style="width:14%">รหัส</th><th style="width:25%">รายการ</th><th style="width:14%">ขอเบิก</th><th style="width:14%">อนุมัติ</th><th style="width:14%">จ่ายแล้ว</th><th style="width:19%">สถานะ</th></tr></thead><tbody>${issueHtml}</tbody></table>
        <footer>เอกสารนี้สร้างจากระบบแจ้งซ่อมโดยอัตโนมัติ · Report Date : ${escapeHtml(reportDate)}</footer>
      </body></html>`;
      const stored = await appsScriptStoragePutPdfFromHtml(`pending-parts-${order.woId}-${Date.now()}`, html, driveSettings.rootFolderId);
      return { url: stored.url, fileName: `pending-parts-${order.woId}.pdf` };
    }),
    uploadAttachment: protectedProcedure.input(z.object({ woId: z.string().min(1), attachmentType: z.enum(["BEFORE", "AFTER", "OTHER"]).default("OTHER"), fileName: z.string().min(1).max(255), mimeType: z.string().min(1).max(120), fileDataBase64: z.string().min(1), uploadedBy: actorSchema })).mutation(async ({ input, ctx }) => {
      if (!canEdit(ctx.user)) throw new Error("FORBIDDEN");
      await assertWorkOrderAccess(ctx.user,input.woId);
      if (input.attachmentType !== "OTHER" && !input.mimeType.startsWith("image/")) throw new Error("PHOTO_MUST_BE_IMAGE");
      const rawBase64 = input.fileDataBase64.replace(/^data:[^;]+;base64,/, "");
      const bytes = Buffer.from(rawBase64, "base64");
      if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Attachment exceeds 8MB limit");
      const storageKey = `work-orders/${input.woId}/${Date.now()}-${input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const driveSettings = await getGoogleDriveIntegrationSettings();
      const stored = driveSettings.isEnabled && driveSettings.rootFolderId
        ? await appsScriptStoragePut(storageKey, bytes, input.mimeType, driveSettings.rootFolderId)
        : await storagePut(storageKey, bytes, input.mimeType);
      return addAttachment({ attachmentId: `ATT-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, woId: input.woId, attachmentType: input.attachmentType, fileName: input.fileName, fileUrl: stored.url, mimeType: input.mimeType, fileSize: bytes.byteLength, uploadedBy: auditActor(ctx.user, input.uploadedBy), createdAt: new Date() });
    }),
  }),
  locations: router({
    list: publicProcedure.query(() => listLocations()),
    create: protectedProcedure.input(z.object({ locationId: z.string().min(1), areaName: z.string().min(1), areaType: z.string().min(1), qrCode: z.string().min(1), building: z.string().optional(), floor: z.string().optional(), roomNo: z.string().optional(), notes: z.string().optional() })).mutation(({ input, ctx }) => canManage(ctx.user) ? createLocation({ ...input, propertyCode: "HOTEL01", isGuestArea: Boolean(input.roomNo), isActive: true }) : Promise.reject(new Error("FORBIDDEN"))),
    update: protectedProcedure.input(z.object({ locationId: z.string().min(1), values: z.object({ areaName: z.string().optional(), areaType: z.string().optional(), building: z.string().nullable().optional(), floor: z.string().nullable().optional(), roomNo: z.string().nullable().optional(), notes: z.string().nullable().optional(), isActive: z.boolean().optional() }) })).mutation(({ input, ctx }) => canManage(ctx.user) ? updateLocation(input.locationId, input.values) : Promise.reject(new Error("FORBIDDEN"))),
  }),
  technicians: router({
    list: protectedProcedure.query(() => listTechnicians()),
    create: protectedProcedure.input(z.object({ techId: z.string().min(1), techName: z.string().min(1), teamCode: z.string().min(1), skills: z.string().optional(), shiftCode: z.string().optional(), phone: z.string().optional(), maxOpenJobs: z.coerce.number().int().positive().default(5) })).mutation(({ input, ctx }) => canManage(ctx.user) ? createTechnician({ ...input, isActive: true, availabilityStatus: "OFF_DUTY", currentOpenJobs: 0 }) : Promise.reject(new Error("FORBIDDEN"))),
    update: protectedProcedure.input(z.object({ techId: z.string().min(1), values: z.object({ techName: z.string().optional(), teamCode: z.string().optional(), skills: z.string().nullable().optional(), shiftCode: z.string().nullable().optional(), phone: z.string().nullable().optional(), maxOpenJobs: z.coerce.number().int().positive().optional(), isActive: z.boolean().optional() }) })).mutation(({ input, ctx }) => canManage(ctx.user) ? updateTechnician(input.techId, input.values) : Promise.reject(new Error("FORBIDDEN"))),
    setAvailability: protectedProcedure.input(z.object({ techId: z.string().min(1), availabilityStatus: technicianAvailabilitySchema })).mutation(async ({ input, ctx }) => (await canSetTechnicianAvailability(ctx.user, input.techId)) ? updateTechnicianAvailability(input.techId, input.availabilityStatus) : Promise.reject(new Error("FORBIDDEN"))),
  }),
  lookups: router({ list: publicProcedure.input(z.object({ type: z.string().optional() }).optional()).query(({ input }) => listLookups(input?.type)) }),
  parts: router({
    list: protectedProcedure.input(z.object({ search: z.string().optional(), category: z.string().optional(), lowStockOnly: z.boolean().optional() }).optional()).query(({ input }) => listParts(input ?? {})),
    create: protectedProcedure.input(z.object({ partCode: z.string().trim().min(1).max(80), partNameTh: z.string().trim().min(1).max(200), partNameEn: z.string().trim().max(200).nullable().optional(), categoryCode: z.string().trim().min(1).max(60), unit: z.string().trim().min(1).max(20), brandModel: z.string().trim().max(200).nullable().optional(), supplierName: z.string().trim().max(200).nullable().optional(), storageLocation: z.string().trim().max(80).nullable().optional(), minStockQty: z.coerce.number().int().min(0).default(0), currentStockQty: z.coerce.number().int().min(0).default(0), reservedQty: z.coerce.number().int().min(0).default(0), unitCostThb: z.coerce.number().min(0).default(0), reorderLeadDays: z.coerce.number().int().min(0).default(0), notes: z.string().trim().max(2000).nullable().optional() })).mutation(({ input, ctx }) => {
      if (!canManage(ctx.user)) throw new Error("FORBIDDEN");
      if (input.reservedQty > input.currentStockQty) throw new Error("RESERVED_QTY_EXCEEDS_STOCK");
      return createPart({ ...input, partId: `PART-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, unitCostThb: String(input.unitCostThb), isActive: true });
    }),
    update: protectedProcedure.input(z.object({ partId: z.string().min(1), values: z.object({ partNameTh: z.string().trim().min(1).max(200).optional(), partNameEn: z.string().trim().max(200).nullable().optional(), categoryCode: z.string().trim().min(1).max(60).optional(), unit: z.string().trim().min(1).max(20).optional(), brandModel: z.string().trim().max(200).nullable().optional(), supplierName: z.string().trim().max(200).nullable().optional(), storageLocation: z.string().trim().max(80).nullable().optional(), minStockQty: z.coerce.number().int().min(0).optional(), currentStockQty: z.coerce.number().int().min(0).optional(), reservedQty: z.coerce.number().int().min(0).optional(), unitCostThb: z.coerce.number().min(0).optional(), reorderLeadDays: z.coerce.number().int().min(0).optional(), notes: z.string().trim().max(2000).nullable().optional(), isActive: z.boolean().optional() }).refine(values => Object.keys(values).length > 0, "ต้องระบุข้อมูลที่ต้องการแก้ไข") })).mutation(({ input, ctx }) => canManage(ctx.user) ? updatePart(input.partId, { ...input.values, unitCostThb: input.values.unitCostThb === undefined ? undefined : String(input.values.unitCostThb) } as any) : Promise.reject(new Error("FORBIDDEN"))),
  }),
  partIssues: router({
    list: protectedProcedure.input(z.object({ woId: z.string().optional(), status: z.string().optional() }).optional()).query(async ({ input, ctx }) => {
      if (input?.woId) await assertWorkOrderAccess(ctx.user, input.woId);
      else if (!canManage(ctx.user)) throw new Error("WO_ID_REQUIRED");
      return listPartIssues(input ?? {});
    }),
    request: protectedProcedure.input(z.object({ woId: z.string().min(1), partId: z.string().min(1), qtyRequested: z.coerce.number().int().positive(), notes: z.string().trim().max(2000).nullable().optional() })).mutation(async ({ input, ctx }) => {
      if (!canCreate(ctx.user)) throw new Error("FORBIDDEN");
      await assertWorkOrderAccess(ctx.user, input.woId);
      return requestPartIssue({ ...input, requestedByUserId: ctx.user.openId });
    }),
    approve: protectedProcedure.input(z.object({ issueId: z.string().min(1), qtyApproved: z.coerce.number().int().positive() })).mutation(({ input, ctx }) => canManage(ctx.user) ? approvePartIssue({ ...input, approvedByUserId: ctx.user.openId }) : Promise.reject(new Error("FORBIDDEN"))),
    issue: protectedProcedure.input(z.object({ issueId: z.string().min(1), qtyIssued: z.coerce.number().int().positive() })).mutation(({ input, ctx }) => canManage(ctx.user) ? issuePart(input) : Promise.reject(new Error("FORBIDDEN"))),
    issueConsumable: protectedProcedure.input(z.object({ issueId: z.string().min(1), qtyIssued: z.coerce.number().int().positive() })).mutation(({ input, ctx }) => canManage(ctx.user) ? issueConsumablePart({ ...input, issuedByUserId: auditActor(ctx.user) }) : Promise.reject(new Error("FORBIDDEN"))),
  }),
  notifications: router({
    list: protectedProcedure.query(({ ctx }) => listNotifications(ctx.user.openId)),
    markRead: protectedProcedure.input(z.object({ notificationId: z.string().min(1) })).mutation(({ input, ctx }) => markNotificationRead(input.notificationId, ctx.user.openId)),
  }),
  integrations: router({
    line: router({
      settings: adminProcedure.query(() => getLineIntegrationPublicSettings()),
      save: adminProcedure.input(z.object({
        channelAccessToken: z.string().max(1200).optional(),
        recipientId: z.string().max(160).optional(),
        isEnabled: z.boolean(),
        alertUrgent: z.boolean(),
        alertOverdue: z.boolean(),
      })).mutation(({ input, ctx }) => saveLineIntegrationSettings({ ...input, updatedByUserId: auditActor(ctx.user) })),
      test: adminProcedure.mutation(() => testLineIntegration()),
    }),
    googleDrive: router({
      settings: adminProcedure.query(async () => ({ ...(await getGoogleDriveIntegrationSettings()), credentialsConfigured: Boolean(ENV.googleAppsScriptUrl && ENV.googleAppsScriptToken) })),
      save: adminProcedure.input(z.object({
        isEnabled: z.boolean(),
        rootFolderId: googleDriveFolderIdSchema.nullable().optional(),
        rootFolderUrl: googleDriveFolderUrlSchema.nullable().optional(),
      }).superRefine((value, ctx) => {
        if (value.isEnabled && !value.rootFolderId?.trim()) {
          ctx.addIssue({ code: "custom", path: ["rootFolderId"], message: "ต้องระบุ Folder ID เมื่อเปิดใช้งานการอ้างอิง Google Drive" });
        }
        if (value.rootFolderUrl && value.rootFolderId && !value.rootFolderUrl.includes(value.rootFolderId)) {
          ctx.addIssue({ code: "custom", path: ["rootFolderUrl"], message: "ลิงก์และ Folder ID ต้องอ้างอิงโฟลเดอร์เดียวกัน" });
        }
      })).mutation(({ input, ctx }) => saveGoogleDriveIntegrationSettings({
        ...input,
        rootFolderId: input.rootFolderId?.trim() || null,
        rootFolderUrl: input.rootFolderUrl?.trim() || null,
        updatedByUserId: auditActor(ctx.user),
      })),
    }),
  }),
  access: router({ roles: publicProcedure.query(() => roleSchema.options), statuses: publicProcedure.query(() => statusSchema.options) }),
});

export type AppRouter = typeof appRouter;

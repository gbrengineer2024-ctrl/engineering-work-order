import { and, desc, eq, gte, like, lte, or, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { InsertUser, attachments, googleDriveIntegrationSettings, locations, lookups, maintenanceUsers, notifications, partIssues, parts, statusLogs, technicians, users, workOrders } from "../drizzle/schema";

// D1 is bound per-Worker via wrangler.toml ([[d1_databases]] binding = "DB").
// bindDatabase() is called once at the start of every request (see server/index.ts)
// so the rest of this file can keep calling getDb() exactly as before.
let _db: ReturnType<typeof drizzle> | null = null;

export function bindDatabase(d1: D1Database) {
  _db = drizzle(d1);
}

export async function getDb() {
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  for (const field of ["name", "email", "loginMethod"] as const) {
    if (user[field] !== undefined) { values[field] = user[field] ?? null; updateSet[field] = user[field] ?? null; }
  }
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) { values.role = user.role; updateSet.role = values.role; }
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getMaintenanceProfile(userId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(maintenanceUsers).where(eq(maintenanceUsers.userId, userId)).limit(1);
  return result[0];
}

export async function touchLineProfile(userId: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(maintenanceUsers).set({ lastLoginAt: new Date() }).where(eq(maintenanceUsers.userId, userId));
}

export async function completeLineProfile(input: { userId: string; displayName: string; department: string; pictureUrl?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const lineUserId = input.userId.startsWith("line_") ? input.userId.slice(5) : null;
  await db.insert(maintenanceUsers).values({
    userId: input.userId,
    lineUserId,
    displayName: input.displayName,
    department: input.department,
    pictureUrl: input.pictureUrl ?? null,
    roleCode: "REPORTER",
    isActive: true,
    lastLoginAt: new Date(),
    consentVersion: "LINE-LOGIN-2026-08",
  }).onConflictDoUpdate({ target: maintenanceUsers.userId, set: { displayName: input.displayName, department: input.department, lastLoginAt: new Date() } });
  return getMaintenanceProfile(input.userId);
}

export async function listMaintenanceUsers(search?: string) {
  const db = await getDb();
  if (!db) return [];
  const keyword = search?.trim();
  const filter = keyword ? or(
    like(maintenanceUsers.displayName, `%${keyword}%`),
    like(maintenanceUsers.department, `%${keyword}%`),
    like(maintenanceUsers.lineUserId, `%${keyword}%`),
    like(maintenanceUsers.userId, `%${keyword}%`),
  ) : undefined;
  return db.select({
    userId: maintenanceUsers.userId,
    lineUserId: maintenanceUsers.lineUserId,
    employeeId: maintenanceUsers.employeeId,
    displayName: maintenanceUsers.displayName,
    pictureUrl: maintenanceUsers.pictureUrl,
    department: maintenanceUsers.department,
    roleCode: maintenanceUsers.roleCode,
    isActive: maintenanceUsers.isActive,
    notes: maintenanceUsers.notes,
    lastLoginAt: maintenanceUsers.lastLoginAt,
    createdAt: maintenanceUsers.createdAt,
    systemRole: users.role,
  }).from(maintenanceUsers)
    .leftJoin(users, eq(maintenanceUsers.userId, users.openId))
    .where(filter)
    .orderBy(desc(maintenanceUsers.lastLoginAt), desc(maintenanceUsers.createdAt));
}

export async function updateMaintenanceUser(userId: string, values: { displayName?: string; department?: string | null; roleCode?: "ADMIN" | "REPORTER" | "SUPERVISOR" | "TECHNICIAN"; isActive?: boolean; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const maintenanceValues: Record<string, unknown> = {};
  if (values.displayName !== undefined) maintenanceValues.displayName = values.displayName;
  if (values.department !== undefined) maintenanceValues.department = values.department;
  if (values.roleCode !== undefined) maintenanceValues.roleCode = values.roleCode;
  if (values.isActive !== undefined) maintenanceValues.isActive = values.isActive;
  if (values.notes !== undefined) maintenanceValues.notes = values.notes;
  if (Object.keys(maintenanceValues).length) await db.update(maintenanceUsers).set(maintenanceValues as any).where(eq(maintenanceUsers.userId, userId));

  const systemValues: Record<string, unknown> = {};
  if (values.displayName !== undefined) systemValues.name = values.displayName;
  if (values.roleCode !== undefined) systemValues.role = values.roleCode;
  if (Object.keys(systemValues).length) await db.update(users).set(systemValues as any).where(eq(users.openId, userId));
  const profile = await getMaintenanceProfile(userId);
  if (profile) await syncTechnicianFromMaintenanceProfile(profile);
  return profile;
}

export function technicianSyncPlan(profile: { userId: string; lineUserId: string | null; displayName: string; department: string | null; roleCode: string; isActive: boolean }) {
  return profile.roleCode === "TECHNICIAN"
    ? { action: "UPSERT" as const, techId: profile.userId, techName: profile.displayName, teamCode: profile.department?.trim() || "MAINTENANCE", lineUserId: profile.lineUserId, isActive: profile.isActive }
    : { action: "DEACTIVATE" as const, techId: profile.userId };
}

export async function syncTechnicianFromMaintenanceProfile(profile: NonNullable<Awaited<ReturnType<typeof getMaintenanceProfile>>>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const plan = technicianSyncPlan(profile);
  if (plan.action === "DEACTIVATE") {
    await db.update(technicians).set({ isActive: false }).where(eq(technicians.userId, plan.techId));
    return;
  }
  await db.insert(technicians).values({
    techId: plan.techId,
    userId: profile.userId,
    techName: plan.techName,
    teamCode: plan.teamCode,
    lineUserId: plan.lineUserId,
    isActive: plan.isActive,
    maxOpenJobs: 5,
    currentOpenJobs: 0,
  }).onConflictDoUpdate({ target: technicians.techId, set: {
    techName: plan.techName,
    teamCode: plan.teamCode,
    lineUserId: plan.lineUserId,
    isActive: plan.isActive,
  } });
}

export async function listWorkOrders(filters: { status?: string; priority?: string; category?: string; location?: string; from?: Date; to?: Date; search?: string; requesterUserId?: string; assignedTechId?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.status) conditions.push(eq(workOrders.statusCode, filters.status as any));
  if (filters.priority) conditions.push(eq(workOrders.priorityCode, filters.priority));
  if (filters.category) conditions.push(eq(workOrders.categoryCode, filters.category));
  if (filters.location) conditions.push(eq(workOrders.locationId, filters.location));
  if (filters.from) conditions.push(gte(workOrders.createdAt, filters.from));
  if (filters.to) conditions.push(lte(workOrders.createdAt, filters.to));
  if (filters.search) conditions.push(or(like(workOrders.woId, `%${filters.search}%`), like(workOrders.description, `%${filters.search}%`)));
  if (filters.requesterUserId) conditions.push(eq(workOrders.requesterUserId, filters.requesterUserId));
  if (filters.assignedTechId) conditions.push(eq(workOrders.assignedTechId, filters.assignedTechId));
  return db.select().from(workOrders).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(workOrders.createdAt));
}

export function workOrderDateSegment(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const value = (type: string) => parts.find(part => part.type === type)?.value ?? "00";
  return `${value("year")}${value("month")}${value("day")}`;
}

export function nextWorkOrderId(prefix: string, existingWorkOrderIds: string[]) {
  const suffixes = existingWorkOrderIds
    .filter(workOrderId => workOrderId.startsWith(`${prefix}-`))
    .map(workOrderId => Number(workOrderId.slice(`${prefix}-`.length)))
    .filter(suffix => Number.isInteger(suffix) && suffix >= 0);
  return `${prefix}-${String((suffixes.length ? Math.max(...suffixes) : 0) + 1).padStart(4, "0")}`;
}

async function generateWorkOrderId() {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const prefix = `WO-${workOrderDateSegment()}`;
  const matches = await db.select({ woId: workOrders.woId }).from(workOrders).where(like(workOrders.woId, `${prefix}-%`));
  return nextWorkOrderId(prefix, matches.map(row => row.woId));
}

export async function getWorkOrder(woId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.woId, woId)).limit(1);
  if (!workOrder) return undefined;
  const [logs, files, alerts, requesterRows] = await Promise.all([
    db.select().from(statusLogs).where(eq(statusLogs.woId, woId)).orderBy(desc(statusLogs.changedAt)),
    db.select().from(attachments).where(eq(attachments.woId, woId)).orderBy(desc(attachments.createdAt)),
    db.select().from(notifications).where(eq(notifications.woId, woId)).orderBy(desc(notifications.createdAt)).limit(20),
    db.select({ displayName: maintenanceUsers.displayName, department: maintenanceUsers.department, roleCode: maintenanceUsers.roleCode }).from(maintenanceUsers).where(eq(maintenanceUsers.userId, workOrder.requesterUserId)).limit(1),
  ]);
  return { workOrder, logs, attachments: files, notifications: alerts, requester: requesterRows[0] ?? null };
}

async function syncOverdueNotifications(db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const overdueOrders = await db.select({ woId: workOrders.woId, requesterUserId: workOrders.requesterUserId, dueAt: workOrders.dueAt }).from(workOrders).where(and(lte(workOrders.dueAt, new Date()), sql`${workOrders.statusCode} not in ('COMPLETED','CLOSED')`));
  for (const order of overdueOrders) {
    const notificationId = `SLA-${order.woId}-${order.dueAt?.getTime() ?? 0}`;
    const [existing] = await db.select({ id: notifications.id }).from(notifications).where(eq(notifications.notificationId, notificationId)).limit(1);
    if (!existing) {
      await db.insert(notifications).values({ notificationId, recipientUserId: order.requesterUserId, woId: order.woId, channel: "WEBAPP", title: "SLA_OVERDUE", message: `ใบงาน ${order.woId} เกินกำหนด SLA แล้ว`, isRead: false, createdAt: new Date() });
      void import("./lineMessaging").then(({ sendLineOverdueAlert }) => sendLineOverdueAlert(order.woId, order.dueAt)).catch(error => console.warn("[LINE OVERDUE]", error));
    }
  }
}

export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return { byStatus: [], overdue: 0, today: 0, week: 0, total: 0 };
  await syncOverdueNotifications(db);
  const [byStatus, overdue, today, week, total] = await Promise.all([
    db.select({ status: workOrders.statusCode, count: sql<number>`count(*)` }).from(workOrders).groupBy(workOrders.statusCode),
    db.select({ count: sql<number>`count(*)` }).from(workOrders).where(and(lte(workOrders.dueAt, new Date()), sql`${workOrders.statusCode} not in ('COMPLETED','CLOSED')`)),
    db.select({ count: sql<number>`count(*)` }).from(workOrders).where(gte(workOrders.createdAt, new Date(new Date().setHours(0, 0, 0, 0)))),
    db.select({ count: sql<number>`count(*)` }).from(workOrders).where(gte(workOrders.createdAt, new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))),
    db.select({ count: sql<number>`count(*)` }).from(workOrders),
  ]);
  return { byStatus, overdue: Number(overdue[0]?.count ?? 0), today: Number(today[0]?.count ?? 0), week: Number(week[0]?.count ?? 0), total: Number(total[0]?.count ?? 0) };
}

export async function createWorkOrder(input: Omit<typeof workOrders.$inferInsert, "woId"> & { woId?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const woId = input.woId ?? await generateWorkOrderId();
  const order = { ...input, woId };
  await db.insert(workOrders).values(order);
  await db.insert(statusLogs).values({ logId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, woId, toStatus: "OPEN", actorUserId: input.requesterUserId, comment: "สร้างใบแจ้งซ่อม", isCustomerVisible: true });
  await createNotification({ notificationId: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, recipientUserId: input.requesterUserId, woId, channel: "WEBAPP", title: "WO_CREATED", message: `สร้างใบแจ้งซ่อม ${woId}`, isRead: false, createdAt: new Date() });
  if (["URGENT", "P1", "CRITICAL"].includes(input.priorityCode.toUpperCase())) {
    void import("./lineMessaging").then(({ sendLineUrgentAlert }) => sendLineUrgentAlert(woId, input.description)).catch(error => console.warn("[LINE URGENT]", error));
  }
  return getWorkOrder(woId);
}

export async function updateWorkOrder(woId: string, values: Partial<typeof workOrders.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(workOrders).set({ ...values, updatedAt: new Date() }).where(eq(workOrders.woId, woId));
  return getWorkOrder(woId);
}

export async function assignWorkOrder(input: { woId: string; techId: string | null; assignedTeam?: string | null; actorUserId: string; comment?: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.woId, input.woId)).limit(1);
  if (!workOrder) throw new Error("Work order not found");
  let assignedTechnician: typeof technicians.$inferSelect | undefined;
  if (input.techId) {
    const [tech] = await db.select().from(technicians).where(eq(technicians.techId, input.techId)).limit(1);
    if (!tech || !tech.isActive) throw new Error("Technician is not active");
    if (tech.availabilityStatus !== "ON_DUTY") throw new Error("TECHNICIAN_NOT_ON_DUTY");
    if (tech.currentOpenJobs >= tech.maxOpenJobs) throw new Error("Technician workload is at capacity");
    assignedTechnician = tech;
  }
  let technicianLineUserId = assignedTechnician?.lineUserId?.trim() || null;
  if (!technicianLineUserId && assignedTechnician?.userId) {
    const [linkedMaintenanceUser] = await db.select({ lineUserId: maintenanceUsers.lineUserId }).from(maintenanceUsers).where(eq(maintenanceUsers.userId, assignedTechnician.userId)).limit(1);
    technicianLineUserId = linkedMaintenanceUser?.lineUserId?.trim() || null;
  }
  const wasActive = ["ASSIGNED", "IN_PROGRESS"].includes(workOrder.statusCode);
  const willBeActive = Boolean(input.techId);
  if (workOrder.assignedTechId && workOrder.assignedTechId !== input.techId && wasActive) {
    await db.update(technicians).set({ currentOpenJobs: sql`MAX(${technicians.currentOpenJobs} - 1, 0)` }).where(eq(technicians.techId, workOrder.assignedTechId));
  }
  if (input.techId && workOrder.assignedTechId !== input.techId && willBeActive) {
    await db.update(technicians).set({ currentOpenJobs: sql`${technicians.currentOpenJobs} + 1` }).where(eq(technicians.techId, input.techId));
  }
  const nextStatus = input.techId ? "ASSIGNED" : "OPEN";
  await db.update(workOrders).set({ assignedTechId: input.techId, assignedTeam: input.assignedTeam ?? null, statusCode: nextStatus, updatedAt: new Date() }).where(eq(workOrders.woId, input.woId));
  await db.insert(statusLogs).values({ logId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, woId: input.woId, fromStatus: workOrder.statusCode, toStatus: nextStatus, actorUserId: input.actorUserId, comment: input.comment ?? (input.techId ? `มอบหมายงานให้ ${input.techId}` : "ยกเลิกการมอบหมาย"), isCustomerVisible: true });
  if (input.techId) {
    await createNotification({ notificationId: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, recipientUserId: input.techId, woId: input.woId, channel: "WEBAPP", title: "WO_ASSIGNED", message: `ได้รับมอบหมายใบงาน ${input.woId}`, isRead: false, createdAt: new Date() });
    void import("./lineMessaging").then(({ resolveTechnicianLineRecipient, sendLineAssignmentAlert }) => sendLineAssignmentAlert({ woId: input.woId, technicianLineUserId: resolveTechnicianLineRecipient(technicianLineUserId), locationId: workOrder.locationId, description: workOrder.description })).catch(error => console.warn("[LINE ASSIGNED]", error));
  }
  return getWorkOrder(input.woId);
}

export function isWorkloadActive(status: string) { return status === "ASSIGNED" || status === "IN_PROGRESS"; }
export function workloadDelta(fromStatus: string, toStatus: string) { return Number(isWorkloadActive(toStatus)) - Number(isWorkloadActive(fromStatus)); }

export async function addStatusLog(input: typeof statusLogs.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [workOrder] = await db.select().from(workOrders).where(eq(workOrders.woId, input.woId)).limit(1);
  if (!workOrder) throw new Error("Work order not found");
  const wasActive = isWorkloadActive(workOrder.statusCode);
  const isActive = isWorkloadActive(input.toStatus);
  await db.insert(statusLogs).values(input);
  await db.update(workOrders).set({ statusCode: input.toStatus as any, startedAt: input.toStatus === "IN_PROGRESS" ? new Date() : workOrder.startedAt, completedAt: ["COMPLETED", "CLOSED"].includes(input.toStatus) ? new Date() : workOrder.completedAt, updatedAt: new Date() }).where(eq(workOrders.woId, input.woId));
  if (workOrder.assignedTechId && wasActive !== isActive) await db.update(technicians).set({ currentOpenJobs: sql`MAX(${technicians.currentOpenJobs} + ${workloadDelta(workOrder.statusCode, input.toStatus)}, 0)` }).where(eq(technicians.techId, workOrder.assignedTechId));
  await createNotification({ notificationId: `NTF-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, recipientUserId: workOrder.requesterUserId, woId: input.woId, channel: "WEBAPP", title: `WO_${input.toStatus}`, message: input.comment ?? `สถานะใบงานเปลี่ยนเป็น ${input.toStatus}`, isRead: false, createdAt: new Date() });
  if (input.toStatus === "COMPLETED" && workOrder.statusCode !== "COMPLETED") {
    const [requester] = await db.select({ lineUserId: maintenanceUsers.lineUserId }).from(maintenanceUsers).where(eq(maintenanceUsers.userId, workOrder.requesterUserId)).limit(1);
    void import("./lineMessaging").then(({ sendLineCompletionAlert }) => sendLineCompletionAlert({ woId: input.woId, requesterLineUserId: requester?.lineUserId ?? workOrder.lineUserId ?? null, locationId: workOrder.locationId, comment: input.comment })).catch(error => console.warn("[LINE COMPLETED]", error));
  }
  return getWorkOrder(input.woId);
}

export async function setWorkOrderPendingParts(input: { woId: string; actorUserId: string; comment?: string }) {
  const workOrder = await getWorkOrder(input.woId);
  if (!workOrder) throw new Error("WORK_ORDER_NOT_FOUND");
  return addStatusLog({
    logId: `LOG-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    woId: input.woId,
    fromStatus: workOrder.workOrder.statusCode,
    toStatus: "PENDING_PARTS",
    actorUserId: input.actorUserId,
    comment: input.comment?.trim() || "รออะไหล่หรือการสั่งซื้อ",
    isCustomerVisible: true,
  });
}

export async function addAttachment(input: typeof attachments.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(attachments).values(input);
  return getWorkOrder(input.woId);
}

export async function hasWorkOrderAttachmentType(woId: string, attachmentType: "BEFORE" | "AFTER" | "OTHER") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [attachment] = await db.select({ attachmentId: attachments.attachmentId }).from(attachments).where(and(eq(attachments.woId, woId), eq(attachments.attachmentType, attachmentType))).limit(1);
  return Boolean(attachment);
}

export async function createNotification(input: typeof notifications.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(notifications).values(input);
  return input;
}

export async function markNotificationRead(notificationId: string, recipientUserId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.update(notifications).set({ isRead: true }).where(and(eq(notifications.notificationId, notificationId), eq(notifications.recipientUserId, recipientUserId)));
  return { success: true } as const;
}

export async function createLocation(input: typeof locations.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(locations).values(input); return listLocations(); }
export async function updateLocation(locationId: string, values: Partial<typeof locations.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(locations).set(values).where(eq(locations.locationId, locationId)); return listLocations(); }
export async function createTechnician(input: typeof technicians.$inferInsert) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.insert(technicians).values(input); return listTechnicians(); }
export async function updateTechnician(techId: string, values: Partial<typeof technicians.$inferInsert>) { const db = await getDb(); if (!db) throw new Error("Database unavailable"); await db.update(technicians).set(values).where(eq(technicians.techId, techId)); return listTechnicians(); }
export async function updateTechnicianAvailability(techId: string, availabilityStatus: "ON_DUTY" | "OFF_DUTY" | "ON_LEAVE") {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [technician] = await db.select({ techId: technicians.techId }).from(technicians).where(eq(technicians.techId, techId)).limit(1);
  if (!technician) throw new Error("TECHNICIAN_NOT_FOUND");
  await db.update(technicians).set({ availabilityStatus }).where(eq(technicians.techId, techId));
  return listTechnicians();
}
export async function listParts(filters: { search?: string; category?: string; lowStockOnly?: boolean } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.category) conditions.push(eq(parts.categoryCode, filters.category));
  if (filters.lowStockOnly) conditions.push(sql`${parts.availableQty} < ${parts.minStockQty}`);
  if (filters.search) conditions.push(or(like(parts.partId, `%${filters.search}%`), like(parts.partCode, `%${filters.search}%`), like(parts.partNameTh, `%${filters.search}%`), like(parts.partNameEn, `%${filters.search}%`)));
  return db.select().from(parts).where(conditions.length ? and(...conditions) : undefined).orderBy(parts.partNameTh);
}

export async function listPartIssues(filters: { woId?: string; status?: string } = {}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters.woId) conditions.push(eq(partIssues.woId, filters.woId));
  if (filters.status) conditions.push(eq(partIssues.issueStatus, filters.status));
  return db.select().from(partIssues).where(conditions.length ? and(...conditions) : undefined).orderBy(desc(partIssues.issueAt), desc(partIssues.createdAt));
}

export function inventoryAfterApproval(stock: { currentStockQty: number; reservedQty: number; availableQty: number }, qtyApproved: number) {
  if (qtyApproved <= 0) throw new Error("QTY_MUST_BE_POSITIVE");
  if (qtyApproved > stock.availableQty) throw new Error("INSUFFICIENT_STOCK");
  const reservedQty = stock.reservedQty + qtyApproved;
  return { currentStockQty: stock.currentStockQty, reservedQty, availableQty: stock.currentStockQty - reservedQty };
}

export function inventoryAfterIssuance(stock: { currentStockQty: number; reservedQty: number }, qtyApproved: number, qtyIssued: number) {
  if (qtyIssued <= 0 || qtyIssued > qtyApproved) throw new Error("INVALID_ISSUE_QTY");
  if (stock.reservedQty < qtyApproved || stock.currentStockQty < qtyIssued) throw new Error("INSUFFICIENT_STOCK");
  const currentStockQty = stock.currentStockQty - qtyIssued;
  const reservedQty = stock.reservedQty - qtyApproved;
  return { currentStockQty, reservedQty, availableQty: currentStockQty - reservedQty };
}

export async function createPart(input: typeof parts.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const availableQty = Math.max((input.currentStockQty ?? 0) - (input.reservedQty ?? 0), 0);
  await db.insert(parts).values({ ...input, availableQty });
  return listParts();
}

export async function updatePart(partId: string, values: Partial<typeof parts.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [existing] = await db.select().from(parts).where(eq(parts.partId, partId)).limit(1);
  if (!existing) throw new Error("PART_NOT_FOUND");
  const currentStockQty = values.currentStockQty ?? existing.currentStockQty;
  const reservedQty = values.reservedQty ?? existing.reservedQty;
  if (reservedQty > currentStockQty) throw new Error("RESERVED_QTY_EXCEEDS_STOCK");
  await db.update(parts).set({ ...values, availableQty: currentStockQty - reservedQty, updatedAt: new Date() } as any).where(eq(parts.partId, partId));
  return listParts();
}

export async function requestPartIssue(input: { woId: string; partId: string; qtyRequested: number; requestedByUserId: string; requestedByLineUserId?: string | null; notes?: string | null }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const [workOrder] = await db.select({ woId: workOrders.woId }).from(workOrders).where(eq(workOrders.woId, input.woId)).limit(1);
  if (!workOrder) throw new Error("WORK_ORDER_NOT_FOUND");
  const [part] = await db.select().from(parts).where(eq(parts.partId, input.partId)).limit(1);
  if (!part || !part.isActive) throw new Error("PART_NOT_FOUND");
  if (input.qtyRequested <= 0) throw new Error("QTY_MUST_BE_POSITIVE");
  const issueId = `ISS-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  await db.insert(partIssues).values({
    issueId,
    woId: input.woId,
    requestedByUserId: input.requestedByUserId,
    requestedByLineUserId: input.requestedByLineUserId ?? null,
    partId: part.partId,
    partCode: part.partCode,
    partNameTh: part.partNameTh,
    qtyRequested: input.qtyRequested,
    qtyApproved: 0,
    qtyIssued: 0,
    unit: part.unit,
    unitCostThb: part.unitCostThb,
    issueCostThb: "0",
    issueStatus: "REQUESTED",
    stockLocation: part.storageLocation,
    notes: input.notes ?? null,
    createdAt: new Date(),
  });
  return { issueId };
}

export async function approvePartIssue(input: { issueId: string; qtyApproved: number; approvedByUserId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [issue] = await tx.select().from(partIssues).where(eq(partIssues.issueId, input.issueId)).limit(1);
    if (!issue) throw new Error("PART_ISSUE_NOT_FOUND");
    if (issue.issueStatus !== "REQUESTED") throw new Error("PART_ISSUE_NOT_REQUESTED");
    if (input.qtyApproved > issue.qtyRequested) throw new Error("APPROVED_QTY_EXCEEDS_REQUEST");
    const [part] = await tx.select().from(parts).where(eq(parts.partId, issue.partId)).limit(1);
    if (!part) throw new Error("PART_NOT_FOUND");
    const inventory = inventoryAfterApproval(part, input.qtyApproved);
    await tx.update(parts).set({ ...inventory, updatedAt: new Date() }).where(eq(parts.partId, part.partId));
    await tx.update(partIssues).set({ qtyApproved: input.qtyApproved, issueStatus: "APPROVED", approvedByUserId: input.approvedByUserId, approvedAt: new Date(), updatedAt: new Date() }).where(eq(partIssues.issueId, input.issueId));
    return { issueId: input.issueId, issueStatus: "APPROVED" as const };
  });
}

export async function issuePart(input: { issueId: string; qtyIssued: number }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  return db.transaction(async tx => {
    const [issue] = await tx.select().from(partIssues).where(eq(partIssues.issueId, input.issueId)).limit(1);
    if (!issue) throw new Error("PART_ISSUE_NOT_FOUND");
    if (issue.issueStatus !== "APPROVED") throw new Error("PART_ISSUE_NOT_APPROVED");
    const [part] = await tx.select().from(parts).where(eq(parts.partId, issue.partId)).limit(1);
    if (!part) throw new Error("PART_NOT_FOUND");
    const inventory = inventoryAfterIssuance(part, issue.qtyApproved, input.qtyIssued);
    await tx.update(parts).set({ ...inventory, updatedAt: new Date() }).where(eq(parts.partId, part.partId));
    await tx.update(partIssues).set({ qtyIssued: input.qtyIssued, issueCostThb: String(Number(issue.unitCostThb) * input.qtyIssued), issueStatus: "ISSUED", issueAt: new Date(), updatedAt: new Date() }).where(eq(partIssues.issueId, input.issueId));
    return { issueId: input.issueId, issueStatus: "ISSUED" as const };
  });
}

export async function listLocations() { const db = await getDb(); return db ? db.select().from(locations).orderBy(locations.areaName) : []; }
export async function listTechnicians() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: technicians.id,
    techId: technicians.techId,
    userId: technicians.userId,
    techName: technicians.techName,
    teamCode: technicians.teamCode,
    skills: technicians.skills,
    shiftCode: technicians.shiftCode,
    phone: technicians.phone,
    isActive: technicians.isActive,
    availabilityStatus: technicians.availabilityStatus,
    maxOpenJobs: technicians.maxOpenJobs,
    currentOpenJobs: technicians.currentOpenJobs,
    notes: technicians.notes,
    isLineConnected: sql<boolean>`CASE WHEN ${technicians.lineUserId} IS NOT NULL AND TRIM(${technicians.lineUserId}) <> '' THEN TRUE ELSE FALSE END`,
  }).from(technicians).orderBy(technicians.techName);
}
export async function listLookups(type?: string) { const db = await getDb(); return db ? db.select().from(lookups).where(type ? eq(lookups.lookupType, type) : undefined).orderBy(lookups.sortOrder) : []; }
export async function listNotifications(userId?: string) { const db = await getDb(); return db ? db.select().from(notifications).where(userId ? eq(notifications.recipientUserId, userId) : undefined).orderBy(desc(notifications.createdAt)).limit(30) : []; }

export async function getGoogleDriveIntegrationSettings() {
  const db = await getDb();
  if (!db) return { isEnabled: false, rootFolderId: null, rootFolderUrl: null, updatedAt: null };
  const [settings] = await db.select({
    isEnabled: googleDriveIntegrationSettings.isEnabled,
    rootFolderId: googleDriveIntegrationSettings.rootFolderId,
    rootFolderUrl: googleDriveIntegrationSettings.rootFolderUrl,
    updatedAt: googleDriveIntegrationSettings.updatedAt,
  }).from(googleDriveIntegrationSettings).where(eq(googleDriveIntegrationSettings.integrationKey, "GOOGLE_DRIVE")).limit(1);
  return settings ?? { isEnabled: false, rootFolderId: null, rootFolderUrl: null, updatedAt: null };
}

export async function saveGoogleDriveIntegrationSettings(input: { isEnabled: boolean; rootFolderId?: string | null; rootFolderUrl?: string | null; updatedByUserId: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(googleDriveIntegrationSettings).values({
    integrationKey: "GOOGLE_DRIVE",
    isEnabled: input.isEnabled,
    rootFolderId: input.rootFolderId ?? null,
    rootFolderUrl: input.rootFolderUrl ?? null,
    updatedByUserId: input.updatedByUserId,
  }).onConflictDoUpdate({ target: googleDriveIntegrationSettings.integrationKey, set: {
    isEnabled: input.isEnabled,
    rootFolderId: input.rootFolderId ?? null,
    rootFolderUrl: input.rootFolderUrl ?? null,
    updatedByUserId: input.updatedByUserId,
    updatedAt: new Date(),
  } });
  return getGoogleDriveIntegrationSettings();
}

import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// Migrated from MySQL/TiDB (drizzle-orm/mysql-core) to Cloudflare D1
// (SQLite, drizzle-orm/sqlite-core). Mapping notes:
//  - varchar/text        -> text
//  - decimal (money)     -> text (kept as numeric strings, same as app code already used)
//  - int/bigint          -> integer
//  - boolean             -> integer({ mode: "boolean" })
//  - timestamp           -> integer({ mode: "timestamp" }) (stored as unix seconds)
//  - mysqlEnum           -> text({ enum: [...] })
//  - autoincrement()     -> primaryKey({ autoIncrement: true })
//  - defaultNow()/onUpdateNow() -> default(sql`(unixepoch())`); onUpdateNow has no direct
//    SQLite equivalent, so every write path in server/db.ts sets updatedAt explicitly.

const now = sql`(unixepoch())`;

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"] }).default("REPORTER").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: "timestamp" }).default(now).notNull(),
});

export const maintenanceUsers = sqliteTable("maintenance_users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("userId").notNull().unique(),
  lineUserId: text("lineUserId"),
  employeeId: text("employeeId"),
  displayName: text("displayName").notNull(),
  pictureUrl: text("pictureUrl"),
  roleCode: text("roleCode", { enum: ["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"] }).default("REPORTER").notNull(),
  department: text("department"),
  phone: text("phone"),
  email: text("email"),
  defaultLocationId: text("defaultLocationId"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  lastLoginAt: integer("lastLoginAt", { mode: "timestamp" }),
  consentVersion: text("consentVersion"),
  notes: text("notes"),
}, table => ({ roleIdx: index("maintenance_users_role_idx").on(table.roleCode) }));

export const locations = sqliteTable("locations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  locationId: text("locationId").notNull().unique(),
  propertyCode: text("propertyCode").notNull().default("HOTEL01"),
  building: text("building"),
  floor: text("floor"),
  areaType: text("areaType").notNull(),
  roomNo: text("roomNo"),
  areaName: text("areaName").notNull(),
  qrCode: text("qrCode").notNull().unique(),
  isGuestArea: integer("isGuestArea", { mode: "boolean" }).default(false).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ areaTypeIdx: index("locations_area_type_idx").on(table.areaType) }));

export const technicians = sqliteTable("technicians", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  techId: text("techId").notNull().unique(),
  userId: text("userId"),
  techName: text("techName").notNull(),
  teamCode: text("teamCode").notNull(),
  skills: text("skills"),
  shiftCode: text("shiftCode"),
  phone: text("phone"),
  lineUserId: text("lineUserId"),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  availabilityStatus: text("availabilityStatus", { enum: ["ON_DUTY", "OFF_DUTY", "ON_LEAVE"] }).default("OFF_DUTY").notNull(),
  maxOpenJobs: integer("maxOpenJobs").default(5).notNull(),
  currentOpenJobs: integer("currentOpenJobs").default(0).notNull(),
  notes: text("notes"),
}, table => ({ teamIdx: index("technicians_team_idx").on(table.teamCode) }));

export const lookups = sqliteTable("lookups", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  lookupId: text("lookupId").notNull().unique(),
  lookupType: text("lookupType").notNull(),
  code: text("code").notNull(),
  labelTh: text("labelTh").notNull(),
  labelEn: text("labelEn").notNull(),
  sortOrder: integer("sortOrder").default(0).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  slaHours: text("slaHours"),
  notifyRole: text("notifyRole"),
  notes: text("notes"),
}, table => ({ lookupTypeIdx: index("lookups_type_idx").on(table.lookupType), lookupCodeIdx: index("lookups_code_idx").on(table.code) }));

export const workOrders = sqliteTable("work_orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  woId: text("woId").notNull().unique(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  requesterUserId: text("requesterUserId").notNull(),
  lineUserId: text("lineUserId"),
  locationId: text("locationId").notNull(),
  categoryCode: text("categoryCode").notNull(),
  subCategory: text("subCategory"),
  priorityCode: text("priorityCode").notNull(),
  statusCode: text("statusCode", { enum: ["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_PARTS", "COMPLETED", "CLOSED"] }).default("OPEN").notNull(),
  description: text("description").notNull(),
  assignedTechId: text("assignedTechId"),
  assignedTeam: text("assignedTeam"),
  slaHours: text("slaHours"),
  dueAt: integer("dueAt", { mode: "timestamp" }),
  startedAt: integer("startedAt", { mode: "timestamp" }),
  completedAt: integer("completedAt", { mode: "timestamp" }),
  costEstimateThb: text("costEstimateThb"),
  actualCostThb: text("actualCostThb"),
  sourceChannel: text("sourceChannel").default("WEBAPP").notNull(),
  customerVisible: integer("customerVisible", { mode: "boolean" }).default(false).notNull(),
  ratingOneToFive: integer("ratingOneToFive"),
  closeNote: text("closeNote"),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ statusIdx: index("work_orders_status_idx").on(table.statusCode), priorityIdx: index("work_orders_priority_idx").on(table.priorityCode), locationIdx: index("work_orders_location_idx").on(table.locationId), createdIdx: index("work_orders_created_idx").on(table.createdAt), techIdx: index("work_orders_tech_idx").on(table.assignedTechId) }));

export const statusLogs = sqliteTable("status_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  logId: text("logId").notNull().unique(),
  woId: text("woId").notNull(),
  changedAt: integer("changedAt", { mode: "timestamp" }).default(now).notNull(),
  fromStatus: text("fromStatus"),
  toStatus: text("toStatus").notNull(),
  actorUserId: text("actorUserId").notNull(),
  comment: text("comment"),
  nextAction: text("nextAction"),
  isCustomerVisible: integer("isCustomerVisible", { mode: "boolean" }).default(false).notNull(),
}, table => ({ woIdx: index("status_logs_wo_idx").on(table.woId), changedIdx: index("status_logs_changed_idx").on(table.changedAt) }));

export const attachments = sqliteTable("attachments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  attachmentId: text("attachmentId").notNull().unique(),
  woId: text("woId").notNull(),
  attachmentType: text("attachmentType", { enum: ["BEFORE", "AFTER", "OTHER"] }).default("OTHER").notNull(),
  fileName: text("fileName").notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: text("mimeType"),
  fileSize: integer("fileSize"),
  uploadedBy: text("uploadedBy").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ woIdx: index("attachments_wo_idx").on(table.woId), typeIdx: index("attachments_type_idx").on(table.woId, table.attachmentType) }));

export const parts = sqliteTable("parts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  partId: text("partId").notNull().unique(),
  partCode: text("partCode").notNull().unique(),
  partNameTh: text("partNameTh").notNull(),
  partNameEn: text("partNameEn"),
  categoryCode: text("categoryCode").notNull(),
  unit: text("unit").notNull(),
  brandModel: text("brandModel"),
  supplierName: text("supplierName"),
  storageLocation: text("storageLocation"),
  minStockQty: integer("minStockQty").default(0).notNull(),
  currentStockQty: integer("currentStockQty").default(0).notNull(),
  reservedQty: integer("reservedQty").default(0).notNull(),
  availableQty: integer("availableQty").default(0).notNull(),
  unitCostThb: text("unitCostThb").default("0").notNull(),
  reorderLeadDays: integer("reorderLeadDays").default(0).notNull(),
  isActive: integer("isActive", { mode: "boolean" }).default(true).notNull(),
  lastCountedAt: integer("lastCountedAt", { mode: "timestamp" }),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ categoryIdx: index("parts_category_idx").on(table.categoryCode), stockIdx: index("parts_stock_idx").on(table.availableQty) }));

export const partIssues = sqliteTable("part_issues", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  issueId: text("issueId").notNull().unique(),
  woId: text("woId").notNull(),
  issueAt: integer("issueAt", { mode: "timestamp" }),
  requestedByUserId: text("requestedByUserId").notNull(),
  requestedByLineUserId: text("requestedByLineUserId"),
  approvedByUserId: text("approvedByUserId"),
  approvedAt: integer("approvedAt", { mode: "timestamp" }),
  partId: text("partId").notNull(),
  partCode: text("partCode").notNull(),
  partNameTh: text("partNameTh").notNull(),
  qtyRequested: integer("qtyRequested").default(0).notNull(),
  qtyApproved: integer("qtyApproved").default(0).notNull(),
  qtyIssued: integer("qtyIssued").default(0).notNull(),
  unit: text("unit").notNull(),
  unitCostThb: text("unitCostThb").default("0").notNull(),
  issueCostThb: text("issueCostThb").default("0").notNull(),
  issueStatus: text("issueStatus").default("REQUESTED").notNull(),
  stockLocation: text("stockLocation"),
  usedAtLocationId: text("usedAtLocationId"),
  returnRequired: integer("returnRequired", { mode: "boolean" }).default(false).notNull(),
  returnQty: integer("returnQty").default(0).notNull(),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ woIdx: index("part_issues_wo_idx").on(table.woId), partIdx: index("part_issues_part_idx").on(table.partId), statusIdx: index("part_issues_status_idx").on(table.issueStatus) }));

export const notifications = sqliteTable("notifications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  notificationId: text("notificationId").notNull().unique(),
  recipientUserId: text("recipientUserId").notNull(),
  woId: text("woId"),
  channel: text("channel").notNull().default("WEBAPP"),
  title: text("title").notNull(),
  message: text("message").notNull(),
  isRead: integer("isRead", { mode: "boolean" }).default(false).notNull(),
  sentAt: integer("sentAt", { mode: "timestamp" }),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
}, table => ({ recipientIdx: index("notifications_recipient_idx").on(table.recipientUserId), readIdx: index("notifications_read_idx").on(table.isRead) }));

/**
 * One application-level LINE Messaging API configuration.  Sensitive values are
 * encrypted server-side before storage and are never returned to the browser.
 */
export const lineIntegrationSettings = sqliteTable("line_integration_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  integrationKey: text("integrationKey").notNull().unique(),
  isEnabled: integer("isEnabled", { mode: "boolean" }).default(false).notNull(),
  alertUrgent: integer("alertUrgent", { mode: "boolean" }).default(true).notNull(),
  alertOverdue: integer("alertOverdue", { mode: "boolean" }).default(true).notNull(),
  channelAccessTokenEncrypted: text("channelAccessTokenEncrypted"),
  recipientIdEncrypted: text("recipientIdEncrypted"),
  updatedByUserId: text("updatedByUserId"),
  lastTestAt: integer("lastTestAt", { mode: "timestamp" }),
  lastDeliveryAt: integer("lastDeliveryAt", { mode: "timestamp" }),
  lastDeliveryStatus: text("lastDeliveryStatus"),
  lastError: text("lastError"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
});

/**
 * Google Drive is optional. Service-account credentials remain in server secrets;
 * this table stores only public folder identifiers and the administrator's intent.
 */
export const googleDriveIntegrationSettings = sqliteTable("google_drive_integration_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  integrationKey: text("integrationKey").notNull().unique(),
  isEnabled: integer("isEnabled", { mode: "boolean" }).default(false).notNull(),
  rootFolderId: text("rootFolderId"),
  rootFolderUrl: text("rootFolderUrl"),
  updatedByUserId: text("updatedByUserId"),
  createdAt: integer("createdAt", { mode: "timestamp" }).default(now).notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" }).default(now).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type WorkOrder = typeof workOrders.$inferSelect;
export type InsertWorkOrder = typeof workOrders.$inferInsert;
export type Location = typeof locations.$inferSelect;
export type Technician = typeof technicians.$inferSelect;
export type StatusLog = typeof statusLogs.$inferSelect;
export type Lookup = typeof lookups.$inferSelect;
export type Part = typeof parts.$inferSelect;
export type PartIssue = typeof partIssues.$inferSelect;
export type LineIntegrationSettings = typeof lineIntegrationSettings.$inferSelect;
export type GoogleDriveIntegrationSettings = typeof googleDriveIntegrationSettings.$inferSelect;

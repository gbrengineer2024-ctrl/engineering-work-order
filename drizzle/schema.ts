import { bigint, boolean, decimal, index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"]).default("REPORTER").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const maintenanceUsers = mysqlTable("maintenance_users", {
  id: int("id").autoincrement().primaryKey(),
  userId: varchar("userId", { length: 40 }).notNull().unique(),
  lineUserId: varchar("lineUserId", { length: 80 }),
  employeeId: varchar("employeeId", { length: 40 }),
  displayName: varchar("displayName", { length: 160 }).notNull(),
  pictureUrl: text("pictureUrl"),
  roleCode: mysqlEnum("roleCode", ["ADMIN", "REPORTER", "SUPERVISOR", "TECHNICIAN"]).default("REPORTER").notNull(),
  department: varchar("department", { length: 120 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  defaultLocationId: varchar("defaultLocationId", { length: 40 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  lastLoginAt: timestamp("lastLoginAt"),
  consentVersion: varchar("consentVersion", { length: 40 }),
  notes: text("notes"),
}, table => ({ roleIdx: index("maintenance_users_role_idx").on(table.roleCode) }));

export const locations = mysqlTable("locations", {
  id: int("id").autoincrement().primaryKey(),
  locationId: varchar("locationId", { length: 40 }).notNull().unique(),
  propertyCode: varchar("propertyCode", { length: 40 }).notNull().default("HOTEL01"),
  building: varchar("building", { length: 120 }),
  floor: varchar("floor", { length: 30 }),
  areaType: varchar("areaType", { length: 60 }).notNull(),
  roomNo: varchar("roomNo", { length: 30 }),
  areaName: varchar("areaName", { length: 160 }).notNull(),
  qrCode: varchar("qrCode", { length: 160 }).notNull().unique(),
  isGuestArea: boolean("isGuestArea").default(false).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ areaTypeIdx: index("locations_area_type_idx").on(table.areaType) }));

export const technicians = mysqlTable("technicians", {
  id: int("id").autoincrement().primaryKey(),
  techId: varchar("techId", { length: 40 }).notNull().unique(),
  userId: varchar("userId", { length: 40 }),
  techName: varchar("techName", { length: 160 }).notNull(),
  teamCode: varchar("teamCode", { length: 60 }).notNull(),
  skills: text("skills"),
  shiftCode: varchar("shiftCode", { length: 40 }),
  phone: varchar("phone", { length: 40 }),
  lineUserId: varchar("lineUserId", { length: 80 }),
  isActive: boolean("isActive").default(true).notNull(),
  availabilityStatus: mysqlEnum("availabilityStatus", ["ON_DUTY", "OFF_DUTY", "ON_LEAVE"]).default("OFF_DUTY").notNull(),
  maxOpenJobs: int("maxOpenJobs").default(5).notNull(),
  currentOpenJobs: int("currentOpenJobs").default(0).notNull(),
  notes: text("notes"),
}, table => ({ teamIdx: index("technicians_team_idx").on(table.teamCode) }));

export const lookups = mysqlTable("lookups", {
  id: int("id").autoincrement().primaryKey(),
  lookupId: varchar("lookupId", { length: 40 }).notNull().unique(),
  lookupType: varchar("lookupType", { length: 40 }).notNull(),
  code: varchar("code", { length: 60 }).notNull(),
  labelTh: varchar("labelTh", { length: 160 }).notNull(),
  labelEn: varchar("labelEn", { length: 160 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  slaHours: decimal("slaHours", { precision: 8, scale: 2 }),
  notifyRole: varchar("notifyRole", { length: 40 }),
  notes: text("notes"),
}, table => ({ lookupTypeIdx: index("lookups_type_idx").on(table.lookupType), lookupCodeIdx: index("lookups_code_idx").on(table.code) }));

export const workOrders = mysqlTable("work_orders", {
  id: int("id").autoincrement().primaryKey(),
  woId: varchar("woId", { length: 40 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  requesterUserId: varchar("requesterUserId", { length: 40 }).notNull(),
  lineUserId: varchar("lineUserId", { length: 80 }),
  locationId: varchar("locationId", { length: 40 }).notNull(),
  categoryCode: varchar("categoryCode", { length: 60 }).notNull(),
  subCategory: varchar("subCategory", { length: 160 }),
  priorityCode: varchar("priorityCode", { length: 40 }).notNull(),
  statusCode: mysqlEnum("statusCode", ["OPEN", "ASSIGNED", "IN_PROGRESS", "PENDING_PARTS", "COMPLETED", "CLOSED"]).default("OPEN").notNull(),
  description: text("description").notNull(),
  assignedTechId: varchar("assignedTechId", { length: 40 }),
  assignedTeam: varchar("assignedTeam", { length: 80 }),
  slaHours: decimal("slaHours", { precision: 8, scale: 2 }),
  dueAt: timestamp("dueAt"),
  startedAt: timestamp("startedAt"),
  completedAt: timestamp("completedAt"),
  costEstimateThb: decimal("costEstimateThb", { precision: 12, scale: 2 }),
  actualCostThb: decimal("actualCostThb", { precision: 12, scale: 2 }),
  sourceChannel: varchar("sourceChannel", { length: 40 }).default("WEBAPP").notNull(),
  customerVisible: boolean("customerVisible").default(false).notNull(),
  ratingOneToFive: int("ratingOneToFive"),
  closeNote: text("closeNote"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ statusIdx: index("work_orders_status_idx").on(table.statusCode), priorityIdx: index("work_orders_priority_idx").on(table.priorityCode), locationIdx: index("work_orders_location_idx").on(table.locationId), createdIdx: index("work_orders_created_idx").on(table.createdAt), techIdx: index("work_orders_tech_idx").on(table.assignedTechId) }));

export const statusLogs = mysqlTable("status_logs", {
  id: int("id").autoincrement().primaryKey(),
  logId: varchar("logId", { length: 40 }).notNull().unique(),
  woId: varchar("woId", { length: 40 }).notNull(),
  changedAt: timestamp("changedAt").defaultNow().notNull(),
  fromStatus: varchar("fromStatus", { length: 40 }),
  toStatus: varchar("toStatus", { length: 40 }).notNull(),
  actorUserId: varchar("actorUserId", { length: 40 }).notNull(),
  comment: text("comment"),
  nextAction: varchar("nextAction", { length: 160 }),
  isCustomerVisible: boolean("isCustomerVisible").default(false).notNull(),
}, table => ({ woIdx: index("status_logs_wo_idx").on(table.woId), changedIdx: index("status_logs_changed_idx").on(table.changedAt) }));

export const attachments = mysqlTable("attachments", {
  id: int("id").autoincrement().primaryKey(),
  attachmentId: varchar("attachmentId", { length: 40 }).notNull().unique(),
  woId: varchar("woId", { length: 40 }).notNull(),
  attachmentType: mysqlEnum("attachmentType", ["BEFORE", "AFTER", "OTHER"]).default("OTHER").notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  fileUrl: text("fileUrl").notNull(),
  mimeType: varchar("mimeType", { length: 120 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  uploadedBy: varchar("uploadedBy", { length: 40 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ woIdx: index("attachments_wo_idx").on(table.woId), typeIdx: index("attachments_type_idx").on(table.woId, table.attachmentType) }));

export const parts = mysqlTable("parts", {
  id: int("id").autoincrement().primaryKey(),
  partId: varchar("partId", { length: 40 }).notNull().unique(),
  partCode: varchar("partCode", { length: 80 }).notNull().unique(),
  partNameTh: varchar("partNameTh", { length: 200 }).notNull(),
  partNameEn: varchar("partNameEn", { length: 200 }),
  categoryCode: varchar("categoryCode", { length: 60 }).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  brandModel: varchar("brandModel", { length: 200 }),
  supplierName: varchar("supplierName", { length: 200 }),
  storageLocation: varchar("storageLocation", { length: 80 }),
  minStockQty: int("minStockQty").default(0).notNull(),
  currentStockQty: int("currentStockQty").default(0).notNull(),
  reservedQty: int("reservedQty").default(0).notNull(),
  availableQty: int("availableQty").default(0).notNull(),
  unitCostThb: decimal("unitCostThb", { precision: 12, scale: 2 }).default("0").notNull(),
  reorderLeadDays: int("reorderLeadDays").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastCountedAt: timestamp("lastCountedAt"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ categoryIdx: index("parts_category_idx").on(table.categoryCode), stockIdx: index("parts_stock_idx").on(table.availableQty) }));

export const partIssues = mysqlTable("part_issues", {
  id: int("id").autoincrement().primaryKey(),
  issueId: varchar("issueId", { length: 40 }).notNull().unique(),
  woId: varchar("woId", { length: 40 }).notNull(),
  issueAt: timestamp("issueAt"),
  requestedByUserId: varchar("requestedByUserId", { length: 40 }).notNull(),
  requestedByLineUserId: varchar("requestedByLineUserId", { length: 80 }),
  approvedByUserId: varchar("approvedByUserId", { length: 40 }),
  approvedAt: timestamp("approvedAt"),
  partId: varchar("partId", { length: 40 }).notNull(),
  partCode: varchar("partCode", { length: 80 }).notNull(),
  partNameTh: varchar("partNameTh", { length: 200 }).notNull(),
  qtyRequested: int("qtyRequested").default(0).notNull(),
  qtyApproved: int("qtyApproved").default(0).notNull(),
  qtyIssued: int("qtyIssued").default(0).notNull(),
  unit: varchar("unit", { length: 20 }).notNull(),
  unitCostThb: decimal("unitCostThb", { precision: 12, scale: 2 }).default("0").notNull(),
  issueCostThb: decimal("issueCostThb", { precision: 12, scale: 2 }).default("0").notNull(),
  issueStatus: varchar("issueStatus", { length: 30 }).default("REQUESTED").notNull(),
  stockLocation: varchar("stockLocation", { length: 80 }),
  usedAtLocationId: varchar("usedAtLocationId", { length: 40 }),
  returnRequired: boolean("returnRequired").default(false).notNull(),
  returnQty: int("returnQty").default(0).notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ woIdx: index("part_issues_wo_idx").on(table.woId), partIdx: index("part_issues_part_idx").on(table.partId), statusIdx: index("part_issues_status_idx").on(table.issueStatus) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  notificationId: varchar("notificationId", { length: 40 }).notNull().unique(),
  recipientUserId: varchar("recipientUserId", { length: 40 }).notNull(),
  woId: varchar("woId", { length: 40 }),
  channel: varchar("channel", { length: 40 }).notNull().default("WEBAPP"),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ recipientIdx: index("notifications_recipient_idx").on(table.recipientUserId), readIdx: index("notifications_read_idx").on(table.isRead) }));

/**
 * One application-level LINE Messaging API configuration.  Sensitive values are
 * encrypted server-side before storage and are never returned to the browser.
 */
export const lineIntegrationSettings = mysqlTable("line_integration_settings", {
  id: int("id").autoincrement().primaryKey(),
  integrationKey: varchar("integrationKey", { length: 40 }).notNull().unique(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  alertUrgent: boolean("alertUrgent").default(true).notNull(),
  alertOverdue: boolean("alertOverdue").default(true).notNull(),
  channelAccessTokenEncrypted: text("channelAccessTokenEncrypted"),
  recipientIdEncrypted: text("recipientIdEncrypted"),
  updatedByUserId: varchar("updatedByUserId", { length: 64 }),
  lastTestAt: timestamp("lastTestAt"),
  lastDeliveryAt: timestamp("lastDeliveryAt"),
  lastDeliveryStatus: varchar("lastDeliveryStatus", { length: 30 }),
  lastError: text("lastError"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

/**
 * Google Drive is optional. Service-account credentials remain in server secrets;
 * this table stores only public folder identifiers and the administrator's intent.
 */
export const googleDriveIntegrationSettings = mysqlTable("google_drive_integration_settings", {
  id: int("id").autoincrement().primaryKey(),
  integrationKey: varchar("integrationKey", { length: 40 }).notNull().unique(),
  isEnabled: boolean("isEnabled").default(false).notNull(),
  rootFolderId: varchar("rootFolderId", { length: 160 }),
  rootFolderUrl: text("rootFolderUrl"),
  updatedByUserId: varchar("updatedByUserId", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
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

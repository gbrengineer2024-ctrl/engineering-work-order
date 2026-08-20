CREATE TABLE `attachments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`attachmentId` text NOT NULL,
	`woId` text NOT NULL,
	`attachmentType` text DEFAULT 'OTHER' NOT NULL,
	`fileName` text NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` text,
	`fileSize` integer,
	`uploadedBy` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `attachments_attachmentId_unique` ON `attachments` (`attachmentId`);--> statement-breakpoint
CREATE INDEX `attachments_wo_idx` ON `attachments` (`woId`);--> statement-breakpoint
CREATE INDEX `attachments_type_idx` ON `attachments` (`woId`,`attachmentType`);--> statement-breakpoint
CREATE TABLE `google_drive_integration_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`integrationKey` text NOT NULL,
	`isEnabled` integer DEFAULT false NOT NULL,
	`rootFolderId` text,
	`rootFolderUrl` text,
	`updatedByUserId` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_drive_integration_settings_integrationKey_unique` ON `google_drive_integration_settings` (`integrationKey`);--> statement-breakpoint
CREATE TABLE `line_integration_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`integrationKey` text NOT NULL,
	`isEnabled` integer DEFAULT false NOT NULL,
	`alertUrgent` integer DEFAULT true NOT NULL,
	`alertOverdue` integer DEFAULT true NOT NULL,
	`channelAccessTokenEncrypted` text,
	`recipientIdEncrypted` text,
	`updatedByUserId` text,
	`lastTestAt` integer,
	`lastDeliveryAt` integer,
	`lastDeliveryStatus` text,
	`lastError` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `line_integration_settings_integrationKey_unique` ON `line_integration_settings` (`integrationKey`);--> statement-breakpoint
CREATE TABLE `locations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`locationId` text NOT NULL,
	`propertyCode` text DEFAULT 'HOTEL01' NOT NULL,
	`building` text,
	`floor` text,
	`areaType` text NOT NULL,
	`roomNo` text,
	`areaName` text NOT NULL,
	`qrCode` text NOT NULL,
	`isGuestArea` integer DEFAULT false NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `locations_locationId_unique` ON `locations` (`locationId`);--> statement-breakpoint
CREATE UNIQUE INDEX `locations_qrCode_unique` ON `locations` (`qrCode`);--> statement-breakpoint
CREATE INDEX `locations_area_type_idx` ON `locations` (`areaType`);--> statement-breakpoint
CREATE TABLE `lookups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`lookupId` text NOT NULL,
	`lookupType` text NOT NULL,
	`code` text NOT NULL,
	`labelTh` text NOT NULL,
	`labelEn` text NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`slaHours` text,
	`notifyRole` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `lookups_lookupId_unique` ON `lookups` (`lookupId`);--> statement-breakpoint
CREATE INDEX `lookups_type_idx` ON `lookups` (`lookupType`);--> statement-breakpoint
CREATE INDEX `lookups_code_idx` ON `lookups` (`code`);--> statement-breakpoint
CREATE TABLE `maintenance_users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` text NOT NULL,
	`lineUserId` text,
	`employeeId` text,
	`displayName` text NOT NULL,
	`pictureUrl` text,
	`roleCode` text DEFAULT 'REPORTER' NOT NULL,
	`department` text,
	`phone` text,
	`email` text,
	`defaultLocationId` text,
	`isActive` integer DEFAULT true NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastLoginAt` integer,
	`consentVersion` text,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `maintenance_users_userId_unique` ON `maintenance_users` (`userId`);--> statement-breakpoint
CREATE INDEX `maintenance_users_role_idx` ON `maintenance_users` (`roleCode`);--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`notificationId` text NOT NULL,
	`recipientUserId` text NOT NULL,
	`woId` text,
	`channel` text DEFAULT 'WEBAPP' NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`sentAt` integer,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `notifications_notificationId_unique` ON `notifications` (`notificationId`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipientUserId`);--> statement-breakpoint
CREATE INDEX `notifications_read_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE TABLE `part_issues` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issueId` text NOT NULL,
	`woId` text NOT NULL,
	`issueAt` integer,
	`requestedByUserId` text NOT NULL,
	`requestedByLineUserId` text,
	`approvedByUserId` text,
	`approvedAt` integer,
	`partId` text NOT NULL,
	`partCode` text NOT NULL,
	`partNameTh` text NOT NULL,
	`qtyRequested` integer DEFAULT 0 NOT NULL,
	`qtyApproved` integer DEFAULT 0 NOT NULL,
	`qtyIssued` integer DEFAULT 0 NOT NULL,
	`unit` text NOT NULL,
	`unitCostThb` text DEFAULT '0' NOT NULL,
	`issueCostThb` text DEFAULT '0' NOT NULL,
	`issueStatus` text DEFAULT 'REQUESTED' NOT NULL,
	`stockLocation` text,
	`usedAtLocationId` text,
	`returnRequired` integer DEFAULT false NOT NULL,
	`returnQty` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `part_issues_issueId_unique` ON `part_issues` (`issueId`);--> statement-breakpoint
CREATE INDEX `part_issues_wo_idx` ON `part_issues` (`woId`);--> statement-breakpoint
CREATE INDEX `part_issues_part_idx` ON `part_issues` (`partId`);--> statement-breakpoint
CREATE INDEX `part_issues_status_idx` ON `part_issues` (`issueStatus`);--> statement-breakpoint
CREATE TABLE `parts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`partId` text NOT NULL,
	`partCode` text NOT NULL,
	`partNameTh` text NOT NULL,
	`partNameEn` text,
	`categoryCode` text NOT NULL,
	`unit` text NOT NULL,
	`brandModel` text,
	`supplierName` text,
	`storageLocation` text,
	`minStockQty` integer DEFAULT 0 NOT NULL,
	`currentStockQty` integer DEFAULT 0 NOT NULL,
	`reservedQty` integer DEFAULT 0 NOT NULL,
	`availableQty` integer DEFAULT 0 NOT NULL,
	`unitCostThb` text DEFAULT '0' NOT NULL,
	`reorderLeadDays` integer DEFAULT 0 NOT NULL,
	`isActive` integer DEFAULT true NOT NULL,
	`lastCountedAt` integer,
	`notes` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `parts_partId_unique` ON `parts` (`partId`);--> statement-breakpoint
CREATE UNIQUE INDEX `parts_partCode_unique` ON `parts` (`partCode`);--> statement-breakpoint
CREATE INDEX `parts_category_idx` ON `parts` (`categoryCode`);--> statement-breakpoint
CREATE INDEX `parts_stock_idx` ON `parts` (`availableQty`);--> statement-breakpoint
CREATE TABLE `status_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`logId` text NOT NULL,
	`woId` text NOT NULL,
	`changedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`fromStatus` text,
	`toStatus` text NOT NULL,
	`actorUserId` text NOT NULL,
	`comment` text,
	`nextAction` text,
	`isCustomerVisible` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `status_logs_logId_unique` ON `status_logs` (`logId`);--> statement-breakpoint
CREATE INDEX `status_logs_wo_idx` ON `status_logs` (`woId`);--> statement-breakpoint
CREATE INDEX `status_logs_changed_idx` ON `status_logs` (`changedAt`);--> statement-breakpoint
CREATE TABLE `technicians` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`techId` text NOT NULL,
	`userId` text,
	`techName` text NOT NULL,
	`teamCode` text NOT NULL,
	`skills` text,
	`shiftCode` text,
	`phone` text,
	`lineUserId` text,
	`isActive` integer DEFAULT true NOT NULL,
	`availabilityStatus` text DEFAULT 'OFF_DUTY' NOT NULL,
	`maxOpenJobs` integer DEFAULT 5 NOT NULL,
	`currentOpenJobs` integer DEFAULT 0 NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `technicians_techId_unique` ON `technicians` (`techId`);--> statement-breakpoint
CREATE INDEX `technicians_team_idx` ON `technicians` (`teamCode`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'REPORTER' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`lastSignedIn` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`woId` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`requesterUserId` text NOT NULL,
	`lineUserId` text,
	`locationId` text NOT NULL,
	`categoryCode` text NOT NULL,
	`subCategory` text,
	`priorityCode` text NOT NULL,
	`statusCode` text DEFAULT 'OPEN' NOT NULL,
	`description` text NOT NULL,
	`assignedTechId` text,
	`assignedTeam` text,
	`slaHours` text,
	`dueAt` integer,
	`startedAt` integer,
	`completedAt` integer,
	`costEstimateThb` text,
	`actualCostThb` text,
	`sourceChannel` text DEFAULT 'WEBAPP' NOT NULL,
	`customerVisible` integer DEFAULT false NOT NULL,
	`ratingOneToFive` integer,
	`closeNote` text,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `work_orders_woId_unique` ON `work_orders` (`woId`);--> statement-breakpoint
CREATE INDEX `work_orders_status_idx` ON `work_orders` (`statusCode`);--> statement-breakpoint
CREATE INDEX `work_orders_priority_idx` ON `work_orders` (`priorityCode`);--> statement-breakpoint
CREATE INDEX `work_orders_location_idx` ON `work_orders` (`locationId`);--> statement-breakpoint
CREATE INDEX `work_orders_created_idx` ON `work_orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `work_orders_tech_idx` ON `work_orders` (`assignedTechId`);
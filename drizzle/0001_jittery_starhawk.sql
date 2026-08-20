CREATE TABLE `attachments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attachmentId` varchar(40) NOT NULL,
	`woId` varchar(40) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`fileUrl` text NOT NULL,
	`mimeType` varchar(120),
	`fileSize` bigint,
	`uploadedBy` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `attachments_id` PRIMARY KEY(`id`),
	CONSTRAINT `attachments_attachmentId_unique` UNIQUE(`attachmentId`)
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationId` varchar(40) NOT NULL,
	`propertyCode` varchar(40) NOT NULL DEFAULT 'HOTEL01',
	`building` varchar(120),
	`floor` varchar(30),
	`areaType` varchar(60) NOT NULL,
	`roomNo` varchar(30),
	`areaName` varchar(160) NOT NULL,
	`qrCode` varchar(160) NOT NULL,
	`isGuestArea` boolean NOT NULL DEFAULT false,
	`isActive` boolean NOT NULL DEFAULT true,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `locations_id` PRIMARY KEY(`id`),
	CONSTRAINT `locations_locationId_unique` UNIQUE(`locationId`),
	CONSTRAINT `locations_qrCode_unique` UNIQUE(`qrCode`)
);
--> statement-breakpoint
CREATE TABLE `lookups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lookupId` varchar(40) NOT NULL,
	`lookupType` varchar(40) NOT NULL,
	`code` varchar(60) NOT NULL,
	`labelTh` varchar(160) NOT NULL,
	`labelEn` varchar(160) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`slaHours` decimal(8,2),
	`notifyRole` varchar(40),
	`notes` text,
	CONSTRAINT `lookups_id` PRIMARY KEY(`id`),
	CONSTRAINT `lookups_lookupId_unique` UNIQUE(`lookupId`)
);
--> statement-breakpoint
CREATE TABLE `maintenance_users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` varchar(40) NOT NULL,
	`lineUserId` varchar(80),
	`displayName` varchar(160) NOT NULL,
	`pictureUrl` text,
	`roleCode` enum('GUEST','STAFF','SUPERVISOR','TECH','ADMIN') NOT NULL DEFAULT 'STAFF',
	`department` varchar(120),
	`phone` varchar(40),
	`email` varchar(320),
	`defaultLocationId` varchar(40),
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastLoginAt` timestamp,
	`consentVersion` varchar(40),
	`notes` text,
	CONSTRAINT `maintenance_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `maintenance_users_userId_unique` UNIQUE(`userId`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationId` varchar(40) NOT NULL,
	`recipientUserId` varchar(40) NOT NULL,
	`woId` varchar(40),
	`channel` varchar(40) NOT NULL DEFAULT 'WEBAPP',
	`title` varchar(200) NOT NULL,
	`message` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `notifications_notificationId_unique` UNIQUE(`notificationId`)
);
--> statement-breakpoint
CREATE TABLE `status_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`logId` varchar(40) NOT NULL,
	`woId` varchar(40) NOT NULL,
	`changedAt` timestamp NOT NULL DEFAULT (now()),
	`fromStatus` varchar(40),
	`toStatus` varchar(40) NOT NULL,
	`actorUserId` varchar(40) NOT NULL,
	`comment` text,
	`nextAction` varchar(160),
	`isCustomerVisible` boolean NOT NULL DEFAULT false,
	CONSTRAINT `status_logs_id` PRIMARY KEY(`id`),
	CONSTRAINT `status_logs_logId_unique` UNIQUE(`logId`)
);
--> statement-breakpoint
CREATE TABLE `technicians` (
	`id` int AUTO_INCREMENT NOT NULL,
	`techId` varchar(40) NOT NULL,
	`userId` varchar(40),
	`techName` varchar(160) NOT NULL,
	`teamCode` varchar(60) NOT NULL,
	`skills` text,
	`shiftCode` varchar(40),
	`phone` varchar(40),
	`lineUserId` varchar(80),
	`isActive` boolean NOT NULL DEFAULT true,
	`maxOpenJobs` int NOT NULL DEFAULT 5,
	`currentOpenJobs` int NOT NULL DEFAULT 0,
	`notes` text,
	CONSTRAINT `technicians_id` PRIMARY KEY(`id`),
	CONSTRAINT `technicians_techId_unique` UNIQUE(`techId`)
);
--> statement-breakpoint
CREATE TABLE `work_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`woId` varchar(40) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`requesterUserId` varchar(40) NOT NULL,
	`lineUserId` varchar(80),
	`locationId` varchar(40) NOT NULL,
	`categoryCode` varchar(60) NOT NULL,
	`subCategory` varchar(160),
	`priorityCode` varchar(40) NOT NULL,
	`statusCode` enum('OPEN','ASSIGNED','IN_PROGRESS','COMPLETED','CLOSED') NOT NULL DEFAULT 'OPEN',
	`description` text NOT NULL,
	`assignedTechId` varchar(40),
	`assignedTeam` varchar(80),
	`slaHours` decimal(8,2),
	`dueAt` timestamp,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`costEstimateThb` decimal(12,2),
	`actualCostThb` decimal(12,2),
	`sourceChannel` varchar(40) NOT NULL DEFAULT 'WEBAPP',
	`customerVisible` boolean NOT NULL DEFAULT false,
	`ratingOneToFive` int,
	`closeNote` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `work_orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `work_orders_woId_unique` UNIQUE(`woId`)
);
--> statement-breakpoint
CREATE INDEX `attachments_wo_idx` ON `attachments` (`woId`);--> statement-breakpoint
CREATE INDEX `locations_area_type_idx` ON `locations` (`areaType`);--> statement-breakpoint
CREATE INDEX `lookups_type_idx` ON `lookups` (`lookupType`);--> statement-breakpoint
CREATE INDEX `lookups_code_idx` ON `lookups` (`code`);--> statement-breakpoint
CREATE INDEX `maintenance_users_role_idx` ON `maintenance_users` (`roleCode`);--> statement-breakpoint
CREATE INDEX `notifications_recipient_idx` ON `notifications` (`recipientUserId`);--> statement-breakpoint
CREATE INDEX `notifications_read_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `status_logs_wo_idx` ON `status_logs` (`woId`);--> statement-breakpoint
CREATE INDEX `status_logs_changed_idx` ON `status_logs` (`changedAt`);--> statement-breakpoint
CREATE INDEX `technicians_team_idx` ON `technicians` (`teamCode`);--> statement-breakpoint
CREATE INDEX `work_orders_status_idx` ON `work_orders` (`statusCode`);--> statement-breakpoint
CREATE INDEX `work_orders_priority_idx` ON `work_orders` (`priorityCode`);--> statement-breakpoint
CREATE INDEX `work_orders_location_idx` ON `work_orders` (`locationId`);--> statement-breakpoint
CREATE INDEX `work_orders_created_idx` ON `work_orders` (`createdAt`);--> statement-breakpoint
CREATE INDEX `work_orders_tech_idx` ON `work_orders` (`assignedTechId`);
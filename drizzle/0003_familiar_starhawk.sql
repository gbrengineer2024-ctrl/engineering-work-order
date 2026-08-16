CREATE TABLE `part_issues` (
	`id` int AUTO_INCREMENT NOT NULL,
	`issueId` varchar(40) NOT NULL,
	`woId` varchar(40) NOT NULL,
	`issueAt` timestamp,
	`requestedByUserId` varchar(40) NOT NULL,
	`requestedByLineUserId` varchar(80),
	`approvedByUserId` varchar(40),
	`approvedAt` timestamp,
	`partId` varchar(40) NOT NULL,
	`partCode` varchar(80) NOT NULL,
	`partNameTh` varchar(200) NOT NULL,
	`qtyRequested` int NOT NULL DEFAULT 0,
	`qtyApproved` int NOT NULL DEFAULT 0,
	`qtyIssued` int NOT NULL DEFAULT 0,
	`unit` varchar(20) NOT NULL,
	`unitCostThb` decimal(12,2) NOT NULL DEFAULT '0',
	`issueCostThb` decimal(12,2) NOT NULL DEFAULT '0',
	`issueStatus` varchar(30) NOT NULL DEFAULT 'REQUESTED',
	`stockLocation` varchar(80),
	`usedAtLocationId` varchar(40),
	`returnRequired` boolean NOT NULL DEFAULT false,
	`returnQty` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `part_issues_id` PRIMARY KEY(`id`),
	CONSTRAINT `part_issues_issueId_unique` UNIQUE(`issueId`)
);
--> statement-breakpoint
CREATE TABLE `parts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`partId` varchar(40) NOT NULL,
	`partCode` varchar(80) NOT NULL,
	`partNameTh` varchar(200) NOT NULL,
	`partNameEn` varchar(200),
	`categoryCode` varchar(60) NOT NULL,
	`unit` varchar(20) NOT NULL,
	`brandModel` varchar(200),
	`supplierName` varchar(200),
	`storageLocation` varchar(80),
	`minStockQty` int NOT NULL DEFAULT 0,
	`currentStockQty` int NOT NULL DEFAULT 0,
	`reservedQty` int NOT NULL DEFAULT 0,
	`availableQty` int NOT NULL DEFAULT 0,
	`unitCostThb` decimal(12,2) NOT NULL DEFAULT '0',
	`reorderLeadDays` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastCountedAt` timestamp,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `parts_id` PRIMARY KEY(`id`),
	CONSTRAINT `parts_partId_unique` UNIQUE(`partId`),
	CONSTRAINT `parts_partCode_unique` UNIQUE(`partCode`)
);
--> statement-breakpoint
CREATE INDEX `part_issues_wo_idx` ON `part_issues` (`woId`);--> statement-breakpoint
CREATE INDEX `part_issues_part_idx` ON `part_issues` (`partId`);--> statement-breakpoint
CREATE INDEX `part_issues_status_idx` ON `part_issues` (`issueStatus`);--> statement-breakpoint
CREATE INDEX `parts_category_idx` ON `parts` (`categoryCode`);--> statement-breakpoint
CREATE INDEX `parts_stock_idx` ON `parts` (`availableQty`);
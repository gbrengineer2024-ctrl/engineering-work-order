CREATE TABLE `google_drive_integration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integrationKey` varchar(40) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`rootFolderId` varchar(160),
	`rootFolderUrl` text,
	`updatedByUserId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `google_drive_integration_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `google_drive_integration_settings_integrationKey_unique` UNIQUE(`integrationKey`)
);

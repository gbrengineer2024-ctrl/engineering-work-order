CREATE TABLE `line_integration_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`integrationKey` varchar(40) NOT NULL,
	`isEnabled` boolean NOT NULL DEFAULT false,
	`alertUrgent` boolean NOT NULL DEFAULT true,
	`alertOverdue` boolean NOT NULL DEFAULT true,
	`channelAccessTokenEncrypted` text,
	`recipientIdEncrypted` text,
	`updatedByUserId` varchar(64),
	`lastTestAt` timestamp,
	`lastDeliveryAt` timestamp,
	`lastDeliveryStatus` varchar(30),
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `line_integration_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `line_integration_settings_integrationKey_unique` UNIQUE(`integrationKey`)
);

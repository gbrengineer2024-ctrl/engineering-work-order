ALTER TABLE `maintenance_users` MODIFY COLUMN `roleCode` enum('ADMIN','REPORTER','SUPERVISOR','TECHNICIAN') NOT NULL DEFAULT 'REPORTER';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('GUEST','STAFF','REPORTER','SUPERVISOR','TECH','TECHNICIAN','ADMIN') NOT NULL DEFAULT 'REPORTER';--> statement-breakpoint
ALTER TABLE `maintenance_users` MODIFY COLUMN `roleCode` enum('GUEST','STAFF','REPORTER','SUPERVISOR','TECH','TECHNICIAN','ADMIN') NOT NULL DEFAULT 'REPORTER';--> statement-breakpoint
UPDATE `users` SET `role` = CASE `role` WHEN 'GUEST' THEN 'REPORTER' WHEN 'STAFF' THEN 'REPORTER' WHEN 'TECH' THEN 'TECHNICIAN' ELSE `role` END;--> statement-breakpoint
UPDATE `maintenance_users` SET `roleCode` = CASE `roleCode` WHEN 'GUEST' THEN 'REPORTER' WHEN 'STAFF' THEN 'REPORTER' WHEN 'TECH' THEN 'TECHNICIAN' ELSE `roleCode` END;--> statement-breakpoint
UPDATE `maintenance_users` m INNER JOIN `users` u ON u.`openId` = m.`userId` SET m.`roleCode` = 'ADMIN' WHERE u.`role` = 'ADMIN';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('ADMIN','REPORTER','SUPERVISOR','TECHNICIAN') NOT NULL DEFAULT 'REPORTER';--> statement-breakpoint
ALTER TABLE `maintenance_users` MODIFY COLUMN `roleCode` enum('ADMIN','REPORTER','SUPERVISOR','TECHNICIAN') NOT NULL DEFAULT 'REPORTER';--> statement-breakpoint
ALTER TABLE `maintenance_users` ADD `employeeId` varchar(40);

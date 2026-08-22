CREATE TABLE `approval_history_report_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`email` varchar(320) NOT NULL,
	`status` enum('active','disabled') NOT NULL DEFAULT 'active',
	`createdByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `approval_history_report_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `approval_history_report_recipient_client_email_unique` UNIQUE(`clientId`,`email`)
);
--> statement-breakpoint
ALTER TABLE `approval_history_report_recipients` ADD CONSTRAINT `approval_history_report_recipients_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_history_report_recipients` ADD CONSTRAINT `approval_history_report_recipients_createdByUserId_users_id_fk` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_history_report_recipient_client_status_idx` ON `approval_history_report_recipients` (`clientId`,`status`);
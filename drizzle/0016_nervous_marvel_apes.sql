CREATE TABLE `approval_history_email_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`clientId` int NOT NULL,
	`actorUserId` int,
	`recipientEmail` varchar(320) NOT NULL,
	`subject` varchar(500) NOT NULL,
	`filtersJson` text NOT NULL,
	`recordCount` int NOT NULL,
	`status` enum('sent','failed') NOT NULL,
	`providerMessageId` varchar(255),
	`failureCode` varchar(120),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approval_history_email_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `approval_history_email_deliveries` ADD CONSTRAINT `approval_history_email_deliveries_campaignId_ad_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_history_email_deliveries` ADD CONSTRAINT `approval_history_email_deliveries_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `approval_history_email_deliveries` ADD CONSTRAINT `approval_history_email_deliveries_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `approval_history_email_campaign_created_idx` ON `approval_history_email_deliveries` (`campaignId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `approval_history_email_client_created_idx` ON `approval_history_email_deliveries` (`clientId`,`createdAt`);
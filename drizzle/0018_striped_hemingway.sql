CREATE TABLE `client_access_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`displayName` varchar(180),
	`role` enum('client_admin','manager','reviewer','viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('pending','active','revoked') NOT NULL DEFAULT 'pending',
	`invitedByUserId` int NOT NULL,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_access_grants_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_access_grants_client_email_unique` UNIQUE(`clientId`,`email`)
);
--> statement-breakpoint
CREATE TABLE `client_brand_guidelines` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`colorsJson` text NOT NULL,
	`fontsJson` text NOT NULL,
	`toneOfVoice` text,
	`prohibitedWordsJson` text NOT NULL,
	`approvedCtasJson` text NOT NULL,
	`productsJson` text NOT NULL,
	`differentiatorsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_brand_guidelines_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_brand_guidelines_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `client_notification_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`eventsJson` text NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_notification_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_notification_preferences_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `client_onboarding_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`currentStep` enum('brand','contacts','ai','whatsapp','goals','review','complete') NOT NULL DEFAULT 'brand',
	`completedStepsJson` text NOT NULL,
	`goals` text,
	`reviewNote` text,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_onboarding_progress_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_onboarding_progress_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `executive_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`periodEnd` timestamp NOT NULL,
	`title` varchar(220) NOT NULL,
	`summary` text NOT NULL,
	`metricsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `executive_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `external_approval_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`campaignId` int NOT NULL,
	`creativeVersionId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`recipientEmail` varchar(320) NOT NULL,
	`tokenHash` varchar(128) NOT NULL,
	`status` enum('open','approved','changes_requested','expired','revoked') NOT NULL DEFAULT 'open',
	`decisionNote` text,
	`expiresAt` timestamp NOT NULL,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `external_approval_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `external_approval_links_token_unique` UNIQUE(`tokenHash`)
);
--> statement-breakpoint
CREATE TABLE `support_ticket_updates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ticketId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`message` text NOT NULL,
	`statusAfter` enum('open','in_progress','waiting_client','resolved','closed'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `support_ticket_updates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`requesterEmail` varchar(320) NOT NULL,
	`subject` varchar(220) NOT NULL,
	`description` text NOT NULL,
	`priority` enum('low','normal','high','urgent') NOT NULL DEFAULT 'normal',
	`status` enum('open','in_progress','waiting_client','resolved','closed') NOT NULL DEFAULT 'open',
	`dueAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `client_access_grants` ADD CONSTRAINT `client_access_grants_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_access_grants` ADD CONSTRAINT `client_access_grants_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_access_grants` ADD CONSTRAINT `client_access_grants_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_brand_guidelines` ADD CONSTRAINT `client_brand_guidelines_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_brand_guidelines` ADD CONSTRAINT `client_brand_guidelines_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_notification_preferences` ADD CONSTRAINT `client_notification_preferences_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_notification_preferences` ADD CONSTRAINT `client_notification_preferences_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_onboarding_progress` ADD CONSTRAINT `client_onboarding_progress_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_onboarding_progress` ADD CONSTRAINT `client_onboarding_progress_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executive_reports` ADD CONSTRAINT `executive_reports_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `executive_reports` ADD CONSTRAINT `executive_reports_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_approval_links` ADD CONSTRAINT `external_approval_links_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_approval_links` ADD CONSTRAINT `external_approval_links_campaignId_ad_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_approval_links` ADD CONSTRAINT `ext_approval_creative_fk` FOREIGN KEY (`creativeVersionId`) REFERENCES `creative_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `external_approval_links` ADD CONSTRAINT `external_approval_links_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_updates` ADD CONSTRAINT `support_ticket_updates_ticketId_support_tickets_id_fk` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_ticket_updates` ADD CONSTRAINT `support_ticket_updates_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `support_tickets` ADD CONSTRAINT `support_tickets_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_access_grants_owner_client_idx` ON `client_access_grants` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `client_brand_guidelines_owner_idx` ON `client_brand_guidelines` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `client_notification_preferences_owner_idx` ON `client_notification_preferences` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `client_onboarding_progress_owner_idx` ON `client_onboarding_progress` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `executive_reports_owner_client_idx` ON `executive_reports` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `executive_reports_period_idx` ON `executive_reports` (`periodStart`,`periodEnd`);--> statement-breakpoint
CREATE INDEX `external_approval_links_owner_client_idx` ON `external_approval_links` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `support_ticket_updates_ticket_idx` ON `support_ticket_updates` (`ticketId`);--> statement-breakpoint
CREATE INDEX `support_tickets_owner_client_idx` ON `support_tickets` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `support_tickets_status_idx` ON `support_tickets` (`status`);

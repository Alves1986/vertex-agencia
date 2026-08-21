CREATE TABLE `client_portal_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`userId` int NOT NULL,
	`invitedByUserId` int NOT NULL,
	`role` enum('client_admin','manager','agent','viewer') NOT NULL DEFAULT 'viewer',
	`status` enum('invited','active','suspended') NOT NULL DEFAULT 'invited',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_portal_members_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_portal_members_client_user_unique` UNIQUE(`clientId`,`userId`)
);
--> statement-breakpoint
CREATE TABLE `saas_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`code` varchar(80) NOT NULL,
	`name` varchar(160) NOT NULL,
	`annualPriceCents` int NOT NULL,
	`includedChannels` int NOT NULL DEFAULT 1,
	`includedHumanSeats` int NOT NULL DEFAULT 1,
	`includedManagedAiMessages` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saas_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_plans_owner_code_unique` UNIQUE(`ownerUserId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `saas_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`planId` int,
	`ownerUserId` int NOT NULL,
	`billingProvider` enum('stripe','manual') NOT NULL DEFAULT 'manual',
	`externalSubscriptionId` varchar(255),
	`status` enum('trialing','active','past_due','paused','canceled','expired') NOT NULL DEFAULT 'trialing',
	`interval` enum('annual') NOT NULL DEFAULT 'annual',
	`managedAiAddOn` int NOT NULL DEFAULT 0,
	`managedAiMonthlyLimit` int NOT NULL DEFAULT 0,
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saas_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `saas_subscriptions_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_ai_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`aiAccessMode` enum('client_api_key','vertex_managed') NOT NULL DEFAULT 'client_api_key',
	`providerConnectionId` int,
	`workflowMode` enum('auto_reply','draft_for_approval','handoff_only') NOT NULL DEFAULT 'draft_for_approval',
	`systemInstructions` text,
	`businessHoursJson` text,
	`handoffKeywordsJson` text,
	`monthlyManagedMessageLimit` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_ai_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_ai_policies_client_unique` UNIQUE(`clientId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_ai_runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`channelId` int NOT NULL,
	`conversationId` int NOT NULL,
	`sourceMessageId` int,
	`resultMessageId` int,
	`billingMode` enum('client_api_key','vertex_managed') NOT NULL,
	`provider` varchar(80) NOT NULL,
	`model` varchar(180) NOT NULL,
	`status` enum('queued','drafted','sent','failed','blocked') NOT NULL DEFAULT 'queued',
	`inputTokens` int,
	`outputTokens` int,
	`totalTokens` int,
	`requestDurationMs` int,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `whatsapp_ai_runs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_audit_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`actorUserId` int,
	`action` varchar(160) NOT NULL,
	`entityType` varchar(80) NOT NULL,
	`entityId` int,
	`detailsJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_audit_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_channels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`label` varchar(140) NOT NULL,
	`provider` enum('meta_cloud','twilio') NOT NULL,
	`status` enum('draft','verification_pending','active','paused','error') NOT NULL DEFAULT 'draft',
	`displayPhoneNumber` varchar(40),
	`externalAccountId` varchar(220),
	`externalSenderId` varchar(220),
	`encryptedConfig` text,
	`configHint` varchar(32),
	`verifiedAt` timestamp,
	`lastInboundAt` timestamp,
	`lastOutboundAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_channels_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_channels_owner_client_label_unique` UNIQUE(`ownerUserId`,`clientId`,`label`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`phoneE164` varchar(32) NOT NULL,
	`displayName` varchar(220),
	`optInStatus` enum('unknown','opted_in','opted_out') NOT NULL DEFAULT 'unknown',
	`optedInAt` timestamp,
	`optedOutAt` timestamp,
	`lastInboundAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_contacts_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_contacts_client_phone_unique` UNIQUE(`clientId`,`phoneE164`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`channelId` int NOT NULL,
	`contactId` int NOT NULL,
	`assignedOperatorId` int,
	`status` enum('ai_active','waiting_human','human_active','closed') NOT NULL DEFAULT 'ai_active',
	`lastMessagePreview` varchar(300),
	`lastMessageAt` timestamp,
	`serviceWindowExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_conversations_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_conversations_channel_contact_unique` UNIQUE(`channelId`,`contactId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`channelId` int NOT NULL,
	`conversationId` int NOT NULL,
	`providerMessageId` varchar(300),
	`direction` enum('inbound','outbound') NOT NULL,
	`authorType` enum('contact','ai','human','system') NOT NULL,
	`body` text,
	`mediaUrl` varchar(1200),
	`templateName` varchar(180),
	`deliveryStatus` enum('received','queued','sent','delivered','read','failed') NOT NULL DEFAULT 'received',
	`providerPayloadJson` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_messages_provider_message_unique` UNIQUE(`providerMessageId`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_webhook_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`channelId` int,
	`provider` enum('meta_cloud','twilio') NOT NULL,
	`externalEventId` varchar(300) NOT NULL,
	`processingStatus` enum('received','processed','ignored','failed') NOT NULL DEFAULT 'received',
	`payloadJson` text NOT NULL,
	`errorMessage` text,
	`receivedAt` timestamp NOT NULL DEFAULT (now()),
	`processedAt` timestamp,
	CONSTRAINT `whatsapp_webhook_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_webhook_events_provider_event_unique` UNIQUE(`provider`,`externalEventId`)
);
--> statement-breakpoint
ALTER TABLE `client_portal_members` ADD CONSTRAINT `client_portal_members_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_portal_members` ADD CONSTRAINT `client_portal_members_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_portal_members` ADD CONSTRAINT `client_portal_members_invitedByUserId_users_id_fk` FOREIGN KEY (`invitedByUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_plans` ADD CONSTRAINT `saas_plans_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_subscriptions` ADD CONSTRAINT `saas_subscriptions_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_subscriptions` ADD CONSTRAINT `saas_subscriptions_planId_saas_plans_id_fk` FOREIGN KEY (`planId`) REFERENCES `saas_plans`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `saas_subscriptions` ADD CONSTRAINT `saas_subscriptions_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD CONSTRAINT `whatsapp_ai_policies_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD CONSTRAINT `whatsapp_ai_policies_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD CONSTRAINT `wa_ai_policy_connection_fk` FOREIGN KEY (`providerConnectionId`) REFERENCES `client_ai_connections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_runs` ADD CONSTRAINT `whatsapp_ai_runs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_runs` ADD CONSTRAINT `whatsapp_ai_runs_channelId_whatsapp_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_runs` ADD CONSTRAINT `whatsapp_ai_runs_conversationId_whatsapp_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `whatsapp_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_runs` ADD CONSTRAINT `whatsapp_ai_runs_sourceMessageId_whatsapp_messages_id_fk` FOREIGN KEY (`sourceMessageId`) REFERENCES `whatsapp_messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_runs` ADD CONSTRAINT `whatsapp_ai_runs_resultMessageId_whatsapp_messages_id_fk` FOREIGN KEY (`resultMessageId`) REFERENCES `whatsapp_messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_audit_logs` ADD CONSTRAINT `whatsapp_audit_logs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_audit_logs` ADD CONSTRAINT `whatsapp_audit_logs_actorUserId_users_id_fk` FOREIGN KEY (`actorUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_channels` ADD CONSTRAINT `whatsapp_channels_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_channels` ADD CONSTRAINT `whatsapp_channels_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_contacts` ADD CONSTRAINT `whatsapp_contacts_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_channelId_whatsapp_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_contactId_whatsapp_contacts_id_fk` FOREIGN KEY (`contactId`) REFERENCES `whatsapp_contacts`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_conversations` ADD CONSTRAINT `whatsapp_conversations_assignedOperatorId_operators_id_fk` FOREIGN KEY (`assignedOperatorId`) REFERENCES `operators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_channelId_whatsapp_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_messages` ADD CONSTRAINT `whatsapp_messages_conversationId_whatsapp_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `whatsapp_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_webhook_events` ADD CONSTRAINT `whatsapp_webhook_events_channelId_whatsapp_channels_id_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_portal_members_user_status_idx` ON `client_portal_members` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `saas_subscriptions_owner_status_idx` ON `saas_subscriptions` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_ai_policies_owner_idx` ON `whatsapp_ai_policies` (`ownerUserId`);--> statement-breakpoint
CREATE INDEX `whatsapp_ai_runs_client_created_idx` ON `whatsapp_ai_runs` (`clientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `whatsapp_ai_runs_conversation_idx` ON `whatsapp_ai_runs` (`conversationId`);--> statement-breakpoint
CREATE INDEX `whatsapp_ai_runs_status_idx` ON `whatsapp_ai_runs` (`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_audit_logs_client_created_idx` ON `whatsapp_audit_logs` (`clientId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `whatsapp_channels_client_status_idx` ON `whatsapp_channels` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_channels_provider_sender_idx` ON `whatsapp_channels` (`provider`,`externalSenderId`);--> statement-breakpoint
CREATE INDEX `whatsapp_contacts_client_optin_idx` ON `whatsapp_contacts` (`clientId`,`optInStatus`);--> statement-breakpoint
CREATE INDEX `whatsapp_conversations_client_status_updated_idx` ON `whatsapp_conversations` (`clientId`,`status`,`updatedAt`);--> statement-breakpoint
CREATE INDEX `whatsapp_conversations_operator_status_idx` ON `whatsapp_conversations` (`assignedOperatorId`,`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_messages_conversation_occurred_idx` ON `whatsapp_messages` (`conversationId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `whatsapp_messages_client_direction_idx` ON `whatsapp_messages` (`clientId`,`direction`);--> statement-breakpoint
CREATE INDEX `whatsapp_webhook_events_channel_status_idx` ON `whatsapp_webhook_events` (`channelId`,`processingStatus`);

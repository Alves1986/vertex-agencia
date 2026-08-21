CREATE TABLE `whatsapp_automation_executions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`channelId` int NOT NULL,
	`conversationId` int NOT NULL,
	`sourceMessageId` int,
	`automationRuleId` int,
	`status` enum('queued','executed','skipped','blocked','failed') NOT NULL DEFAULT 'queued',
	`decisionReason` text,
	`outputJson` text,
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_automation_executions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_automation_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`channelId` int,
	`name` varchar(180) NOT NULL,
	`triggerType` enum('inbound_message','keyword','outside_business_hours','handoff_requested') NOT NULL,
	`triggerConfigJson` text,
	`actionType` enum('ai_reply','draft_for_approval','handoff_human','tag_conversation') NOT NULL,
	`actionConfigJson` text,
	`requiresApproval` int NOT NULL DEFAULT 1,
	`priority` int NOT NULL DEFAULT 100,
	`status` enum('draft','active','paused') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_automation_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_automation_executions` ADD CONSTRAINT `wa_exec_client_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_executions` ADD CONSTRAINT `wa_exec_channel_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_executions` ADD CONSTRAINT `wa_exec_conversation_fk` FOREIGN KEY (`conversationId`) REFERENCES `whatsapp_conversations`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_executions` ADD CONSTRAINT `wa_exec_message_fk` FOREIGN KEY (`sourceMessageId`) REFERENCES `whatsapp_messages`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_executions` ADD CONSTRAINT `wa_exec_rule_fk` FOREIGN KEY (`automationRuleId`) REFERENCES `whatsapp_automation_rules`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_rules` ADD CONSTRAINT `wa_rule_client_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_rules` ADD CONSTRAINT `wa_rule_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_automation_rules` ADD CONSTRAINT `wa_rule_channel_fk` FOREIGN KEY (`channelId`) REFERENCES `whatsapp_channels`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `whatsapp_automation_exec_conversation_idx` ON `whatsapp_automation_executions` (`conversationId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `whatsapp_automation_exec_rule_status_idx` ON `whatsapp_automation_executions` (`automationRuleId`,`status`);--> statement-breakpoint
CREATE INDEX `whatsapp_automation_rules_client_status_idx` ON `whatsapp_automation_rules` (`clientId`,`status`,`priority`);--> statement-breakpoint
CREATE INDEX `whatsapp_automation_rules_channel_trigger_idx` ON `whatsapp_automation_rules` (`channelId`,`triggerType`);

CREATE TABLE `asset_usage_rights` (
	`id` int AUTO_INCREMENT NOT NULL,
	`brandAssetId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`versionLabel` varchar(160),
	`licenseType` enum('owned','licensed','stock','partner','editorial','unknown') NOT NULL DEFAULT 'unknown',
	`usageScope` text,
	`sourceUrl` varchar(1400),
	`status` enum('active','expiring','expired','restricted') NOT NULL DEFAULT 'active',
	`expiresAt` timestamp,
	`reviewedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `asset_usage_rights_id` PRIMARY KEY(`id`),
	CONSTRAINT `asset_usage_rights_asset_version_unique` UNIQUE(`brandAssetId`,`versionLabel`)
);
--> statement-breakpoint
CREATE TABLE `capacity_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`teamId` int,
	`operatorId` int NOT NULL,
	`periodStart` timestamp NOT NULL,
	`capacityMinutes` int NOT NULL,
	`bookedMinutes` int NOT NULL DEFAULT 0,
	`notes` varchar(600),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `capacity_plans_id` PRIMARY KEY(`id`),
	CONSTRAINT `capacity_plans_operator_period_unique` UNIQUE(`operatorId`,`periodStart`)
);
--> statement-breakpoint
CREATE TABLE `client_consents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`subjectName` varchar(180),
	`subjectEmail` varchar(320),
	`consentType` enum('marketing','data_processing','whatsapp','email','terms') NOT NULL,
	`status` enum('granted','revoked','pending') NOT NULL DEFAULT 'pending',
	`legalBasis` varchar(180),
	`evidenceUrl` varchar(1400),
	`grantedAt` timestamp,
	`revokedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_consents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `commercial_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`leadId` int,
	`clientId` int,
	`proposalNumber` varchar(80) NOT NULL,
	`title` varchar(220) NOT NULL,
	`scope` text NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`status` enum('draft','sent','viewed','accepted','rejected','expired') NOT NULL DEFAULT 'draft',
	`validUntil` timestamp,
	`sentAt` timestamp,
	`decidedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `commercial_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `commercial_proposals_owner_number_unique` UNIQUE(`ownerUserId`,`proposalNumber`)
);
--> statement-breakpoint
CREATE TABLE `data_retention_policies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int,
	`dataCategory` enum('contacts','conversations','creative','analytics','financial','research') NOT NULL,
	`retentionDays` int NOT NULL,
	`status` enum('active','paused') NOT NULL DEFAULT 'active',
	`reviewAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `data_retention_policies_id` PRIMARY KEY(`id`),
	CONSTRAINT `data_retention_owner_client_category_unique` UNIQUE(`ownerUserId`,`clientId`,`dataCategory`)
);
--> statement-breakpoint
CREATE TABLE `editorial_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`projectId` int,
	`campaignId` int,
	`assignedOperatorId` int,
	`title` varchar(240) NOT NULL,
	`channel` enum('instagram','facebook','tiktok','youtube','linkedin','blog','email','whatsapp','other') NOT NULL DEFAULT 'instagram',
	`format` varchar(120),
	`pillar` varchar(160),
	`objective` varchar(220),
	`brief` text,
	`status` enum('idea','briefing','production','review','approved','published','archived') NOT NULL DEFAULT 'idea',
	`plannedFor` timestamp,
	`publishedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `editorial_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `financial_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`contractId` int,
	`projectId` int,
	`entryType` enum('revenue','expense','media_spend','refund') NOT NULL,
	`status` enum('planned','invoiced','paid','overdue','cancelled') NOT NULL DEFAULT 'planned',
	`category` varchar(120),
	`description` varchar(320) NOT NULL,
	`amountCents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'BRL',
	`dueAt` timestamp,
	`paidAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `financial_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `integration_health_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int,
	`integrationType` enum('ai','whatsapp','email','media','research','crm','other') NOT NULL,
	`provider` varchar(140) NOT NULL,
	`status` enum('healthy','warning','error','unknown') NOT NULL DEFAULT 'unknown',
	`safeMessage` varchar(800),
	`checkedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `integration_health_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_research_sources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`researchId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`sourceType` enum('web','social','video','community','report','competitor','other') NOT NULL DEFAULT 'web',
	`title` varchar(300) NOT NULL,
	`url` varchar(1400) NOT NULL,
	`publisher` varchar(220),
	`excerpt` text,
	`publishedAt` timestamp,
	`capturedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `marketing_research_sources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `marketing_researches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`campaignId` int,
	`title` varchar(240) NOT NULL,
	`objective` varchar(240) NOT NULL,
	`question` text NOT NULL,
	`audience` varchar(240),
	`market` varchar(240),
	`status` enum('draft','collecting','review','accepted','archived') NOT NULL DEFAULT 'draft',
	`summary` text,
	`recommendation` text,
	`risks` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketing_researches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paid_media_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`campaignId` int,
	`name` varchar(220) NOT NULL,
	`platform` enum('meta','google','tiktok','linkedin','other') NOT NULL,
	`objective` varchar(180) NOT NULL,
	`targetMetric` varchar(100),
	`targetValue` int,
	`plannedBudgetCents` int NOT NULL,
	`status` enum('draft','active','paused','completed') NOT NULL DEFAULT 'draft',
	`startsAt` timestamp,
	`endsAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paid_media_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `paid_media_snapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`mediaPlanId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`recordedAt` timestamp NOT NULL,
	`spendCents` int NOT NULL DEFAULT 0,
	`impressions` int NOT NULL DEFAULT 0,
	`reach` int NOT NULL DEFAULT 0,
	`clicks` int NOT NULL DEFAULT 0,
	`leads` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`conversionValueCents` int NOT NULL DEFAULT 0,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `paid_media_snapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `paid_media_snapshots_plan_date_unique` UNIQUE(`mediaPlanId`,`recordedAt`)
);
--> statement-breakpoint
CREATE TABLE `sales_activities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`leadId` int NOT NULL,
	`authorUserId` int NOT NULL,
	`activityType` enum('note','call','email','meeting','task','status_change') NOT NULL,
	`description` text NOT NULL,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`nextActionAt` timestamp,
	CONSTRAINT `sales_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sales_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`convertedClientId` int,
	`responsibleOperatorId` int,
	`companyName` varchar(220) NOT NULL,
	`contactName` varchar(180),
	`contactEmail` varchar(320),
	`contactPhone` varchar(40),
	`source` varchar(120),
	`status` enum('new','qualified','proposal','negotiation','won','lost','archived') NOT NULL DEFAULT 'new',
	`score` int,
	`estimatedMonthlyRevenueCents` int,
	`nextActionAt` timestamp,
	`lostReason` varchar(500),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sales_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `service_contracts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`leadId` int,
	`proposalId` int,
	`code` varchar(80) NOT NULL,
	`title` varchar(220) NOT NULL,
	`scope` text NOT NULL,
	`status` enum('draft','active','suspended','ended','renewal_due') NOT NULL DEFAULT 'draft',
	`billingCycle` enum('monthly','annual','project') NOT NULL DEFAULT 'monthly',
	`recurringRevenueCents` int,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`signedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `service_contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `service_contracts_owner_code_unique` UNIQUE(`ownerUserId`,`code`)
);
--> statement-breakpoint
CREATE TABLE `time_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`ownerUserId` int NOT NULL,
	`clientId` int NOT NULL,
	`projectId` int,
	`taskId` int,
	`operatorId` int,
	`workedMinutes` int NOT NULL,
	`billable` int NOT NULL DEFAULT 1,
	`internalCostCents` int,
	`note` varchar(800),
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `time_entries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `asset_usage_rights` ADD CONSTRAINT `asset_usage_rights_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `asset_usage_rights` ADD CONSTRAINT `asset_usage_rights_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `asset_usage_rights` ADD CONSTRAINT `asset_right_brand_asset_fk` FOREIGN KEY (`brandAssetId`) REFERENCES `client_brand_assets`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `capacity_plans` ADD CONSTRAINT `capacity_plans_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `capacity_plans` ADD CONSTRAINT `capacity_plans_teamId_teams_id_fk` FOREIGN KEY (`teamId`) REFERENCES `teams`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `capacity_plans` ADD CONSTRAINT `capacity_plans_operatorId_operators_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `operators`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_consents` ADD CONSTRAINT `client_consents_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_consents` ADD CONSTRAINT `client_consents_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_proposals` ADD CONSTRAINT `commercial_proposals_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_proposals` ADD CONSTRAINT `commercial_proposals_leadId_sales_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `sales_leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_proposals` ADD CONSTRAINT `commercial_proposals_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_retention_policies` ADD CONSTRAINT `data_retention_policies_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `data_retention_policies` ADD CONSTRAINT `data_retention_policies_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorial_items` ADD CONSTRAINT `editorial_items_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorial_items` ADD CONSTRAINT `editorial_items_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorial_items` ADD CONSTRAINT `editorial_items_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorial_items` ADD CONSTRAINT `editorial_items_campaignId_ad_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `editorial_items` ADD CONSTRAINT `editorial_items_assignedOperatorId_operators_id_fk` FOREIGN KEY (`assignedOperatorId`) REFERENCES `operators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_entries` ADD CONSTRAINT `financial_entries_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_entries` ADD CONSTRAINT `financial_entries_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_entries` ADD CONSTRAINT `financial_entries_contractId_service_contracts_id_fk` FOREIGN KEY (`contractId`) REFERENCES `service_contracts`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `financial_entries` ADD CONSTRAINT `financial_entries_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_health_logs` ADD CONSTRAINT `integration_health_logs_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `integration_health_logs` ADD CONSTRAINT `integration_health_logs_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_research_sources` ADD CONSTRAINT `marketing_research_sources_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_research_sources` ADD CONSTRAINT `marketing_research_sources_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_research_sources` ADD CONSTRAINT `research_source_research_fk` FOREIGN KEY (`researchId`) REFERENCES `marketing_researches`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_researches` ADD CONSTRAINT `marketing_researches_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_researches` ADD CONSTRAINT `marketing_researches_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `marketing_researches` ADD CONSTRAINT `marketing_researches_campaignId_ad_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_plans` ADD CONSTRAINT `paid_media_plans_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_plans` ADD CONSTRAINT `paid_media_plans_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_plans` ADD CONSTRAINT `paid_media_plans_campaignId_ad_campaigns_id_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_snapshots` ADD CONSTRAINT `paid_media_snapshots_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_snapshots` ADD CONSTRAINT `paid_media_snapshots_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paid_media_snapshots` ADD CONSTRAINT `media_snapshot_plan_fk` FOREIGN KEY (`mediaPlanId`) REFERENCES `paid_media_plans`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_activities` ADD CONSTRAINT `sales_activities_leadId_sales_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `sales_leads`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_activities` ADD CONSTRAINT `sales_activities_authorUserId_users_id_fk` FOREIGN KEY (`authorUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_leads` ADD CONSTRAINT `sales_leads_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_leads` ADD CONSTRAINT `sales_leads_convertedClientId_clients_id_fk` FOREIGN KEY (`convertedClientId`) REFERENCES `clients`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_leads` ADD CONSTRAINT `sales_leads_responsibleOperatorId_operators_id_fk` FOREIGN KEY (`responsibleOperatorId`) REFERENCES `operators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_contracts` ADD CONSTRAINT `service_contracts_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_contracts` ADD CONSTRAINT `service_contracts_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_contracts` ADD CONSTRAINT `service_contracts_leadId_sales_leads_id_fk` FOREIGN KEY (`leadId`) REFERENCES `sales_leads`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `service_contracts` ADD CONSTRAINT `service_contracts_proposalId_commercial_proposals_id_fk` FOREIGN KEY (`proposalId`) REFERENCES `commercial_proposals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_taskId_tasks_id_fk` FOREIGN KEY (`taskId`) REFERENCES `tasks`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `time_entries` ADD CONSTRAINT `time_entries_operatorId_operators_id_fk` FOREIGN KEY (`operatorId`) REFERENCES `operators`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `asset_usage_rights_client_status_idx` ON `asset_usage_rights` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `asset_usage_rights_expiry_idx` ON `asset_usage_rights` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `capacity_plans_owner_period_idx` ON `capacity_plans` (`ownerUserId`,`periodStart`);--> statement-breakpoint
CREATE INDEX `client_consents_client_type_idx` ON `client_consents` (`clientId`,`consentType`,`status`);--> statement-breakpoint
CREATE INDEX `client_consents_subject_idx` ON `client_consents` (`subjectEmail`);--> statement-breakpoint
CREATE INDEX `commercial_proposals_owner_status_idx` ON `commercial_proposals` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `commercial_proposals_lead_idx` ON `commercial_proposals` (`leadId`);--> statement-breakpoint
CREATE INDEX `commercial_proposals_client_idx` ON `commercial_proposals` (`clientId`);--> statement-breakpoint
CREATE INDEX `data_retention_review_idx` ON `data_retention_policies` (`reviewAt`);--> statement-breakpoint
CREATE INDEX `editorial_items_client_plan_idx` ON `editorial_items` (`clientId`,`plannedFor`);--> statement-breakpoint
CREATE INDEX `editorial_items_client_status_idx` ON `editorial_items` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `editorial_items_operator_idx` ON `editorial_items` (`assignedOperatorId`);--> statement-breakpoint
CREATE INDEX `financial_entries_client_status_idx` ON `financial_entries` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `financial_entries_owner_paid_idx` ON `financial_entries` (`ownerUserId`,`paidAt`);--> statement-breakpoint
CREATE INDEX `financial_entries_due_idx` ON `financial_entries` (`dueAt`);--> statement-breakpoint
CREATE INDEX `integration_health_owner_client_checked_idx` ON `integration_health_logs` (`ownerUserId`,`clientId`,`checkedAt`);--> statement-breakpoint
CREATE INDEX `integration_health_status_idx` ON `integration_health_logs` (`status`);--> statement-breakpoint
CREATE INDEX `marketing_research_sources_research_idx` ON `marketing_research_sources` (`researchId`);--> statement-breakpoint
CREATE INDEX `marketing_research_sources_client_idx` ON `marketing_research_sources` (`clientId`);--> statement-breakpoint
CREATE INDEX `marketing_researches_client_status_idx` ON `marketing_researches` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `marketing_researches_campaign_idx` ON `marketing_researches` (`campaignId`);--> statement-breakpoint
CREATE INDEX `paid_media_plans_client_status_idx` ON `paid_media_plans` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `paid_media_plans_client_period_idx` ON `paid_media_plans` (`clientId`,`startsAt`,`endsAt`);--> statement-breakpoint
CREATE INDEX `paid_media_snapshots_client_date_idx` ON `paid_media_snapshots` (`clientId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `sales_activities_lead_occurred_idx` ON `sales_activities` (`leadId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `sales_leads_owner_status_idx` ON `sales_leads` (`ownerUserId`,`status`);--> statement-breakpoint
CREATE INDEX `sales_leads_owner_action_idx` ON `sales_leads` (`ownerUserId`,`nextActionAt`);--> statement-breakpoint
CREATE INDEX `sales_leads_operator_idx` ON `sales_leads` (`responsibleOperatorId`);--> statement-breakpoint
CREATE INDEX `service_contracts_client_status_idx` ON `service_contracts` (`clientId`,`status`);--> statement-breakpoint
CREATE INDEX `service_contracts_ends_idx` ON `service_contracts` (`endsAt`);--> statement-breakpoint
CREATE INDEX `time_entries_client_occurred_idx` ON `time_entries` (`clientId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `time_entries_operator_occurred_idx` ON `time_entries` (`operatorId`,`occurredAt`);--> statement-breakpoint
CREATE INDEX `time_entries_project_idx` ON `time_entries` (`projectId`);

CREATE TABLE `carousel_brief_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(500),
	`fieldsJson` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `carousel_brief_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `carousel_brief_templates_client_name_unique` UNIQUE(`clientId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `client_brand_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(220) NOT NULL,
	`assetType` enum('logo','product','reference','palette','other') NOT NULL DEFAULT 'reference',
	`storageKey` varchar(1000) NOT NULL,
	`assetUrl` varchar(1200) NOT NULL,
	`mimeType` varchar(120) NOT NULL,
	`byteSize` int NOT NULL,
	`status` enum('authorized','archived') NOT NULL DEFAULT 'authorized',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_brand_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `carousel_brief_templates` ADD CONSTRAINT `carousel_brief_templates_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carousel_brief_templates` ADD CONSTRAINT `carousel_brief_templates_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_brand_assets` ADD CONSTRAINT `client_brand_assets_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_brand_assets` ADD CONSTRAINT `client_brand_assets_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `carousel_brief_templates_owner_client_idx` ON `carousel_brief_templates` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `client_brand_assets_owner_client_idx` ON `client_brand_assets` (`ownerUserId`,`clientId`);--> statement-breakpoint
CREATE INDEX `client_brand_assets_client_status_idx` ON `client_brand_assets` (`clientId`,`status`);
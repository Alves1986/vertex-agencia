CREATE TABLE `client_brand_asset_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`description` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `client_brand_asset_collections_id` PRIMARY KEY(`id`),
	CONSTRAINT `client_brand_asset_collections_client_name_unique` UNIQUE(`clientId`,`name`)
);
--> statement-breakpoint
ALTER TABLE `client_brand_assets` ADD `collectionId` int;--> statement-breakpoint
ALTER TABLE `client_brand_asset_collections` ADD CONSTRAINT `client_brand_asset_collections_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `client_brand_asset_collections` ADD CONSTRAINT `client_brand_asset_collections_ownerUserId_users_id_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_brand_asset_collections_owner_client_idx` ON `client_brand_asset_collections` (`ownerUserId`,`clientId`);--> statement-breakpoint
ALTER TABLE `client_brand_assets` ADD CONSTRAINT `brand_assets_collection_fk` FOREIGN KEY (`collectionId`) REFERENCES `client_brand_asset_collections`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `client_brand_assets_client_collection_idx` ON `client_brand_assets` (`clientId`,`collectionId`);

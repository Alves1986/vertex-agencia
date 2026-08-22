ALTER TABLE `calendar_events` DROP FOREIGN KEY `calendar_events_clientId_clients_id_fk`;
--> statement-breakpoint
ALTER TABLE `commercial_proposals` DROP FOREIGN KEY `commercial_proposals_clientId_clients_id_fk`;
--> statement-breakpoint
ALTER TABLE `sales_leads` DROP FOREIGN KEY `sales_leads_convertedClientId_clients_id_fk`;
--> statement-breakpoint
ALTER TABLE `calendar_events` ADD CONSTRAINT `calendar_events_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `commercial_proposals` ADD CONSTRAINT `commercial_proposals_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sales_leads` ADD CONSTRAINT `sales_leads_convertedClientId_clients_id_fk` FOREIGN KEY (`convertedClientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;
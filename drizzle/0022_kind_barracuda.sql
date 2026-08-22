ALTER TABLE `projects` DROP FOREIGN KEY `projects_clientId_clients_id_fk`;
--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_clientId_clients_id_fk` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE cascade ON UPDATE no action;
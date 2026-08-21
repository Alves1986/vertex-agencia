CREATE TABLE `carousel_slide_approval_batches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creativeVersionId` int NOT NULL,
	`campaignId` int NOT NULL,
	`ownerUserId` int NOT NULL,
	`reviewerUserId` int NOT NULL,
	`slideNumbersJson` text NOT NULL,
	`decision` enum('approved','changes_requested') NOT NULL DEFAULT 'approved',
	`note` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `carousel_slide_approval_batches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `carousel_slide_approval_batches` ADD CONSTRAINT `carousel_batch_version_fk` FOREIGN KEY (`creativeVersionId`) REFERENCES `creative_versions`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carousel_slide_approval_batches` ADD CONSTRAINT `carousel_batch_campaign_fk` FOREIGN KEY (`campaignId`) REFERENCES `ad_campaigns`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carousel_slide_approval_batches` ADD CONSTRAINT `carousel_batch_owner_fk` FOREIGN KEY (`ownerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `carousel_slide_approval_batches` ADD CONSTRAINT `carousel_batch_reviewer_fk` FOREIGN KEY (`reviewerUserId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `carousel_batch_approvals_version_idx` ON `carousel_slide_approval_batches` (`creativeVersionId`);--> statement-breakpoint
CREATE INDEX `carousel_batch_approvals_campaign_idx` ON `carousel_slide_approval_batches` (`campaignId`);--> statement-breakpoint
CREATE INDEX `carousel_batch_approvals_owner_idx` ON `carousel_slide_approval_batches` (`ownerUserId`);

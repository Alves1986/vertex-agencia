ALTER TABLE `saas_plans` ADD `managedAiCostPerThousandCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saas_plans` ADD `managedAiMarkupPercent` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saas_plans` ADD `managedAiOveragePricePerThousandCents` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `saas_subscriptions` ADD `stripeCustomerId` varchar(255);--> statement-breakpoint
ALTER TABLE `saas_subscriptions` ADD `stripePriceId` varchar(255);--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD `managedAiCostPerThousandCents` int;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD `managedAiMarkupPercent` int;--> statement-breakpoint
ALTER TABLE `whatsapp_ai_policies` ADD `managedAiOveragePricePerThousandCents` int;
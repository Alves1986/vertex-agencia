ALTER TABLE `ai_generations` ADD `inputTokens` int;--> statement-breakpoint
ALTER TABLE `ai_generations` ADD `outputTokens` int;--> statement-breakpoint
ALTER TABLE `ai_generations` ADD `totalTokens` int;--> statement-breakpoint
ALTER TABLE `ai_generations` ADD `requestDurationMs` int;
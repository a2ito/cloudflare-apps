ALTER TABLE `categories` ADD `price_score_weight` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `spec_fields` ADD `score_weight` integer DEFAULT 0 NOT NULL;
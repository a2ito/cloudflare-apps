CREATE TABLE `exchange_rates` (
	`group_id` text NOT NULL,
	`currency` text NOT NULL,
	`rate` text NOT NULL,
	`updated_at` integer NOT NULL,
	PRIMARY KEY(`group_id`, `currency`),
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `currency` text DEFAULT 'JPY' NOT NULL;--> statement-breakpoint
-- 既存の立替はグループの通貨で記録されていたので、それを引き継ぐ
UPDATE `expenses` SET `currency` = (SELECT `currency` FROM `groups` WHERE `groups`.`id` = `expenses`.`group_id`);

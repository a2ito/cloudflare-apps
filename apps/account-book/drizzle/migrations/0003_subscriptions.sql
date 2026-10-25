CREATE TABLE `subscriptions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` text NOT NULL,
	`name` text NOT NULL,
	`amount` integer NOT NULL,
	`category_id` text NOT NULL,
	`cycle` text NOT NULL,
	`billing_day` integer NOT NULL,
	`billing_month` integer,
	`start_date` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`group_id`) REFERENCES `groups`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
ALTER TABLE `expenses` ADD `subscription_id` integer;--> statement-breakpoint
CREATE UNIQUE INDEX `expenses_subscription_id_date_unique` ON `expenses` (`subscription_id`,`date`);
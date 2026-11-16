CREATE TABLE `networks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`ssid` text NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `networks_user_ssid_idx` ON `networks` (`user_id`,`ssid`);--> statement-breakpoint
ALTER TABLE `samples` ADD `network_id` integer;--> statement-breakpoint
CREATE INDEX `samples_network_measured_at_idx` ON `samples` (`network_id`,`measured_at`);
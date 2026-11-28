CREATE TABLE `parent_child` (
	`tree_id` integer NOT NULL,
	`parent_id` integer NOT NULL,
	`child_id` integer NOT NULL,
	PRIMARY KEY(`parent_id`, `child_id`),
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`child_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "parent_child_not_self" CHECK("parent_child"."parent_id" <> "parent_child"."child_id")
);
--> statement-breakpoint
CREATE INDEX `parent_child_tree_idx` ON `parent_child` (`tree_id`);--> statement-breakpoint
CREATE TABLE `partnerships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tree_id` integer NOT NULL,
	`person_a_id` integer NOT NULL,
	`person_b_id` integer NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_a_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`person_b_id`) REFERENCES `persons`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "partnerships_ordered" CHECK("partnerships"."person_a_id" < "partnerships"."person_b_id")
);
--> statement-breakpoint
CREATE UNIQUE INDEX `partnerships_pair_idx` ON `partnerships` (`person_a_id`,`person_b_id`);--> statement-breakpoint
CREATE INDEX `partnerships_tree_idx` ON `partnerships` (`tree_id`);--> statement-breakpoint
CREATE TABLE `persons` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`tree_id` integer NOT NULL,
	`name` text NOT NULL,
	`kana` text,
	`gender` text DEFAULT 'unknown' NOT NULL,
	`birth_date` text,
	`death_date` text,
	`note` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `persons_tree_idx` ON `persons` (`tree_id`);--> statement-breakpoint
CREATE TABLE `tree_members` (
	`tree_id` integer NOT NULL,
	`email` text NOT NULL,
	`role` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	PRIMARY KEY(`tree_id`, `email`),
	FOREIGN KEY (`tree_id`) REFERENCES `trees`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `tree_members_email_idx` ON `tree_members` (`email`);--> statement-breakpoint
CREATE TABLE `trees` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`email` text NOT NULL,
	`name` text,
	`image` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);
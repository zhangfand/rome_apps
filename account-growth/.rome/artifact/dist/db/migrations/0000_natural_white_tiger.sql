CREATE TABLE `account_growth__plans` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`markdown` text NOT NULL,
	`performance_summary` text,
	`focus` text,
	`created_at` integer NOT NULL
);

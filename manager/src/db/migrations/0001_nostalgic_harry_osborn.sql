CREATE TABLE `manager__preferences` (
	`id` text PRIMARY KEY NOT NULL,
	`selected_repo` text,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `manager__snapshots` (
	`repo` text PRIMARY KEY NOT NULL,
	`data` text NOT NULL,
	`synced_at` integer NOT NULL
);

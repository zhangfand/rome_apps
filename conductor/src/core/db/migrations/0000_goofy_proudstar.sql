CREATE TABLE `conductor__config` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conductor__facts` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`task_id` text NOT NULL,
	`kind` text NOT NULL,
	`by` text NOT NULL,
	`source` text,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `conductor__facts_task_idx` ON `conductor__facts` (`task_id`);--> statement-breakpoint
CREATE INDEX `conductor__facts_id_idx` ON `conductor__facts` (`id`);--> statement-breakpoint
CREATE TABLE `conductor__locks` (
	`name` text PRIMARY KEY NOT NULL,
	`held_until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `conductor__worker_health` (
	`worker_id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`last_heartbeat_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);

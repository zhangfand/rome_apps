CREATE TABLE `conductor__intervention_notices` (
	`key` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`fact_seq` integer NOT NULL,
	`status` text NOT NULL,
	`provider_message_id` text,
	`failure_code` text,
	`created_at` integer NOT NULL,
	`attempted_at` integer,
	`settled_at` integer
);
--> statement-breakpoint
CREATE INDEX `conductor__intervention_notices_task_idx` ON `conductor__intervention_notices` (`task_id`);
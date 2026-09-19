CREATE TABLE `conductor__task_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`session_id` text NOT NULL,
	`session_type` text NOT NULL,
	`role` text NOT NULL,
	`worker_id` text,
	`job_id` text,
	`created_at` integer NOT NULL,
	`last_seen_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conductor__task_sessions_task_session_idx` ON `conductor__task_sessions` (`task_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `conductor__task_sessions_task_idx` ON `conductor__task_sessions` (`task_id`);
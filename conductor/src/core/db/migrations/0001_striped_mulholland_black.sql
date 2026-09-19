CREATE TABLE `conductor__frontdesk_shadow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`channel_thread_key` text NOT NULL,
	`input` text NOT NULL,
	`state` text NOT NULL,
	`status` text NOT NULL,
	`model` text,
	`decision` text,
	`raw_response` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`latency_ms` integer,
	`error` text,
	`actual_kind` text,
	`actual_task_id` text,
	`actual_project_id` text,
	`matched` integer,
	`mismatch` text,
	`created_at` integer NOT NULL,
	`completed_at` integer
);
--> statement-breakpoint
CREATE INDEX `conductor__frontdesk_shadow_created_idx` ON `conductor__frontdesk_shadow_runs` (`created_at`);--> statement-breakpoint
CREATE INDEX `conductor__frontdesk_shadow_session_idx` ON `conductor__frontdesk_shadow_runs` (`session_id`);
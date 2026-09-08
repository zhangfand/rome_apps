CREATE TABLE `feature_video__playscripts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`name` text NOT NULL,
	`start_path` text DEFAULT '/' NOT NULL,
	`doc_json` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `feature_video__playscripts_project_idx` ON `feature_video__playscripts` (`project_id`);--> statement-breakpoint
CREATE TABLE `feature_video__projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_url` text NOT NULL,
	`ready_target_json` text NOT NULL,
	`stage_selector` text,
	`layout` text DEFAULT '1280x720' NOT NULL,
	`video` text DEFAULT '3840x2160' NOT NULL,
	`fps` integer DEFAULT 60 NOT NULL,
	`timezone` text,
	`locale` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `feature_video__runs` (
	`id` text PRIMARY KEY NOT NULL,
	`playscript_id` text NOT NULL,
	`status` text DEFAULT 'queued' NOT NULL,
	`dir` text NOT NULL,
	`report_json` text,
	`files_json` text,
	`error` text,
	`started_at` integer NOT NULL,
	`finished_at` integer
);
--> statement-breakpoint
CREATE INDEX `feature_video__runs_playscript_idx` ON `feature_video__runs` (`playscript_id`);--> statement-breakpoint
CREATE INDEX `feature_video__runs_status_idx` ON `feature_video__runs` (`status`);
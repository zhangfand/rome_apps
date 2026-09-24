CREATE TABLE `family_health__findings` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`member_id` text NOT NULL,
	`exam_date` text,
	`organ` text DEFAULT '' NOT NULL,
	`finding_key` text,
	`severity` text,
	`raw_text` text NOT NULL,
	`page` integer,
	`confirmed` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `family_health__findings_report_idx` ON `family_health__findings` (`report_id`);--> statement-breakpoint
CREATE INDEX `family_health__findings_member_key_idx` ON `family_health__findings` (`member_id`,`finding_key`);--> statement-breakpoint
CREATE TABLE `family_health__indicator_defs` (
	`code` text PRIMARY KEY NOT NULL,
	`name_zh` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`aliases` text DEFAULT '[]' NOT NULL,
	`category` text NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`value_type` text DEFAULT 'numeric' NOT NULL,
	`conversions` text DEFAULT '[]' NOT NULL,
	`ref_range` text,
	`direction` text NOT NULL,
	`sex` text,
	`derived` integer DEFAULT false NOT NULL,
	`explain` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_health__insights` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`scope_id` text NOT NULL,
	`member_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`content` text,
	`markdown` text,
	`error` text,
	`model` text,
	`prompt_version` text DEFAULT 'v1' NOT NULL,
	`input_hash` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `family_health__insights_scope_uq` ON `family_health__insights` (`scope`,`scope_id`);--> statement-breakpoint
CREATE TABLE `family_health__interventions` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`category` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text,
	`created_via` text DEFAULT 'ui' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `family_health__interventions_member_idx` ON `family_health__interventions` (`member_id`,`start_date`);--> statement-breakpoint
CREATE TABLE `family_health__measurements` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`indicator_code` text NOT NULL,
	`value` real NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`raw_value` text,
	`raw_unit` text,
	`measured_at` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_via` text DEFAULT 'chat' NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `family_health__measurements_member_code_idx` ON `family_health__measurements` (`member_id`,`indicator_code`,`measured_at`);--> statement-breakpoint
CREATE TABLE `family_health__members` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`relation` text DEFAULT '其他' NOT NULL,
	`sex` text,
	`birth_date` text,
	`height_cm` real,
	`goals` text DEFAULT '[]' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `family_health__reports` (
	`id` text PRIMARY KEY NOT NULL,
	`member_id` text NOT NULL,
	`exam_date` text,
	`provider` text DEFAULT '' NOT NULL,
	`source_files` text DEFAULT '[]' NOT NULL,
	`page_images` text DEFAULT '[]' NOT NULL,
	`status` text DEFAULT 'uploaded' NOT NULL,
	`error` text,
	`pages_done` integer DEFAULT 0 NOT NULL,
	`pages_total` integer DEFAULT 0 NOT NULL,
	`is_demo` integer DEFAULT false NOT NULL,
	`confirmed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `family_health__reports_member_idx` ON `family_health__reports` (`member_id`,`exam_date`);--> statement-breakpoint
CREATE TABLE `family_health__results` (
	`id` text PRIMARY KEY NOT NULL,
	`report_id` text NOT NULL,
	`member_id` text NOT NULL,
	`indicator_code` text,
	`raw_name` text NOT NULL,
	`raw_value` text DEFAULT '' NOT NULL,
	`value_num` real,
	`value_text` text,
	`raw_unit` text DEFAULT '' NOT NULL,
	`unit` text DEFAULT '' NOT NULL,
	`ref_low` real,
	`ref_high` real,
	`ref_text` text,
	`flag` text,
	`section` text,
	`page` integer,
	`confidence` real,
	`source` text DEFAULT 'extracted' NOT NULL,
	`confirmed` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `family_health__results_report_idx` ON `family_health__results` (`report_id`);--> statement-breakpoint
CREATE INDEX `family_health__results_member_code_idx` ON `family_health__results` (`member_id`,`indicator_code`);
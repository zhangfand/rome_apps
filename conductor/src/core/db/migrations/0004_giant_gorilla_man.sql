CREATE TABLE `conductor__agent_instance_mappings` (
	`id` text PRIMARY KEY NOT NULL,
	`instance_id` text NOT NULL,
	`identity_type` text NOT NULL,
	`identity_value` text NOT NULL,
	`relation` text NOT NULL,
	`cursor_seq` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `conductor__agent_instance_mappings_identity_idx` ON `conductor__agent_instance_mappings` (`identity_type`,`identity_value`,`relation`);--> statement-breakpoint
CREATE UNIQUE INDEX `conductor__agent_instance_mappings_instance_relation_idx` ON `conductor__agent_instance_mappings` (`instance_id`,`identity_type`,`relation`);--> statement-breakpoint
CREATE INDEX `conductor__agent_instance_mappings_instance_idx` ON `conductor__agent_instance_mappings` (`instance_id`);--> statement-breakpoint
CREATE TABLE `conductor__agent_instances` (
	`id` text PRIMARY KEY NOT NULL,
	`agent_name` text NOT NULL,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);

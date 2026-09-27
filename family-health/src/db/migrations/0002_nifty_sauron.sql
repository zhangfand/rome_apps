ALTER TABLE `family_health__indicator_defs` ADD `explain_source_id` text;--> statement-breakpoint
ALTER TABLE `family_health__indicator_defs` ADD `ref_source_id` text;--> statement-breakpoint
ALTER TABLE `family_health__indicator_defs` ADD `ranges` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `family_health__indicator_defs` ADD `conflict` text;--> statement-breakpoint
ALTER TABLE `family_health__indicator_defs` ADD `loinc` text;--> statement-breakpoint
ALTER TABLE `family_health__indicator_defs` ADD `side` text;--> statement-breakpoint
ALTER TABLE `family_health__results` ADD `printed_marker` text;
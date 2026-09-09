CREATE TABLE `manager__worker_health` (
	`worker_id` text PRIMARY KEY NOT NULL,
	`task_id` text NOT NULL,
	`owner_id` text NOT NULL,
	`last_heartbeat_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);

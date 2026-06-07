CREATE TABLE `notifications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`read` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `notif_user_read_created_idx` ON `notifications` (`user_id`,`read`,`created_at`);--> statement-breakpoint
CREATE INDEX `notif_user_read_idx` ON `notifications` (`user_id`,`read`);--> statement-breakpoint
ALTER TABLE `incomes` ADD `pending_due_notified_at` text;--> statement-breakpoint
ALTER TABLE `users` ADD `display_currency` text DEFAULT 'PHP' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_enabled` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_frequency` text;--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_day_of_week` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_day_of_month` integer;--> statement-breakpoint
ALTER TABLE `users` ADD `reminder_hour` integer;
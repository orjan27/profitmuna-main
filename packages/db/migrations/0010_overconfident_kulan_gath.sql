CREATE TABLE `cron_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`job` text NOT NULL,
	`ran_at` text NOT NULL,
	`trigger` text NOT NULL,
	`generated_incomes` integer DEFAULT 0 NOT NULL,
	`generated_expenses` integer DEFAULT 0 NOT NULL,
	`pending_due_notifications` integer DEFAULT 0 NOT NULL,
	`reminder_emails` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `cron_runs_job_unique` ON `cron_runs` (`job`);--> statement-breakpoint
ALTER TABLE `users` ADD `role` text DEFAULT 'USER' NOT NULL;
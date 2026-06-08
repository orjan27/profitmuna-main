CREATE TABLE `recurring_expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`wallet_id` integer NOT NULL,
	`wallet_name` text,
	`frequency` text NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`day_of_month_2` integer,
	`active` integer DEFAULT true NOT NULL,
	`last_generated_date` text,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurring_expenses_user_idx` ON `recurring_expenses` (`user_id`);--> statement-breakpoint
CREATE INDEX `recurring_expenses_active_idx` ON `recurring_expenses` (`active`);--> statement-breakpoint
CREATE TABLE `recurring_incomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`amount` integer,
	`description` text,
	`frequency` text NOT NULL,
	`day_of_week` integer,
	`day_of_month` integer,
	`day_of_month_2` integer,
	`profit_first_allocated` integer DEFAULT true NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`last_generated_date` text,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `income_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `recurring_incomes_user_idx` ON `recurring_incomes` (`user_id`);--> statement-breakpoint
CREATE INDEX `recurring_incomes_active_idx` ON `recurring_incomes` (`active`);
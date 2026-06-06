CREATE TABLE `expense_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`system` integer DEFAULT false NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ec_user_idx` ON `expense_categories` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ec_user_name_unique` ON `expense_categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`expense_date` text NOT NULL,
	`payment_method` text,
	`deleted_at` text,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `expenses_user_idx` ON `expenses` (`user_id`);--> statement-breakpoint
CREATE INDEX `expenses_user_date_idx` ON `expenses` (`user_id`,`expense_date`);--> statement-breakpoint
CREATE INDEX `expenses_user_category_idx` ON `expenses` (`user_id`,`category_id`);--> statement-breakpoint
CREATE TABLE `income_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`system` integer DEFAULT false NOT NULL,
	`user_id` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ic_user_idx` ON `income_categories` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `ic_user_name_unique` ON `income_categories` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `incomes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`category_id` integer NOT NULL,
	`category_name` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`income_date` text NOT NULL,
	`money_status` text DEFAULT 'PENDING' NOT NULL,
	`expected_release_date` text,
	`received_date` text,
	`profit_first_allocated` integer DEFAULT true NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`category_id`) REFERENCES `income_categories`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `incomes_user_status_idx` ON `incomes` (`user_id`,`money_status`);--> statement-breakpoint
CREATE INDEX `incomes_user_date_idx` ON `incomes` (`user_id`,`income_date`);--> statement-breakpoint
CREATE INDEX `incomes_user_status_pf_idx` ON `incomes` (`user_id`,`money_status`,`profit_first_allocated`);--> statement-breakpoint
CREATE INDEX `incomes_user_category_idx` ON `incomes` (`user_id`,`category_id`);
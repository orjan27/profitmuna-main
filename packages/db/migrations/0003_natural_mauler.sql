CREATE TABLE `wallet_expense_category_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_id` integer NOT NULL,
	`expense_category_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`expense_category_id`) REFERENCES `expense_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wecm_expense_category_unique` ON `wallet_expense_category_mappings` (`expense_category_id`);--> statement-breakpoint
CREATE INDEX `wecm_user_idx` ON `wallet_expense_category_mappings` (`user_id`);--> statement-breakpoint
CREATE INDEX `wecm_wallet_idx` ON `wallet_expense_category_mappings` (`wallet_id`);--> statement-breakpoint
CREATE TABLE `wallet_income_category_mappings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_id` integer NOT NULL,
	`income_category_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`income_category_id`) REFERENCES `income_categories`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `wicm_income_category_unique` ON `wallet_income_category_mappings` (`income_category_id`);--> statement-breakpoint
CREATE INDEX `wicm_user_idx` ON `wallet_income_category_mappings` (`user_id`);--> statement-breakpoint
CREATE INDEX `wicm_wallet_idx` ON `wallet_income_category_mappings` (`wallet_id`);--> statement-breakpoint
CREATE TABLE `wallet_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`wallet_id` integer NOT NULL,
	`user_id` integer NOT NULL,
	`type` text NOT NULL,
	`amount` integer NOT NULL,
	`description` text,
	`transaction_date` text NOT NULL,
	`deleted_at` text,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`wallet_id`) REFERENCES `wallets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wt_user_wallet_idx` ON `wallet_transactions` (`user_id`,`wallet_id`);--> statement-breakpoint
CREATE INDEX `wt_wallet_date_idx` ON `wallet_transactions` (`wallet_id`,`transaction_date`);--> statement-breakpoint
CREATE TABLE `wallets` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`name` text NOT NULL,
	`source_type` text NOT NULL,
	`profit_first_account_id` integer,
	`auto_deduct_all_expenses` integer DEFAULT false NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`profit_first_account_id`) REFERENCES `profit_first_accounts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `wallets_user_idx` ON `wallets` (`user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `wallets_user_pf_account_unique` ON `wallets` (`user_id`,`profit_first_account_id`);
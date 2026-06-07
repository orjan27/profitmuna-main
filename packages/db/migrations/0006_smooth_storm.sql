DROP TABLE `wallet_expense_category_mappings`;--> statement-breakpoint
ALTER TABLE `expenses` ADD `wallet_id` integer REFERENCES wallets(id);--> statement-breakpoint
ALTER TABLE `expenses` ADD `wallet_name` text;--> statement-breakpoint
CREATE INDEX `expenses_user_wallet_idx` ON `expenses` (`user_id`,`wallet_id`);--> statement-breakpoint
ALTER TABLE `expenses` DROP COLUMN `payment_method`;--> statement-breakpoint
ALTER TABLE `wallets` ADD `is_default` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `wallets` ADD `deleted_at` text;--> statement-breakpoint
ALTER TABLE `wallets` DROP COLUMN `auto_deduct_all_expenses`;
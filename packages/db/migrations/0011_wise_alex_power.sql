ALTER TABLE `incomes` ADD `wallet_id` integer REFERENCES wallets(id);--> statement-breakpoint
ALTER TABLE `incomes` ADD `wallet_name` text;--> statement-breakpoint
CREATE INDEX `incomes_user_wallet_idx` ON `incomes` (`user_id`,`wallet_id`);
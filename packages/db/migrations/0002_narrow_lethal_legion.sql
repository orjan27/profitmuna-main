CREATE TABLE `profit_first_accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`target_percentage` integer NOT NULL,
	`color` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`account_type` text DEFAULT 'CUSTOM' NOT NULL,
	`user_id` integer NOT NULL,
	`created_at` text,
	`updated_at` text,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pfa_user_name_unique` ON `profit_first_accounts` (`user_id`,`name`);

-- ─── One-time idempotent backfill for pre-Phase-3 users ──────────────────────
-- Seeds the 4 canonical Profit First defaults for every existing user who has
-- none yet. The NOT IN guard makes this safe to re-run on subsequent deploys
-- (Pitfall 6 — no duplicate rows). (D-03 seed values: basis points, hex colors)

INSERT INTO `profit_first_accounts` (`name`, `target_percentage`, `color`, `sort_order`, `account_type`, `user_id`, `created_at`, `updated_at`)
SELECT 'Profit', 500, '#10b981', 0, 'PROFIT', id, datetime('now'), datetime('now')
FROM `users`
WHERE id NOT IN (SELECT DISTINCT user_id FROM `profit_first_accounts`);

INSERT INTO `profit_first_accounts` (`name`, `target_percentage`, `color`, `sort_order`, `account_type`, `user_id`, `created_at`, `updated_at`)
SELECT 'Owner Pay', 5000, '#8b5cf6', 1, 'OWNERS_PAY', id, datetime('now'), datetime('now')
FROM `users`
WHERE id NOT IN (SELECT DISTINCT user_id FROM `profit_first_accounts`);

INSERT INTO `profit_first_accounts` (`name`, `target_percentage`, `color`, `sort_order`, `account_type`, `user_id`, `created_at`, `updated_at`)
SELECT 'Tax', 1500, '#f59e0b', 2, 'TAX', id, datetime('now'), datetime('now')
FROM `users`
WHERE id NOT IN (SELECT DISTINCT user_id FROM `profit_first_accounts`);

INSERT INTO `profit_first_accounts` (`name`, `target_percentage`, `color`, `sort_order`, `account_type`, `user_id`, `created_at`, `updated_at`)
SELECT 'Operating Expenses', 3000, '#f43f5e', 3, 'OPEX', id, datetime('now'), datetime('now')
FROM `users`
WHERE id NOT IN (SELECT DISTINCT user_id FROM `profit_first_accounts`);
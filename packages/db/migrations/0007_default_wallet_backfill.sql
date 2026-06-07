-- Hand-written data migration: seed an undeletable 'Default' wallet for every
-- user that does not already have one. Idempotent via NOT EXISTS guard.
INSERT INTO wallets (user_id, name, profit_first_account_id, is_default, color, sort_order, created_at, updated_at)
SELECT u.id, 'Default', NULL, 1, '#10b981', 0,
       strftime('%Y-%m-%dT%H:%M:%fZ','now'), strftime('%Y-%m-%dT%H:%M:%fZ','now')
FROM users u
WHERE NOT EXISTS (SELECT 1 FROM wallets w WHERE w.user_id = u.id AND w.is_default = 1);

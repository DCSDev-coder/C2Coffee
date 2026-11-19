-- Preserve the value and target of a voucher exactly as it was applied.
-- RM and C2 Credit discounts use different units, so both are stored.
ALTER TABLE orders
  ADD COLUMN voucher_discount_tokens INT UNSIGNED NOT NULL DEFAULT 0 AFTER discount_total_rm,
  ADD COLUMN voucher_reward_summary VARCHAR(500) NULL AFTER voucher_discount_tokens,
  ADD COLUMN voucher_name_snapshot VARCHAR(255) NULL AFTER voucher_reward_summary,
  ADD COLUMN voucher_code_snapshot VARCHAR(80) NULL AFTER voucher_name_snapshot,
  ADD COLUMN voucher_type_snapshot VARCHAR(80) NULL AFTER voucher_code_snapshot,
  ADD COLUMN voucher_discount_mode_snapshot VARCHAR(40) NULL AFTER voucher_type_snapshot;

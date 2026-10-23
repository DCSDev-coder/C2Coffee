-- Tier achievement rewards remain usable while the customer still holds the
-- tier that unlocked them. The non-null sentinel preserves the legacy schema;
-- checkout separately verifies the customer's current tier before redemption.

UPDATE voucher_templates
SET expires_in_days = NULL,
    valid_until = NULL
WHERE voucher_type = 'tier_reward';

UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
SET uv.expires_at = '9999-12-31 23:59:59'
WHERE vt.voucher_type = 'tier_reward'
  AND uv.status = 'active'
  AND uv.redeemed_at IS NULL
  AND uv.revoked_at IS NULL;

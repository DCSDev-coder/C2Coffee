-- Keep temporary subsidy-role transitions auditable without classifying them
-- as new monthly issuance or ordinary allowance expiry.

ALTER TABLE token_ledger
  MODIFY source_type ENUM(
    'topup_paid',
    'topup_refund',
    'order_spend',
    'refund_return',
    'expiry',
    'admin_adjustment',
    'promo_credit',
    'voucher_subsidy',
    'referral_reward',
    'referral_reversal',
    'gift_card_purchase',
    'gift_card_redemption',
    'employee_allowance_issue',
    'employee_allowance_spend',
    'employee_allowance_expiry',
    'employee_allowance_role_revoke',
    'employee_allowance_role_restore'
  ) NOT NULL;

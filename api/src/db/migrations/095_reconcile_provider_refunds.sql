-- Reconcile cash refunds from CHIP with the closed-loop token wallet.
ALTER TABLE token_topups
  MODIFY status ENUM(
    'pending_payment',
    'paid',
    'failed',
    'cancelled',
    'refunded',
    'refund_needs_review'
  ) NOT NULL DEFAULT 'pending_payment';

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
    'referral_reversal'
  ) NOT NULL;

-- Rotate reconciliation fairly across paid purchases instead of repeatedly
-- checking only the oldest rows inside the bounded sweep.
ALTER TABLE payments
  ADD COLUMN provider_checked_at DATETIME NULL AFTER provider_bill_id,
  ADD KEY idx_payments_provider_reconcile (provider, status, provider_checked_at, created_at);

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE token_ledger
  MODIFY source_type ENUM(
    'topup_paid', 'topup_refund', 'order_spend', 'refund_return', 'expiry',
    'admin_adjustment', 'promo_credit', 'voucher_subsidy', 'referral_reward',
    'referral_reversal', 'gift_card_purchase', 'gift_card_redemption'
  ) NOT NULL;

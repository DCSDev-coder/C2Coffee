-- Automatic voucher campaigns are single-use per customer and availability
-- period. Normalize legacy templates that predate that invariant, including
-- inactive templates that would otherwise fail production readiness.
UPDATE voucher_templates
SET limit_per_user = 1,
    updated_at = UTC_TIMESTAMP()
WHERE COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(eligible_scope_json, '$.audience')),
        'all_customers'
      ) <> 'manual_issue_only'
  AND COALESCE(limit_per_user, 1) > 1;

-- These three CHIP refunds were already settled by the provider. Their five
-- credited tokens were removed in one audited Admin Web adjustment, so the
-- wallet must not be debited again. Build a deliberately narrow proof set and
-- only close the review records when every financial invariant still matches.
CREATE TEMPORARY TABLE verified_legacy_topup_refund_users (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY
);

INSERT IGNORE INTO verified_legacy_topup_refund_users (user_id)
SELECT tt.user_id
FROM token_topups tt
JOIN payments p
  ON p.topup_id = tt.id
 AND p.provider = 'chip'
JOIN token_accounts ta
  ON ta.user_id = tt.user_id
JOIN token_ledger credit
  ON credit.user_id = tt.user_id
 AND credit.direction = 'credit'
 AND credit.source_type = 'topup_paid'
 AND credit.source_id = tt.id
 AND credit.amount = tt.token_amount
JOIN token_ledger adjustment
  ON adjustment.user_id = tt.user_id
 AND adjustment.direction = 'debit'
 AND adjustment.source_type = 'admin_adjustment'
 AND adjustment.amount = 5
 AND adjustment.balance_after = 0
 AND LOWER(TRIM(adjustment.remarks)) = 'refund'
WHERE tt.topup_ref IN (
  'TOP-20261015-F3C3EF81-4',
  'TOP-20261015-A9F3BD5C-E',
  'TOP-20261015-297FAAD0-C'
)
GROUP BY tt.user_id, ta.balance_available, adjustment.id
HAVING COUNT(DISTINCT tt.topup_ref) = 3
   AND COUNT(DISTINCT tt.id) = 3
   AND SUM(tt.token_amount) = 5
   AND SUM(tt.status = 'refund_needs_review') = 3
   AND SUM(p.status = 'refunded') = 3
   AND ta.balance_available = 0;

-- Preserve an explicit reconciliation event for each provider payment. The
-- unique provider_event_id makes this operation safe to retry.
INSERT IGNORE INTO payment_events (
  payment_id,
  provider_event_id,
  event_type,
  event_payload_hash,
  processed_at,
  process_result,
  created_at
)
SELECT
  p.id,
  CONCAT('manual:refund-reconciliation:102:', tt.topup_ref),
  'manual_refund_reconciled',
  SHA2(CONCAT('migration-102:', tt.topup_ref), 256),
  UTC_TIMESTAMP(),
  'manually_reconciled',
  UTC_TIMESTAMP()
FROM token_topups tt
JOIN payments p
  ON p.topup_id = tt.id
 AND p.provider = 'chip'
 AND p.status = 'refunded'
JOIN verified_legacy_topup_refund_users verified
  ON verified.user_id = tt.user_id
WHERE tt.topup_ref IN (
  'TOP-20261015-F3C3EF81-4',
  'TOP-20261015-A9F3BD5C-E',
  'TOP-20261015-297FAAD0-C'
)
  AND tt.status = 'refund_needs_review';

UPDATE token_topups tt
JOIN verified_legacy_topup_refund_users verified
  ON verified.user_id = tt.user_id
SET tt.status = 'refunded'
WHERE tt.topup_ref IN (
  'TOP-20261015-F3C3EF81-4',
  'TOP-20261015-A9F3BD5C-E',
  'TOP-20261015-297FAAD0-C'
)
  AND tt.status = 'refund_needs_review';

DROP TEMPORARY TABLE verified_legacy_topup_refund_users;

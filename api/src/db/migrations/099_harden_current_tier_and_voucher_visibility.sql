-- A customer may claim only the achievement reward for their current tier.
-- Retain redeemed/history rows, but retire legacy rows that should no longer be
-- visible or usable.

-- Tier Management supports one achievement and one birthday reward per tier.
UPDATE loyalty_tiers
SET reward_config_json = JSON_SET(
  reward_config_json,
  '$.voucherTemplateIds',
  JSON_ARRAY(JSON_EXTRACT(reward_config_json, '$.voucherTemplateIds[0]'))
)
WHERE JSON_LENGTH(JSON_EXTRACT(reward_config_json, '$.voucherTemplateIds')) > 1;

-- Expired rows must not remain logically active in the database.
UPDATE user_vouchers
SET status = 'expired'
WHERE status = 'active'
  AND redeemed_at IS NULL
  AND revoked_at IS NULL
  AND expires_at <= UTC_TIMESTAMP();

-- Older builds treated weekly employee benefits as permanent campaigns.
UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Replaced by day-scoped recurring voucher policy',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND uv.issued_by_type = 'system'
  AND uv.redeemed_at IS NULL
  AND uv.revoked_at IS NULL
  AND uv.issue_case_ref LIKE 'campaign:%'
  AND JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.schedule.mode')) = 'weekly';

-- Retire old tier birthday templates that are no longer configured by any
-- active tier. This deliberately uses tier metadata as well as the legacy
-- description so a stale "campaign" reference cannot bypass the cleanup.
UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Legacy birthday reward retired',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND uv.issued_by_type = 'system'
  AND uv.redeemed_at IS NULL
  AND uv.revoked_at IS NULL
  AND vt.voucher_type = 'tier_reward'
  AND (
    LOWER(vt.name) LIKE '%birthday%'
    OR LOWER(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.description')), '')) LIKE '%birthday%'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM loyalty_tiers lt
    WHERE lt.is_active = 1
      AND JSON_CONTAINS(
        COALESCE(lt.reward_config_json, JSON_OBJECT()),
        JSON_ARRAY(uv.voucher_template_id),
        '$.birthdayVoucherTemplateIds'
      )
  );

-- Keep one usable copy of each non-recurring campaign. Prefer the canonical
-- campaign reference produced by the current API, then the newest row.
UPDATE user_vouchers uv
JOIN (
  SELECT id
  FROM (
    SELECT
      uv2.id,
      ROW_NUMBER() OVER (
        PARTITION BY uv2.user_id, uv2.voucher_template_id
        ORDER BY
          CASE
            WHEN uv2.issue_case_ref = CONCAT('campaign:', uv2.voucher_template_id) THEN 0
            ELSE 1
          END,
          uv2.issued_at DESC,
          uv2.id DESC
      ) AS campaign_rank
    FROM user_vouchers uv2
    JOIN voucher_templates vt2 ON vt2.id = uv2.voucher_template_id
    WHERE uv2.status = 'active'
      AND uv2.issued_by_type = 'system'
      AND uv2.redeemed_at IS NULL
      AND uv2.revoked_at IS NULL
      AND uv2.expires_at > UTC_TIMESTAMP()
      AND (uv2.issue_case_ref IS NULL OR uv2.issue_case_ref LIKE 'campaign:%')
      AND uv2.issued_reason LIKE 'Campaign voucher:%'
      AND COALESCE(
        JSON_UNQUOTE(JSON_EXTRACT(vt2.eligible_scope_json, '$.schedule.mode')),
        'always'
      ) = 'always'
      AND NOT EXISTS (
        SELECT 1
        FROM loyalty_tiers lt2
        WHERE JSON_CONTAINS(
          COALESCE(lt2.reward_config_json, JSON_OBJECT()),
          JSON_ARRAY(uv2.voucher_template_id),
          '$.voucherTemplateIds'
        )
        OR JSON_CONTAINS(
          COALESCE(lt2.reward_config_json, JSON_OBJECT()),
          JSON_ARRAY(uv2.voucher_template_id),
          '$.birthdayVoucherTemplateIds'
        )
      )
  ) ranked_campaigns
  WHERE campaign_rank > 1
) duplicate_campaigns ON duplicate_campaigns.id = uv.id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Duplicate campaign voucher retired',
    uv.revoked_at = UTC_TIMESTAMP();

-- Only the latest/current tier may remain claimable.
UPDATE user_tier_reward_entitlements e
JOIN (
  SELECT lts.user_id, lts.tier_code
  FROM loyalty_tier_snapshots lts
  JOIN (
    SELECT user_id, MAX(id) AS latest_id
    FROM loyalty_tier_snapshots
    GROUP BY user_id
  ) latest ON latest.latest_id = lts.id
) current_tier ON current_tier.user_id = e.user_id
SET e.status = 'revoked',
    e.revoked_reason = 'Superseded by the customer current tier',
    e.revoked_at = UTC_TIMESTAMP()
WHERE e.status = 'claimable'
  AND e.tier_code <> current_tier.tier_code;

-- If tier configuration changed, keep only its first configured achievement
-- entitlement. Other unclaimed records remain as audit history.
UPDATE user_tier_reward_entitlements e
JOIN loyalty_tiers lt ON lt.code = e.tier_code
SET e.status = 'revoked',
    e.revoked_reason = 'Tier reward configuration superseded',
    e.revoked_at = UTC_TIMESTAMP()
WHERE e.status = 'claimable'
  AND (
    lt.is_active = 0
    OR COALESCE(JSON_LENGTH(JSON_EXTRACT(lt.reward_config_json, '$.voucherTemplateIds')), 0) = 0
    OR e.voucher_template_id <> CAST(
      JSON_UNQUOTE(JSON_EXTRACT(lt.reward_config_json, '$.voucherTemplateIds[0]'))
      AS UNSIGNED
    )
  );

-- Claimed rewards from a previous tier must no longer be usable after the
-- customer's tier changes. Redemption history is never modified.
UPDATE user_vouchers uv
JOIN (
  SELECT lts.user_id, lts.tier_code
  FROM loyalty_tier_snapshots lts
  JOIN (
    SELECT user_id, MAX(id) AS latest_id
    FROM loyalty_tier_snapshots
    GROUP BY user_id
  ) latest ON latest.latest_id = lts.id
) current_tier ON current_tier.user_id = uv.user_id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Superseded by the customer current tier',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND uv.redeemed_at IS NULL
  AND uv.revoked_at IS NULL
  AND (
    uv.issue_case_ref LIKE 'tier_claim:%'
    OR uv.issue_case_ref LIKE 'tier_unlock:%'
  )
  AND (uv.tier_at_issue IS NULL OR uv.tier_at_issue <> current_tier.tier_code);

-- MySQL unique indexes permit multiple NULL values. The generated column is
-- populated only while an entitlement is claimable, preventing two active
-- claim cards for the same customer/tier while preserving all history rows.
ALTER TABLE user_tier_reward_entitlements
  ADD COLUMN claimable_tier_code VARCHAR(50)
    GENERATED ALWAYS AS (
      CASE WHEN status = 'claimable' THEN tier_code ELSE NULL END
    ) STORED,
  ADD UNIQUE KEY uq_tier_reward_one_claimable_per_tier (user_id, claimable_tier_code);

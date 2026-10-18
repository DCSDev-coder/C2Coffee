-- Tier achievement rewards must be explicitly claimed before they become
-- checkout vouchers. Birthday-month rewards remain separately managed.

CREATE TABLE IF NOT EXISTS user_tier_reward_entitlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  voucher_template_id BIGINT UNSIGNED NOT NULL,
  tier_code VARCHAR(50) NOT NULL,
  status ENUM('claimable','claimed','revoked') NOT NULL DEFAULT 'claimable',
  issue_case_ref VARCHAR(100) NOT NULL,
  source_order_id BIGINT UNSIGNED NULL,
  user_voucher_id BIGINT UNSIGNED NULL,
  unlocked_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  claimed_at DATETIME NULL,
  revoked_at DATETIME NULL,
  revoked_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_tier_reward_entitlement_issue (user_id, issue_case_ref),
  KEY idx_tier_reward_entitlement_user_status (user_id, status, unlocked_at),
  KEY idx_tier_reward_entitlement_template (voucher_template_id),
  KEY idx_tier_reward_entitlement_order (source_order_id),
  CONSTRAINT fk_tier_reward_entitlement_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tier_reward_entitlement_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tier_reward_entitlement_template
    FOREIGN KEY (voucher_template_id) REFERENCES voucher_templates(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tier_reward_entitlement_order
    FOREIGN KEY (source_order_id) REFERENCES orders(id) ON DELETE RESTRICT,
  CONSTRAINT fk_tier_reward_entitlement_voucher
    FOREIGN KEY (user_voucher_id) REFERENCES user_vouchers(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve existing tier history. Active, unused tier vouchers become
-- claimable; redeemed vouchers remain claimed and inactive vouchers remain
-- revoked so a member can never unlock the same tier reward twice.
INSERT IGNORE INTO user_tier_reward_entitlements (
  user_id, tenant_id, voucher_template_id, tier_code, status,
  issue_case_ref, source_order_id, user_voucher_id, unlocked_at,
  claimed_at, revoked_at, revoked_reason
)
SELECT
  uv.user_id,
  vt.tenant_id,
  uv.voucher_template_id,
  COALESCE(uv.tier_at_issue, SUBSTRING_INDEX(SUBSTRING_INDEX(uv.issue_case_ref, ':', 2), ':', -1)),
  CASE
    WHEN uv.status = 'active' AND uv.redeemed_at IS NULL AND uv.revoked_at IS NULL THEN 'claimable'
    WHEN uv.status = 'redeemed' OR uv.redeemed_at IS NOT NULL THEN 'claimed'
    ELSE 'revoked'
  END,
  uv.issue_case_ref,
  lori.order_id,
  CASE WHEN uv.status = 'redeemed' OR uv.redeemed_at IS NOT NULL THEN uv.id ELSE NULL END,
  uv.issued_at,
  CASE WHEN uv.status = 'redeemed' OR uv.redeemed_at IS NOT NULL THEN COALESCE(uv.redeemed_at, uv.issued_at) ELSE NULL END,
  CASE WHEN uv.status IN ('expired', 'revoked') OR uv.revoked_at IS NOT NULL THEN COALESCE(uv.revoked_at, UTC_TIMESTAMP()) ELSE NULL END,
  CASE WHEN uv.status IN ('expired', 'revoked') OR uv.revoked_at IS NOT NULL THEN COALESCE(uv.revoked_reason, 'Legacy tier reward is inactive') ELSE NULL END
FROM user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
LEFT JOIN loyalty_order_reward_issues lori ON lori.user_voucher_id = uv.id
WHERE uv.issue_case_ref LIKE 'tier_unlock:%';

UPDATE user_vouchers
SET status = 'revoked',
    revoked_reason = 'Tier reward must be claimed before use',
    revoked_at = UTC_TIMESTAMP()
WHERE issue_case_ref LIKE 'tier_unlock:%'
  AND status = 'active'
  AND redeemed_at IS NULL
  AND revoked_at IS NULL;

ALTER TABLE loyalty_order_reward_issues
  MODIFY COLUMN user_voucher_id BIGINT UNSIGNED NULL,
  ADD COLUMN tier_reward_entitlement_id BIGINT UNSIGNED NULL AFTER user_voucher_id,
  ADD UNIQUE KEY uq_loyalty_order_reward_entitlement (tier_reward_entitlement_id),
  ADD CONSTRAINT fk_loyalty_order_reward_entitlement
    FOREIGN KEY (tier_reward_entitlement_id)
    REFERENCES user_tier_reward_entitlements(id)
    ON DELETE RESTRICT;

UPDATE loyalty_order_reward_issues lori
JOIN user_vouchers uv ON uv.id = lori.user_voucher_id
JOIN user_tier_reward_entitlements utre
  ON utre.user_id = lori.user_id
 AND utre.issue_case_ref = uv.issue_case_ref
SET lori.tier_reward_entitlement_id = utre.id
WHERE lori.tier_reward_entitlement_id IS NULL;

-- Catch birthday vouchers whose legacy issue reference/type/schedule does not
-- identify them, but whose template is configured as a birthday tier reward.
UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
LEFT JOIN user_profiles up ON up.user_id = uv.user_id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Birthday reward is only available during the birthday month',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND EXISTS (
    SELECT 1
    FROM loyalty_tiers lt
    WHERE JSON_CONTAINS(
      COALESCE(lt.reward_config_json, JSON_OBJECT()),
      JSON_ARRAY(uv.voucher_template_id),
      '$.birthdayVoucherTemplateIds'
    )
  )
  AND (
    up.birthday IS NULL
    OR DATE_FORMAT(up.birthday, '%m') <> DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%m')
  );

UPDATE user_vouchers uv
JOIN (
  SELECT id
  FROM (
    SELECT
      uv2.id,
      ROW_NUMBER() OVER (
        PARTITION BY uv2.user_id
        ORDER BY
          CASE WHEN uv2.issue_case_ref LIKE 'tier_birthday:%' THEN 0 ELSE 1 END,
          uv2.issued_at DESC,
          uv2.id DESC
      ) AS birthday_rank
    FROM user_vouchers uv2
    JOIN user_profiles up2 ON up2.user_id = uv2.user_id
    WHERE uv2.status = 'active'
      AND DATE_FORMAT(up2.birthday, '%m') = DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%m')
      AND EXISTS (
        SELECT 1
        FROM loyalty_tiers lt2
        WHERE JSON_CONTAINS(
          COALESCE(lt2.reward_config_json, JSON_OBJECT()),
          JSON_ARRAY(uv2.voucher_template_id),
          '$.birthdayVoucherTemplateIds'
        )
      )
  ) ranked_birthdays
  WHERE birthday_rank > 1
) duplicate_birthdays ON duplicate_birthdays.id = uv.id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Duplicate birthday reward retired',
    uv.revoked_at = UTC_TIMESTAMP();

-- Retire birthday grants that are active outside each customer's birthday month.
-- Runtime checks also enforce this rule so old or manually extended grants cannot be redeemed.
UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
LEFT JOIN user_profiles up ON up.user_id = uv.user_id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Birthday reward is only available during the birthday month',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND (
    uv.issue_case_ref LIKE 'tier_birthday:%'
    OR uv.issue_case_ref LIKE 'birthday:%'
    OR vt.voucher_type = 'birthday_treat'
    OR JSON_UNQUOTE(JSON_EXTRACT(vt.eligible_scope_json, '$.schedule.mode')) = 'birthday'
  )
  AND (
    up.birthday IS NULL
    OR DATE_FORMAT(up.birthday, '%m') <> DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%m')
  );

-- Older tier settings allowed more than one birthday reward. Keep one configured
-- template per tier; the API now enforces the same invariant for future saves.
UPDATE loyalty_tiers
SET reward_config_json = JSON_SET(
  reward_config_json,
  '$.birthdayVoucherTemplateIds',
  JSON_ARRAY(JSON_EXTRACT(reward_config_json, '$.birthdayVoucherTemplateIds[0]'))
)
WHERE JSON_LENGTH(JSON_EXTRACT(reward_config_json, '$.birthdayVoucherTemplateIds')) > 1;

-- During the birthday month, retain only the newest active birthday grant.
-- The runtime synchronizer replaces it with the configured current-year tier
-- grant where applicable.
UPDATE user_vouchers uv
JOIN (
  SELECT id
  FROM (
    SELECT
      uv2.id,
      ROW_NUMBER() OVER (
        PARTITION BY uv2.user_id
        ORDER BY uv2.issued_at DESC, uv2.id DESC
      ) AS birthday_rank
    FROM user_vouchers uv2
    JOIN voucher_templates vt2 ON vt2.id = uv2.voucher_template_id
    JOIN user_profiles up2 ON up2.user_id = uv2.user_id
    WHERE uv2.status = 'active'
      AND DATE_FORMAT(up2.birthday, '%m') = DATE_FORMAT(CONVERT_TZ(UTC_TIMESTAMP(), '+00:00', '+08:00'), '%m')
      AND (
        uv2.issue_case_ref LIKE 'tier_birthday:%'
        OR uv2.issue_case_ref LIKE 'birthday:%'
        OR vt2.voucher_type = 'birthday_treat'
        OR JSON_UNQUOTE(JSON_EXTRACT(vt2.eligible_scope_json, '$.schedule.mode')) = 'birthday'
      )
  ) ranked_birthdays
  WHERE birthday_rank > 1
) duplicate_birthdays ON duplicate_birthdays.id = uv.id
SET uv.status = 'revoked',
    uv.revoked_reason = 'Duplicate birthday reward retired',
    uv.revoked_at = UTC_TIMESTAMP();

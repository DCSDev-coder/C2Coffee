-- Tier achievement rewards and birthday-month rewards are separate programs.
-- Existing tier-linked "Happy Birthday" rewards are moved to the birthday
-- configuration so they cannot be auto-issued as ordinary campaigns.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

UPDATE loyalty_tiers lt
SET reward_config_json = JSON_SET(
  COALESCE(reward_config_json, JSON_OBJECT()),
  '$.birthdayVoucherTemplateIds',
  COALESCE(JSON_EXTRACT(reward_config_json, '$.voucherTemplateIds'), JSON_ARRAY()),
  '$.voucherTemplateIds', JSON_ARRAY()
)
WHERE JSON_LENGTH(JSON_EXTRACT(reward_config_json, '$.voucherTemplateIds')) = 1
  AND EXISTS (
    SELECT 1
    FROM voucher_templates vt
    WHERE vt.id = CAST(JSON_UNQUOTE(JSON_EXTRACT(lt.reward_config_json, '$.voucherTemplateIds[0]')) AS UNSIGNED)
      AND LOWER(TRIM(vt.name)) = 'happy birthday'
  );

UPDATE voucher_templates vt
JOIN loyalty_tiers lt
  ON JSON_CONTAINS(COALESCE(lt.reward_config_json, JSON_OBJECT()), JSON_ARRAY(vt.id), '$.voucherTemplateIds')
     OR JSON_CONTAINS(COALESCE(lt.reward_config_json, JSON_OBJECT()), JSON_ARRAY(vt.id), '$.birthdayVoucherTemplateIds')
SET vt.voucher_type = 'tier_reward'
WHERE vt.voucher_type <> 'tier_reward';

-- Revoke historic automatic birthday grants. Correct birthday-month grants are
-- issued once per current tier by the customer rewards endpoint.
UPDATE user_vouchers uv
JOIN voucher_templates vt ON vt.id = uv.voucher_template_id
JOIN loyalty_tiers lt
  ON JSON_CONTAINS(COALESCE(lt.reward_config_json, JSON_OBJECT()), JSON_ARRAY(vt.id), '$.birthdayVoucherTemplateIds')
SET uv.status = 'revoked',
    uv.revoked_reason = 'Replaced by birthday-month tier reward policy',
    uv.revoked_at = UTC_TIMESTAMP()
WHERE uv.status = 'active'
  AND (uv.issue_case_ref IS NULL OR uv.issue_case_ref NOT LIKE 'tier_birthday:%');

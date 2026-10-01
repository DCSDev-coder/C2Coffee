-- Harden wallet capacity, referral settlement, and voucher issuance.

-- C2 tokens do not expire. Historical lots remain for audit only.
ALTER TABLE token_lots
  MODIFY expires_at DATETIME NULL;

UPDATE token_lots
SET expires_at = NULL
WHERE expires_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS token_wallet_cap_reservations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  topup_id BIGINT UNSIGNED NOT NULL,
  token_amount INT UNSIGNED NOT NULL,
  status ENUM('active','consumed','released','needs_review') NOT NULL DEFAULT 'active',
  provider_bill_id VARCHAR(255) NULL,
  expires_at DATETIME NOT NULL,
  release_reason VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  released_at DATETIME NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_wallet_cap_reservation_topup (topup_id),
  KEY idx_wallet_cap_reservation_user_status (user_id, status, expires_at),
  CONSTRAINT fk_wallet_cap_reservation_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT,
  CONSTRAINT fk_wallet_cap_reservation_topup FOREIGN KEY (topup_id) REFERENCES token_topups(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO token_wallet_cap_reservations (user_id, topup_id, token_amount, status, provider_bill_id, expires_at, created_at)
SELECT tt.user_id, tt.id, tt.token_amount, 'active', p.provider_bill_id,
       COALESCE(tt.expires_at, DATE_ADD(tt.created_at, INTERVAL 30 MINUTE)), tt.created_at
FROM token_topups tt
JOIN payments p ON p.topup_id = tt.id
WHERE tt.status = 'pending_payment' AND p.status = 'pending';

ALTER TABLE referrals
  ADD UNIQUE KEY uq_referrals_referred_user (referred_user_id);

-- Preserve historical duplicate grants while making their legacy issue keys unique.
UPDATE user_vouchers uv
JOIN (
  SELECT grouped_duplicates.*
  FROM (
    SELECT user_id, voucher_template_id, issue_case_ref, MIN(id) AS keep_id
    FROM user_vouchers
    WHERE issue_case_ref IS NOT NULL
    GROUP BY user_id, voucher_template_id, issue_case_ref
    HAVING COUNT(*) > 1
  ) grouped_duplicates
) duplicates
  ON duplicates.user_id = uv.user_id
 AND duplicates.voucher_template_id = uv.voucher_template_id
 AND duplicates.issue_case_ref = uv.issue_case_ref
SET uv.issue_case_ref = CONCAT(LEFT(uv.issue_case_ref, 70), ':legacy:', uv.id)
WHERE uv.id <> duplicates.keep_id;

ALTER TABLE user_vouchers
  ADD UNIQUE KEY uq_user_voucher_issue_case (user_id, voucher_template_id, issue_case_ref);

CREATE TABLE IF NOT EXISTS referral_reward_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  referral_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  reward_side ENUM('friend','referrer') NOT NULL,
  status ENUM('pending','retrying','needs_review','completed','waived') NOT NULL DEFAULT 'pending',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  next_attempt_at DATETIME NULL,
  last_failure_reason VARCHAR(64) NULL,
  last_error_message VARCHAR(500) NULL,
  resolved_by_admin_id BIGINT UNSIGNED NULL,
  resolution_note VARCHAR(500) NULL,
  resolved_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_referral_reward_job_side (referral_id, reward_side),
  KEY idx_referral_reward_jobs_tenant_status (tenant_id, status, next_attempt_at),
  CONSTRAINT fk_referral_reward_jobs_referral FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_reward_jobs_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_reward_jobs_admin FOREIGN KEY (resolved_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO referral_reward_jobs (
  referral_id, tenant_id, reward_side, status, attempt_count,
  next_attempt_at, last_failure_reason, last_error_message, created_at
)
SELECT r.id, rp.tenant_id, 'friend', 'needs_review', 1, UTC_TIMESTAMP(),
       COALESCE(o.friend_failure_reason, 'legacy_unresolved'),
       'Migrated unresolved referral reward.', UTC_TIMESTAMP()
FROM referrals r
JOIN referral_programs rp ON rp.id = r.referral_program_id
LEFT JOIN referral_reward_outcomes o ON o.referral_id = r.id
WHERE r.status = 'qualified' AND COALESCE(o.friend_issued, 0) = 0;

INSERT IGNORE INTO referral_reward_jobs (
  referral_id, tenant_id, reward_side, status, attempt_count,
  next_attempt_at, last_failure_reason, last_error_message, created_at
)
SELECT r.id, rp.tenant_id, 'referrer', 'needs_review', 1, UTC_TIMESTAMP(),
       COALESCE(o.referrer_failure_reason, 'legacy_unresolved'),
       'Migrated unresolved referral reward.', UTC_TIMESTAMP()
FROM referrals r
JOIN referral_programs rp ON rp.id = r.referral_program_id
LEFT JOIN referral_reward_outcomes o ON o.referral_id = r.id
WHERE r.status = 'qualified' AND COALESCE(o.referrer_issued, 0) = 0;

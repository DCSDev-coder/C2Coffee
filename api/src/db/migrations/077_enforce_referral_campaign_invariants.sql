-- Keep the newest active campaign if an earlier deployment allowed duplicates.
UPDATE referral_programs AS program
JOIN (
  SELECT tenant_id, MAX(id) AS keep_id
  FROM referral_programs
  WHERE status = 'active'
  GROUP BY tenant_id
  HAVING COUNT(*) > 1
) AS duplicate_active
  ON duplicate_active.tenant_id = program.tenant_id
SET program.status = 'paused'
WHERE program.status = 'active'
  AND program.id <> duplicate_active.keep_id;

-- Keep the active selection in a separate table. This avoids rebuilding the
-- foreign-keyed referral_programs table on MySQL installations that reject it.
CREATE TABLE IF NOT EXISTS referral_active_programs (
  tenant_id BIGINT UNSIGNED NOT NULL,
  program_id BIGINT UNSIGNED NOT NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id),
  UNIQUE KEY uq_referral_active_programs_program (program_id),
  CONSTRAINT fk_referral_active_programs_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_referral_active_programs_program FOREIGN KEY (program_id) REFERENCES referral_programs(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO referral_active_programs (tenant_id, program_id)
SELECT tenant_id, MAX(id)
FROM referral_programs
WHERE status = 'active'
GROUP BY tenant_id
ON DUPLICATE KEY UPDATE program_id = VALUES(program_id), updated_at = UTC_TIMESTAMP();

-- Preserve exact settlement outcomes without rebuilding the referrals table.
CREATE TABLE IF NOT EXISTS referral_reward_outcomes (
  referral_id BIGINT UNSIGNED NOT NULL,
  friend_issued TINYINT(1) NOT NULL,
  friend_label VARCHAR(255) NULL,
  friend_failure_reason VARCHAR(64) NULL,
  referrer_issued TINYINT(1) NOT NULL,
  referrer_label VARCHAR(255) NULL,
  referrer_failure_reason VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (referral_id),
  CONSTRAINT fk_referral_reward_outcomes_referral FOREIGN KEY (referral_id) REFERENCES referrals(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

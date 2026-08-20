-- C2 Coffee Phase 1 migration 009
-- Internal admin username/password auth with setup-required onboarding.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE admin_users
  ADD COLUMN username VARCHAR(80) NULL AFTER id,
  ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 0 AFTER status,
  ADD COLUMN must_set_email TINYINT(1) NOT NULL DEFAULT 0 AFTER must_change_password;

UPDATE admin_users
SET username = COALESCE(username, SUBSTRING_INDEX(email, '@', 1))
WHERE username IS NULL;

ALTER TABLE admin_users
  MODIFY username VARCHAR(80) NOT NULL,
  MODIFY email VARCHAR(255) NULL,
  ADD UNIQUE KEY uq_admin_users_username (username);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  access_token_version INT UNSIGNED NOT NULL DEFAULT 1,
  issued_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_sessions_refresh_token_hash (refresh_token_hash),
  KEY idx_admin_sessions_admin_expires_at (admin_user_id, expires_at),
  CONSTRAINT fk_admin_sessions_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_roles (code, name, description)
VALUES
  ('super_admin', 'Super Admin', 'Full administrative access'),
  ('marketing_admin', 'Marketing Admin', 'Campaign, voucher, and reward operations'),
  ('operations_admin', 'Operations Admin', 'Store, order, menu, refund, and operational support'),
  ('support_admin', 'Support Admin', 'Customer lookup and limited support actions')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT INTO admin_users (
  username,
  email,
  full_name,
  password_hash,
  status,
  must_change_password,
  must_set_email,
  activated_at,
  created_at,
  updated_at
)
VALUES (
  'Boss',
  NULL,
  'Boss',
  'scrypt$7d3d9d6d1dbad5f5f2d6c4d20d12c8aa$ebc8924af85d27df4a76b8dc5a575eb8b0f2f09217c5df619750bbfd504737b66121ee363915020ba5128762bddb481f16edd4df090807aa314caa82fc7006ed',
  'active',
  0,
  0,
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP(),
  UTC_TIMESTAMP()
)
ON DUPLICATE KEY UPDATE
  email = VALUES(email),
  full_name = VALUES(full_name),
  password_hash = VALUES(password_hash),
  status = VALUES(status),
  must_change_password = VALUES(must_change_password),
  must_set_email = VALUES(must_set_email),
  activated_at = VALUES(activated_at),
  updated_at = VALUES(updated_at);

INSERT IGNORE INTO admin_user_roles (admin_user_id, admin_role_id)
SELECT au.id, ar.id
FROM admin_users au
JOIN admin_roles ar ON ar.code = 'super_admin'
WHERE au.username = 'Boss';

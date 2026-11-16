-- Verified recovery email enrollment and unauthenticated admin password reset.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE admin_users
  ADD COLUMN email_verified_at DATETIME NULL AFTER email;

-- Preserve passwords and sessions, but require every named administrator to
-- prove ownership of their recovery address. Shared barista-only accounts do
-- not participate in email recovery and remain unchanged.
UPDATE admin_users au
SET au.email_verified_at = NULL,
    au.must_set_email = 1
WHERE EXISTS (
  SELECT 1
  FROM admin_user_roles aur
  JOIN admin_roles ar ON ar.id = aur.admin_role_id
  WHERE aur.admin_user_id = au.id
    AND ar.code <> 'barista'
);

CREATE TABLE IF NOT EXISTS admin_email_verification_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  pending_email VARCHAR(255) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts_used INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  status ENUM('pending', 'consumed', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_email_verification_request_id (request_id),
  KEY idx_admin_email_verification_user_status (admin_user_id, status),
  KEY idx_admin_email_verification_expires_at (expires_at),
  CONSTRAINT fk_admin_email_verification_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_password_reset_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts_used INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  status ENUM('pending', 'consumed', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_password_reset_request_id (request_id),
  KEY idx_admin_password_reset_user_status (admin_user_id, status),
  KEY idx_admin_password_reset_expires_at (expires_at),
  CONSTRAINT fk_admin_password_reset_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

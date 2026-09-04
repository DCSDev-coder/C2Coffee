-- Persist customer state separately and support verified admin password changes.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE user_profiles
  ADD COLUMN state VARCHAR(120) NULL AFTER city;

CREATE TABLE IF NOT EXISTS admin_password_change_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  new_password_hash VARCHAR(255) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts_used INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  status ENUM('pending', 'consumed', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'pending',
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_password_change_otps_request_id (request_id),
  KEY idx_admin_password_change_otps_user_status (admin_user_id, status),
  KEY idx_admin_password_change_otps_expires_at (expires_at),
  CONSTRAINT fk_admin_password_change_otps_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- C2 Coffee Phase 1 migration 001
-- Customer identity, device, session, and OTP tables.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_e164 VARCHAR(20) NOT NULL,
  status ENUM('active', 'blocked', 'closed', 'deletion_requested', 'deleted') NOT NULL DEFAULT 'active',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  closed_at DATETIME NULL,
  deletion_requested_at DATETIME NULL,
  retention_until DATETIME NULL,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_phone_e164 (phone_e164),
  KEY idx_users_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id BIGINT UNSIGNED NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  birthday DATE NULL,
  gender VARCHAR(50) NULL,
  house_line VARCHAR(255) NULL,
  street_line VARCHAR(255) NULL,
  postcode VARCHAR(20) NULL,
  city VARCHAR(120) NULL,
  avatar_type ENUM('preset', 'uploaded') NOT NULL DEFAULT 'preset',
  avatar_value VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  CONSTRAINT fk_user_profiles_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS devices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NULL,
  device_fingerprint VARCHAR(255) NOT NULL,
  platform ENUM('android', 'ios', 'unknown') NOT NULL DEFAULT 'unknown',
  app_version VARCHAR(50) NULL,
  last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_devices_fingerprint (device_fingerprint),
  KEY idx_devices_user_created_at (user_id, created_at),
  CONSTRAINT fk_devices_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  device_id BIGINT UNSIGNED NULL,
  refresh_token_hash CHAR(64) NOT NULL,
  access_token_version INT UNSIGNED NOT NULL DEFAULT 1,
  issued_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  revoke_reason VARCHAR(255) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sessions_refresh_token_hash (refresh_token_hash),
  KEY idx_sessions_user_expires_at (user_id, expires_at),
  KEY idx_sessions_device_id (device_id),
  CONSTRAINT fk_sessions_user
    FOREIGN KEY (user_id) REFERENCES users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_sessions_device
    FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS auth_otps (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_e164 VARCHAR(20) NOT NULL,
  device_id BIGINT UNSIGNED NULL,
  channel ENUM('whatsapp', 'sms') NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  attempts_used INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  status ENUM('pending', 'verified', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'pending',
  provider_message_ref VARCHAR(255) NULL,
  requested_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  PRIMARY KEY (id),
  KEY idx_auth_otps_phone_status (phone_e164, status),
  KEY idx_auth_otps_expires_at (expires_at),
  KEY idx_auth_otps_device_id (device_id),
  CONSTRAINT fk_auth_otps_device
    FOREIGN KEY (device_id) REFERENCES devices(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS otp_request_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  phone_e164 VARCHAR(20) NOT NULL,
  device_fingerprint VARCHAR(255) NULL,
  ip_address VARCHAR(45) NULL,
  channel_requested ENUM('whatsapp', 'sms') NOT NULL,
  result_code VARCHAR(50) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_otp_request_logs_phone_created_at (phone_e164, created_at),
  KEY idx_otp_request_logs_device_created_at (device_fingerprint, created_at),
  KEY idx_otp_request_logs_ip_created_at (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

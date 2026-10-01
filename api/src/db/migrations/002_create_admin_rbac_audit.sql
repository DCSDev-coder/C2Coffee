-- C2 Coffee Phase 1 migration 002
-- Admin accounts, multi-role RBAC, invites, and admin audit logs.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS admin_users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  email VARCHAR(255) NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NULL,
  mfa_enabled TINYINT(1) NOT NULL DEFAULT 0,
  mfa_secret_encrypted TEXT NULL,
  status ENUM('invited', 'active', 'blocked', 'deactivated', 'deleted') NOT NULL DEFAULT 'invited',
  invited_at DATETIME NULL,
  activated_at DATETIME NULL,
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_users_email (email),
  KEY idx_admin_users_status_created_at (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_roles (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_roles_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id BIGINT UNSIGNED NOT NULL,
  admin_role_id BIGINT UNSIGNED NOT NULL,
  assigned_by_admin_id BIGINT UNSIGNED NULL,
  assigned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_user_id, admin_role_id),
  KEY idx_admin_user_roles_role_id (admin_role_id),
  KEY idx_admin_user_roles_assigned_by (assigned_by_admin_id),
  CONSTRAINT fk_admin_user_roles_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_roles_role
    FOREIGN KEY (admin_role_id) REFERENCES admin_roles(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_admin_user_roles_assigned_by
    FOREIGN KEY (assigned_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_invites (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NOT NULL,
  invite_token_hash CHAR(64) NOT NULL,
  invited_email VARCHAR(255) NOT NULL,
  status ENUM('pending', 'accepted', 'expired', 'revoked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_by_admin_id BIGINT UNSIGNED NULL,
  created_reason VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_admin_invites_token_hash (invite_token_hash),
  KEY idx_admin_invites_admin_user_id (admin_user_id),
  KEY idx_admin_invites_status_expires_at (status, expires_at),
  KEY idx_admin_invites_created_by (created_by_admin_id),
  CONSTRAINT fk_admin_invites_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE CASCADE,
  CONSTRAINT fk_admin_invites_created_by
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  admin_user_id BIGINT UNSIGNED NULL,
  effective_roles_json JSON NULL,
  action_code VARCHAR(120) NOT NULL,
  target_type VARCHAR(80) NOT NULL,
  target_id BIGINT UNSIGNED NULL,
  before_json JSON NULL,
  after_json JSON NULL,
  reason_code VARCHAR(80) NULL,
  reason_note TEXT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_audit_logs_admin_created_at (admin_user_id, created_at),
  KEY idx_admin_audit_logs_target (target_type, target_id),
  KEY idx_admin_audit_logs_action_created_at (action_code, created_at),
  CONSTRAINT fk_admin_audit_logs_admin_user
    FOREIGN KEY (admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

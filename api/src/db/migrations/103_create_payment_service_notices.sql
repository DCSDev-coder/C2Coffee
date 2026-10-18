-- Scheduled customer notices for payment-provider maintenance.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS payment_service_notices (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(160) NOT NULL,
  message VARCHAR(600) NOT NULL,
  payment_methods_json JSON NOT NULL,
  starts_at DATETIME NOT NULL,
  ends_at DATETIME NOT NULL,
  status ENUM('active', 'cancelled') NOT NULL DEFAULT 'active',
  created_by_admin_id BIGINT UNSIGNED NULL,
  cancelled_by_admin_id BIGINT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_payment_service_notices_visibility (tenant_id, status, ends_at, starts_at),
  CONSTRAINT fk_payment_service_notices_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_service_notices_created_by
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_payment_service_notices_cancelled_by
    FOREIGN KEY (cancelled_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_payment_service_notices_window CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS payment_service_notice_dismissals (
  notice_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  dismissed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (notice_id, user_id),
  KEY idx_payment_service_notice_dismissals_user (user_id, dismissed_at),
  CONSTRAINT fk_payment_service_notice_dismissals_notice
    FOREIGN KEY (notice_id) REFERENCES payment_service_notices(id) ON DELETE CASCADE,
  CONSTRAINT fk_payment_service_notice_dismissals_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Durable one-time and recurring customer broadcast schedules.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS customer_message_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  title VARCHAR(120) NOT NULL,
  body VARCHAR(420) NOT NULL,
  schedule_json JSON NOT NULL,
  next_run_at DATETIME NOT NULL,
  last_run_at DATETIME NULL,
  status ENUM('active', 'completed', 'cancelled') NOT NULL DEFAULT 'active',
  created_by_admin_id BIGINT UNSIGNED NULL,
  cancelled_by_admin_id BIGINT UNSIGNED NULL,
  cancelled_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_customer_message_schedules_due (status, next_run_at),
  KEY idx_customer_message_schedules_tenant (tenant_id, status, next_run_at),
  CONSTRAINT fk_customer_message_schedules_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_customer_message_schedules_created_by
    FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_customer_message_schedules_cancelled_by
    FOREIGN KEY (cancelled_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

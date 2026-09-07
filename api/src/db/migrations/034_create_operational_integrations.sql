-- Single-tenant operational integration foundation.
-- Provider credentials remain in the deployment secret store; this schema only
-- records the configured provider, its supported capabilities, and audit data.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS outlet_integrations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  provider_code ENUM('manual', 'storehub', 'feedme', 'local_print_bridge') NOT NULL,
  display_name VARCHAR(120) NOT NULL,
  status ENUM('not_configured', 'pending', 'connected', 'disabled') NOT NULL DEFAULT 'not_configured',
  capabilities_json JSON NOT NULL,
  connection_reference VARCHAR(255) NULL,
  last_checked_at DATETIME NULL,
  last_error_code VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_outlet_integrations_tenant_store_provider (tenant_code, store_id, provider_code),
  KEY idx_outlet_integrations_tenant_status (tenant_code, status),
  CONSTRAINT fk_outlet_integrations_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS printer_targets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  integration_id BIGINT UNSIGNED NULL,
  name VARCHAR(120) NOT NULL,
  delivery_mode ENUM('pos_adapter', 'local_print_bridge', 'network_printer') NOT NULL,
  printer_reference VARCHAR(255) NOT NULL,
  status ENUM('not_configured', 'pending', 'connected', 'disabled') NOT NULL DEFAULT 'not_configured',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  last_checked_at DATETIME NULL,
  last_error_code VARCHAR(100) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_printer_targets_tenant_reference (tenant_code, printer_reference),
  KEY idx_printer_targets_tenant_status (tenant_code, status),
  CONSTRAINT fk_printer_targets_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_printer_targets_integration FOREIGN KEY (integration_id) REFERENCES outlet_integrations(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS print_jobs (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  job_ref CHAR(36) NOT NULL,
  tenant_code VARCHAR(80) NOT NULL,
  order_id BIGINT UNSIGNED NOT NULL,
  printer_target_id BIGINT UNSIGNED NOT NULL,
  requested_by_admin_user_id BIGINT UNSIGNED NULL,
  request_type ENUM('original', 'reprint') NOT NULL,
  status ENUM('queued', 'dispatching', 'printed', 'failed', 'cancelled') NOT NULL DEFAULT 'queued',
  attempt_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_error_code VARCHAR(100) NULL,
  printed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_print_jobs_ref (job_ref),
  KEY idx_print_jobs_tenant_status (tenant_code, status, created_at),
  KEY idx_print_jobs_order (order_id),
  CONSTRAINT fk_print_jobs_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_print_jobs_printer FOREIGN KEY (printer_target_id) REFERENCES printer_targets(id) ON DELETE RESTRICT,
  CONSTRAINT fk_print_jobs_requester FOREIGN KEY (requested_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS barista_weekly_schedules (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  barista_id INT NOT NULL,
  weekday TINYINT UNSIGNED NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barista_weekly_schedule (tenant_code, barista_id, weekday, starts_at),
  KEY idx_barista_weekly_schedule_lookup (tenant_code, weekday, is_active),
  CONSTRAINT fk_barista_weekly_schedules_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_weekly_schedules_barista FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE CASCADE,
  CONSTRAINT chk_barista_weekly_schedule_weekday CHECK (weekday BETWEEN 1 AND 7),
  CONSTRAINT chk_barista_weekly_schedule_time CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS workstation_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_ref CHAR(36) NOT NULL,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  workstation_key VARCHAR(128) NOT NULL,
  barista_id INT NOT NULL,
  source ENUM('manual_pin', 'pos_attendance') NOT NULL,
  started_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at DATETIME NULL,
  ended_reason ENUM('handover', 'sign_out', 'pos_clock_out', 'manager_override') NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_workstation_sessions_ref (session_ref),
  KEY idx_workstation_sessions_open (tenant_code, workstation_key, ended_at),
  CONSTRAINT fk_workstation_sessions_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_workstation_sessions_barista FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

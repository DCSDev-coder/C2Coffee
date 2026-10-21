SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS barista_sound_settings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  volume_percent TINYINT UNSIGNED NOT NULL DEFAULT 70,
  clock_in_beeps TINYINT UNSIGNED NOT NULL DEFAULT 1,
  clock_out_beeps TINYINT UNSIGNED NOT NULL DEFAULT 2,
  side_work_beeps TINYINT UNSIGNED NOT NULL DEFAULT 3,
  updated_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barista_sound_settings_store (tenant_id, store_id),
  CONSTRAINT fk_barista_sound_settings_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_sound_settings_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_sound_settings_admin FOREIGN KEY (updated_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_barista_sound_volume CHECK (volume_percent BETWEEN 0 AND 100),
  CONSTRAINT chk_barista_clock_in_beeps CHECK (clock_in_beeps BETWEEN 1 AND 5),
  CONSTRAINT chk_barista_clock_out_beeps CHECK (clock_out_beeps BETWEEN 1 AND 5),
  CONSTRAINT chk_barista_side_work_beeps CHECK (side_work_beeps BETWEEN 1 AND 5),
  CONSTRAINT chk_barista_sound_patterns_unique CHECK (
    clock_in_beeps <> clock_out_beeps
    AND clock_in_beeps <> side_work_beeps
    AND clock_out_beeps <> side_work_beeps
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

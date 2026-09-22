-- Calendar-based staffing plans replace repeating weekly templates for future
-- schedules. Existing templates remain available as a temporary fallback.

CREATE TABLE IF NOT EXISTS barista_dated_shifts (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  barista_id INT NOT NULL,
  shift_date DATE NOT NULL,
  starts_at TIME NOT NULL,
  ends_at TIME NOT NULL,
  created_by_admin_user_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barista_dated_shift (tenant_code, barista_id, shift_date, starts_at),
  KEY idx_barista_dated_shift_lookup (tenant_code, shift_date, barista_id),
  CONSTRAINT fk_barista_dated_shifts_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_dated_shifts_barista FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_dated_shifts_creator FOREIGN KEY (created_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_barista_dated_shift_time CHECK (ends_at > starts_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

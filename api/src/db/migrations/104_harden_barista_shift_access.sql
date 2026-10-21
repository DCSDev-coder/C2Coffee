-- Make attendance outlet-aware and record which timetable dates have been
-- deliberately published. This lets the workstation distinguish a closed day
-- from a missing timetable and keeps shift access server-authoritative.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE barista_attendance
  ADD COLUMN store_id BIGINT UNSIGNED NULL AFTER tenant_id,
  ADD KEY idx_barista_attendance_store_active (tenant_id, store_id, clocked_out_at),
  ADD CONSTRAINT fk_barista_attendance_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT;

UPDATE barista_attendance a
JOIN stores s ON s.tenant_id = a.tenant_id AND s.is_customer_facing = 1
SET a.store_id = s.id
WHERE a.store_id IS NULL;

CREATE TABLE IF NOT EXISTS barista_schedule_publications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_code VARCHAR(80) NOT NULL,
  store_id BIGINT UNSIGNED NULL,
  schedule_date DATE NOT NULL,
  published_by_admin_user_id BIGINT UNSIGNED NULL,
  published_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_barista_schedule_publication (tenant_code, store_id, schedule_date),
  KEY idx_barista_schedule_publication_lookup (tenant_code, schedule_date),
  CONSTRAINT fk_barista_schedule_publication_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_barista_schedule_publication_admin
    FOREIGN KEY (published_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Existing dated rosters were already intentionally published. Preserve that
-- meaning during rollout so an upgrade does not lock an operating outlet.
INSERT IGNORE INTO barista_schedule_publications (
  tenant_code, store_id, schedule_date, published_by_admin_user_id, published_at
)
SELECT tenant_code, store_id, shift_date, MAX(created_by_admin_user_id), MIN(created_at)
FROM barista_dated_shifts
GROUP BY tenant_code, store_id, shift_date;

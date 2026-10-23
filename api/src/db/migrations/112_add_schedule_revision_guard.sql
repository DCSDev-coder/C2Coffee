-- Prevent one administrator from silently overwriting another administrator's
-- published 31-day timetable.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS barista_schedule_revisions (
  tenant_code VARCHAR(80) NOT NULL,
  revision BIGINT UNSIGNED NOT NULL DEFAULT 0,
  updated_by_admin_user_id BIGINT UNSIGNED NULL,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_code),
  CONSTRAINT fk_barista_schedule_revision_admin
    FOREIGN KEY (updated_by_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

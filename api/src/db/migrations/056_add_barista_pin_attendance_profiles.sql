-- A barista PIN identifies a staff profile on a shared workstation. It is
-- hashed exactly like an administrator password and is never returned by APIs.
ALTER TABLE baristas
  ADD COLUMN pin_hash VARCHAR(255) NULL AFTER is_active,
  ADD COLUMN pin_updated_at DATETIME NULL AFTER pin_hash;

-- Keep the original admin-user attendance rows for audit history while adding
-- profile-based records for the shared Barista workstation.
ALTER TABLE barista_attendance
  MODIFY COLUMN admin_user_id BIGINT UNSIGNED NULL,
  ADD COLUMN barista_id INT NULL AFTER tenant_id,
  ADD COLUMN recorded_by_admin_user_id BIGINT UNSIGNED NULL AFTER admin_user_id,
  ADD KEY idx_barista_attendance_profile_active (tenant_id, barista_id, clocked_out_at),
  ADD KEY idx_barista_attendance_profile_history (tenant_id, barista_id, clocked_in_at),
  ADD CONSTRAINT fk_barista_attendance_profile FOREIGN KEY (barista_id) REFERENCES baristas(id) ON DELETE RESTRICT,
  ADD CONSTRAINT fk_barista_attendance_recorder FOREIGN KEY (recorded_by_admin_user_id) REFERENCES admin_users(id) ON DELETE SET NULL;

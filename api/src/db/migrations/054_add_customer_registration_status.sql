-- POS imports are customer records, not completed mobile-app registrations.
-- Existing memberships remain registered so this change is safe for live users.
ALTER TABLE customer_tenant_memberships
  ADD COLUMN registration_status ENUM('imported', 'registered') NOT NULL DEFAULT 'registered' AFTER is_employee,
  ADD COLUMN registered_at DATETIME NULL AFTER registration_status,
  ADD KEY idx_customer_tenant_memberships_registration (tenant_id, registration_status, user_id);

-- OTP purpose is persisted so a login OTP cannot be replayed to claim an import.
ALTER TABLE auth_otps
  ADD COLUMN purpose ENUM('login', 'signup') NOT NULL DEFAULT 'login' AFTER channel;

-- Preserve deleted customer identities for audit/retention while allowing the
-- phone number to be registered again after an administrative deletion.
SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE users
  ADD COLUMN deletion_source ENUM('user', 'admin', 'system') NULL AFTER deleted_at,
  ADD COLUMN deletion_actor_admin_user_id BIGINT UNSIGNED NULL AFTER deletion_source,
  ADD COLUMN active_phone_e164 VARCHAR(20)
    GENERATED ALWAYS AS (CASE WHEN deleted_at IS NULL THEN phone_e164 ELSE NULL END) STORED
    AFTER phone_e164,
  DROP INDEX uq_users_phone_e164,
  ADD UNIQUE KEY uq_users_active_phone_e164 (active_phone_e164),
  ADD KEY idx_users_deleted_at (deleted_at),
  ADD KEY idx_users_deletion_source (deletion_source),
  ADD CONSTRAINT fk_users_deletion_actor_admin
    FOREIGN KEY (deletion_actor_admin_user_id) REFERENCES admin_users(id)
    ON DELETE SET NULL;

-- Older Admin Web deletes removed the membership but left an active orphan
-- user row. Retire those rows so their phone identities can be reclaimed.
UPDATE users u
SET u.status = 'deleted',
    u.closed_at = COALESCE(u.closed_at, UTC_TIMESTAMP()),
    u.deleted_at = COALESCE(u.deleted_at, UTC_TIMESTAMP()),
    u.deletion_source = COALESCE(u.deletion_source, 'system'),
    u.updated_at = UTC_TIMESTAMP()
WHERE u.status = 'active'
  AND NOT EXISTS (
    SELECT 1 FROM customer_tenant_memberships ctm WHERE ctm.user_id = u.id
  );

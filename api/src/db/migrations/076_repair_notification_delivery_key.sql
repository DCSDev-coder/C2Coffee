-- The live deployment now has delivery_key. Verify it before recording this
-- repair migration, avoiding a second ADD COLUMN on MariaDB.
SELECT delivery_key FROM notifications LIMIT 0;

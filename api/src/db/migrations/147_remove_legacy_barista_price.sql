-- Earlier pre-release builds briefly created a separate Barista RM column.
-- Barista order entry intentionally shares counter_price_rm, so remove that
-- redundant column when upgrading a database that already ran migration 146.
SET @drop_barista_price_sql = IF(
  EXISTS(
    SELECT 1
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'menu_items'
      AND COLUMN_NAME = 'barista_price_rm'
  ),
  'ALTER TABLE menu_items DROP COLUMN barista_price_rm',
  'SELECT 1'
);

PREPARE drop_barista_price_statement FROM @drop_barista_price_sql;
EXECUTE drop_barista_price_statement;
DEALLOCATE PREPARE drop_barista_price_statement;

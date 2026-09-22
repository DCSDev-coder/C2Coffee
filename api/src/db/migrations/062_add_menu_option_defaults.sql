-- Make the default customer selection explicit. The menu card, item detail,
-- and checkout can now use the same stored configuration instead of labels or
-- sort order heuristics.

ALTER TABLE menu_option_group_options
  ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0 AFTER is_active;

-- Preserve the previous safe behaviour: each group starts with its first
-- active option selected, then known service defaults replace that fallback.
CREATE TEMPORARY TABLE migration_option_defaults (
  option_id BIGINT UNSIGNED NOT NULL PRIMARY KEY
);

INSERT INTO migration_option_defaults (option_id)
SELECT o.id
FROM menu_option_group_options o
WHERE o.is_active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM menu_option_group_options earlier
    WHERE earlier.option_group_id = o.option_group_id
      AND earlier.is_active = 1
      AND (earlier.sort_order < o.sort_order OR (earlier.sort_order = o.sort_order AND earlier.id < o.id))
  );

UPDATE menu_option_group_options o
JOIN migration_option_defaults defaults_to_keep ON defaults_to_keep.option_id = o.id
SET o.is_default = 1;

UPDATE menu_option_group_options o
JOIN menu_option_groups g ON g.id = o.option_group_id
SET o.is_default = 0
WHERE LOWER(g.name) IN ('espresso shot', 'choice of temperature', 'choice of sweetness', 'ice level', 'order type');

UPDATE menu_option_group_options o
JOIN menu_option_groups g ON g.id = o.option_group_id
SET o.is_default = 1
WHERE o.is_active = 1
  AND (
    (LOWER(g.name) = 'espresso shot' AND LOWER(o.name) = '1 shot') OR
    (LOWER(g.name) = 'choice of temperature' AND LOWER(o.name) = 'cold') OR
    (LOWER(g.name) = 'choice of sweetness' AND LOWER(o.name) = 'regular sweet') OR
    (LOWER(g.name) = 'ice level' AND LOWER(o.name) = 'regular ice') OR
    (LOWER(g.name) = 'order type' AND LOWER(o.name) = 'take away')
  );

DROP TEMPORARY TABLE migration_option_defaults;

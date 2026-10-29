ALTER TABLE home_banners
  ADD COLUMN home_sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER sort_order,
  ADD COLUMN floating_sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER home_sort_order,
  ADD COLUMN partnership_sort_order INT UNSIGNED NOT NULL DEFAULT 0 AFTER floating_sort_order;

UPDATE home_banners
SET home_sort_order = sort_order,
    floating_sort_order = CASE WHEN floating_priority = 1 THEN sort_order ELSE 0 END,
    partnership_sort_order = CASE WHEN banner_type = 'partner' THEN sort_order ELSE 0 END;

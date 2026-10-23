-- Track when a menu item entered the archive so admins can review old records
-- without automatically deleting order or loyalty history.

ALTER TABLE menu_items
  ADD COLUMN archived_at DATETIME NULL AFTER is_active,
  ADD KEY idx_menu_items_archive_review (is_active, archived_at);

-- Older rows predate explicit archive tracking. Their last update is the best
-- available starting point for the first five-year review reminder.
UPDATE menu_items
SET archived_at = updated_at
WHERE is_active = 0
  AND archived_at IS NULL;

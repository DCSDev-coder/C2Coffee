-- Preserve the nutrition presented at checkout even if an admin later edits a recipe.
ALTER TABLE order_items
  ADD COLUMN base_calories_kcal_snapshot INT UNSIGNED NOT NULL DEFAULT 0 AFTER token_price_snapshot;

ALTER TABLE order_item_modifiers
  ADD COLUMN calorie_delta_kcal_snapshot INT NOT NULL DEFAULT 0 AFTER token_price_delta_snapshot;

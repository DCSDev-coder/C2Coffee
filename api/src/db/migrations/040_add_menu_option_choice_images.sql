-- Bean choices can include an optional customer-facing image.
ALTER TABLE menu_option_group_options
  ADD COLUMN image_url VARCHAR(512) NULL AFTER name;

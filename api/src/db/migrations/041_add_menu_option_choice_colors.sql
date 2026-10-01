-- Customer-facing choice cards can use a solid color or a two-color gradient.
ALTER TABLE menu_option_group_options
  ADD COLUMN color_hex VARCHAR(7) NULL AFTER image_url,
  ADD COLUMN gradient_end_hex VARCHAR(7) NULL AFTER color_hex;

-- Stores the direction selected for the optional colour gradient on each
-- customer choice card.
ALTER TABLE menu_option_group_options
  ADD COLUMN gradient_direction ENUM('diagonal', 'horizontal', 'vertical')
    NOT NULL DEFAULT 'diagonal' AFTER gradient_end_hex;

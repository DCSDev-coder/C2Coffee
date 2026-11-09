-- Tier rewards that waive a selected menu option/add-on only.
ALTER TABLE voucher_templates
  MODIFY COLUMN discount_mode ENUM('fixed_rm', 'percent_rm', 'fixed_token', 'free_drink', 'free_option') NOT NULL;

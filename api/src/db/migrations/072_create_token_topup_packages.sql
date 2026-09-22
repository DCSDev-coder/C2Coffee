CREATE TABLE IF NOT EXISTS token_topup_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  token_amount INT UNSIGNED NOT NULL,
  rm_amount DECIMAL(12,2) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_token_topup_packages_code (code),
  KEY idx_token_topup_packages_active_sort (is_active, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT IGNORE INTO token_topup_packages (code, name, token_amount, rm_amount, is_active, sort_order) VALUES
  ('TOKENS-20', '20 C2 Tokens', 20, 20.00, 1, 10),
  ('TOKENS-50', '50 C2 Tokens', 50, 50.00, 1, 20),
  ('TOKENS-100', '100 C2 Tokens', 100, 100.00, 1, 30);

ALTER TABLE token_topups
  ADD COLUMN topup_package_id BIGINT UNSIGNED NULL AFTER user_id,
  ADD KEY idx_token_topups_package (topup_package_id),
  ADD CONSTRAINT fk_token_topups_package
    FOREIGN KEY (topup_package_id) REFERENCES token_topup_packages(id)
    ON DELETE RESTRICT;

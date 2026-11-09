-- Track store-specific availability of customizations, such as coffee bean blends.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

CREATE TABLE IF NOT EXISTS store_customization_availability (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  store_id BIGINT UNSIGNED NOT NULL,
  customization_type VARCHAR(50) NOT NULL,
  customization_value VARCHAR(100) NOT NULL,
  is_available TINYINT(1) NOT NULL DEFAULT 1,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_store_customization (store_id, customization_type, customization_value),
  KEY idx_store_customization_type (store_id, customization_type, is_available),
  CONSTRAINT fk_store_customization_store
    FOREIGN KEY (store_id) REFERENCES stores(id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

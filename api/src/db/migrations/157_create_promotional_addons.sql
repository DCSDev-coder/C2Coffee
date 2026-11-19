-- Inventory-backed promotional add-ons (collectibles, gifts, food, and future reward products).

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE menu_items
  ADD COLUMN sale_visibility ENUM('normal', 'promotion_only', 'hidden') NOT NULL DEFAULT 'normal' AFTER is_active,
  ADD KEY idx_menu_items_sale_visibility (sale_visibility, is_active);

ALTER TABLE order_items
  ADD COLUMN line_type ENUM('sale', 'promotional_addon') NOT NULL DEFAULT 'sale' AFTER menu_item_id,
  ADD KEY idx_order_items_line_type (order_id, line_type);

ALTER TABLE inventory_movements
  MODIFY COLUMN movement_type ENUM(
    'purchase', 'purchase_receive', 'consumption', 'waste', 'adjustment',
    'refund_reversal', 'transfer_out', 'transfer_in',
    'stocktake_adjustment', 'supplier_return',
    'marketing_consumption', 'marketing_reversal',
    'promotional_return', 'promotional_retained'
  ) NOT NULL;

CREATE TABLE IF NOT EXISTS promotional_addon_campaigns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  code VARCHAR(50) NOT NULL,
  name VARCHAR(160) NOT NULL,
  description VARCHAR(500) NULL,
  status ENUM('draft', 'active', 'paused', 'archived') NOT NULL DEFAULT 'draft',
  assignment_mode ENUM('customer_choice', 'server_random') NOT NULL,
  legacy_fallback ENUM('random', 'no_reward') NOT NULL DEFAULT 'no_reward',
  allow_decline TINYINT(1) NOT NULL DEFAULT 1,
  price_mode ENUM('free', 'fixed_rm', 'fixed_token') NOT NULL DEFAULT 'free',
  fixed_price_rm DECIMAL(12,2) NULL,
  fixed_token_amount INT UNSIGNED NULL,
  minimum_quantity INT UNSIGNED NOT NULL DEFAULT 1,
  qualifying_product_kind_codes_json JSON NOT NULL,
  payment_modes_json JSON NOT NULL,
  sales_channels_json JSON NOT NULL,
  starts_at DATETIME NULL,
  ends_at DATETIME NULL,
  priority INT NOT NULL DEFAULT 0,
  created_by_admin_id BIGINT UNSIGNED NULL,
  updated_by_admin_id BIGINT UNSIGNED NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_promotional_addon_campaign_code (tenant_id, code),
  KEY idx_promotional_addon_campaign_active (tenant_id, status, starts_at, ends_at, priority),
  CONSTRAINT fk_promotional_addon_campaign_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_campaign_created_by FOREIGN KEY (created_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT fk_promotional_addon_campaign_updated_by FOREIGN KEY (updated_by_admin_id) REFERENCES admin_users(id) ON DELETE SET NULL,
  CONSTRAINT chk_promotional_addon_campaign_dates CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at),
  CONSTRAINT chk_promotional_addon_campaign_price CHECK (
    (price_mode = 'free' AND fixed_price_rm IS NULL AND fixed_token_amount IS NULL) OR
    (price_mode = 'fixed_rm' AND fixed_price_rm IS NOT NULL AND fixed_price_rm >= 0 AND fixed_token_amount IS NULL) OR
    (price_mode = 'fixed_token' AND fixed_token_amount IS NOT NULL AND fixed_price_rm IS NULL)
  )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotional_addon_campaign_stores (
  campaign_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (campaign_id, store_id),
  CONSTRAINT fk_promotional_addon_store_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotional_addon_qualifying_categories (
  campaign_id BIGINT UNSIGNED NOT NULL,
  category_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (campaign_id, category_id),
  CONSTRAINT fk_promotional_addon_category_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_category FOREIGN KEY (category_id) REFERENCES menu_categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotional_addon_qualifying_items (
  campaign_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (campaign_id, menu_item_id),
  CONSTRAINT fk_promotional_addon_item_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotional_addon_reward_items (
  campaign_id BIGINT UNSIGNED NOT NULL,
  menu_item_id BIGINT UNSIGNED NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (campaign_id, menu_item_id),
  KEY idx_promotional_addon_rewards_item (menu_item_id),
  CONSTRAINT fk_promotional_addon_reward_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_reward_item FOREIGN KEY (menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS order_promotional_addons (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  order_id BIGINT UNSIGNED NOT NULL,
  order_item_id BIGINT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  reward_menu_item_id BIGINT UNSIGNED NOT NULL,
  campaign_code_snapshot VARCHAR(50) NOT NULL,
  campaign_name_snapshot VARCHAR(160) NOT NULL,
  assignment_mode_snapshot ENUM('customer_choice', 'server_random') NOT NULL,
  reward_name_snapshot VARCHAR(255) NOT NULL,
  reward_image_url_snapshot VARCHAR(512) NULL,
  normal_price_rm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  promotional_price_rm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  promotional_token_amount_snapshot INT UNSIGNED NOT NULL DEFAULT 0,
  discount_rm_snapshot DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  quantity INT UNSIGNED NOT NULL DEFAULT 1,
  qualification_summary_snapshot VARCHAR(500) NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  fulfilment_status ENUM('pending', 'fulfilled', 'returned', 'retained_after_refund', 'cancelled') NOT NULL DEFAULT 'pending',
  fulfilled_at DATETIME NULL,
  returned_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_promotional_addons_order (order_id),
  UNIQUE KEY uq_order_promotional_addons_order_item (order_item_id),
  KEY idx_order_promotional_addons_campaign (campaign_id, created_at),
  CONSTRAINT fk_order_promotional_addon_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_promotional_addon_order_item FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_promotional_addon_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_promotional_addon_reward FOREIGN KEY (reward_menu_item_id) REFERENCES menu_items(id) ON DELETE RESTRICT,
  CONSTRAINT fk_order_promotional_addon_store FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS promotional_addon_events (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  campaign_id BIGINT UNSIGNED NOT NULL,
  order_id BIGINT UNSIGNED NULL,
  user_id BIGINT UNSIGNED NULL,
  event_type ENUM('quoted', 'selected', 'assigned_randomly', 'declined', 'fulfilled', 'returned', 'retained_after_refund', 'cancelled') NOT NULL,
  metadata_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_promotional_addon_events_campaign (campaign_id, created_at),
  KEY idx_promotional_addon_events_order (order_id),
  CONSTRAINT fk_promotional_addon_event_tenant FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_event_campaign FOREIGN KEY (campaign_id) REFERENCES promotional_addon_campaigns(id) ON DELETE CASCADE,
  CONSTRAINT fk_promotional_addon_event_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
  CONSTRAINT fk_promotional_addon_event_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

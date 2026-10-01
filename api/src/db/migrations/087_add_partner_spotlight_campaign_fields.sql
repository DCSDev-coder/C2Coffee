-- Partner Spotlight metadata and engagement tracking.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE home_banners
  ADD COLUMN partner_name VARCHAR(160) NULL AFTER banner_type,
  ADD COLUMN sponsored_label TINYINT(1) NOT NULL DEFAULT 1 AFTER partner_name,
  ADD COLUMN cta_label VARCHAR(60) NULL AFTER sponsored_label,
  ADD COLUMN action_type ENUM('none', 'external_url', 'email') NOT NULL DEFAULT 'none' AFTER cta_label,
  ADD COLUMN action_value VARCHAR(512) NULL AFTER action_type,
  ADD KEY idx_home_banners_partner_schedule (tenant_id, banner_type, is_active, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS home_banner_engagements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  tenant_id BIGINT UNSIGNED NOT NULL,
  banner_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  event_type ENUM('impression', 'click') NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_home_banner_engagements_campaign (tenant_id, banner_id, event_type, occurred_at),
  KEY idx_home_banner_engagements_user (user_id, occurred_at),
  CONSTRAINT fk_home_banner_engagements_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_home_banner_engagements_banner
    FOREIGN KEY (banner_id) REFERENCES home_banners(id) ON DELETE CASCADE,
  CONSTRAINT fk_home_banner_engagements_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

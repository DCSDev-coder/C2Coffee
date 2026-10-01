-- Tier definitions are shared, but each tenant owns the colours shown to its
-- customers. Seed the current effective palette so existing outlets do not
-- change appearance when this migration is applied.

CREATE TABLE IF NOT EXISTS tenant_loyalty_tier_appearances (
  tenant_id BIGINT UNSIGNED NOT NULL,
  loyalty_tier_id BIGINT UNSIGNED NOT NULL,
  primary_color VARCHAR(32) NOT NULL,
  secondary_color VARCHAR(32) NOT NULL,
  text_color VARCHAR(32) NOT NULL,
  background_color VARCHAR(32) NOT NULL,
  muted_text_color VARCHAR(32) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, loyalty_tier_id),
  CONSTRAINT fk_tenant_tier_appearance_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_tenant_tier_appearance_tier
    FOREIGN KEY (loyalty_tier_id) REFERENCES loyalty_tiers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO tenant_loyalty_tier_appearances (
  tenant_id, loyalty_tier_id, primary_color, secondary_color,
  text_color, background_color, muted_text_color
)
SELECT
  t.id,
  lt.id,
  COALESCE(lt.primary_color, t.primary_color, '#2E5E58'),
  COALESCE(lt.secondary_color, t.secondary_color, '#D4AF7A'),
  COALESCE(lt.text_color, t.text_color, '#2C2C2C'),
  COALESCE(lt.background_color, t.background_color, '#FFFFFF'),
  COALESCE(lt.muted_text_color, t.muted_text_color, '#6B7280')
FROM admin_tenants t
CROSS JOIN loyalty_tiers lt
WHERE lt.is_active = 1
ON DUPLICATE KEY UPDATE tenant_id = VALUES(tenant_id);

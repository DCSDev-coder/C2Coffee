-- Counter voucher use requires explicit customer authorization. Codes and
-- authorization tokens are stored only as hashes and are bound to one basket.

CREATE TABLE IF NOT EXISTS counter_voucher_authorizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id CHAR(36) NOT NULL,
  counter_customer_session_id BIGINT UNSIGNED NOT NULL,
  counter_device_id BIGINT UNSIGNED NOT NULL,
  tenant_id BIGINT UNSIGNED NOT NULL,
  store_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  user_voucher_id BIGINT UNSIGNED NOT NULL,
  basket_hash CHAR(64) NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  otp_hash CHAR(64) NOT NULL,
  authorization_token_hash CHAR(64) NULL,
  attempts_used INT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts INT UNSIGNED NOT NULL DEFAULT 5,
  status ENUM('pending', 'verified', 'consumed', 'expired', 'cancelled', 'blocked') NOT NULL DEFAULT 'pending',
  expires_at DATETIME NOT NULL,
  verified_expires_at DATETIME NULL,
  verified_at DATETIME NULL,
  consumed_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_counter_voucher_authorizations_request (request_id),
  UNIQUE KEY uq_counter_voucher_authorizations_token (authorization_token_hash),
  KEY idx_counter_voucher_authorizations_session_status (counter_customer_session_id, status),
  KEY idx_counter_voucher_authorizations_expiry (expires_at, verified_expires_at),
  CONSTRAINT fk_counter_voucher_authorizations_session
    FOREIGN KEY (counter_customer_session_id) REFERENCES counter_customer_sessions(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_voucher_authorizations_device
    FOREIGN KEY (counter_device_id) REFERENCES counter_devices(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_voucher_authorizations_tenant
    FOREIGN KEY (tenant_id) REFERENCES admin_tenants(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_voucher_authorizations_store
    FOREIGN KEY (store_id) REFERENCES stores(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_voucher_authorizations_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_counter_voucher_authorizations_voucher
    FOREIGN KEY (user_voucher_id) REFERENCES user_vouchers(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

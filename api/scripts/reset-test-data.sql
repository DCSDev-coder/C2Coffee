-- C2 Coffee controlled test-data reset
--
-- Keeps: the tenant/store setup, menu catalog, media, loyalty and voucher
-- configuration, all Marketing content (home banners and featured items),
-- schema migrations, RBAC role definitions, and the one named super-admin
-- account below. It removes customer, order, payment, device, staff,
-- printer/POS, timetable, notification, and audit test data.
--
-- Before running: make a database backup and verify the SELECT result below
-- identifies the intended super-admin. This cannot be undone after COMMIT.

SET @keep_admin_email := 'dcstack26@gmail.com';
SET @keep_admin_id := (
  SELECT id
  FROM admin_users
  WHERE email = @keep_admin_email
  LIMIT 1
);
SET @reset_authorized := IF(
  @keep_admin_id IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM admin_user_roles aur
    JOIN admin_roles ar ON ar.id = aur.admin_role_id
    WHERE aur.admin_user_id = @keep_admin_id
      AND ar.code = 'super_admin'
  ),
  1,
  0
);

-- Safety check: this must return exactly the Boss account before continuing.
SELECT
  au.id,
  au.email,
  au.full_name,
  au.status,
  ar.code AS role_code
FROM admin_users au
LEFT JOIN admin_user_roles aur ON aur.admin_user_id = au.id
LEFT JOIN admin_roles ar ON ar.id = aur.admin_role_id
WHERE au.id = @keep_admin_id;

SELECT @reset_authorized AS reset_authorized;

START TRANSACTION;

-- Operational records and attendance.
DELETE FROM print_jobs WHERE @reset_authorized = 1;
DELETE FROM workstation_sessions WHERE @reset_authorized = 1;
DELETE FROM barista_weekly_schedules WHERE @reset_authorized = 1;
DELETE FROM printer_targets WHERE @reset_authorized = 1;
DELETE FROM outlet_integrations WHERE @reset_authorized = 1;
DELETE FROM baristas WHERE @reset_authorized = 1;

-- Order, payment, voucher use, referral, and loyalty history.
DELETE FROM voucher_redemptions WHERE @reset_authorized = 1;
DELETE FROM referrals WHERE @reset_authorized = 1;
DELETE FROM loyalty_cup_events WHERE @reset_authorized = 1;
DELETE FROM order_item_modifiers WHERE @reset_authorized = 1;
DELETE FROM order_items WHERE @reset_authorized = 1;
DELETE FROM order_status_history WHERE @reset_authorized = 1;
DELETE FROM token_reservations WHERE @reset_authorized = 1;
DELETE FROM refunds WHERE @reset_authorized = 1;
DELETE FROM payment_events WHERE @reset_authorized = 1;
DELETE FROM payments WHERE @reset_authorized = 1;
DELETE FROM orders WHERE @reset_authorized = 1;
DELETE FROM store_daily_order_sequences WHERE @reset_authorized = 1;

-- Customer token balances and issued vouchers. Voucher templates remain.
DELETE FROM token_ledger WHERE @reset_authorized = 1;
DELETE FROM token_lots WHERE @reset_authorized = 1;
DELETE FROM token_topups WHERE @reset_authorized = 1;
DELETE FROM token_accounts WHERE @reset_authorized = 1;
DELETE FROM user_vouchers WHERE @reset_authorized = 1;
DELETE FROM loyalty_tier_snapshots WHERE @reset_authorized = 1;
DELETE FROM user_referral_codes WHERE @reset_authorized = 1;

-- Customer identity, authentication, support, and notification data.
DELETE FROM notifications WHERE @reset_authorized = 1;
DELETE FROM push_tokens WHERE @reset_authorized = 1;
DELETE FROM customer_email_change_otps WHERE @reset_authorized = 1;
DELETE FROM customer_support_tickets WHERE @reset_authorized = 1;
DELETE FROM customer_tenant_memberships WHERE @reset_authorized = 1;
DELETE FROM sessions WHERE @reset_authorized = 1;
DELETE FROM auth_otps WHERE @reset_authorized = 1;
DELETE FROM otp_request_logs WHERE @reset_authorized = 1;
DELETE FROM devices WHERE @reset_authorized = 1;
DELETE FROM user_profiles WHERE @reset_authorized = 1;
DELETE FROM users WHERE @reset_authorized = 1;

-- Remove every staff/admin account except the retained Boss account.
-- If the email above does not match an account, this condition deletes no
-- admin users, which is safer than deleting the wrong administrator.
DELETE FROM admin_sessions WHERE @reset_authorized = 1;
DELETE FROM admin_password_change_otps WHERE @reset_authorized = 1;
DELETE FROM admin_invites WHERE @reset_authorized = 1;
DELETE FROM admin_audit_logs WHERE @reset_authorized = 1;
DELETE FROM admin_user_roles WHERE @reset_authorized = 1 AND admin_user_id <> @keep_admin_id;
DELETE FROM admin_users WHERE @reset_authorized = 1 AND id <> @keep_admin_id;

-- Verification summary. Expected values after a fresh reset: zero customers,
-- orders, payments, baristas, schedules, printer targets, and print jobs;
-- exactly one retained admin user.
SELECT
  (SELECT COUNT(*) FROM users) AS customer_count,
  (SELECT COUNT(*) FROM orders) AS order_count,
  (SELECT COUNT(*) FROM payments) AS payment_count,
  (SELECT COUNT(*) FROM baristas) AS barista_count,
  (SELECT COUNT(*) FROM barista_weekly_schedules) AS timetable_count,
  (SELECT COUNT(*) FROM printer_targets) AS printer_count,
  (SELECT COUNT(*) FROM print_jobs) AS print_job_count,
  (SELECT COUNT(*) FROM admin_users) AS admin_count,
  (SELECT COUNT(*) FROM menu_items) AS preserved_menu_item_count,
  (SELECT COUNT(*) FROM voucher_templates) AS preserved_voucher_template_count;

COMMIT;

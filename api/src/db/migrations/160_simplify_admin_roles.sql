-- C2 Coffee: consolidate tenant administration into four understandable roles.
-- Existing operational and marketing assignments become the broad Admin role.

SET NAMES utf8mb4;

INSERT INTO admin_roles (code, name, description)
VALUES ('admin', 'Admin', 'Full operational and read access; sensitive actions require Super Admin approval')
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  description = VALUES(description);

INSERT IGNORE INTO admin_user_roles (admin_user_id, admin_role_id)
SELECT aur.admin_user_id, target_role.id
FROM admin_user_roles aur
JOIN admin_roles legacy_role ON legacy_role.id = aur.admin_role_id
JOIN admin_roles target_role ON target_role.code = 'admin'
WHERE legacy_role.code IN ('operations_admin', 'marketing_admin');

DELETE aur
FROM admin_user_roles aur
JOIN admin_roles legacy_role ON legacy_role.id = aur.admin_role_id
WHERE legacy_role.code IN ('operations_admin', 'marketing_admin');

-- Each customer can unlock a configured tier reward only once.

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE user_vouchers
  ADD UNIQUE KEY uq_user_vouchers_issue_case_ref (user_id, issue_case_ref);

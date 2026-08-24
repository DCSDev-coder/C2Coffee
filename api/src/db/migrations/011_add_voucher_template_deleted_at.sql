-- Migration 011: Track soft-deleted voucher templates separately from drafts

SET NAMES utf8mb4;
SET time_zone = '+00:00';

ALTER TABLE voucher_templates
ADD COLUMN deleted_at DATETIME NULL AFTER is_active,
ADD KEY idx_voucher_templates_deleted_at (deleted_at);

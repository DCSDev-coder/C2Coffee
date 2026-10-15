-- New payment rows should default to the approved CHIP provider. Existing
-- Billplz history is preserved for audit and reconciliation.

ALTER TABLE payments
  MODIFY COLUMN provider VARCHAR(50) NOT NULL DEFAULT 'chip';

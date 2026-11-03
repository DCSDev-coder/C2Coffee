-- Keep direct-payment provider refunds auditable and idempotent.
ALTER TABLE refunds
  ADD COLUMN provider_refund_ref VARCHAR(255) NULL AFTER refund_ref,
  ADD UNIQUE KEY uq_refunds_provider_refund_ref (provider_refund_ref);

-- Keep voucher allocation checks fast while campaigns are distributed to many
-- customers. Quantity and per-customer limits are still enforced transactionally
-- by locking the parent voucher_templates row before these counts are read.

ALTER TABLE user_vouchers
  ADD KEY idx_user_vouchers_allocation (
    voucher_template_id,
    status,
    user_id,
    issue_case_ref
  );

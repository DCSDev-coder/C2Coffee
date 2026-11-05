-- Cap the company-funded employee allowance at 200 tokens per month and retain
-- enough detail for monthly finance/audit reporting.

ALTER TABLE employee_token_allowances
  ADD COLUMN carried_forward_amount INT UNSIGNED NOT NULL DEFAULT 0 AFTER period_end,
  ADD COLUMN refunded_amount INT UNSIGNED NOT NULL DEFAULT 0 AFTER remaining_amount;

ALTER TABLE orders
  ADD COLUMN employee_allowance_tokens_refunded INT UNSIGNED NOT NULL DEFAULT 0
    AFTER employee_allowance_tokens_used;

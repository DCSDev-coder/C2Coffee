-- One completed order containing at least one qualifying drink earns one cup.
-- Normalize historical events before enforcing the one-event-per-order rule.

DELETE FROM loyalty_cup_events
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY order_id
        ORDER BY (reversed_at IS NULL) DESC, id ASC
      ) AS row_number_for_order
    FROM loyalty_cup_events
  ) ranked_events
  WHERE row_number_for_order > 1
);

UPDATE loyalty_cup_events
SET cups_awarded = 1
WHERE cups_awarded <> 1;

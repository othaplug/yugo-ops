-- Backfill is_pm_move for moves whose linked organization is a property
-- management vertical. Older code paths (single create form) didn't set
-- the flag even when admin selected a PM partner, so the moves list
-- rendered them as "B2B Delivery" instead of "PM Move".
--
-- Idempotent: WHERE clause skips already-flagged rows. Safe to re-run.

UPDATE moves m
SET is_pm_move = TRUE
FROM organizations o
WHERE m.organization_id = o.id
  AND (m.is_pm_move IS NULL OR m.is_pm_move = FALSE)
  AND (
    o.vertical IN (
      'property_management_residential',
      'property_management_commercial',
      'developer_builder'
    )
    OR o.type IN (
      'property_management',
      'property_management_residential',
      'property_management_commercial',
      'developer_builder'
    )
  );

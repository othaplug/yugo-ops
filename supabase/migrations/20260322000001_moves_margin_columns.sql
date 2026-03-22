-- Pricing Engine v2: add margin tracking columns to moves table
-- These are populated on move completion via calculateActualMargin()

ALTER TABLE moves ADD COLUMN IF NOT EXISTS actual_labour_cost   NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS actual_truck_cost    NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS actual_fuel_cost     NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS actual_supplies_cost NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS total_cost           NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS gross_profit         NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS margin_percent       NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS margin_flag          TEXT
  CHECK (margin_flag IN ('green', 'yellow', 'red'));

-- Estimated margin from quote generation (stored when quote is accepted/move created)
ALTER TABLE moves ADD COLUMN IF NOT EXISTS est_margin_percent   NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS est_cost_total       NUMERIC;

COMMENT ON COLUMN moves.actual_labour_cost   IS 'Actual labour cost: actual_hours × crew × cost_per_mover_hour';
COMMENT ON COLUMN moves.actual_truck_cost    IS 'Truck cost for the job (from truck_costs_per_job config)';
COMMENT ON COLUMN moves.actual_fuel_cost     IS 'Fuel cost: distance_km × 2 × fuel_cost_per_km';
COMMENT ON COLUMN moves.actual_supplies_cost IS 'Packing supplies cost (estate tier only)';
COMMENT ON COLUMN moves.total_cost           IS 'Sum of all actual direct costs';
COMMENT ON COLUMN moves.gross_profit         IS 'total_price - total_cost';
COMMENT ON COLUMN moves.margin_percent       IS 'gross_profit / total_price × 100 (rounded to nearest integer)';
COMMENT ON COLUMN moves.margin_flag          IS 'green ≥35%, yellow 25–34%, red <25%';
COMMENT ON COLUMN moves.est_margin_percent   IS 'Estimated margin from quote generation';
COMMENT ON COLUMN moves.est_cost_total       IS 'Estimated total cost from quote generation';

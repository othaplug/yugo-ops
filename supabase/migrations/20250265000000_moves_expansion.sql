-- Expand the moves table with columns for CRM integration, payments,
-- service-type-specific fields, and quoting system linkage.
-- All statements are idempotent (ADD COLUMN IF NOT EXISTS).

-- CRM & payment integrations
ALTER TABLE moves ADD COLUMN IF NOT EXISTS hubspot_deal_id TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS quote_id UUID REFERENCES quotes(id);
ALTER TABLE moves ADD COLUMN IF NOT EXISTS square_customer_id TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS square_card_id TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS square_payment_id TEXT;

-- Service classification
ALTER TABLE moves ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'local_move';
ALTER TABLE moves ADD COLUMN IF NOT EXISTS tier_selected TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS addons JSONB DEFAULT '[]';

-- Contract & deposit tracking
ALTER TABLE moves ADD COLUMN IF NOT EXISTS contract_signed BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS contract_signed_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS contract_pdf_url TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS deposit_paid_at TIMESTAMPTZ;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_amount NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS balance_paid_at TIMESTAMPTZ;

-- Lead & neighbourhood data
ALTER TABLE moves ADD COLUMN IF NOT EXISTS lead_source TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS neighbourhood_tier TEXT;

-- Residential move fields
ALTER TABLE moves ADD COLUMN IF NOT EXISTS move_size TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS distance_km NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS packing_service TEXT;

-- Office move fields
ALTER TABLE moves ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS business_type TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS square_footage INTEGER;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS workstation_count INTEGER;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS has_it_equipment BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS timing_preference TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS phasing_notes TEXT;

-- Single-item move fields
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_description TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_category TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_dimensions TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_weight_class TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_photo_url TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS assembly_needed TEXT;

-- White-glove move fields
ALTER TABLE moves ADD COLUMN IF NOT EXISTS declared_value NUMERIC;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS item_source TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS source_company TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS placement_spec TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS enhanced_insurance BOOLEAN DEFAULT FALSE;

-- Specialty move fields
ALTER TABLE moves ADD COLUMN IF NOT EXISTS project_type TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS project_description TEXT;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS custom_crating BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS climate_control BOOLEAN DEFAULT FALSE;
ALTER TABLE moves ADD COLUMN IF NOT EXISTS special_equipment JSONB DEFAULT '[]';

-- Indexes
CREATE INDEX IF NOT EXISTS idx_moves_hubspot ON moves(hubspot_deal_id);
CREATE INDEX IF NOT EXISTS idx_moves_service_type ON moves(service_type);
CREATE INDEX IF NOT EXISTS idx_moves_quote ON moves(quote_id);

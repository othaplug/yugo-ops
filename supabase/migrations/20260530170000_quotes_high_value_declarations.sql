-- Client-side high-value item declarations from the quote page.
--
-- Fix #10 from the client-quote-page audit: the "Declare an item" link
-- on the Protection step rendered a working form but the declarations
-- it captured lived in React state only — page reload lost them and no
-- coordinator ever saw them. This column persists them on the quote
-- row so they survive reload, show up on the admin quote detail page,
-- and get carried onto the move at booking time.
--
-- Shape:
--   [
--     { item_name: "Steinway upright", declared_value: 18000, fee: 360 },
--     { item_name: "Original oil painting", declared_value: 15000, fee: 300 }
--   ]
--
-- Idempotent. Defaults to empty array so existing quotes are valid.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS high_value_declarations JSONB
  NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN quotes.high_value_declarations IS
  'Array of {item_name, declared_value, fee} for items over $10K declared by the client on the quote page.';

NOTIFY pgrst, 'reload schema';

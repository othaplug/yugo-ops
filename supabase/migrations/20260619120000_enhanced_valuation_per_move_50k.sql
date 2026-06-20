-- Fix: Enhanced Value Protection (the valuation tier included with the
-- Signature package) had max_per_shipment = 25000, but the Signature tier
-- card and the relocation agreement both state "$50,000 per move". This made
-- the client quote PROTECT step show "PER MOVE up to $25,000" while the card
-- above it promised $50,000 — a contradiction on the same page.
--
-- Per-item limit ($2,500) and rate ($5.00/lb) are unchanged and already match
-- the card; only the per-move (per-shipment) ceiling was wrong.
UPDATE valuation_tiers
SET max_per_shipment = 50000
WHERE tier_slug = 'enhanced'
  AND max_per_shipment = 25000;

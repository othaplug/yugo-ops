-- HubSpot OPS+ pipeline and deal stage IDs (Yugo lifecycle mappings).
-- Required for deal creation in a non-default pipeline: both pipeline and dealstage.

INSERT INTO public.platform_config (key, value, description) VALUES
  ('hubspot_pipeline_id', '876726408', 'HubSpot deals pipeline ID (OPS+)'),
  ('hubspot_stage_new_lead', '1314108491', 'HubSpot stage: New lead'),
  ('hubspot_stage_contacted', '1314108492', 'HubSpot stage: Contacted'),
  ('hubspot_stage_quote_draft', '1322568106', 'HubSpot stage: Ready for quote'),
  ('hubspot_stage_quote_sent', '1314108493', 'HubSpot stage: Quote sent'),
  ('hubspot_stage_quote_viewed', '1314108493', 'HubSpot stage: Quote viewed (same as Quote sent until split)'),
  ('hubspot_stage_deposit_received', '1314108494', 'HubSpot stage: Deposit received'),
  ('hubspot_stage_booked', '1314108495', 'HubSpot stage: Booked and scheduled'),
  ('hubspot_stage_scheduled', '1314108495', 'HubSpot stage: Booked and scheduled'),
  ('hubspot_stage_in_progress', '1314108495', 'HubSpot stage: In progress (same pipeline stage as booked)'),
  ('hubspot_stage_stalled', '1314108492', 'HubSpot stage: Stalled or nurture (Contacted)'),
  ('hubspot_stage_closed_won', '1314108496', 'HubSpot stage: Closed won'),
  ('hubspot_stage_partner_signed', '1314108496', 'HubSpot stage: Partner signed (Closed won)'),
  ('hubspot_stage_closed_lost', '1314108497', 'HubSpot stage: Closed lost')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = COALESCE(EXCLUDED.description, public.platform_config.description);

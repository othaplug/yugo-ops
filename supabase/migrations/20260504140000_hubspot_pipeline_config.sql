-- Set HubSpot OPS+ pipeline ID so deal creation and stage sync work automatically.
-- Pipeline "OPS+" internal id: 876726408 (visible in HubSpot pipeline settings URL).
INSERT INTO platform_config (key, value, description)
VALUES (
  'hubspot_pipeline_id',
  '876726408',
  'HubSpot deal pipeline ID for the OPS+ pipeline'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- Update quote ID prefix from YGO- to YG- for new quotes
UPDATE platform_config
SET value = 'YG-'
WHERE key = 'quote_id_prefix' AND value = 'YGO-';

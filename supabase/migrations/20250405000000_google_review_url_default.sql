-- Update default Google review URL to g.page/r/CU67iDN6TgMIEB0/review/
UPDATE public.platform_config
SET value = 'https://g.page/r/CU67iDN6TgMIEB0/review/'
WHERE key = 'google_review_url'
  AND (value = 'https://g.page/r/yugo-moving/review' OR value IS NULL OR value = '');

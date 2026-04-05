-- Client quote trust bar: configurable Google review count headline (e.g. "360+ Reviews")
INSERT INTO public.platform_config (key, value, description) VALUES
  (
    'google_review_count_label',
    '360+ Reviews',
    'Headline on public quote trust bar for Google reviews; update as your Google count grows'
  )
ON CONFLICT (key) DO NOTHING;

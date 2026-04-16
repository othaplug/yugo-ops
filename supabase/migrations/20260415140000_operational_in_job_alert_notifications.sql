-- Track last staff notification per in-job operational alert (margin runway, schedule risk).
ALTER TABLE public.moves
  ADD COLUMN IF NOT EXISTS operational_margin_alert_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operational_schedule_alert_notified_at TIMESTAMPTZ;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS operational_margin_alert_notified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS operational_schedule_alert_notified_at TIMESTAMPTZ;

INSERT INTO public.notification_events (event_slug, event_name, description, category, display_order) VALUES
('in_job_margin_alert', 'In-Job Margin Alert', 'Projected margin falls below half of planned margin during an active job', 'moves', 53),
('in_job_schedule_alert', 'In-Job Schedule Risk', 'Projected finish exceeds allocated time during an active job', 'moves', 54)
ON CONFLICT (event_slug) DO NOTHING;

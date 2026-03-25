-- One end-of-day report per crew team per calendar date (prevents duplicate cron inserts).
CREATE UNIQUE INDEX IF NOT EXISTS idx_end_of_day_reports_team_report_date_unique
  ON public.end_of_day_reports (team_id, report_date);

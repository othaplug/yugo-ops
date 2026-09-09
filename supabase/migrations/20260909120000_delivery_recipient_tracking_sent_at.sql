-- Records when the recipient (end-customer) tracking link was last sent for a
-- delivery. Powers dedup for the bulk "Send tracking" action so a batch cannot
-- re-spam customers who already received their link. Single-send stamps it too,
-- so the two agree. Nullable: null = never sent.
alter table public.deliveries
  add column if not exists recipient_tracking_sent_at timestamptz;

comment on column public.deliveries.recipient_tracking_sent_at is
  'When the recipient tracking link was last successfully sent (SMS or email). Null = never sent. Used to gate bulk tracking sends.';

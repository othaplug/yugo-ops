-- B2B deliveries: default scheduled_start/end for calendar grid + crew blocks for assigned crews

UPDATE deliveries
SET
  scheduled_start = COALESCE(scheduled_start, TIME '08:00:00'),
  scheduled_end = COALESCE(
    scheduled_end,
    LEAST(
      TIME '20:00:00',
      COALESCE(scheduled_start, TIME '08:00:00')
        + (interval '1 hour' * COALESCE(estimated_duration_hours, 4::numeric))
    )
  )
WHERE lower(trim(coalesce(category, ''))) = 'b2b'
  AND scheduled_date IS NOT NULL
  AND (scheduled_start IS NULL OR scheduled_end IS NULL)
  AND coalesce(lower(status), '') NOT IN ('cancelled', 'canceled');

INSERT INTO crew_schedule_blocks (crew_id, block_date, block_start, block_end, block_type, reference_id, reference_type)
SELECT
  d.crew_id,
  d.scheduled_date::date,
  d.scheduled_start,
  d.scheduled_end,
  'delivery',
  d.id,
  'delivery'
FROM deliveries d
WHERE lower(trim(coalesce(d.category, ''))) = 'b2b'
  AND d.crew_id IS NOT NULL
  AND d.scheduled_date IS NOT NULL
  AND d.scheduled_start IS NOT NULL
  AND d.scheduled_end IS NOT NULL
  AND coalesce(lower(d.status), '') NOT IN ('cancelled', 'canceled')
  AND NOT EXISTS (
    SELECT 1
    FROM crew_schedule_blocks b
    WHERE b.reference_type = 'delivery'
      AND b.reference_id = d.id
  );

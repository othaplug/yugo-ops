# B2B multi-stop deliveries (coordinator notes)

## How progress works

Crew progress for **multi-stop** jobs is driven by **`delivery_stops.stop_status`** (pending, current, arrived, in_progress, completed). The client-facing **`deliveries.stage`** and the **live tracking session** are updated from that flow, including when the crew uses the sequential stops screen without tapping **Start tracking**.

If you **edit stops or statuses in admin** while a job is in progress, **`deliveries.stage`** may look out of step until the crew takes the **next** stop action (or opens the job in the crew app, which reconciles the tracking session when possible).

## Tracking session and live map

For **`is_multi_stop` deliveries**, an **active `tracking_sessions` row** is created when:

- The crew **opens the job** in the crew app (job detail GET), and stops imply an active leg, or
- The crew **advances a stop** (PATCH `/api/crew/stops`), after which the session is **reconciled** to match the stop states.

This keeps the **admin live map** and **checkpoint timeline** aligned with multi-stop progress even when the crew never uses the separate **Start tracking** control.

## Final leg flag

The **last stop** on a multi-stop route should have **`is_final_destination = true`** in the database. A migration backfills this for existing multi-stop jobs where it was missing. New jobs should continue to set the flag on create. Crew copy uses this flag for **Final drop-off** labeling.

## Client SMS and email (partner jobs)

For **en route to destination**, **arrived at destination**, and related checkpoints, SMS prefers the **site recipient** phone when present:

1. **`end_client_phone`** (B2B multi-stop site contact)
2. **`end_customer_phone`**
3. **`customer_phone`**
4. **`contact_phone`**

Partner org SMS still uses org phone rules in `sendPartnerDeliveryCheckpointSms`.

## Duplicate notifications

The same tracking checkpoint is **not** re-sent to clients within **about two minutes** if it was already sent (`deliveries.last_notified_tracking_status` / `last_notified_tracking_at`). This reduces duplicates when admin and crew both touch stage, or a request is retried.

## QA checklist (staging or production smoke)

1. Complete stop **N minus 1** on a multi-stop job: client should get **en route to destination** (if the next leg is the final drop) and **`deliveries.stage`** should advance.
2. On the **final** stop, tap **Arrived**: client should get **arrived at destination** and stage should match.
3. **Complete** the final stop: delivery **completed**, **`stage` completed**, **completion** email or SMS once (no immediate duplicate).
4. Confirm **SMS** goes to **`end_client_phone`** when that field is set (recipient), not only the billing **`customer_phone`**.
5. Open the crew job with an active leg: **tracking session** exists and **map** shows the team when GPS is on.

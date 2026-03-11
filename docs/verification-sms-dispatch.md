# Verifying SMS in notification dispatch

## What was implemented

- **Migration:** `platform_users.phone` (optional TEXT) — see `supabase/migrations/20250327000000_platform_users_phone.sql`.
- **Dispatch:** When `sms_enabled` is true for a user/event, `sendNotification` in `src/lib/notifications/dispatch.ts` sends one SMS via Twilio (if the user has a phone and Twilio env is set), then sets `results.sms` accordingly.

## How to verify

### Prerequisites

1. **Apply the migration** (if not already applied):
   ```bash
   npx supabase db push
   # or apply 20250327000000_platform_users_phone.sql in your Supabase project
   ```

2. **Twilio:** Set in `.env.local`:
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE_NUMBER` (E.164, e.g. +15551234567)

3. **Phone for a platform user:** In **Admin → Users** (or **Platform Settings → Users**), open a staff user and set **Phone (SMS)**. Use 10 or 11 digits (e.g. `5551234567` or `15551234567`).

4. **Enable SMS for an event:** In the app go to **Admin → Settings → Notifications** and turn **SMS** ON for at least one event (e.g. **Quote viewed**, **New quote request**, or **Payment received**).

---

### Test 1: SMS is sent when everything is configured

1. Ensure the user who receives admin notifications has `platform_users.phone` set and SMS enabled for an event (e.g. `quote_viewed`).
2. Trigger that event in a way that calls `notifyAdmins` (and thus `sendNotification` for that user), for example:
   - **Quote viewed:** view a quote (as client) so the system notifies admins.
   - **New quote request / widget lead:** submit a widget lead or create a claim so the system notifies admins.
   - **Payment received:** complete a payment so post-payment flow notifies admins.
3. **Expected:** The staff user receives an SMS with the notification title and body (e.g. "Quote viewed: …"). In logs you should see no `[dispatch] SMS send failed` error.

---

### Test 2: No phone → no SMS, no error

1. Clear `platform_users.phone` for the test user (or use a user that has no phone).
2. Keep SMS enabled for the event and trigger the same event as above.
3. **Expected:** No SMS is sent, no error. Email/push/in-app still work. `results.sms` will be `false` for that user.

---

### Test 3: Twilio not configured → no SMS, no error

1. Unset Twilio env vars (e.g. rename `.env.local` or remove `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`).
2. Restart the app, then trigger an event that would send SMS (user has phone, SMS enabled).
3. **Expected:** No SMS is sent, no throw. Other channels (email, push, in-app) still work; `results.sms` is `false`.

---

## Code-level verification (already done)

- **Migration:** `supabase/migrations/20250327000000_platform_users_phone.sql` adds `phone TEXT` to `platform_users`.
- **Dispatch:** `src/lib/notifications/dispatch.ts`:
  - Selects `phone` from `platform_users`.
  - When `smsEnabled`, resolves phone from `platformUser.phone` or auth `user.phone`, normalizes to E.164, guards on Twilio env, builds body from `buildNotificationTitle` + `buildNotificationBody` (truncated to 1600 chars), calls `twilioClient.messages.create`, sets `results.sms` and catches/logs errors without throwing.

To double-check the app builds:

```bash
npm run build
```

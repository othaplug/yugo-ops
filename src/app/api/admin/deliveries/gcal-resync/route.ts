import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import { syncDeliveryGCalNow } from "@/lib/google-calendar/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Resync deliveries (B2B jobs) to Google Calendar. Backfills any that never got
 * an event (e.g. delivered before "delivered" was a bookable status). By default
 * only deliveries missing a gcal_event_id; pass { all: true } to re-push every
 * non-cancelled delivery.
 */
export async function POST(req: NextRequest) {
  // Allow either an admin session or the cron secret (so a backfill / scheduled
  // re-sync can run without a browser session).
  const authHeader = req.headers.get("authorization");
  const viaCron = !!process.env.CRON_SECRET && authHeader === `Bearer ${process.env.CRON_SECRET}`;
  if (!viaCron) {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
  }

  if (!isGCalConfigured()) {
    return NextResponse.json({ error: "Google Calendar is not configured" }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const all = body?.all === true;

  const db = createAdminClient();
  let query = db
    .from("deliveries")
    .select("id, delivery_number, status, gcal_event_id")
    .order("scheduled_date", { ascending: false })
    .limit(500);
  if (!all) query = query.is("gcal_event_id", null);

  const { data: rows, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results: Record<string, number> = {};
  const synced: string[] = [];
  for (const d of rows ?? []) {
    try {
      const action = await syncDeliveryGCalNow(d.id);
      results[action] = (results[action] ?? 0) + 1;
      if (action === "created" || action === "updated") synced.push(d.delivery_number || d.id);
    } catch {
      results.error = (results.error ?? 0) + 1;
    }
  }

  return NextResponse.json({ ok: true, considered: rows?.length ?? 0, results, synced });
}

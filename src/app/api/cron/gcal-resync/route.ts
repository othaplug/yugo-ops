import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import { syncDeliveryGCalNow } from "@/lib/google-calendar/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Self-healing daily resync: pushes any delivery (B2B job) that is missing a
 * Google Calendar event. Catches anything the live create/update sync missed,
 * so B2B jobs stay on the calendar.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGCalConfigured()) {
    return NextResponse.json({ ok: true, skipped: "Google Calendar not configured" });
  }

  const db = createAdminClient();
  const { data: rows } = await db
    .from("deliveries")
    .select("id, delivery_number")
    .is("gcal_event_id", null)
    .order("scheduled_date", { ascending: false })
    .limit(300);

  const results: Record<string, number> = {};
  for (const d of rows ?? []) {
    try {
      const action = await syncDeliveryGCalNow(d.id);
      results[action] = (results[action] ?? 0) + 1;
    } catch {
      results.error = (results.error ?? 0) + 1;
    }
  }
  return NextResponse.json({ ok: true, considered: rows?.length ?? 0, results });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import {
  syncDeliveryGCalNow,
  syncMoveGCalNow,
  GCAL_PENDING,
} from "@/lib/google-calendar/sync-utils";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily resync + one-off refresh for the Google Calendar.
 *
 * Default (?refresh=missing, or no param):
 *   Pushes any delivery / PM move that is MISSING a gcal_event_id.
 *   Catches anything the live create/update sync dropped so no job
 *   silently vanishes from the crew calendar.
 *
 * ?refresh=pm:
 *   Additionally REFRESHES every existing PM move's calendar event
 *   with the current title + body format. Used when the sync-job
 *   template changed (e.g. "B2B Delivery" → "PM Reno Move-In" on
 *   2026-07-06) and existing events need to catch up. Skips any PM
 *   move without an event yet (those hit the missing-only branch).
 *
 * ?refresh=all:
 *   Refreshes every non-cancelled move + delivery event. Heavier;
 *   use for large template changes.
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isGCalConfigured()) {
    return NextResponse.json({ ok: true, skipped: "Google Calendar not configured" });
  }

  const url = new URL(req.url);
  const refreshMode = (url.searchParams.get("refresh") ?? "missing").toLowerCase();
  const db = createAdminClient();
  const results: Record<string, number> = {};

  // 0. Heal stale claims. A sync that crashed / was killed after atomically
  //    claiming a delivery (gcal_event_id = "__gcal_pending__") leaves it stuck:
  //    it is neither null (so the missing-scan below skips it) nor a real event,
  //    and syncDeliveryGCalNow cannot re-claim the sentinel — so it never lands
  //    on the calendar (this stranded DLV-30413). Release any sentinel older than
  //    15 minutes back to null so the missing-scan re-creates it. The window
  //    protects a fresh, in-flight concurrent claim (seconds old) from being
  //    stolen. Same for moves (the move path does not use the sentinel today,
  //    but heal defensively in case a future path does).
  const staleClaimBefore = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data: healed } = await db
    .from("deliveries")
    .update({ gcal_event_id: null })
    .eq("gcal_event_id", GCAL_PENDING)
    .lt("updated_at", staleClaimBefore)
    .select("id");
  results["delivery.stale_claim_healed"] = healed?.length ?? 0;

  // 1. Deliveries missing a GCal event — always re-tried.
  const { data: missingDeliveries } = await db
    .from("deliveries")
    .select("id")
    .is("gcal_event_id", null)
    .order("scheduled_date", { ascending: false })
    .limit(300);
  for (const d of missingDeliveries ?? []) {
    try {
      const action = await syncDeliveryGCalNow(d.id);
      results[`delivery.${action}`] = (results[`delivery.${action}`] ?? 0) + 1;
    } catch {
      results["delivery.error"] = (results["delivery.error"] ?? 0) + 1;
    }
  }

  // 2. PM moves AND event legs missing a GCal event. Events are two linked move
  //    rows (delivery + return); the return leg used to be left off the calendar
  //    entirely (MV-30369). event_group_id catches any leg still missing its
  //    event; syncMoveGCalNow also re-syncs the sibling, so both days land.
  const { data: missingPmMoves } = await db
    .from("moves")
    .select("id")
    .or("is_pm_move.eq.true,event_group_id.not.is.null")
    .is("gcal_event_id", null)
    .order("scheduled_date", { ascending: false })
    .limit(300);
  for (const m of missingPmMoves ?? []) {
    try {
      const action = await syncMoveGCalNow(m.id);
      results[`pm_move.${action}`] = (results[`pm_move.${action}`] ?? 0) + 1;
    } catch {
      results["pm_move.error"] = (results["pm_move.error"] ?? 0) + 1;
    }
  }

  // 3. Optional refresh of already-synced PM move events. Fires when the
  //    sync-job template changed and existing events need to catch up.
  if (refreshMode === "pm" || refreshMode === "all") {
    const { data: syncedPm } = await db
      .from("moves")
      .select("id")
      .eq("is_pm_move", true)
      .not("gcal_event_id", "is", null)
      .order("scheduled_date", { ascending: false })
      .limit(500);
    for (const m of syncedPm ?? []) {
      try {
        const action = await syncMoveGCalNow(m.id);
        results[`pm_move_refresh.${action}`] =
          (results[`pm_move_refresh.${action}`] ?? 0) + 1;
      } catch {
        results["pm_move_refresh.error"] =
          (results["pm_move_refresh.error"] ?? 0) + 1;
      }
    }
  }

  // 4. Optional full refresh of every already-synced delivery.
  if (refreshMode === "all") {
    const { data: syncedDel } = await db
      .from("deliveries")
      .select("id")
      .not("gcal_event_id", "is", null)
      .order("scheduled_date", { ascending: false })
      .limit(500);
    for (const d of syncedDel ?? []) {
      try {
        const action = await syncDeliveryGCalNow(d.id);
        results[`delivery_refresh.${action}`] =
          (results[`delivery_refresh.${action}`] ?? 0) + 1;
      } catch {
        results["delivery_refresh.error"] =
          (results["delivery_refresh.error"] ?? 0) + 1;
      }
    }
  }

  return NextResponse.json({ ok: true, refreshMode, results });
}

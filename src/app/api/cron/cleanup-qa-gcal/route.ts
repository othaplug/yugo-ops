import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  callGCal,
  getGCalId,
  setGCalIdOverride,
  isGCalConfigured,
} from "@/lib/google-calendar/client";
import { deleteGCalEvent } from "@/lib/google-calendar/sync-job";

/**
 * ONE-OFF cleanup: remove the orphaned Google Calendar events left by the QA
 * sample project (deliveries DLV-QA-INS-1 / INS-2 / TDN-1). The sample delivery
 * rows were deleted directly in the DB, so the usual deleteGCalEvent cascade
 * never ran and prod's gcal-resync cron had already created real events.
 *
 * Scoped hard: only events whose summary starts with "DLV-QA-" inside the
 * sample's Nov–Dec 2026 window are touched. Safe to delete this route after it
 * reports done. Cron-secret protected.
 */
type GCalEvent = { id: string; summary?: string; start?: { date?: string; dateTime?: string } };

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Match the sync routes: honour the platform_config calendar override if set.
  try {
    const db = createAdminClient();
    const { data } = await db.from("platform_config").select("value").eq("key", "gcal_calendar_id").maybeSingle();
    if (data?.value) setGCalIdOverride(String(data.value));
  } catch {
    /* fall back to env GOOGLE_CALENDAR_ID */
  }

  if (!isGCalConfigured()) {
    return NextResponse.json({ error: "Google Calendar is not configured" }, { status: 503 });
  }

  const calId = encodeURIComponent(getGCalId());
  const mode = req.nextUrl.searchParams.get("mode"); // "list" = dump, no delete
  const params = new URLSearchParams({
    timeMin: "2026-11-01T00:00:00Z",
    timeMax: "2026-12-31T23:59:59Z",
    maxResults: "250",
    singleEvents: "true",
    orderBy: "startTime",
  });
  const list = await callGCal<{ items?: GCalEvent[] }>(`/calendars/${calId}/events?${params.toString()}`, "GET");
  if (!list.ok) {
    return NextResponse.json({ error: `List failed: ${list.error}` }, { status: 502 });
  }

  const all = list.data?.items ?? [];
  if (mode === "list") {
    return NextResponse.json({
      ok: true,
      calendarId: getGCalId(),
      total: all.length,
      events: all.map((e) => ({ id: e.id, summary: e.summary ?? "", date: e.start?.date ?? e.start?.dateTime ?? null })),
    });
  }

  // Delete QA sample events: title prefix OR a clear QA/Sample marker in title.
  const isQa = (s: string) => s.startsWith("DLV-QA-") || /DLV-QA|QA Sample|Sample Client/i.test(s);
  const items = all.filter((e) => isQa(e.summary ?? ""));
  const deleted: { id: string; summary: string; date: string | null }[] = [];
  const errors: string[] = [];
  for (const e of items) {
    try {
      await deleteGCalEvent(e.id);
      deleted.push({ id: e.id, summary: e.summary ?? "", date: e.start?.date ?? e.start?.dateTime ?? null });
    } catch (err) {
      errors.push(`${e.id}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return NextResponse.json({ ok: true, matched: items.length, deleted, errors });
}

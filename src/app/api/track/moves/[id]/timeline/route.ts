import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isMoveIdUuid } from "@/lib/move-code";
import type { TimelineEntry } from "@/components/tracking/LiveMoveTimeline";
import {
  STATUS_TO_TIMELINE,
  STATUS_TO_TIMELINE_DELIVERY,
  STATUS_TO_TIMELINE_EVENT,
} from "@/components/tracking/LiveMoveTimeline";
import { isMoveRowLogisticsDelivery } from "@/lib/quotes/b2b-quote-copy";

const MOVE_STATUS_ORDER = [
  "confirmed",
  "dispatched",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "walkthrough_complete",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "completed",
];

/** Event bookings split into two move rows (event_phase delivery/return). Each
 *  row's client timeline shows only its own leg's milestones. The full-trip
 *  order is the fallback for a single-day / unknown-phase event row. */
const EVENT_STATUS_ORDER = [
  "confirmed",
  "dispatched",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route_venue",
  "arrived_venue",
  "event_active",
  "teardown",
  "en_route_return",
  "completed",
];

/** Delivery leg: origin → venue (load, drive, unload + setup). */
const EVENT_DELIVERY_ORDER = [
  "confirmed",
  "dispatched",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "en_route_venue",
  "arrived_venue",
  "completed",
];

/** Return leg: venue → origin (load-out, optional teardown, drive back, unload). */
const EVENT_RETURN_ORDER = [
  "confirmed",
  "dispatched",
  "en_route_venue",
  "arrived_venue",
  "teardown",
  "en_route_return",
  "completed",
];

function fmt(iso: string | null | undefined): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("en-CA", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: slug } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const supabase = createAdminClient();

  const byUuid = isMoveIdUuid(slug);
  const moveSelect =
    "id, status, move_code, crew_id, estimated_hours, service_type, move_type, event_phase, quote_id";
  const { data: move } = byUuid
    ? await supabase.from("moves").select(moveSelect).eq("id", slug).single()
    : await supabase
        .from("moves")
        .select(moveSelect)
        .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
        .single();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!verifyTrackToken("move", move.id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isEvent = String(move.service_type ?? "") === "event";
  const eventPhase = String(move.event_phase ?? "").toLowerCase().trim();

  // Event return / single-day legs drop the teardown milestone when the quote
  // opted out (quotes.factors_applied.teardown_required === false).
  let teardownRequired = true;
  if (isEvent && eventPhase !== "delivery") {
    const quoteId = (move as { quote_id?: string | null }).quote_id;
    if (quoteId) {
      const { data: q } = await supabase
        .from("quotes")
        .select("factors_applied")
        .eq("id", quoteId)
        .maybeSingle();
      const fa = (q as { factors_applied?: Record<string, unknown> } | null)
        ?.factors_applied;
      if (
        fa &&
        typeof fa === "object" &&
        (fa as { teardown_required?: unknown }).teardown_required === false
      ) {
        teardownRequired = false;
      }
    }
  }

  const eventOrder =
    eventPhase === "delivery"
      ? EVENT_DELIVERY_ORDER
      : eventPhase === "return"
        ? EVENT_RETURN_ORDER
        : EVENT_STATUS_ORDER;
  const statusOrder = isEvent
    ? teardownRequired
      ? eventOrder
      : eventOrder.filter((s) => s !== "teardown")
    : MOVE_STATUS_ORDER;
  const statusLabels = isEvent
    ? STATUS_TO_TIMELINE_EVENT
    : isMoveRowLogisticsDelivery({
        service_type: move.service_type,
        move_type: move.move_type,
      })
      ? STATUS_TO_TIMELINE_DELIVERY
      : STATUS_TO_TIMELINE;

  // Fetch stored timeline events
  const { data: storedEvents } = await supabase
    .from("move_timeline_events")
    .select("id, event_type, label, icon, occurred_at, metadata")
    .eq("move_id", move.id)
    .order("occurred_at", { ascending: true });

  const currentStatusIdx = statusOrder.indexOf(move.status || "");

  const entries: TimelineEntry[] = [];

  if (storedEvents && storedEvents.length > 0) {
    // Use stored events
    for (const ev of storedEvents) {
      const isCompleted = true;
      entries.push({
        id: ev.id,
        time: fmt(ev.occurred_at),
        label: ev.label,
        icon: ev.icon || "Clock",
        status: "completed",
        metadata: ev.metadata as Record<string, unknown>,
      });
    }

    // Add current in-progress event if the status isn't terminal
    const lastStoredStatus = storedEvents[storedEvents.length - 1]?.event_type;
    const lastIdx = statusOrder.indexOf(lastStoredStatus || "");

    if (currentStatusIdx > lastIdx && !["completed", "cancelled"].includes(move.status)) {
      const nextStatus = statusOrder[currentStatusIdx];
      if (nextStatus && statusLabels[nextStatus]) {
        const info = statusLabels[nextStatus]!;
        entries.push({
          time: "",
          label: info.label,
          icon: info.icon,
          status: "current",
        });
      }
    }
  } else {
    // Build from current status
    for (let i = 0; i <= currentStatusIdx; i++) {
      const s = statusOrder[i];
      if (!s || !statusLabels[s]) continue;
      const info = statusLabels[s]!;
      const isLast = i === currentStatusIdx;

      entries.push({
        time: "",
        label: info.label,
        icon: info.icon,
        status: isLast && !["completed", "cancelled"].includes(move.status)
          ? "current"
          : "completed",
      });
    }
  }

  return NextResponse.json({ entries, currentStatus: move.status });
}

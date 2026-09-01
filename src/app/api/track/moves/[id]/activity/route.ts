import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { isMoveIdUuid } from "@/lib/move-code";
import { calculateAddons, type AddonSelection } from "@/lib/quotes/price-addons";

/**
 * GET /api/track/moves/[id]/activity
 *
 * The client-facing Updates feed for a move: a reverse-chronological timeline of
 * everything the client should know about, merged from
 *   - move_timeline_events (precise events written as they happen), and
 *   - derived events from existing data (booking, add-ons, crew assignment,
 *     change requests, extra charges, current crew progress),
 * so even moves booked before this feature have a populated feed.
 *
 * Returns { items: FeedItem[], latestAt: string|null } where the client tracks
 * `latestAt` in localStorage to show an unread indicator.
 */

type FeedItem = {
  id: string;
  category: "booking" | "addon" | "crew" | "progress" | "change" | "payment";
  title: string;
  detail?: string;
  icon: string;
  at: string | null; // ISO, null when the time is unknown
};

const STAGE_LABEL: Record<string, { label: string; icon: string }> = {
  dispatched: { label: "Crew dispatched", icon: "Truck" },
  en_route_to_pickup: { label: "Crew is on the way to you", icon: "Truck" },
  arrived_at_pickup: { label: "Crew arrived", icon: "MapPin" },
  walkthrough_complete: { label: "Walkthrough complete", icon: "CheckCircle" },
  loading: { label: "Loading started", icon: "stack" },
  en_route_to_destination: { label: "On the way to your new home", icon: "Truck" },
  arrived_at_destination: { label: "Arrived at your new home", icon: "MapPin" },
  unloading: { label: "Unloading started", icon: "stack" },
  completed: { label: "Move complete", icon: "CheckCircle" },
};

function sortKey(at: string | null, fallback: string): number {
  return new Date(at ?? fallback).getTime();
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: slug } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  const supabase = createAdminClient();

  const sel =
    "id, move_code, status, stage, created_at, deposit_paid_at, scheduled_date, assigned_members, assigned_crew_name, addons, quote_id";
  const { data: move } = isMoveIdUuid(slug)
    ? await supabase.from("moves").select(sel).eq("id", slug).single()
    : await supabase
        .from("moves")
        .select(sel)
        .ilike("move_code", slug.replace(/^#/, "").toUpperCase())
        .single();

  if (!move) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!verifyTrackToken("move", move.id, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const items: FeedItem[] = [];
  const bookedAt: string =
    (move.deposit_paid_at as string | null) ??
    (move.created_at as string | null) ??
    new Date(0).toISOString();

  // 1. Booking
  items.push({
    id: `booking-${move.id}`,
    category: "booking",
    title: "Booking confirmed",
    detail: "Your move is booked. Your coordinator will be in touch.",
    icon: "CheckCircle",
    at: (move.deposit_paid_at as string | null) ?? (move.created_at as string | null),
  });

  // 2. Add-ons the client selected (resolve names + specifics via the engine)
  const addonSel = Array.isArray(move.addons) ? (move.addons as AddonSelection[]) : [];
  if (addonSel.length > 0) {
    try {
      const priced = await calculateAddons(supabase, addonSel, 0, null, null);
      for (const b of priced.breakdown) {
        if (!b.name) continue;
        // Admin-added lines carry their own timestamp; client selections landed
        // at booking.
        const raw = addonSel.find((s) => s.addon_id === b.addon_id) as
          | (AddonSelection & { added_at?: string; added_by_admin?: boolean })
          | undefined;
        items.push({
          id: `addon-${b.addon_id}`,
          category: "addon",
          title: `${b.name} added`,
          detail: b.detail,
          icon: "Package",
          at: raw?.added_at ?? bookedAt,
        });
      }
    } catch {
      /* names unresolved; skip add-on lines rather than fail the feed */
    }
  }

  // 3. Crew assignment (time from a stored event when available; see below)
  const crewName =
    (move.assigned_crew_name as string | null) ||
    (Array.isArray(move.assigned_members) && move.assigned_members.length > 0
      ? (move.assigned_members as string[]).join(", ")
      : null);

  // 4. Stored precise events (crew assigned, progress, and anything written live)
  const { data: stored } = await supabase
    .from("move_timeline_events")
    .select("id, event_type, label, icon, occurred_at, metadata")
    .eq("move_id", move.id)
    .order("occurred_at", { ascending: true });
  const storedTypes = new Set((stored ?? []).map((e) => e.event_type));
  for (const e of stored ?? []) {
    const meta = (e.metadata ?? {}) as { category?: FeedItem["category"]; detail?: string };
    items.push({
      id: e.id,
      category: meta.category ?? "progress",
      title: e.label,
      detail: meta.detail,
      icon: e.icon || "Bell",
      at: e.occurred_at as string,
    });
  }

  // Crew assigned: only derive when no precise event was stored for it.
  if (crewName && !storedTypes.has("crew_assigned")) {
    items.push({
      id: `crew-${move.id}`,
      category: "crew",
      title: `Crew assigned: ${crewName}`,
      icon: "Users",
      at: null,
    });
  }

  // 5. Current crew progress (derived from stage) when not already a stored event.
  const stage = String(move.stage ?? "").toLowerCase();
  const statusLc = String(move.status ?? "").toLowerCase();
  const effectiveStage =
    statusLc === "completed" || statusLc === "delivered" ? "completed" : stage;
  if (effectiveStage && STAGE_LABEL[effectiveStage] && !storedTypes.has(`stage_${effectiveStage}`)) {
    items.push({
      id: `stage-${effectiveStage}-${move.id}`,
      category: "progress",
      title: STAGE_LABEL[effectiveStage].label,
      icon: STAGE_LABEL[effectiveStage].icon,
      at: null,
    });
  }

  // 6. Change requests
  const { data: changes } = await supabase
    .from("move_change_requests")
    .select("id, type, description, status, created_at")
    .eq("move_id", move.id)
    .order("created_at", { ascending: true });
  for (const c of changes ?? []) {
    items.push({
      id: `change-${c.id}`,
      category: "change",
      title: `Change requested: ${c.type}`,
      detail: (c.description as string) || undefined,
      icon: "PencilSimple",
      at: c.created_at as string,
    });
  }

  // 7. Extra charges / payments (adjustments + balance) from the ledger
  const { data: ledger } = await supabase
    .from("move_payment_ledger")
    .select("id, entry_type, label, pre_tax_amount, hst_amount, paid_at")
    .eq("move_id", move.id)
    .in("entry_type", ["adjustment", "balance", "inventory_change"])
    .order("paid_at", { ascending: true });
  for (const l of ledger ?? []) {
    const total = Number(l.pre_tax_amount || 0) + Number(l.hst_amount || 0);
    items.push({
      id: `ledger-${l.id}`,
      category: "payment",
      title: (l.label as string) || "Charge processed",
      detail: total > 0 ? `$${total.toFixed(2)}` : undefined,
      icon: "CreditCard",
      at: l.paid_at as string,
    });
  }

  // Newest first; unknown-time items sort by the booking time as a floor.
  items.sort((a, b) => sortKey(b.at, bookedAt) - sortKey(a.at, bookedAt));

  const latestAt =
    items.map((i) => i.at).filter(Boolean).sort().slice(-1)[0] ?? null;

  return NextResponse.json({ items, latestAt });
}

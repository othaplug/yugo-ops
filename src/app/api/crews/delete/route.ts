import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";
import { isDispatchJobInProgress } from "@/lib/dispatch-job-in-progress";

const TERMINAL_MOVE_STATUSES = ["completed", "cancelled"];
const TERMINAL_DELIVERY_STATUSES = ["completed", "cancelled"];

function statusInListSql(statuses: string[]): string {
  return `(${statuses.map((s) => `"${s}"`).join(",")})`;
}

function formatDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const d = new Date(isoDate + (isoDate.includes("T") ? "" : "T12:00:00"));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function humanStatus(status: string | null): string {
  if (!status) return "—";
  const k = status.toLowerCase().replace(/-/g, "_");
  const map: Record<string, string> = {
    pending: "Pending",
    pending_approval: "Pending approval",
    scheduled: "Scheduled",
    confirmed: "Confirmed",
    in_transit: "In transit",
    "in-transit": "In transit",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    dispatched: "Dispatched",
    in_progress: "In progress",
  };
  return map[k] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** DELETE a crew/team. Fails if the crew is assigned to any moves or deliveries. */
export async function POST(req: NextRequest) {
  const { error: authError } = await requireAuth();
  if (authError) return authError;
  try {
    const { crewId } = await req.json();
    if (!crewId) return NextResponse.json({ error: "crewId required" }, { status: 400 });

    const supabase = await createClient();

    const { data: moveRows } = await supabase
      .from("moves")
      .select("id, move_code, status, stage, scheduled_date, from_address, client_name")
      .eq("crew_id", crewId)
      .not("status", "in", statusInListSql(TERMINAL_MOVE_STATUSES));

    const { data: deliveryRows } = await supabase
      .from("deliveries")
      .select("id, delivery_number, status, stage, scheduled_date, customer_name, client_name, pickup_address")
      .eq("crew_id", crewId)
      .not("status", "in", statusInListSql(TERMINAL_DELIVERY_STATUSES));

    const blockingMoves = (moveRows ?? []).map((row) => {
      const dateStr = formatDate(row.scheduled_date as string | null);
      const place = (row.from_address as string | null)?.trim()
        ? String(row.from_address).split(",")[0].trim().slice(0, 56)
        : null;
      const client = (row.client_name as string | null)?.trim() || null;
      const code = (row.move_code as string | null)?.trim() || "Move";
      const summary = [code, client, dateStr, place].filter(Boolean).join(" · ");
      const can_reassign = !isDispatchJobInProgress(row.status as string | null, row.stage as string | null);
      return {
        id: row.id as string,
        move_code: row.move_code as string | null,
        summary: summary || code,
        status_label: humanStatus(row.status as string | null),
        can_reassign,
      };
    });

    const blockingDeliveries = (deliveryRows ?? []).map((row) => {
      const dateStr = formatDate(row.scheduled_date as string | null);
      const num = (row.delivery_number as string | null)?.trim() || "Delivery";
      const cust =
        (row.customer_name as string | null)?.trim() ||
        (row.client_name as string | null)?.trim() ||
        null;
      const pickup = (row.pickup_address as string | null)?.trim()
        ? String(row.pickup_address).split(",")[0].trim().slice(0, 56)
        : null;
      const summary = [num, cust, dateStr, pickup].filter(Boolean).join(" · ");
      const can_reassign = !isDispatchJobInProgress(row.status as string | null, row.stage as string | null);
      return {
        id: row.id as string,
        delivery_number: row.delivery_number as string | null,
        summary: summary || num,
        status_label: humanStatus(row.status as string | null),
        can_reassign,
      };
    });

    if (blockingMoves.length > 0 || blockingDeliveries.length > 0) {
      return NextResponse.json(
        {
          error: "This team is still assigned to active jobs. Reassign or complete them first.",
          blocking_moves: blockingMoves,
          blocking_deliveries: blockingDeliveries,
        },
        { status: 400 }
      );
    }

    const { error } = await supabase.from("crews").delete().eq("id", crewId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to delete" }, { status: 500 });
  }
}

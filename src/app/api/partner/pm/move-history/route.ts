import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { partnerMoveTrackingUrl } from "@/lib/partner/pm-track-url";
import { inferMoveOnTimeFromCompletion } from "@/lib/partner/pm-move-on-time";

function startDateForRange(range: string): string | null {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();
  if (range === "all") return null;
  if (range === "this_month") {
    return new Date(y, m, 1).toISOString().slice(0, 10);
  }
  if (range === "last_month") {
    return new Date(y, m - 1, 1).toISOString().slice(0, 10);
  }
  if (range === "last_3_months") {
    return new Date(y, m - 3, d).toISOString().slice(0, 10);
  }
  if (range === "this_year") {
    return `${y}-01-01`;
  }
  return new Date(y, m, 1).toISOString().slice(0, 10);
}

function endDateForLastMonth(): string | null {
  const now = new Date();
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  return lastMonthEnd.toISOString().slice(0, 10);
}

/** Filterable move history with POD links for PM partners. */
export async function GET(req: NextRequest) {
  const { orgIds, error } = await requirePartner();
  if (error) return error;
  const orgId = orgIds[0]!;
  const admin = createAdminClient();

  const buildingId = req.nextUrl.searchParams.get("building")?.trim() || "";
  const typeFilter = req.nextUrl.searchParams.get("type")?.trim().toLowerCase() || "";
  const range = req.nextUrl.searchParams.get("range")?.trim() || "this_month";

  const start = startDateForRange(range);
  const lastMonthEnd = range === "last_month" ? endDateForLastMonth() : null;

  let q = admin
    .from("moves")
    .select(
      "id, move_code, status, scheduled_date, scheduled_time, completed_at, unit_number, tenant_name, partner_property_id, pm_reason_code, pm_move_kind, amount, estimate",
    )
    .eq("organization_id", orgId)
    .not("contract_id", "is", null)
    .order("scheduled_date", { ascending: false })
    .limit(500);

  if (buildingId && buildingId !== "all") {
    q = q.eq("partner_property_id", buildingId);
  }

  if (start) {
    q = q.gte("scheduled_date", start);
  }
  if (lastMonthEnd && range === "last_month") {
    q = q.lte("scheduled_date", lastMonthEnd);
  }

  const { data: rows, error: qErr } = await q;
  if (qErr) {
    return NextResponse.json({ error: qErr.message }, { status: 400 });
  }

  const { data: props } = await admin
    .from("partner_properties")
    .select("id, building_name")
    .eq("partner_id", orgId);

  const propById = new Map((props ?? []).map((p) => [p.id as string, p.building_name as string]));

  const { data: globals } = await admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);
  const { data: customs } = await admin.from("pm_move_reasons").select("reason_code, label").eq("partner_id", orgId).eq("active", true);
  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  const moveIds = (rows ?? []).map((r) => r.id as string);
  const podByMove = new Map<string, string | null>();
  if (moveIds.length) {
    const { data: pods } = await admin.from("proof_of_delivery").select("move_id, pdf_url").in("move_id", moveIds);
    for (const pod of pods ?? []) {
      const mid = pod.move_id as string;
      if (!podByMove.has(mid)) podByMove.set(mid, (pod.pdf_url as string) || null);
    }
  }

  const terminal = new Set(["completed", "paid", "delivered"]);

  let moves = (rows ?? []).map((m) => {
    const rc = ((m.pm_reason_code as string) || (m.pm_move_kind as string) || "").toLowerCase();
    const typeLabel =
      reasonLabels[(m.pm_reason_code as string) || ""] ||
      reasonLabels[(m.pm_move_kind as string) || ""] ||
      "Move";
    const pid = m.partner_property_id as string | null;
    const completed = terminal.has(String(m.status || "").toLowerCase());
    const completedAt = m.completed_at as string | null | undefined;
    const arrived_on_time =
      completed && completedAt
        ? inferMoveOnTimeFromCompletion({
            completed_at: completedAt,
            scheduled_time: m.scheduled_time as string | null,
          })
        : null;
    return {
      id: m.id as string,
      date: m.scheduled_date as string | null,
      building_name: pid ? propById.get(pid) ?? "—" : "—",
      unit: m.unit_number as string | null,
      move_type: typeLabel,
      reason_code: rc,
      tenant_name: m.tenant_name as string | null,
      status: m.status as string | null,
      price: Number(m.amount ?? m.estimate) || 0,
      pod_url: completed ? podByMove.get(m.id as string) ?? null : null,
      tracking_url:
        !completed && m.id
          ? partnerMoveTrackingUrl({ id: m.id as string, move_code: m.move_code as string | null })
          : null,
      arrived_on_time,
    };
  });

  if (typeFilter && typeFilter !== "all") {
    moves = moves.filter((m) => {
      const label = m.move_type.toLowerCase();
      const code = m.reason_code;
      if (typeFilter === "tenant_move_in")
        return code.includes("move_in") || code.includes("tenant_move_in") || label.includes("move-in");
      if (typeFilter === "tenant_move_out")
        return code.includes("move_out") || code.includes("tenant_move_out") || label.includes("move-out");
      if (typeFilter === "renovation")
        return (
          code.includes("reno") ||
          code.includes("displacement") ||
          code.includes("return") ||
          label.includes("renovation")
        );
      if (typeFilter === "suite_transfer") return code.includes("suite") || label.includes("suite");
      if (typeFilter === "emergency") return code.includes("emergency") || label.includes("emergency");
      return true;
    });
  }

  const totalMoves = moves.length;
  const totalSpend = moves.reduce((s, m) => s + m.price, 0);
  const avgCost = totalMoves > 0 ? Math.round(totalSpend / totalMoves) : 0;
  const onTimeRows = moves.filter((m) => m.arrived_on_time === true || m.arrived_on_time === false);
  const onTimeHits = onTimeRows.filter((m) => m.arrived_on_time === true).length;
  const onTimeRate =
    onTimeRows.length > 0 ? Math.round((onTimeHits / onTimeRows.length) * 100) : null;

  return NextResponse.json({
    moves,
    summary: {
      totalMoves,
      totalSpend,
      avgCost,
      onTimeRate,
    },
  });
}

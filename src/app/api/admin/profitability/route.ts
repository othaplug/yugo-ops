import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/auth/check-role";
import { calculateMoveProfitability, getMonthlyOverhead } from "@/lib/finance/calculateProfit";

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireOwner();
  if (authErr) return authErr;

  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");

  if (!from || !to) {
    return NextResponse.json({ error: "from and to params required" }, { status: 400 });
  }

  const sb = createAdminClient();

  // Include "paid" — moves are often marked paid when done (Square, admin mark paid, etc.)
  const completedStatuses = ["completed", "delivered", "done", "paid"];
  const fromDate = from.slice(0, 10);
  const toDate = to.slice(0, 10);

  // Fetch moves that are either: (a) scheduled in range, or (b) completed_at in range (catch null scheduled_date)
  const [{ data: byScheduled }, { data: byCompletedAt }, { data: configRows }] = await Promise.all([
    sb
      .from("moves")
      .select(
        "id, move_code, scheduled_date, completed_at, client_name, move_type, service_type, tier_selected, estimate, final_amount, tip_amount, distance_km, truck_primary, truck_secondary, move_size, est_crew_size, est_hours, actual_crew_count, actual_hours, actual_start_time, actual_end_time, crew, from_postal, status",
      )
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate)
      .order("scheduled_date", { ascending: false }),
    sb
      .from("moves")
      .select(
        "id, move_code, scheduled_date, completed_at, client_name, move_type, service_type, tier_selected, estimate, final_amount, tip_amount, distance_km, truck_primary, truck_secondary, move_size, est_crew_size, est_hours, actual_crew_count, actual_hours, actual_start_time, actual_end_time, crew, from_postal, status",
      )
      .not("completed_at", "is", null)
      .gte("completed_at", `${fromDate}T00:00:00Z`)
      .lte("completed_at", `${toDate}T23:59:59.999Z`)
      .order("completed_at", { ascending: false }),
    sb.from("platform_config").select("key, value"),
  ]);

  // Merge and dedupe by id; prefer scheduled_date-in-range set so we don't double-count
  const seen = new Set<string>();
  const merged: typeof byScheduled = [];
  for (const m of byScheduled ?? []) {
    if (m?.id && !seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }
  for (const m of byCompletedAt ?? []) {
    if (m?.id && !seen.has(m.id)) {
      seen.add(m.id);
      merged.push(m);
    }
  }
  merged.sort((a, b) => {
    const da = a.scheduled_date || a.completed_at || "";
    const db = b.scheduled_date || b.completed_at || "";
    return db.localeCompare(da);
  });

  // Include moves whose status (case-insensitive) is completed/delivered/done/paid
  const completedMoves = merged.filter((m) =>
    completedStatuses.includes((m.status || "").toLowerCase())
  );

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  const monthlyMoveCount = completedMoves.length || 1;
  const targetMargin = parseFloat(config.target_gross_margin_pct ?? "40");

  const rows = completedMoves.map((m) => {
    const revenue = Number(m.final_amount ?? m.estimate ?? 0);
    const costs = calculateMoveProfitability(m, config, monthlyMoveCount);
    return {
      id: m.id,
      move_code: m.move_code,
      date: m.scheduled_date || (m.completed_at ? m.completed_at.slice(0, 10) : null),
      client: m.client_name,
      type: m.move_type || m.service_type,
      tier: m.tier_selected,
      revenue,
      neighbourhood: m.from_postal?.substring(0, 3) ?? null,
      ...costs,
    };
  });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalDirectCost = rows.reduce((s, r) => s + r.totalDirect, 0);
  const totalGrossProfit = totalRevenue - totalDirectCost;
  const avgGrossMargin = totalRevenue > 0 ? Math.round(((totalGrossProfit / totalRevenue) * 100) * 10) / 10 : 0;
  const totalOverhead = rows.reduce((s, r) => s + r.allocatedOverhead, 0);
  const totalNetProfit = totalGrossProfit - totalOverhead;
  const avgNetMargin = totalRevenue > 0 ? Math.round(((totalNetProfit / totalRevenue) * 100) * 10) / 10 : 0;
  const avgProfitPerMove = rows.length > 0 ? Math.round(totalGrossProfit / rows.length) : 0;
  const lowMarginCount = rows.filter((r) => r.grossMargin < 25).length;

  const overhead = getMonthlyOverhead(config);
  const avgRevenue = rows.length > 0 ? totalRevenue / rows.length : 0;
  const breakEven = avgRevenue > 0 ? Math.ceil(overhead / (avgRevenue - (totalDirectCost / (rows.length || 1)))) : 0;

  return NextResponse.json({
    rows,
    summary: {
      avgGrossMargin,
      avgNetMargin,
      avgProfitPerMove,
      lowMarginCount,
      totalRevenue,
      totalDirectCost,
      totalGrossProfit,
      totalNetProfit,
      moveCount: rows.length,
      targetMargin,
    },
    overhead: {
      total: overhead,
      perMove: rows.length > 0 ? Math.round(overhead / rows.length) : overhead,
      breakEven,
      items: {
        software: parseFloat(config.monthly_software_cost ?? "250"),
        autoInsurance: parseFloat(config.monthly_auto_insurance ?? "1000"),
        glInsurance: parseFloat(config.monthly_gl_insurance ?? "300"),
        marketing: parseFloat(config.monthly_marketing_budget ?? "1000"),
        officeAdmin: parseFloat(config.monthly_office_admin ?? "350"),
        ownerDraw: parseFloat(config.monthly_owner_draw ?? "0"),
      },
    },
  });
}

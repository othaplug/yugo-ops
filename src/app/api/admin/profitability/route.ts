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

  const [{ data: moves }, { data: configRows }] = await Promise.all([
    sb
      .from("moves")
      .select(
        "id, move_code, scheduled_date, client_name, move_type, service_type, tier_selected, estimate, final_amount, tip_amount, distance_km, truck_primary, truck_secondary, move_size, est_crew_size, est_hours, actual_crew_count, actual_hours, actual_start_time, actual_end_time, crew, from_postal, status",
      )
      .in("status", ["completed", "delivered", "done"])
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .order("scheduled_date", { ascending: false }),
    sb.from("platform_config").select("key, value"),
  ]);

  const config: Record<string, string> = {};
  for (const r of configRows ?? []) config[r.key] = r.value;

  const completedMoves = moves ?? [];
  const monthlyMoveCount = completedMoves.length || 1;
  const targetMargin = parseFloat(config.target_gross_margin_pct ?? "40");

  const rows = completedMoves.map((m) => {
    const costs = calculateMoveProfitability(m, config, monthlyMoveCount);
    const revenue = m.final_amount ?? m.estimate ?? 0;
    return {
      id: m.id,
      move_code: m.move_code,
      date: m.scheduled_date,
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

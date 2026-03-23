import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getConfig } from "@/lib/config";

export async function GET(_req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const supabase = createAdminClient();
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const conversionRateStr = await getConfig("quote_conversion_rate", "0.35");
  const conversionRate = parseFloat(conversionRateStr) || 0.35;

  const periods = [7, 14, 30] as const;
  const forecasts = await Promise.all(
    periods.map(async (days) => {
      const endDate = new Date(now);
      endDate.setDate(endDate.getDate() + days);
      const endStr = endDate.toISOString().slice(0, 10);

      const [{ data: confirmedMoves }, { data: confirmedDeliveries }, { data: pipelineQuotes }] =
        await Promise.all([
          supabase
            .from("moves")
            .select("total_price, amount")
            .in("status", ["confirmed", "scheduled", "paid", "confirmed_pending_schedule", "confirmed_unassigned"])
            .gte("scheduled_date", todayStr)
            .lte("scheduled_date", endStr),
          supabase
            .from("deliveries")
            .select("price")
            .in("status", ["confirmed", "scheduled", "approved"])
            .gte("scheduled_date", todayStr)
            .lte("scheduled_date", endStr),
          supabase
            .from("quotes")
            .select("essential_price")
            .in("status", ["sent", "viewed", "reactivated"])
            .gte("move_date", todayStr)
            .lte("move_date", endStr),
        ]);

      const confirmedRevenue =
        (confirmedMoves ?? []).reduce((s, m) => s + (Number(m.total_price) || Number(m.amount) || 0), 0) +
        (confirmedDeliveries ?? []).reduce((s, d) => s + (Number(d.price) || 0), 0);

      const pipelineRevenue = Math.round(
        (pipelineQuotes ?? []).reduce((s, q) => s + (Number(q.essential_price) || 0), 0) *
          conversionRate
      );

      return { days, confirmedRevenue, pipelineRevenue, quoteCount: (pipelineQuotes ?? []).length };
    })
  );

  return NextResponse.json({ forecasts, conversionRate });
}

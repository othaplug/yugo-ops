import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function GET(req: NextRequest) {
  const token =
    req.headers.get("x-crew-token") ||
    req.cookies.get(CREW_COOKIE_NAME)?.value ||
    req.nextUrl.searchParams.get("token") ||
    "";
  const crewMember = verifyCrewToken(token);
  if (!crewMember) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: tips } = await supabase
    .from("tips")
    .select("id, move_id, client_name, amount, processing_fee, net_amount, charged_at")
    .eq("crew_id", crewMember.crewMemberId)
    .order("charged_at", { ascending: false })
    .limit(50);

  const allTips = tips || [];

  const totalEarned = allTips.reduce((s, t) => s + Number(t.net_amount ?? t.amount ?? 0), 0);
  const avgTip = allTips.length > 0 ? totalEarned / allTips.length : 0;
  const highestTip = allTips.length > 0 ? Math.max(...allTips.map((t) => Number(t.net_amount ?? t.amount ?? 0))) : 0;

  // Monthly breakdown for last 6 months
  const now = new Date();
  const monthlyBreakdown: { label: string; amount: number; count: number }[] = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-CA", { month: "short", year: "numeric" });
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString();

    const monthTips = allTips.filter((t) => t.charged_at >= monthStart && t.charged_at <= monthEnd);
    monthlyBreakdown.push({
      label,
      amount: monthTips.reduce((s, t) => s + Number(t.net_amount ?? t.amount ?? 0), 0),
      count: monthTips.length,
    });
  }

  return NextResponse.json({
    tips: allTips,
    summary: {
      totalEarned,
      avgTip,
      highestTip,
      count: allTips.length,
    },
    monthlyBreakdown,
  });
}

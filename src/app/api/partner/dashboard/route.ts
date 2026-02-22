import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

/** GET /api/partner/dashboard - Summary for partner dashboard (counts, recent activity). */
export async function GET() {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();

  const [
    { count: deliveriesCount },
    { count: movesCount },
    { data: recentDeliveries },
    { data: recentMoves },
  ] = await Promise.all([
    supabase.from("deliveries").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
    supabase.from("moves").select("id", { count: "exact", head: true }).eq("organization_id", orgId!),
    supabase
      .from("deliveries")
      .select("id, delivery_number, status, scheduled_date")
      .eq("organization_id", orgId!)
      .order("scheduled_date", { ascending: false })
      .limit(5),
    supabase
      .from("moves")
      .select("id, move_code, status, scheduled_date")
      .eq("organization_id", orgId!)
      .order("scheduled_date", { ascending: false })
      .limit(5),
  ]);

  return NextResponse.json({
    deliveriesCount: deliveriesCount ?? 0,
    movesCount: movesCount ?? 0,
    recentDeliveries: recentDeliveries || [],
    recentMoves: recentMoves || [],
  });
}

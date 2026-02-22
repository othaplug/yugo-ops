import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

/** GET /api/partner/moves - List moves for the partner's organization (e.g. designer projects). */
export async function GET(req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  let query = supabase
    .from("moves")
    .select("id, move_code, client_name, status, stage, move_type, scheduled_date, scheduled_time, from_address, to_address, created_at, updated_at")
    .eq("organization_id", orgId!)
    .order("scheduled_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error: dbError } = await query;

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  return NextResponse.json({ moves: data || [] });
}

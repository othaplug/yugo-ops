import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requirePartner } from "@/lib/partner-auth";

/** GET /api/partner/deliveries - List deliveries for the partner's organization. */
export async function GET(req: NextRequest) {
  const { orgId, error } = await requirePartner();
  if (error) return error;

  const supabase = await createClient();
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);

  let query = supabase
    .from("deliveries")
    .select("id, delivery_number, customer_name, client_name, status, stage, scheduled_date, time_slot, delivery_address, pickup_address, category, created_at, updated_at")
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

  return NextResponse.json({ deliveries: data || [] });
}

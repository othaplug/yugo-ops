import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";
import { canAccessDeliveryPod, isStaffSession } from "@/lib/authz/pod-access";

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const jobId = req.nextUrl.searchParams.get("jobId");
    const jobType = req.nextUrl.searchParams.get("jobType") || "delivery";

    if (!jobId) return NextResponse.json(null);

    const admin = createAdminClient();
    const col = jobType === "move" ? "move_id" : "delivery_id";

    // Authorize: staff always; a partner only for a delivery their org owns.
    // Move PODs are staff-only. This blocked the prior IDOR where any logged-in
    // user could read any job's proof-of-delivery.
    if (jobType === "move") {
      if (!(await isStaffSession())) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const { data: del } = await admin
        .from("deliveries")
        .select("organization_id")
        .eq("id", jobId)
        .maybeSingle();
      if (!(await canAccessDeliveryPod(del?.organization_id))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const { data } = await admin
      .from("proof_of_delivery")
      .select("*")
      .eq(col, jobId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(data || null);
  } catch (err) {
    console.error("[GET /api/pod/by-job]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

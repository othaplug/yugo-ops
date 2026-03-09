import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const jobId = req.nextUrl.searchParams.get("jobId");
    const jobType = req.nextUrl.searchParams.get("jobType") || "delivery";

    if (!jobId) return NextResponse.json(null);

    const admin = createAdminClient();
    const col = jobType === "move" ? "move_id" : "delivery_id";

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

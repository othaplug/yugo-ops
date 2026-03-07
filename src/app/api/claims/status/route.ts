import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const moveId = searchParams.get("moveId");

    if (!moveId) {
      return NextResponse.json({ error: "moveId is required" }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: claim } = await supabase
      .from("claims")
      .select("id, claim_number, status")
      .eq("move_id", moveId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!claim) {
      return NextResponse.json({ claim: null });
    }

    return NextResponse.json({
      claim: {
        id: claim.id,
        claim_number: claim.claim_number,
        status: claim.status,
      },
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

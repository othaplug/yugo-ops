import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const stage = req.nextUrl.searchParams.get("stage") || "unloading";

  const admin = createAdminClient();
  const { data: move } = await admin.from("moves").select("id, crew_id").eq("id", jobId).single();
  if (!move || move.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const { data: verifications } = await admin
    .from("inventory_verifications")
    .select("move_inventory_id, room, item_name, stage")
    .eq("job_id", jobId)
    .eq("stage", stage);

  const verifiedIds = new Set((verifications || []).filter((v) => v.move_inventory_id).map((v) => v.move_inventory_id));
  const verifiedKeys = new Set((verifications || []).filter((v) => v.room && v.item_name).map((v) => `${v.room}::${v.item_name}`));
  const verifiedRooms = new Set((verifications || []).filter((v) => v.room && !v.move_inventory_id).map((v) => v.room!));

  return NextResponse.json({
    verifiedIds: Array.from(verifiedIds),
    verifiedKeys: Array.from(verifiedKeys),
    verifiedRooms: Array.from(verifiedRooms),
  });
}

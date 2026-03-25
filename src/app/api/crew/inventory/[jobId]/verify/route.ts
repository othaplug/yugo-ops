import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { resolveCrewInventoryJob } from "@/lib/resolve-crew-inventory-job";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId: rawJobId } = await params;
  const body = await req.json();
  const moveInventoryId = body.moveInventoryId ?? body.move_inventory_id;
  const room = (body.room || "").toString().trim();
  const itemName = (body.itemName || body.item_name || "").toString().trim();
  const stage = (body.stage || "unloading").toString() as "loading" | "unloading";
  if (!["loading", "unloading"].includes(stage)) {
    return NextResponse.json({ error: "Invalid stage" }, { status: 400 });
  }

  const admin = createAdminClient();
  const ctx = await resolveCrewInventoryJob(admin, rawJobId);
  if (!ctx || ctx.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "Job not found or not assigned" }, { status: 404 });
  }

  const entityId = ctx.id;
  const jobTypeDb = ctx.kind;

  if (jobTypeDb === "delivery" && moveInventoryId) {
    return NextResponse.json({ error: "Delivery inventory uses room and item name" }, { status: 400 });
  }

  if (moveInventoryId) {
    const { data: inv } = await admin.from("move_inventory").select("id, move_id").eq("id", moveInventoryId).single();
    if (!inv || inv.move_id !== entityId) return NextResponse.json({ error: "Invalid item" }, { status: 400 });
  } else if (!room || !itemName) {
    return NextResponse.json({ error: "room and itemName required when not using moveInventoryId" }, { status: 400 });
  }

  const { data: verification, error } = await admin
    .from("inventory_verifications")
    .insert({
      job_id: entityId,
      job_type: jobTypeDb,
      move_inventory_id: moveInventoryId || null,
      room: room || null,
      item_name: itemName || null,
      stage,
      verified_by: payload.crewMemberId,
    })
    .select("id, stage, verified_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(verification);
}

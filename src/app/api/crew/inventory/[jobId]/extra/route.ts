import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const description = (body.description || "").toString().trim();
  const room = (body.room || "").toString().trim() || null;
  const quantity = Math.max(1, parseInt(String(body.quantity), 10) || 1);

  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);

  let entityId: string;
  let jobType: "move" | "delivery" = "move";
  if (isUuid) {
    const [moveRes, delRes] = await Promise.all([
      admin.from("moves").select("id, crew_id").eq("id", jobId).maybeSingle(),
      admin.from("deliveries").select("id, crew_id").eq("id", jobId).maybeSingle(),
    ]);
    const move = moveRes.data;
    const delivery = delRes.data;
    if (!move && !delivery) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    jobType = delivery ? "delivery" : "move";
    const crewId = move?.crew_id || delivery?.crew_id;
    if (crewId !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    entityId = move?.id || delivery?.id || jobId;
  } else {
    const [moveRes, delRes] = await Promise.all([
      admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).maybeSingle(),
      admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).maybeSingle(),
    ]);
    const move = moveRes.data;
    const delivery = delRes.data;
    if (!move && !delivery) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    jobType = delivery ? "delivery" : "move";
    const crewId = move?.crew_id || delivery?.crew_id;
    if (crewId !== payload.teamId) return NextResponse.json({ error: "Job not assigned to your team" }, { status: 403 });
    entityId = move?.id || delivery?.id || jobId;
  }
  const { data: item, error } = await admin
    .from("extra_items")
    .insert({
      job_id: entityId,
      job_type: jobType,
      added_by: payload.crewMemberId,
      requested_by: "crew",
      status: "pending",
      description,
      room,
      quantity,
    })
    .select("id, description, room, quantity, added_at")
    .single();

  if (error) {
    const msg =
      (error.message?.includes("added_by") && error.message?.includes("null")) ||
      error.message?.includes("requested_by") ||
      error.message?.includes("job_type")
        ? "Database migration required for extra items. Run: supabase db push"
        : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(item);
}

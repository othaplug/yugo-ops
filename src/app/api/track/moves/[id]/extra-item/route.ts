import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/** POST: Client adds extra item request (pending admin approval) */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || req.headers.get("x-track-token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const body = await req.json();
  const description = (body.description || "").toString().trim();
  const room = (body.room || "").toString().trim() || null;
  const quantity = Math.max(1, parseInt(String(body.quantity), 10) || 1);

  if (!description) return NextResponse.json({ error: "Description required" }, { status: 400 });

  const admin = createAdminClient();
  const { data: move } = await admin.from("moves").select("id").eq("id", moveId).single();
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const { data: item, error } = await admin
    .from("extra_items")
    .insert({
      job_id: moveId,
      job_type: "move",
      added_by: null,
      requested_by: "client",
      status: "pending",
      description,
      room,
      quantity,
    })
    .select("id, description, room, quantity, added_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(item);
}

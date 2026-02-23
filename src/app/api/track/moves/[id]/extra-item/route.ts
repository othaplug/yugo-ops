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
  const { data: move } = await admin.from("moves").select("id").eq("id", moveId).single();
  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const { data: item, error } = await admin
    .from("extra_items")
    .insert({
      job_id: moveId,
      added_by: null,
      requested_by: "client",
      status: "pending",
      description,
      room,
      quantity,
    })
    .select("id, description, room, quantity, added_at")
    .single();

  if (error) {
    const msg =
      error.message?.includes("added_by") && error.message?.includes("null")
        ? "Database migration required for extra items (extra_items.added_by must be nullable). Run: supabase db push"
        : error.message;
    return NextResponse.json({ error: msg }, { status: 500 });
  }
  return NextResponse.json(item);
}

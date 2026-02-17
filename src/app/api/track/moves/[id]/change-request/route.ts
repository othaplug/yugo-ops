import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

const CHANGE_TYPES = [
  "Change move date",
  "Change move time",
  "Add items to inventory",
  "Remove items from inventory",
  "Change destination address",
  "Add special instructions",
  "Upgrade service tier",
  "Other",
];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const type = body.type || "Other";
    const description = (body.description || "").trim();
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";

    if (!description) {
      return NextResponse.json({ error: "Please describe the change" }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: move } = await admin.from("moves").select("id").eq("id", moveId).single();
    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const { data: cr, error } = await admin
      .from("move_change_requests")
      .insert({
        move_id: moveId,
        type: CHANGE_TYPES.includes(type) ? type : "Other",
        description,
        urgency,
      })
      .select("id")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, id: cr?.id });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to submit" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/api-auth";

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
  const { error: authError } = await requireAuth();
  if (authError) return authError;

  try {
    const { id: moveId } = await params;
    const body = await req.json();
    const type = body.type || "Other";
    const description = (body.description || "").trim();
    const urgency = body.urgency === "urgent" ? "urgent" : "normal";

    if (!description) {
      return NextResponse.json({ error: "Please describe the change" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const email = user.email.trim().toLowerCase();
    const { data: move } = await supabase
      .from("moves")
      .select("id, client_email")
      .eq("id", moveId)
      .ilike("client_email", email)
      .single();

    if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

    const { data: cr, error } = await supabase
      .from("move_change_requests")
      .insert({
        move_id: moveId,
        type: CHANGE_TYPES.includes(type) ? type : "Other",
        description,
        urgency,
        submitted_by: "client",
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

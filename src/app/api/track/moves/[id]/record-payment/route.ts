import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

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
    const admin = createAdminClient();

    const { data: existing } = await admin
      .from("move_documents")
      .select("id")
      .eq("move_id", moveId)
      .eq("type", "invoice")
      .ilike("title", "Payment Receipt%")
      .limit(1)
      .maybeSingle();

    const updateMove = admin
      .from("moves")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", moveId);

    if (existing) {
      await updateMove;
      return NextResponse.json({ ok: true, alreadyRecorded: true });
    }

    const [{ error: docError }, { error: moveError }] = await Promise.all([
      admin.from("move_documents").insert({
        move_id: moveId,
        type: "invoice",
        title: `Payment Receipt – ${new Date().toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}`,
        storage_path: null,
        external_url: null,
      }),
      updateMove,
    ]);

    if (docError) return NextResponse.json({ error: docError.message }, { status: 500 });
    if (moveError) return NextResponse.json({ error: moveError.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    console.error("[record-payment]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to record" },
      { status: 500 }
    );
  }
}

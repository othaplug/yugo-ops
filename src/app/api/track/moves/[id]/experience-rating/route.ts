import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/** POST: Save client experience rating (1-5) and optional feedback (1-3 stars). */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  let body: { rating?: number; feedback?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = typeof body.rating === "number" ? body.rating : parseInt(String(body?.rating ?? ""), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
  }

  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";

  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code, client_name, internal_notes")
    .eq("id", moveId)
    .single();
  if (!move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  // Get or create review_request for this move
  let { data: rr } = await admin
    .from("review_requests")
    .select("id")
    .eq("move_id", moveId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!rr) {
    const { data: inserted, error: insertErr } = await admin
      .from("review_requests")
      .insert({
        move_id: moveId,
        client_name: (move as { client_name?: string }).client_name || "Client",
        status: "pending",
        scheduled_send_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (insertErr || !inserted) {
      return NextResponse.json({ error: "Could not create review request" }, { status: 500 });
    }
    rr = inserted;
  }

  const { error: updateErr } = await admin
    .from("review_requests")
    .update({
      client_rating: rating,
      ...(feedback ? { client_feedback: feedback } : {}),
    })
    .eq("id", rr.id);

  if (updateErr) {
    console.error("[experience-rating] update failed:", updateErr.message, updateErr.details);
    const message =
      typeof updateErr.message === "string" && updateErr.message.includes("column")
        ? "Database schema may be missing columns. Run migrations (e.g. client_rating, client_feedback on review_requests)."
        : "Could not save rating";
    return NextResponse.json(
      { error: message, detail: process.env.NODE_ENV === "development" ? updateErr.message : undefined },
      { status: 500 }
    );
  }

  // 1-3 stars with feedback: notify admin by appending to move internal_notes
  if (rating >= 1 && rating <= 3 && feedback) {
    const existing = ((move as { internal_notes?: string }).internal_notes || "").trim();
    const timestamp = new Date().toLocaleString("en-CA", { dateStyle: "short", timeStyle: "short" });
    const entry = `[${timestamp}] Client experience feedback (${rating}★): ${feedback}`;
    const appended = existing ? `${existing}\n\n${entry}` : entry;
    await admin
      .from("moves")
      .update({ internal_notes: appended })
      .eq("id", moveId);
  }

  return NextResponse.json({ ok: true, reviewRequestId: rr.id });
}

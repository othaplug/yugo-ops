import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/track-token";

/** POST: Save experience rating by review token (public, from email link). 1-3: feedback form. 4-5: returns redirectUrl to Google. */
export async function POST(req: NextRequest) {
  let body: { rating?: number; feedback?: string; token?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const token =
    req.nextUrl.searchParams.get("token") ||
    req.headers.get("x-review-token") ||
    (typeof body?.token === "string" ? body.token : "") ||
    "";
  const reviewRequestId = verifyReviewToken(token);
  if (!reviewRequestId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const rating = typeof body.rating === "number" ? body.rating : parseInt(String(body?.rating ?? ""), 10);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1-5" }, { status: 400 });
  }

  const feedback = typeof body.feedback === "string" ? body.feedback.trim() : "";

  const admin = createAdminClient();

  const { data: rr, error: fetchErr } = await admin
    .from("review_requests")
    .select("id, move_id")
    .eq("id", reviewRequestId)
    .single();

  if (fetchErr || !rr) {
    return NextResponse.json({ error: "Review request not found" }, { status: 404 });
  }

  const { error: updateErr } = await admin
    .from("review_requests")
    .update({
      client_rating: rating,
      ...(feedback ? { client_feedback: feedback } : {}),
      ...(rating >= 4 ? { review_clicked: true, review_clicked_at: new Date().toISOString() } : {}),
    })
    .eq("id", rr.id);

  if (updateErr) {
    return NextResponse.json({ error: "Could not save rating" }, { status: 500 });
  }

  if (rating >= 1 && rating <= 3 && feedback && rr.move_id) {
    const { data: move } = await admin
      .from("moves")
      .select("internal_notes")
      .eq("id", rr.move_id)
      .single();
    const existing = (move?.internal_notes || "").trim();
    const entry = `[${new Date().toLocaleString("en-CA", { dateStyle: "short", timeStyle: "short" })}] Client experience feedback (${rating}★): ${feedback}`;
    await admin
      .from("moves")
      .update({ internal_notes: existing ? `${existing}\n\n${entry}` : entry })
      .eq("id", rr.move_id);
  }

  if (rating >= 4) {
    const { data: config } = await admin
      .from("platform_config")
      .select("value")
      .eq("key", "google_review_url")
      .single();
    const redirectUrl =
      (config as { value?: string } | null)?.value ||
      process.env.GOOGLE_REVIEW_URL ||
      "https://g.page/r/yugo-moving/review";
    return NextResponse.json({ ok: true, redirectUrl });
  }

  return NextResponse.json({ ok: true });
}

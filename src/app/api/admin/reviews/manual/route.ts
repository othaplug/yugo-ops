import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

/**
 * POST /api/admin/reviews/manual
 *
 * Log a review a client left directly on Google (or another channel) without
 * using the emailed review link. Creates a review_requests row with
 * source='manual' and status='reviewed' so it surfaces in the reviews table
 * alongside system-sent reviews.
 */
export async function POST(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  let body: {
    rating?: number;
    platform?: string;
    client_name?: string;
    client_email?: string;
    move_code?: string;
    feedback?: string;
    review_date?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "rating must be 1–5" }, { status: 400 });
  }

  const platform = String(body.platform || "google").toLowerCase();
  if (!["google", "internal", "other"].includes(platform)) {
    return NextResponse.json({ error: "platform must be google, internal, or other" }, { status: 400 });
  }

  const clientName = (body.client_name || "").trim() || "Anonymous";
  const clientEmail = (body.client_email || "").trim() || null;
  const feedback = (body.feedback || "").trim() || null;
  const moveCode = (body.move_code || "").trim().toUpperCase() || null;

  // Parse review_date — defaults to now when omitted or invalid
  let createdAt = new Date().toISOString();
  if (body.review_date) {
    const parsed = new Date(body.review_date);
    if (!Number.isNaN(parsed.getTime())) createdAt = parsed.toISOString();
  }

  const db = createAdminClient();

  // Resolve move_code → move_id + client details when provided
  let moveId: string | null = null;
  let resolvedMoveCode: string | null = null;
  let scheduledDate: string | null = null;

  if (moveCode) {
    const { data: move } = await db
      .from("moves")
      .select("id, move_code, scheduled_date, client_name, client_email")
      .or(`move_code.eq.${moveCode},id.eq.${moveCode}`)
      .maybeSingle();

    if (!move) {
      return NextResponse.json(
        { error: `Move "${moveCode}" not found` },
        { status: 404 },
      );
    }

    moveId = move.id;
    resolvedMoveCode = move.move_code ?? null;
    scheduledDate = move.scheduled_date ?? null;

    // Backfill client details from the move when the admin left them blank
    if (!clientEmail && move.client_email) {
      // leave as provided — don't override what admin typed
    }
  }

  const { data: row, error: insErr } = await db
    .from("review_requests")
    .insert({
      move_id: moveId,
      client_name: clientName,
      client_email: clientEmail,
      client_rating: rating,
      client_feedback: feedback,
      status: "reviewed",
      source: "manual",
      platform,
      // scheduled_send_at is NOT NULL — set to now since there's no email to send
      scheduled_send_at: createdAt,
      created_at: createdAt,
    })
    .select("id")
    .single();

  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    id: row.id,
    move_code: resolvedMoveCode,
    scheduled_date: scheduledDate,
  });
}

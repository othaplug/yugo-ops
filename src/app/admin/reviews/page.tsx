export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ReviewsListClient from "./ReviewsListClient";

export default async function ReviewsPage() {
  const db = createAdminClient();

  // Pull every review_request — rated and pending — plus the linked move so
  // each row has a clickable move_code + scheduled_date for context. Sorted
  // newest-first so the operator's recent batch is at the top.
  const { data: reviewsRaw } = await db
    .from("review_requests")
    .select(
      "id, move_id, client_name, client_email, client_rating, client_feedback, status, source, platform, email_sent_at, sms_sent_at, reminder_sent_at, review_clicked, review_clicked_at, created_at, moves:move_id(move_code, scheduled_date)",
    )
    .order("created_at", { ascending: false })
    .limit(500);

  const rows = (reviewsRaw ?? []).map((row) => {
    const m = (row as { moves?: { move_code?: string | null; scheduled_date?: string | null } | null })
      .moves;
    const { moves: _drop, ...rest } = row as typeof row & { moves?: unknown };
    return {
      ...rest,
      move_code: m?.move_code ?? null,
      scheduled_date: m?.scheduled_date ?? null,
    };
  });

  return <ReviewsListClient reviews={rows} />;
}

export const metadata = { title: "Reviews" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import ReviewsListClient from "./ReviewsListClient";

export default async function ReviewsPage() {
  const db = createAdminClient();

  const [{ data: reviewsRaw }, { data: movesRaw }] = await Promise.all([
    db
      .from("review_requests")
      .select(
        "id, move_id, client_name, client_email, client_rating, client_feedback, status, source, platform, email_sent_at, sms_sent_at, reminder_sent_at, review_clicked, review_clicked_at, created_at, moves:move_id(move_code, scheduled_date)",
      )
      .order("created_at", { ascending: false })
      .limit(500),

    // Completed moves for the "Add review" move selector
    db
      .from("moves")
      .select("id, move_code, client_name, client_email, scheduled_date")
      .in("status", ["completed", "delivered", "done", "paid"])
      .order("scheduled_date", { ascending: false })
      .limit(300),
  ]);

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

  const completedMoves = (movesRaw ?? []).map((m) => ({
    id: m.id as string,
    move_code: (m.move_code as string | null) ?? "",
    client_name: (m.client_name as string | null) ?? "",
    client_email: (m.client_email as string | null) ?? "",
    scheduled_date: (m.scheduled_date as string | null) ?? "",
  }));

  return <ReviewsListClient reviews={rows} completedMoves={completedMoves} />;
}

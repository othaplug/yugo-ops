import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

/** GET: Review request state + Google review URL for move completion experience flow */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: move } = await admin
    .from("moves")
    .select("id, status")
    .eq("id", moveId)
    .single();
  if (!move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  const [reviewRes, configRes] = await Promise.all([
    admin
      .from("review_requests")
      .select("id, client_rating, client_feedback, review_clicked")
      .eq("move_id", moveId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("platform_config")
      .select("value")
      .eq("key", "google_review_url")
      .single(),
  ]);

  const rr = reviewRes.data ?? null;
  const googleReviewUrl =
    (configRes.data as { value?: string } | null)?.value ||
    process.env.GOOGLE_REVIEW_URL ||
    "https://g.page/r/CU67iDN6TgMIEB0/review/";

  return NextResponse.json({
    reviewRequestId: rr?.id ?? null,
    googleReviewUrl,
    clientRating: rr?.client_rating ?? null,
    clientFeedback: rr?.client_feedback ?? null,
    reviewClicked: rr?.review_clicked ?? false,
  });
}

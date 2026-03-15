import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/track-token";

/**
 * GET: Public review state by token (no session). Returns googleReviewUrl and existing rating/feedback.
 * Token is signed with TRACK_SIGNING_SECRET; same secret must be set everywhere that sends or verifies review links.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") || "";
  const reviewRequestId = verifyReviewToken(token);
  if (!reviewRequestId) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 401 });
  }

  const admin = createAdminClient();
  const [rrRes, configRes] = await Promise.all([
    admin
      .from("review_requests")
      .select("id, client_rating, client_feedback, review_clicked")
      .eq("id", reviewRequestId)
      .single(),
    admin.from("platform_config").select("value").eq("key", "google_review_url").single(),
  ]);

  const rr = rrRes.data;
  if (!rr) {
    return NextResponse.json({ error: "Review request not found" }, { status: 404 });
  }

  const googleReviewUrl =
    (configRes.data as { value?: string } | null)?.value ||
    process.env.GOOGLE_REVIEW_URL ||
    "https://g.page/r/CU67iDN6TgMIEB0/review/";

  return NextResponse.json({
    googleReviewUrl,
    clientRating: rr.client_rating ?? null,
    clientFeedback: rr.client_feedback ?? null,
    reviewClicked: rr.review_clicked ?? false,
  });
}

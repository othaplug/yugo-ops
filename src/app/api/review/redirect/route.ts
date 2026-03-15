import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyReviewToken } from "@/lib/track-token";

/** 4 and 5 star email links always redirect here. */
const REVIEW_4_5_STAR_URL = "https://g.page/r/CU67iDN6TgMIEB0/review/";

const DEFAULT_GOOGLE_URL = "https://g.page/r/CU67iDN6TgMIEB0/review/";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");
  const ratingParam = url.searchParams.get("rating");
  const rating = ratingParam ? parseInt(ratingParam, 10) : NaN;

  const admin = createAdminClient();

  // Token + rating (4 or 5): save rating then redirect to Google (used by email star links)
  if (token && Number.isInteger(rating) && rating >= 4 && rating <= 5) {
    const reviewRequestId = verifyReviewToken(token);
    if (reviewRequestId) {
      await admin
        .from("review_requests")
        .update({
          client_rating: rating,
          review_clicked: true,
          review_clicked_at: new Date().toISOString(),
        })
        .eq("id", reviewRequestId);

      return NextResponse.redirect(REVIEW_4_5_STAR_URL);
    }
    // Invalid/expired token: send to review page so user sees "Invalid or expired link" (same as 1–3 star)
    const reviewPage = new URL("/review", req.url);
    reviewPage.searchParams.set("token", token);
    reviewPage.searchParams.set("rating", String(rating));
    return NextResponse.redirect(reviewPage);
  }

  // Legacy: id only — mark review_clicked and redirect to Google
  if (id) {
    await admin
      .from("review_requests")
      .update({ review_clicked: true, review_clicked_at: new Date().toISOString() })
      .eq("id", id);
  }

  const { data: config } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "google_review_url")
    .single();

  const redirectUrl = config?.value || process.env.GOOGLE_REVIEW_URL || DEFAULT_GOOGLE_URL;
  return NextResponse.redirect(redirectUrl);
}

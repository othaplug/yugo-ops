import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveGoogleReviewUrl } from "@/lib/google-review-url";
import { verifyReviewToken } from "@/lib/track-token";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  const token = url.searchParams.get("token");
  const ratingParam = url.searchParams.get("rating");
  const rating = ratingParam ? parseInt(ratingParam, 10) : NaN;

  const admin = createAdminClient();

  // Token + rating (4 or 5): save rating then redirect to Google (legacy email links)
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

      const { data: cfg } = await admin
        .from("platform_config")
        .select("value")
        .eq("key", "google_review_url")
        .single();
      return NextResponse.redirect(resolveGoogleReviewUrl(cfg?.value));
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

  return NextResponse.redirect(resolveGoogleReviewUrl(config?.value));
}

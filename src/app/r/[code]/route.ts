import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Short review link. The SMS and email carry /r/<code>; this logs the click,
 * stops the cadence (review_clicked), and 302s the client straight to Google's
 * "write a review" box. No star page, no gate (Google policy). Public, idempotent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const admin = createAdminClient();

  // Resolve the Google destination (config override → env → fallback profile).
  const { data: cfg } = await admin
    .from("platform_config")
    .select("value")
    .eq("key", "google_review_url")
    .maybeSingle();
  const googleUrl =
    (cfg?.value && String(cfg.value).trim()) ||
    process.env.GOOGLE_REVIEW_URL ||
    "https://g.page/r/CU67iDN6TgMIEB0/review/";

  // Log the click so the cadence stops. Never block the redirect on this.
  const { data: rr } = await admin
    .from("review_requests")
    .select("id")
    .eq("short_code", code)
    .maybeSingle();
  if (rr?.id) {
    await admin
      .from("review_requests")
      .update({ review_clicked: true, review_clicked_at: new Date().toISOString() })
      .eq("id", rr.id)
      .then(() => {}, () => {});
  }

  return NextResponse.redirect(googleUrl, 302);
}

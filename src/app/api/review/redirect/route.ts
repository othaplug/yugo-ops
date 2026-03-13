import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_GOOGLE_URL = "https://www.google.com";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  const admin = createAdminClient();

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

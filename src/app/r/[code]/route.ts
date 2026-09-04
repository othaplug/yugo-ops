import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signReviewToken } from "@/lib/track-token";

/**
 * Short review link. The SMS carries /r/<code>; this resolves the code to its
 * review_requests row, signs a fresh token, and forwards to the star gate.
 * Public (no auth) and idempotent.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const origin = new URL(req.url).origin;

  const admin = createAdminClient();
  const { data } = await admin
    .from("review_requests")
    .select("id")
    .eq("short_code", code)
    .maybeSingle();

  if (!data?.id) {
    return NextResponse.redirect(new URL("/review", origin));
  }

  const token = signReviewToken(data.id);
  return NextResponse.redirect(
    new URL(`/review?token=${encodeURIComponent(token)}`, origin),
  );
}

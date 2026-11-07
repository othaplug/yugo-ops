import { NextRequest, NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyRecommendedTier } from "@/lib/quotes/set-recommended-tier";

/**
 * Change the recommended tier on a tiered quote (post-generate, no reprice).
 * Flips recommended_tier, moves the stored deposit to that tier, and re-syncs
 * the linked HubSpot deal. Drives the "Make recommended" control on the admin
 * quote card.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { quoteId } = await params;
  let body: { tier?: string };
  try {
    body = (await req.json()) as { tier?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const sb = createAdminClient();
  const result = await applyRecommendedTier(sb, quoteId, String(body.tier ?? ""));
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    recommended_tier: result.recommended_tier,
    deposit_amount: result.deposit_amount,
  });
}

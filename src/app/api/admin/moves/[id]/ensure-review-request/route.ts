import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createReviewRequestIfEligible } from "@/lib/review-request-helper";
import { requireAuth } from "@/lib/api-auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error: authError } = await requireAuth();
  if (authError) return authError;

  const { id: moveId } = await params;
  if (!moveId) return NextResponse.json({ error: "Move ID required" }, { status: 400 });

  const admin = createAdminClient();
  const created = await createReviewRequestIfEligible(admin, moveId);

  return NextResponse.json({ created });
}

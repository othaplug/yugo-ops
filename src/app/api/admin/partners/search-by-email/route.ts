import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";

/**
 * POST /api/admin/partners/search-by-email
 *
 * Body: { email: string, phone?: string }
 *
 * Returns the first matching organization (partner) in OPS+ by email or phone.
 * Used by the partner onboarding wizard to prevent duplicate creation.
 */
export async function POST(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const { email, phone } = await req.json().catch(() => ({}));

  if (!email && !phone) {
    return NextResponse.json({ partner: null });
  }

  const admin = createAdminClient();

  const orFilter = [
    email ? `email.eq.${email.trim().toLowerCase()}` : null,
    phone ? `phone.eq.${phone.trim()}` : null,
  ]
    .filter(Boolean)
    .join(",");

  const { data } = await admin
    .from("organizations")
    .select("id, name, email, phone, onboarding_status")
    .or(orFilter)
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ partner: data ?? null });
}

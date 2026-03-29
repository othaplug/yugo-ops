import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requirePartner } from "@/lib/partner-auth";
import { listPartnerB2BVerticals } from "@/lib/partners/partner-b2b-verticals";

export const dynamic = "force-dynamic";

/** Delivery verticals this partner has on file (partner_vertical_rates). */
export async function GET() {
  const { primaryOrgId, error } = await requirePartner();
  if (error) return error;
  if (!primaryOrgId) {
    return NextResponse.json({ error: "No organization linked" }, { status: 403 });
  }
  const admin = createAdminClient();
  const verticals = await listPartnerB2BVerticals(admin, primaryOrgId);
  return NextResponse.json({ verticals });
}

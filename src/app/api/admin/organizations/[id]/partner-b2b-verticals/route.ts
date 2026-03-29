import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { listPartnerB2BVerticals } from "@/lib/partners/partner-b2b-verticals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: organizationId } = await params;
  if (!organizationId) {
    return NextResponse.json({ error: "Organization id required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const verticals = await listPartnerB2BVerticals(admin, organizationId);
  return NextResponse.json({ verticals });
}

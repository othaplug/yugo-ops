import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-sync";

/** Re-merge crew/admin-driven Estate checklist flags (after status change from admin UI, etc.). */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const admin = createAdminClient();
  await applyEstateServiceChecklistAutomation(admin, moveId);

  const { data: move } = await admin
    .from("moves")
    .select("estate_service_checklist")
    .eq("id", moveId)
    .single();

  return NextResponse.json({
    ok: true,
    estate_service_checklist: move?.estate_service_checklist ?? {},
  });
}

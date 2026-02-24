import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("client_sign_offs")
    .select(`
      id, signed_by, signed_at,
      signed_lat, signed_lng,
      all_items_received, condition_accepted,
      walkthrough_conducted_by_client,
      client_present_during_unloading,
      pre_existing_conditions_noted,
      photos_reviewed_by_client,
      satisfaction_rating, would_recommend, nps_score,
      no_issues_during_move, no_damages, no_property_damage,
      walkthrough_completed, crew_conducted_professionally,
      crew_wore_protection, furniture_reassembled,
      items_placed_correctly, property_left_clean,
      claims_process_explained,
      damage_report_deadline,
      escalation_triggered, escalation_reason,
      discrepancy_flags,
      feedback_note, exceptions
    `)
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Also fetch skip records for this job
  const { data: skips } = await admin
    .from("signoff_skips")
    .select("id, skip_reason, skip_note, location_lat, location_lng, created_at")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .order("created_at", { ascending: false });

  return NextResponse.json({ signOff: data || null, skips: skips || [] });
}

import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { generateSignOffReceiptPDF } from "@/lib/pdf";
import { formatJobId } from "@/lib/move-code";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { id: moveId } = await params;
  const admin = createAdminClient();

  const { data: signOff, error } = await admin
    .from("client_sign_offs")
    .select("*")
    .eq("job_id", moveId)
    .eq("job_type", "move")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!signOff) return NextResponse.json({ error: "No sign-off found" }, { status: 404 });

  const { data: move } = await admin
    .from("moves")
    .select("id, move_code, client_name")
    .eq("id", moveId)
    .maybeSingle();

  const displayId = formatJobId(move?.move_code || moveId, "move");

  const confirmations = [
    { label: "All items received", value: !!signOff.all_items_received },
    { label: "Condition accepted", value: !!signOff.condition_accepted },
    { label: "Walkthrough conducted by client", value: !!signOff.walkthrough_conducted_by_client },
    { label: "Client present during unloading", value: !!signOff.client_present_during_unloading },
    { label: "Pre-existing conditions noted", value: !!signOff.pre_existing_conditions_noted },
    { label: "Photos reviewed by client", value: !!signOff.photos_reviewed_by_client },
    { label: "No issues during move", value: !!signOff.no_issues_during_move },
    { label: "No damages to belongings", value: !!signOff.no_damages },
    { label: "No property damage", value: !!signOff.no_property_damage },
    { label: "Walkthrough completed with crew", value: !!signOff.walkthrough_completed },
    { label: "Crew conducted professionally", value: !!signOff.crew_conducted_professionally },
    { label: "Crew used floor/wall protection", value: !!signOff.crew_wore_protection },
    { label: "Furniture reassembled", value: !!signOff.furniture_reassembled },
    { label: "Items placed in correct rooms", value: !!signOff.items_placed_correctly },
    { label: "Property left clean", value: !!signOff.property_left_clean },
    { label: "Claims process explained", value: !!signOff.claims_process_explained },
  ];

  const doc = generateSignOffReceiptPDF({
    jobId: moveId,
    jobType: "move",
    displayId,
    clientName: move?.client_name || undefined,
    signedBy: signOff.signed_by,
    signedAt: signOff.signed_at,
    signedLat: signOff.signed_lat,
    signedLng: signOff.signed_lng,
    satisfactionRating: signOff.satisfaction_rating,
    npsScore: signOff.nps_score,
    wouldRecommend: signOff.would_recommend,
    damageReportDeadline: signOff.damage_report_deadline,
    confirmations,
    feedbackNote: signOff.feedback_note,
    exceptions: signOff.exceptions,
    escalationTriggered: signOff.escalation_triggered,
    escalationReason: signOff.escalation_reason,
    discrepancyFlags: signOff.discrepancy_flags || [],
  });

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

  return new NextResponse(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="signoff-receipt-${displayId}.pdf"`,
    },
  });
}

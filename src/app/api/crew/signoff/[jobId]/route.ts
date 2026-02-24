import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const jobType = req.nextUrl.searchParams.get("jobType") || "move";

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId = jobId;
  if (!isUuid) {
    const { data: move } = await admin.from("moves").select("id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).maybeSingle();
    const { data: delivery } = await admin.from("deliveries").select("id").ilike("delivery_number", jobId).maybeSingle();
    entityId = move?.id || delivery?.id || jobId;
  }

  const { data } = await admin
    .from("client_sign_offs")
    .select("id, signed_by, signed_at, all_items_received, condition_accepted, satisfaction_rating, would_recommend, feedback_note, exceptions")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .maybeSingle();

  return NextResponse.json(data || null);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;
  const body = await req.json();
  const jobType = (body.jobType || "move") as "move" | "delivery";
  const signedBy = (body.signedBy || body.signed_by || "").toString().trim();
  const signatureDataUrl = (body.signatureDataUrl || body.signature_data_url || "").toString().trim();

  // Original fields
  const allItemsReceived = body.allItemsReceived !== undefined ? !!body.allItemsReceived : (body.all_items_received !== undefined ? !!body.all_items_received : true);
  const conditionAccepted = body.conditionAccepted !== undefined ? !!body.conditionAccepted : (body.condition_accepted !== undefined ? !!body.condition_accepted : true);
  const satisfactionRating = body.satisfactionRating ?? body.satisfaction_rating;
  const wouldRecommend = body.wouldRecommend ?? body.would_recommend;
  const feedbackNote = (body.feedbackNote || body.feedback_note || "").toString().trim() || null;
  const exceptions = (body.exceptions || "").toString().trim() || null;

  // Confirmation checkboxes (from previous migration)
  const walkthroughConductedByClient = body.walkthroughConductedByClient === true;
  const noIssuesDuringMove = body.noIssuesDuringMove === true;
  const noDamages = body.noDamages === true;
  const walkthroughCompleted = body.walkthroughCompleted === true;
  const crewConductedProfessionally = body.crewConductedProfessionally === true;

  // New power fields
  const signedLat = typeof body.signedLat === "number" ? body.signedLat : null;
  const signedLng = typeof body.signedLng === "number" ? body.signedLng : null;
  const npsScore = typeof body.npsScore === "number" && body.npsScore >= 0 && body.npsScore <= 10 ? body.npsScore : null;
  const crewWoreProtection = body.crewWoreProtection === true;
  const furnitureReassembled = body.furnitureReassembled === true ? true : body.furnitureReassembled === false ? false : null;
  const itemsPlacedCorrectly = body.itemsPlacedCorrectly === true;
  const propertyLeftClean = body.propertyLeftClean === true;
  const clientPresentDuringUnloading = body.clientPresentDuringUnloading === true;
  const noPropertyDamage = body.noPropertyDamage === true;
  const preExistingConditionsNoted = body.preExistingConditionsNoted === true;
  const claimsProcessExplained = false;
  const photosReviewedByClient = body.photosReviewedByClient === true;

  if (!signedBy || !signatureDataUrl) {
    return NextResponse.json({ error: "Name and signature required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("moves").select("id, crew_id").ilike("move_code", jobId.replace(/^#/, "").toUpperCase()).single();
    if (!move || move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = move.id;
  } else {
    const { data: delivery } = isUuid
      ? await admin.from("deliveries").select("id, crew_id").eq("id", jobId).single()
      : await admin.from("deliveries").select("id, crew_id").ilike("delivery_number", jobId).single();
    if (!delivery || delivery.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = delivery.id;
  }

  const { data: existing } = await admin
    .from("client_sign_offs")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .maybeSingle();

  if (existing) return NextResponse.json({ error: "Sign-off already recorded" }, { status: 400 });

  // 24-hour damage reporting window
  const damageReportDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  // Escalation detection
  let escalationTriggered = false;
  const escalationReasons: string[] = [];

  if (satisfactionRating != null && satisfactionRating <= 2) {
    escalationTriggered = true;
    escalationReasons.push(`Low satisfaction rating: ${satisfactionRating}/5`);
  }
  if (npsScore != null && npsScore <= 4) {
    escalationTriggered = true;
    escalationReasons.push(`Low NPS score: ${npsScore}/10`);
  }
  if (!noDamages) {
    escalationTriggered = true;
    escalationReasons.push("Client reported damages");
  }
  if (!noPropertyDamage) {
    escalationTriggered = true;
    escalationReasons.push("Client reported property damage");
  }
  if (!allItemsReceived) {
    escalationTriggered = true;
    escalationReasons.push("Not all items received");
  }
  if (!conditionAccepted) {
    escalationTriggered = true;
    escalationReasons.push("Condition not accepted");
  }
  if (wouldRecommend === false) {
    escalationTriggered = true;
    escalationReasons.push("Would not recommend");
  }
  if (exceptions) {
    escalationTriggered = true;
    escalationReasons.push("Client noted exceptions");
  }

  const { data: inserted, error } = await admin
    .from("client_sign_offs")
    .insert({
      job_id: entityId,
      job_type: jobType,
      signed_by: signedBy,
      signature_data_url: signatureDataUrl,
      signed_lat: signedLat,
      signed_lng: signedLng,
      all_items_received: allItemsReceived,
      condition_accepted: conditionAccepted,
      walkthrough_conducted_by_client: walkthroughConductedByClient,
      satisfaction_rating: satisfactionRating >= 1 && satisfactionRating <= 5 ? satisfactionRating : null,
      would_recommend: wouldRecommend,
      nps_score: npsScore,
      no_issues_during_move: noIssuesDuringMove,
      no_damages: noDamages,
      walkthrough_completed: walkthroughCompleted,
      crew_conducted_professionally: crewConductedProfessionally,
      crew_wore_protection: crewWoreProtection,
      furniture_reassembled: furnitureReassembled,
      items_placed_correctly: itemsPlacedCorrectly,
      property_left_clean: propertyLeftClean,
      client_present_during_unloading: clientPresentDuringUnloading,
      no_property_damage: noPropertyDamage,
      pre_existing_conditions_noted: preExistingConditionsNoted,
      claims_process_explained: claimsProcessExplained,
      photos_reviewed_by_client: photosReviewedByClient,
      damage_report_deadline: damageReportDeadline,
      escalation_triggered: escalationTriggered,
      escalation_reason: escalationReasons.length > 0 ? escalationReasons.join("; ") : null,
      feedback_note: feedbackNote,
      exceptions,
    })
    .select("id, signed_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Log escalation as a status event so admin dashboard picks it up
  if (escalationTriggered) {
    try {
      await admin.from("status_events").insert({
        entity_type: jobType,
        entity_id: entityId,
        event_type: "signoff_escalation",
        description: `Sign-off escalation: ${escalationReasons.join("; ")}`,
        icon: "alert-triangle",
      });
    } catch {}
  }

  // Run discrepancy detection against crew-reported incidents
  try {
    const { data: crewIncidents } = await admin
      .from("incidents")
      .select("id, issue_type")
      .eq("job_id", entityId)
      .eq("job_type", jobType);

    const flags: string[] = [];
    const crewReportedDamage = (crewIncidents || []).some((i) => i.issue_type === "damage");
    const crewReportedMissing = (crewIncidents || []).some((i) => i.issue_type === "missing_item");

    if (noDamages && crewReportedDamage) {
      flags.push("Client says no damages, but crew reported a damage incident");
    }
    if (!noDamages && !crewReportedDamage) {
      flags.push("Client reports damages, but crew logged no damage incidents");
    }
    if (allItemsReceived && crewReportedMissing) {
      flags.push("Client says all items received, but crew reported missing items");
    }
    if (satisfactionRating && satisfactionRating <= 2 && noIssuesDuringMove && noDamages && crewConductedProfessionally) {
      flags.push("Low rating but all confirmations positive — possible misclick or duress");
    }

    if (flags.length > 0) {
      await admin
        .from("client_sign_offs")
        .update({ discrepancy_flags: flags })
        .eq("id", inserted.id);
    }
  } catch {}

  // Complete the job
  const { data: activeSession } = await admin
    .from("tracking_sessions")
    .select("id")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  if (activeSession) {
    const now = new Date().toISOString();
    await admin
      .from("tracking_sessions")
      .update({ status: "completed", is_active: false, completed_at: now, updated_at: now })
      .eq("id", activeSession.id);
    const table = jobType === "move" ? "moves" : "deliveries";
    await admin
      .from(table)
      .update({
        status: jobType === "move" ? "completed" : "delivered",
        stage: "completed",
        updated_at: now,
      })
      .eq("id", entityId);
  }

  return NextResponse.json(inserted);
}

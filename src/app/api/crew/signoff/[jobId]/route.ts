import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { isEquipmentRelationUnavailable } from "@/lib/supabase-equipment-errors";
import { notifyJobCompletedForCrewProfiles } from "@/lib/crew/profile-after-job";
import {
  ensureJobCompleted,
  repairJobCompletionFromEvidence,
  runDeliveryCompletionFollowUp,
  runMoveCompletionFollowUp,
} from "@/lib/moves/complete-move-job";

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

  // For deliveries, resolve the partner vertical so the sign-off page can use context-aware copy
  let partnerVertical: string | null = null;
  if (jobType === "delivery") {
    const { data: delivery } = await admin
      .from("deliveries")
      .select("organization_id")
      .eq("id", entityId)
      .maybeSingle();
    if (delivery?.organization_id) {
      const { data: org } = await admin
        .from("organizations")
        .select("type")
        .eq("id", delivery.organization_id)
        .maybeSingle();
      partnerVertical = org?.type || null;
    }
  }

  const { data: eqRow, error: eqErr } = await admin
    .from("equipment_checks")
    .select("id, skip_reason")
    .eq("job_type", jobType)
    .eq("job_id", entityId)
    .maybeSingle();

  const equipmentQueryFailed = !!(eqErr && isEquipmentRelationUnavailable(eqErr.message));

  let serviceType: string | null = null;
  if (jobType === "move") {
    const { data: moveMeta } = await admin
      .from("moves")
      .select("service_type")
      .eq("id", entityId)
      .maybeSingle();
    serviceType = (moveMeta?.service_type as string | null) ?? null;
  }

  return NextResponse.json({
    ...(data || {}),
    partnerVertical,
    serviceType,
    equipmentCheckDone: equipmentQueryFailed ? false : !!eqRow,
    equipmentCheckSkippedReason: eqRow?.skip_reason ?? null,
    equipmentTrackingUnavailable: equipmentQueryFailed,
  });
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
  const itemConditions = Array.isArray(body.itemConditions) ? body.itemConditions : [];

  if (!signedBy || !signatureDataUrl) {
    return NextResponse.json({ error: "Name and signature required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let entityId: string;

  if (jobType === "move") {
    const { data: move } = isUuid
      ? await admin.from("moves").select("id, crew_id, move_type, service_type").eq("id", jobId).single()
      : await admin
          .from("moves")
          .select("id, crew_id, move_type, service_type")
          .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
          .single();
    if (!move || move.crew_id !== payload.teamId) return NextResponse.json({ error: "Job not found" }, { status: 404 });
    entityId = move.id;

    const isLabourOnly =
      move.move_type === "labour_only" || move.service_type === "labour_only";
    if (isLabourOnly) {
      const { count, error: photoErr } = await admin
        .from("job_photos")
        .select("id", { count: "exact", head: true })
        .eq("job_id", entityId)
        .eq("job_type", "move");
      if (photoErr) {
        return NextResponse.json({ error: "Could not verify completion photos" }, { status: 500 });
      }
      if (!count || count < 1) {
        return NextResponse.json(
          {
            error:
              "Labour-only jobs require at least one job photo (finished work) before client sign-off. Upload a photo in the Photos tab first.",
          },
          { status: 400 },
        );
      }
    }
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

  if (existing) {
    const repair = await repairJobCompletionFromEvidence(admin, entityId, jobType);
    if (!repair.ok) {
      return NextResponse.json(
        { error: repair.error || "Could not sync job completion. Contact support." },
        { status: 503 },
      );
    }
    if (repair.transitioned) {
      if (jobType === "move") {
        await runMoveCompletionFollowUp(admin, entityId, { source: "repair_signoff_retry" });
      } else {
        await runDeliveryCompletionFollowUp(admin, entityId);
      }
    }
    const { data: existingRow, error: exErr } = await admin
      .from("client_sign_offs")
      .select("id, signed_at")
      .eq("job_id", entityId)
      .eq("job_type", jobType)
      .single();
    if (exErr || !existingRow) {
      return NextResponse.json({ error: "Sign-off already recorded" }, { status: 400 });
    }
    return NextResponse.json(existingRow);
  }

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
      item_conditions: itemConditions.length > 0 ? itemConditions : [],
    })
    .select("id, signed_at")
    .single();

  if (error) {
    // Schema cache / missing column - suggest running migrations
    const msg = String(error.message || "");
    if (msg.includes("schema cache") || msg.includes("column") && msg.includes("client_sign_offs")) {
      return NextResponse.json({
        error: "Database schema update required. Please run: supabase db push (or apply migrations in Supabase dashboard).",
        code: "SCHEMA_UPDATE_REQUIRED",
      }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const signoffRating =
    typeof satisfactionRating === "number" && satisfactionRating >= 1 && satisfactionRating <= 5
      ? satisfactionRating
      : null;
  if (jobType === "move" && signoffRating != null) {
    await admin.from("moves").update({ satisfaction_rating: signoffRating, updated_at: new Date().toISOString() }).eq("id", entityId);
  }

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
      flags.push("Low rating but all confirmations positive, possible misclick or duress");
    }

    if (flags.length > 0) {
      await admin
        .from("client_sign_offs")
        .update({ discrepancy_flags: flags })
        .eq("id", inserted.id);
    }
  } catch {}

  const hasNewDamage = itemConditions.some((ic: { condition: string }) => ic.condition === "new_damage");

  // Complete the job row BEFORE PoD so we never leave PoD on file with status still in_progress.
  const now = new Date().toISOString();

  const { data: activeSession } = await admin
    .from("tracking_sessions")
    .select("id, started_at")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .eq("is_active", true)
    .maybeSingle();

  const { data: latestSession } = await admin
    .from("tracking_sessions")
    .select("id, started_at")
    .eq("job_id", entityId)
    .eq("job_type", jobType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sessionForHours = activeSession ?? latestSession;
  const sessionStartMs = sessionForHours?.started_at
    ? new Date(sessionForHours.started_at as string).getTime()
    : null;
  const sessionEndMs = new Date(now).getTime();
  const actualHours =
    sessionStartMs != null
      ? Math.round(((sessionEndMs - sessionStartMs) / 3_600_000) * 100) / 100
      : null;

  const completedAt = (inserted.signed_at as string) || now;
  const { wasAlreadyComplete, ok: completeOk, error: completeErr } = await ensureJobCompleted(admin, {
    jobId: entityId,
    jobType,
    completedAt,
    actualHours,
  });

  if (!completeOk) {
    console.error("[signoff] ensureJobCompleted failed:", completeErr);
    return NextResponse.json(
      {
        error:
          "Sign-off was saved but the job could not be marked complete in the system. Tap submit again or contact the office.",
        code: "COMPLETION_SYNC_FAILED",
      },
      { status: 503 },
    );
  }

  // Create Proof of Delivery record (after the job is terminal in the database).
  try {
    const { data: jobPhotos } = await admin
      .from("job_photos")
      .select("storage_path, category, note, taken_at")
      .eq("job_id", entityId)
      .eq("job_type", jobType);

    const photosByCategory = (cat: string) =>
      (jobPhotos || [])
        .filter((p) => p.category === cat)
        .map((p) => ({ url: p.storage_path, caption: p.note, timestamp: p.taken_at }));

    const crewMemberNames: string[] = [];
    if (payload.teamId) {
      const { data: members } = await admin
        .from("crew_members")
        .select("first_name, last_name")
        .eq("crew_id", payload.teamId)
        .eq("is_active", true);
      for (const m of members || []) {
        crewMemberNames.push(`${m.first_name} ${(m.last_name || "").charAt(0)}.`);
      }
    }

    await admin.from("proof_of_delivery").insert({
      move_id: jobType === "move" ? entityId : null,
      delivery_id: jobType === "delivery" ? entityId : null,
      photos_pickup: photosByCategory("pre_move_condition"),
      photos_transit: photosByCategory("in_transit"),
      photos_delivery: photosByCategory("delivery_placement"),
      item_conditions: itemConditions,
      signature_data: signatureDataUrl,
      signer_name: signedBy,
      signed_at: inserted.signed_at,
      satisfaction_rating: satisfactionRating >= 1 && satisfactionRating <= 5 ? satisfactionRating : null,
      satisfaction_comment: feedbackNote,
      crew_members: crewMemberNames,
      gps_lat: signedLat,
      gps_lng: signedLng,
    });

    if (hasNewDamage) {
      await admin.from("status_events").insert({
        entity_type: jobType,
        entity_id: entityId,
        event_type: "new_damage_reported",
        description: `New damage reported on ${itemConditions.filter((ic: { condition: string }) => ic.condition === "new_damage").length} item(s) during PoD`,
        icon: "alert-triangle",
      });
    }
  } catch (e) {
    console.error("[signoff] proof_of_delivery insert failed (job already completed):", e);
  }

  const signoffHadDamage = !noDamages || !noPropertyDamage || hasNewDamage;

  if (!wasAlreadyComplete) {
    if (jobType === "move") {
      await runMoveCompletionFollowUp(admin, entityId, {
        source: "crew_signoff",
      });
    } else {
      await runDeliveryCompletionFollowUp(admin, entityId);
    }
  }

  notifyJobCompletedForCrewProfiles(admin, {
    jobType,
    jobId: entityId,
    signoff: { clientRating: signoffRating, hadDamage: signoffHadDamage },
  }).catch((e) => console.error("[crew-profile] signoff:", e));

  return NextResponse.json(inserted);
}

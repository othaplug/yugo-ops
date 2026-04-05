import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email/send";
import { signTrackToken } from "@/lib/track-token";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatJobId } from "@/lib/move-code";
import { createReviewRequestIfEligible } from "@/lib/review-request-helper";
import { createClientReferralIfNeeded } from "@/lib/client-referral";
import { generateMovePDFs } from "@/lib/documents/generateMovePDFs";
import { calcActualMargin } from "@/lib/pricing/engine";
import { collectCalibrationData } from "@/lib/learning/engine";
import { applyEstateServiceChecklistAutomation } from "@/lib/estate-service-checklist-sync";

/**
 * When admin marks a move as completed in the UI, this endpoint sends the
 * move-complete email to the client and triggers review request, referral code,
 * and PDF generation (same as crew checkpoint completion).
 * Critical: without this, clients don't get the completion email when admin
 * completes the move instead of crew.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error: authErr } = await requireStaff();
  if (authErr) return authErr;

  const { id: moveId } = await params;
  const admin = createAdminClient();

  const { data: move, error } = await admin
    .from("moves")
    .select("id, move_code, client_email, client_name, from_address, to_address, status, completed_at, actual_hours, est_hours, actual_crew_count, crew_count, truck_primary, distance_km, tier_selected, move_size, estimate")
    .eq("id", moveId)
    .single();

  if (error || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const status = (move.status || "").toLowerCase();
  if (status !== "completed" && status !== "delivered") {
    return NextResponse.json(
      { error: "Move is not completed; only completed moves can trigger completion notifications" },
      { status: 400 }
    );
  }

  const clientEmail = (move.client_email || "").trim();
  const trackUrl = `${getEmailBaseUrl()}/track/move/${move.move_code || move.id}?token=${signTrackToken("move", move.id)}`;

  // 1. Send move-complete email to client (same as crew checkpoint path)
  if (clientEmail) {
    try {
      await sendEmail({
        to: clientEmail,
        subject: `Your move is complete ${formatJobId(move.move_code || moveId, "move")}`,
        template: "move-complete",
        data: {
          clientName: move.client_name ?? "",
          moveCode: move.move_code || moveId,
          fromAddress: move.from_address ?? "",
          toAddress: move.to_address ?? "",
          completedDate: move.completed_at || new Date().toISOString(),
          trackingUrl: trackUrl,
        },
      });
    } catch (e) {
      console.error("[notify-complete] move-complete email failed:", e);
    }
  }

  // 2. Review request (idempotent / eligibility-checked)
  createReviewRequestIfEligible(admin, moveId).catch((e) =>
    console.error("[notify-complete] review request failed:", e)
  );

  // 3. Client referral code if needed (idempotent)
  createClientReferralIfNeeded(admin, moveId).catch((e) =>
    console.error("[notify-complete] client referral failed:", e)
  );

  // 4. Generate move PDFs (summary, invoice, receipt)
  generateMovePDFs(moveId).catch((e) =>
    console.error("[notify-complete] generateMovePDFs failed:", e)
  );

  // 5. Calculate actual margin and persist to moves table
  try {
    const { data: configRows } = await admin.from("platform_config").select("key, value");
    const config: Record<string, string> = {};
    for (const r of configRows ?? []) config[r.key] = r.value;

    const marginResult = calcActualMargin(
      {
        actualHours: move.actual_hours ?? null,
        estimatedHours: move.est_hours ?? null,
        actualCrew: move.actual_crew_count ?? null,
        crewSize: move.crew_count ?? null,
        truckType: move.truck_primary ?? null,
        distanceKm: move.distance_km ?? null,
        tier: move.tier_selected ?? null,
        moveSize: move.move_size ?? null,
        totalPrice: move.estimate ?? null,
      },
      config,
    );

    await admin.from("moves").update(marginResult).eq("id", moveId);
  } catch (e) {
    console.error("[notify-complete] margin calculation failed:", e);
  }

  // 6. Learning engine — fire-and-forget calibration data collection
  collectCalibrationData(moveId).catch((e) =>
    console.error("[notify-complete] calibration data collection failed:", e)
  );

  applyEstateServiceChecklistAutomation(admin, moveId).catch((e) =>
    console.error("[notify-complete] estate checklist sync failed:", e),
  );

  return NextResponse.json({
    ok: true,
    emailSent: !!clientEmail,
  });
}

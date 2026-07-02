/**
 * POST /api/admin/moves/[id]/resend-booking-emails
 *
 * Super-admin one-off endpoint for re-firing the two booking-time emails
 * that go out post-payment:
 *   1. Tier-specific booking confirmation ("Your Yugo Signature move is
 *      confirmed, MV-XXXXX")
 *   2. Pre-move survey invite ("{first}, help us prepare for your {date}
 *      move")
 *
 * Used when the original send was blocked by Resend's suppression list
 * (e.g. a typo'd recipient bounced, the bounce caused subsequent sends
 * to be suppressed). After the admin corrects the client_email on the
 * move + contact row, this endpoint re-renders and resends the same two
 * emails to the corrected address — bypassing the full
 * runPostPaymentActions orchestration so we don't re-fire HubSpot
 * pipeline updates, SMS, or other side-effects.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff, isSuperAdminEmail } from "@/lib/api-auth";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { formatMoveDate } from "@/lib/date-format";
import {
  essentialConfirmationEmail,
  signatureConfirmationEmail,
  singleItemConfirmationEmail,
  estateConfirmationEmail,
  officeConfirmationEmail,
  statusUpdateEmailHtml,
  type TierConfirmationParams,
} from "@/lib/email-templates";
import { logAudit } from "@/lib/audit";

const TIER_LABELS: Record<string, string> = {
  essential: "Essential",
  curated: "Essential",
  signature: "Signature",
  estate: "Estate",
  custom: "Standard",
  essentials: "Essential",
  premier: "Signature",
};

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Local Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_oneoff: "Delivery",
  b2b_delivery: "B2B Delivery",
  event: "Event Logistics",
  labour_only: "Labour Only",
  bin_rental: "Bin Rental",
};

const TRUCK_DISPLAY: Record<string, string> = {
  sprinter: "Extended Sprinter Van",
  "16ft": "16ft Fully Equipped Truck",
  "20ft": "20ft Dedicated Moving Truck",
  "24ft": "24ft Full-Size Moving Truck",
  "26ft": "26ft Maximum-Capacity Truck",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, error: authErr } = await requireStaff();
  if (authErr) return authErr;
  if (!isSuperAdminEmail(user?.email)) {
    return NextResponse.json(
      { error: "Super admin only." },
      { status: 403 },
    );
  }

  const { id: moveSlug } = await params;
  const db = createAdminClient();

  // Resolve move by id or move_code so the caller can pass either.
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    moveSlug,
  );
  const moveQuery = isUuid
    ? db.from("moves").select("*").eq("id", moveSlug).maybeSingle()
    : db
        .from("moves")
        .select("*")
        .ilike("move_code", moveSlug.toUpperCase())
        .maybeSingle();
  const { data: move, error: moveErr } = await moveQuery;
  if (moveErr || !move) {
    return NextResponse.json({ error: "Move not found" }, { status: 404 });
  }

  // Pull the linked quote (for tiers / service_type / dates / addresses).
  const { data: quote } = await db
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("id", move.quote_id)
    .maybeSingle();
  if (!quote) {
    return NextResponse.json(
      { error: "Linked quote not found" },
      { status: 404 },
    );
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const clientName = move.client_name || contact?.name || "";
  const clientEmail = (move.client_email || contact?.email || "").trim();
  if (!clientEmail) {
    return NextResponse.json(
      { error: "No client_email on the move or contact." },
      { status: 400 },
    );
  }

  const moveCode: string = move.move_code || moveSlug.toUpperCase();
  const baseUrl = getEmailBaseUrl();
  const trackToken = signTrackToken("move", move.id);
  const trackingUrl = `${baseUrl}/track/move/${moveCode}?token=${trackToken}`;

  const selectedTier = move.tier_selected || quote.selected_tier;
  const tierLabel = TIER_LABELS[selectedTier ?? ""] ?? selectedTier ?? "";
  const serviceLabel =
    SERVICE_LABELS[quote.service_type as string] ?? quote.service_type;

  const totalWithTax = Number(move.amount) || 0;
  const depositAmount = Number(move.deposit_amount || 0);
  const balanceAmount = Math.max(0, totalWithTax - depositAmount);

  const tier = (selectedTier ?? "signature") as string;
  const truckKey =
    (move.truck_info as string) || (quote.truck_primary as string) || "";
  const truckDisplayName =
    TRUCK_DISPLAY[truckKey] || truckKey || "Dedicated moving truck";
  const tierData =
    tier && quote.tiers
      ? (quote.tiers as Record<string, { includes?: string[] }>)[tier]
      : null;
  const includes = tierData?.includes ?? [];
  const crewSize =
    (move.crew_size as number) || (quote.est_crew_size as number) || 3;
  const timeWindow =
    (move.arrival_window as string) || "Morning (7 AM – 12 PM)";

  const resend = getResend();
  const emailFrom = await getEmailFrom();
  const results: { name: string; ok: boolean; error?: string }[] = [];

  /* ── 1. Tier-specific booking confirmation ── */
  try {
    if (quote.service_type === "single_item") {
      // Single-item is non-tiered, 2-person crew by default — dedicated template.
      const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
      const lines = Array.isArray(factors.single_item_lines)
        ? (factors.single_item_lines as Array<{
            item_description?: string;
            quantity?: number;
          }>)
        : [];
      const items = lines.map((l) => {
        const name = (l.item_description || "").trim() || "Item";
        const qty = Number(l.quantity) || 1;
        return qty > 1 ? `${name} ×${qty}` : name;
      });
      const siCrew =
        Number(factors.single_item_crew_estimated) ||
        (move.crew_size as number) ||
        (quote.est_crew_size as number) ||
        2;
      await resend.emails.send({
        from: emailFrom,
        to: clientEmail,
        subject: `Booking confirmed, ${moveCode}`,
        html: singleItemConfirmationEmail({
          clientName,
          moveCode,
          moveDate: quote.move_date,
          timeWindow,
          fromAddress: quote.from_address,
          toAddress: quote.to_address,
          crewSize: siCrew,
          truckDisplayName,
          items,
          totalWithTax,
          depositPaid: depositAmount,
          balanceRemaining: balanceAmount,
          trackingUrl,
          includes: [
            "Professional handling and transport",
            "Protective blanket wrapping for all items",
            "Careful loading and unloading",
            "Floor and entryway protection",
          ],
        }),
        headers: {
          Precedence: "auto",
          "X-Auto-Response-Suppress": "All",
        },
      });
      results.push({ name: "booking_confirmation", ok: true });
    } else {
    // Resolve welcome-package URL for tiers that get one (Estate residential
    // + Office Priority). Reuses the token minted at booking; the resend is
    // a re-render, not a re-mint. Mirrors post-payment.ts:200 logic so
    // resends match the original confirmation.
    const isEstateBooking = tier === "estate";
    const isOfficePriority =
      tier === "priority" && quote.service_type === "office_move";
    let welcomePackageUrl: string | null = null;
    if (isEstateBooking || isOfficePriority) {
      const wpTok = String(
        (move as { welcome_package_token?: string | null })
          .welcome_package_token ?? "",
      ).trim();
      if (wpTok) {
        const kind = isOfficePriority ? "office" : "estate";
        welcomePackageUrl = `${baseUrl}/${kind}/welcome/${wpTok}`;
      }
    }

    // Office Priority: pull day count + PM contact from quote factors so
    // the office template renders the phased plan and PM signature block.
    const qFactors = (quote.factors_applied ?? {}) as Record<string, unknown>;
    const officeDayCount = (() => {
      if (!isOfficePriority) return null;
      const per = qFactors.office_per_tier_days as
        | Record<string, number>
        | undefined;
      const n = per?.priority;
      return typeof n === "number" && n > 0 ? n : null;
    })();
    const projectManagerName =
      (typeof qFactors.project_manager_name === "string" &&
        qFactors.project_manager_name.trim()) ||
      null;
    const projectManagerPhone =
      (typeof qFactors.project_manager_phone === "string" &&
        qFactors.project_manager_phone.trim()) ||
      null;

    const confirmParams: TierConfirmationParams = {
      clientName,
      moveCode,
      moveDate: quote.move_date,
      timeWindow,
      fromAddress: quote.from_address,
      toAddress: quote.to_address,
      tierLabel,
      serviceLabel,
      crewSize,
      truckDisplayName,
      totalWithTax,
      depositPaid: depositAmount,
      balanceRemaining: balanceAmount,
      trackingUrl,
      includes,
      coordinatorName: (move.coordinator_name as string) || null,
      coordinatorPhone: (move.coordinator_phone as string) || null,
      coordinatorEmail: (move.coordinator_email as string) || null,
      welcomePackageUrl,
      officeDayCount,
      projectManagerName,
      projectManagerPhone,
    };

    const templateFns: Record<
      string,
      (p: TierConfirmationParams) => string
    > = {
      essential: essentialConfirmationEmail,
      curated: essentialConfirmationEmail,
      signature: signatureConfirmationEmail,
      estate: estateConfirmationEmail,
      // Residential Priority → Estate copy (matches post-payment.ts). Office
      // Priority is routed via the isOfficePriority override below.
      priority: estateConfirmationEmail,
      essentials: essentialConfirmationEmail,
      premier: signatureConfirmationEmail,
    };
    const templateFn = isOfficePriority
      ? officeConfirmationEmail
      : templateFns[tier] ?? signatureConfirmationEmail;

    const subjects: Record<string, string> = {
      essential: `Your Yugo move is confirmed, ${moveCode}`,
      curated: `Your Yugo move is confirmed, ${moveCode}`,
      signature: `Your Yugo Signature move is confirmed, ${moveCode}`,
      estate: `Welcome to your Yugo Estate experience, ${moveCode}`,
      essentials: `Your Yugo move is confirmed, ${moveCode}`,
      premier: `Your Yugo Signature move is confirmed, ${moveCode}`,
    };
    const subject = isOfficePriority
      ? `Your Yugo Priority office relocation is booked, ${moveCode}`
      : subjects[tier] ?? `Booking confirmed, ${moveCode}`;

    await resend.emails.send({
      from: emailFrom,
      to: clientEmail,
      subject,
      html: templateFn(confirmParams),
      headers: {
        Precedence: "auto",
        "X-Auto-Response-Suppress": "All",
      },
    });
    results.push({ name: "booking_confirmation", ok: true });
    }
  } catch (e) {
    results.push({
      name: "booking_confirmation",
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  /* ── 2. Pre-move survey invite (mirrors post-payment.ts) ── */
  try {
    if (
      ![
        "essential",
        "curated",
        "signature",
        "essentials",
        "premier",
      ].includes(tier)
    ) {
      // Estate tier and non-residential service types don't get the
      // survey invite. Skip silently to match the original automation.
      results.push({
        name: "pre_move_survey",
        ok: true,
        error: `Skipped (tier=${tier})`,
      });
    } else {
      // Survey token may not exist yet — generate one if missing,
      // mirroring runPostPaymentActions.
      let surveyToken = String(
        (move as { survey_token?: string | null }).survey_token ?? "",
      ).trim();
      if (!surveyToken) {
        const { randomBytes } = await import("crypto");
        surveyToken = randomBytes(24).toString("hex");
        await db
          .from("moves")
          .update({ survey_token: surveyToken })
          .eq("id", move.id);
      }

      const first = clientName.trim().split(/\s+/)[0] || "there";
      const moveDateStr = quote.move_date
        ? formatMoveDate(String(quote.move_date))
        : null;
      const surveyUrl = `${baseUrl}/survey/${surveyToken}`;

      const html = statusUpdateEmailHtml({
        eyebrow: "Help us prepare",
        headline: "Quick room photos",
        body:
          `Hi ${first},<br/><br/>` +
          `Your move is coming up${moveDateStr ? ` on <strong>${moveDateStr}</strong>` : ""}, and your coordinator is getting ready. A quick photo walkthrough of your space lets us:` +
          `<br/><br/>` +
          `<ul style="margin:0;padding-left:18px;line-height:1.55;">` +
          `<li>Confirm the inventory we built from your intake</li>` +
          `<li>Flag bulky or fragile pieces before crew day</li>` +
          `<li>Check access details — elevators, stairs, narrow doors</li>` +
          `<li>Arrive with the right truck, blankets, and dollies</li>` +
          `</ul>` +
          `<br/>` +
          `<strong>What to photograph (about two minutes):</strong>` +
          `<br/>` +
          `<ul style="margin:0;padding-left:18px;line-height:1.55;">` +
          `<li>Each room from the doorway — wide shots, not close-ups</li>` +
          `<li>Anything heavy, oversized, or fragile</li>` +
          `<li>The building entrance and elevator if you have one</li>` +
          `</ul>` +
          `<br/>` +
          `Your photos go straight to your coordinator. You can stop and pick it back up later on the same link.`,
        ctaUrl: surveyUrl,
        ctaLabel: "TAKE PHOTOS",
        includeFooter: true,
        tone: "premium",
      });
      const subject = moveDateStr
        ? `${first}, help us prepare for your ${moveDateStr} move`
        : `${first}, help us prepare for your move`;
      await resend.emails.send({
        from: emailFrom,
        to: clientEmail,
        subject,
        html,
        headers: {
          Precedence: "auto",
          "X-Auto-Response-Suppress": "All",
        },
      });
      results.push({ name: "pre_move_survey", ok: true });
    }
  } catch (e) {
    results.push({
      name: "pre_move_survey",
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    });
  }

  await logAudit({
    userId: user?.id,
    userEmail: user?.email,
    action: "edit_move",
    resourceType: "move",
    resourceId: move.id,
    details: {
      kind: "resend_booking_emails",
      move_code: moveCode,
      recipient: clientEmail,
      results,
    },
  });

  return NextResponse.json({
    ok: results.every((r) => r.ok),
    moveCode,
    recipient: clientEmail,
    results,
  });
}

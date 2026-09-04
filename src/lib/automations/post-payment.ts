import { randomBytes } from "crypto";
import { syncJobToGCal } from "@/lib/google-calendar/sync-job";
import { syncDeliveryGCalNow, syncMoveGCalNow } from "@/lib/google-calendar/sync-utils";
import { isGCalConfigured } from "@/lib/google-calendar/client";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { buildHubSpotDealName } from "@/lib/hubspot/deal-name";
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";
import { getResend } from "@/lib/resend";
import { getEmailFrom, sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { signTrackToken } from "@/lib/track-token";
import { isFullRelocationMove } from "@/lib/track-non-move-product";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import {
  equinoxPromoLayout,
  equinoxPromoFinePrint,
} from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatCurrency } from "@/lib/format-currency";
import { formatMoveDate } from "@/lib/date-format";
import { getCompanyDisplayName, getAdminNotificationEmail } from "@/lib/config";
import {
  calculateAddons,
  addonAmountForTier,
  type AddonSelection,
} from "@/lib/quotes/price-addons";
import { autoScheduleMove } from "@/lib/scheduling/auto-schedule";
import { generateWelcomePackageToken } from "@/lib/welcome-package-token";
import {
  bookingConfirmationEmail,
  internalBookingAlertEmail,
  essentialConfirmationEmail,
  curatedConfirmationEmail,
  signatureConfirmationEmail,
  estateConfirmationEmail,
  officeConfirmationEmail,
  binRentalConfirmationEmail,
  singleItemConfirmationEmail,
  eventConfirmationEmail,
  whiteGloveConfirmationEmail,
  specialtyConfirmationEmail,
  labourOnlyConfirmationEmail,
  b2bDeliveryConfirmationEmail,
  statusUpdateEmailHtml,
  emailDetailRows,
  type TierConfirmationParams,
} from "@/lib/email-templates";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";

/* ═══════════════════════════════════════════════════════════
   runPostPaymentActions
   ─────────────────────────────────────────────────────────
   Orchestrates every action that should fire after a
   successful deposit payment. Each action runs independently
   via Promise.allSettled, one failure never blocks others.

   Called fire-and-forget from POST /api/payments/process.
   ═══════════════════════════════════════════════════════════ */

export interface PostPaymentInput {
  quoteId: string;
  moveId: string;
  moveCode: string;
  paymentId: string;
  amount: number;
}

export interface PostPaymentResult {
  actions: {
    name: string;
    status: "fulfilled" | "rejected";
    error?: string;
  }[];
}

const TIER_LABELS: Record<string, string> = {
  essential: "Essential",
  curated: "Essential",
  signature: "Signature",
  estate: "Estate",
  priority: "Priority",
  custom: "Standard",
  // legacy keys for moves created before the rename
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

function binBundleLabelFromFactors(factors: Record<string, unknown>): string {
  const fromLabel = String(factors.bin_bundle_label ?? "").trim();
  if (fromLabel) return fromLabel;
  const bt = String(factors.bin_bundle_type ?? "").toLowerCase();
  const customN = Math.floor(Number(factors.bin_custom_count) || 0);
  if (bt === "custom" && customN > 0) {
    return `Custom · ${customN} bins`;
  }
  const byType: Record<string, string> = {
    studio: "Studio bundle",
    "1br": "1 bedroom bundle",
    "2br": "2 bedroom bundle",
    "3br": "3 bedroom bundle",
    "4br_plus": "4 bedroom plus bundle",
  };
  return byType[bt] || "Bin rental";
}

function getSeason(dateStr: string | null): string | null {
  if (!dateStr) return null;
  const month = new Date(dateStr + "T00:00:00").getMonth();
  if (month >= 2 && month <= 4) return "spring";
  if (month >= 5 && month <= 7) return "summer";
  if (month >= 8 && month <= 10) return "fall";
  return "winter";
}

function getDayOfWeek(dateStr: string | null): string | null {
  if (!dateStr) return null;
  return new Date(dateStr + "T12:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    timeZone: "America/Toronto",
  });
}

export async function runPostPaymentActions(
  input: PostPaymentInput,
): Promise<PostPaymentResult> {
  const supabase = createAdminClient();

  /* ── Fetch quote + move in parallel ── */
  const [quoteRes, moveRes] = await Promise.all([
    supabase
      .from("quotes")
      .select("*, contacts:contact_id(name, email, phone)")
      .eq("quote_id", input.quoteId)
      .single(),
    supabase.from("moves").select("*").eq("id", input.moveId).single(),
  ]);

  const quote = quoteRes.data;
  const move = moveRes.data;

  if (!quote || !move) {
    const msg = `Data fetch failed: quote=${!!quote}, move=${!!move}`;
    console.error("[postPayment]", msg);
    return {
      actions: [{ name: "data_fetch", status: "rejected", error: msg }],
    };
  }

  /* ── Derive shared data ── */
  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;

  const clientName = move.client_name || contact?.name || "";
  const clientEmail = move.client_email || contact?.email || "";
  const clientPhone = move.client_phone || contact?.phone || "";
  const hubspotDealId = quote.hubspot_deal_id as string | null;

  const baseUrl = getEmailBaseUrl();
  const trackToken = signTrackToken("move", input.moveId);
  const trackingUrl = `${baseUrl}/track/move/${input.moveCode}?token=${trackToken}`;

  const tokenUpdates: Record<string, string> = {};
  const existingSurveyTok = String(
    (move as { survey_token?: string | null }).survey_token ?? "",
  ).trim();
  const existingChecklistTok = String(
    (move as { checklist_token?: string | null }).checklist_token ?? "",
  ).trim();
  if (!existingSurveyTok)
    tokenUpdates.survey_token = randomBytes(24).toString("hex");
  if (!existingChecklistTok)
    tokenUpdates.checklist_token = randomBytes(24).toString("hex");
  if (Object.keys(tokenUpdates).length > 0) {
    const { error: tokUpErr } = await supabase
      .from("moves")
      .update(tokenUpdates)
      .eq("id", input.moveId);
    if (tokUpErr)
      console.error("[postPayment] survey/checklist tokens", tokUpErr);
  }
  const surveyTokenForEmail = String(
    tokenUpdates.survey_token ?? existingSurveyTok,
  ).trim();
  const checklistTokenForEmail = String(
    tokenUpdates.checklist_token ?? existingChecklistTok,
  ).trim();

  const selectedTier = move.tier_selected || quote.selected_tier;
  const tierLabel = TIER_LABELS[selectedTier ?? ""] ?? selectedTier ?? "";
  const tierLower = String(selectedTier ?? "").toLowerCase().trim();
  const isEstateBooking = tierLower === "estate";
  const isOfficePriorityBooking =
    tierLower === "priority" && quote.service_type === "office_move";

  // Welcome-package link — generated once here and shared by BOTH the
  // confirmation email and the booking SMS (the SMS step can't see the email
  // step's locals, and its in-memory move row is stale after the token write).
  //
  // Estate  → /estate/welcome/{token}  (residential concierge guide)
  // Office Priority → /office/welcome/{token}  (office-branded guide with
  //   PM contact, Day 1/Day 2 plan, IT/dock/floor-plan reminders)
  let welcomePackageUrl: string | null = null;
  if (isEstateBooking || isOfficePriorityBooking) {
    let wpTok = String(
      (move as { welcome_package_token?: string | null }).welcome_package_token ?? "",
    ).trim();
    if (!wpTok) {
      wpTok = generateWelcomePackageToken();
      const { error: wpErr } = await supabase
        .from("moves")
        .update({ welcome_package_token: wpTok })
        .eq("id", input.moveId);
      if (wpErr) {
        console.error("[postPayment] welcome_package_token", wpErr.message);
        wpTok = "";
      }
    }
    if (wpTok) {
      const kind = isOfficePriorityBooking ? "office" : "estate";
      welcomePackageUrl = `${baseUrl}/${kind}/welcome/${wpTok}`;
    }
  }

  const serviceLabel = SERVICE_LABELS[quote.service_type] ?? quote.service_type;
  const totalWithTax = Number(move.amount) || 0;
  const depositAmount = input.amount;
  const balanceAmount = totalWithTax - depositAmount;

  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const neighbourhoodTier = (factors.neighbourhood_tier as string) ?? null;

  /* ── Compute base price for addon calculation ── */
  let basePrice = 0;
  if (selectedTier && quote.tiers) {
    const tierData = (
      quote.tiers as Record<string, { price: number; total: number }>
    )[selectedTier];
    basePrice = tierData?.price ?? 0;
  } else {
    basePrice = Number(quote.custom_price) || 0;
  }

  /* ── Compute addon analytics ──
     Priced through the shared engine (calculateAddons) so variant_matrix add-ons
     like TV wall mounting are never $0 (the MV-30378 bug lived in this file's
     old hand-rolled switch, which had no variant_matrix case) and the line
     specifics (bin count, TV size/mount) come through for the confirmation email
     and the admin alert. addonRevenue is tier-adjusted to match what the move
     actually charges. */
  const selectedAddons = (quote.selected_addons || []) as AddonSelection[];
  const addonCount = selectedAddons.length;
  const addonSlugs = selectedAddons
    .map((a) => a.slug)
    .filter(Boolean) as string[];

  let addonRevenue = 0;
  // Resolved add-on lines for the confirmation email + admin booking alert.
  const resolvedAddonLines: {
    name: string;
    qty?: number;
    price: number;
    detail?: string;
  }[] = [];

  if (addonCount > 0) {
    const addonResult = await calculateAddons(
      supabase,
      selectedAddons,
      basePrice,
      quote.move_size,
      quote.service_type,
    );
    addonRevenue = selectedTier
      ? addonAmountForTier(addonResult, selectedTier)
      : addonResult.total;
    for (const b of addonResult.breakdown) {
      resolvedAddonLines.push({
        name: b.name,
        qty: b.quantity && b.quantity > 1 ? b.quantity : undefined,
        price: b.subtotal,
        detail: b.detail,
      });
    }
  }

  /* ═══════════════════════════════════════════════════════
     ACTION DEFINITIONS
     Each returns a Promise<void>. Failures are caught by
     Promise.allSettled, they never block other actions.
     ═══════════════════════════════════════════════════════ */

  const actionDefs: {
    name: string;
    critical: boolean;
    fn: () => Promise<void>;
  }[] = [
    /* ── 1. HubSpot deal update ── */
    {
      name: "hubspot_deal_update",
      critical: true,
      fn: async () => {
        if (!hubspotDealId) return;

        await syncDealStage(hubspotDealId, "confirmed");

        const token = process.env.HUBSPOT_ACCESS_TOKEN;
        if (!token) return;

        // Rebuild the canonical deal name + property bag so post-payment
        // doesn't wipe the proper-cased name set at quote-send time. The
        // earlier "Client · MV-XXXX" template was the source of the legacy
        // dot-separator dealnames we had to patch by hand (Chris Chatlani,
        // Richelle Baker, etc.).
        const firstNameForPayment = (clientName || "")
          .trim()
          .split(/\s+/)[0] ?? "";
        const lastNameForPayment = (clientName || "")
          .trim()
          .split(/\s+/)
          .slice(1)
          .join(" ");
        const rebuiltDealName = buildHubSpotDealName({
          serviceType: String(quote.service_type ?? "") || undefined,
          isPmMove: !!move.is_pm_move,
          firstName: firstNameForPayment,
          lastName: lastNameForPayment,
          tierLabel: (selectedTier as string | null | undefined) ?? undefined,
          moveSize: (quote.move_size as string | null | undefined) ?? undefined,
          fromAddress: (quote.from_address as string | null | undefined) ?? undefined,
          fallbackCode: `Move ${input.moveCode}`,
        });

        const dealPayload: Record<string, string> = {
          dealname: rebuiltDealName,
          amount: String(totalWithTax),
          deposit_received_at: new Date().toISOString(),
          square_invoice_id: input.paymentId,
          opsplus_move_id: input.moveId,
          contract_signed: "true",
          package_type: tierLabel || serviceLabel,
          ...buildAllDealProperties({
            jobId: input.moveCode,
            firstName: firstNameForPayment,
            lastName: lastNameForPayment,
            fromAddress: quote.from_address as string | null | undefined,
            toAddress: quote.to_address as string | null | undefined,
            fromAccess: quote.from_access as string | null | undefined,
            toAccess: quote.to_access as string | null | undefined,
            serviceType: String(quote.service_type ?? "") || undefined,
            moveDate: (quote.move_date as string | null | undefined) ?? undefined,
            moveSize: (quote.move_size as string | null | undefined) ?? undefined,
            subtotal: totalWithTax > 0 ? Math.round(totalWithTax / 1.13 * 100) / 100 : null,
            totalPrice: totalWithTax,
            tierSelected: (selectedTier as string | null | undefined) ?? null,
            isPmMove: !!move.is_pm_move,
          }),
        };

        await safePatchDeal(token, hubspotDealId, dealPayload);
      },
    },

    /* ── 2. Client confirmation email (tier-specific) ── */
    {
      name: "client_confirmation_email",
      critical: true,
      fn: async () => {
        if (!clientEmail) return;

        const resend = getResend();

        if (quote.service_type === "bin_rental") {
          const dropOffRaw =
            typeof factors.bin_drop_off_date === "string"
              ? factors.bin_drop_off_date.trim()
              : "";
          const pickupRaw =
            typeof factors.bin_pickup_date === "string"
              ? factors.bin_pickup_date.trim()
              : "";
          let moveDateForEmail: string | null =
            typeof factors.bin_move_date === "string" &&
            factors.bin_move_date.trim()
              ? factors.bin_move_date.trim()
              : quote.move_date
                ? String(quote.move_date).trim()
                : null;
          if (moveDateForEmail && dropOffRaw && moveDateForEmail === dropOffRaw) {
            moveDateForEmail = null;
          }

          const delivery = String(quote.to_address ?? "").trim();
          const fromA = String(quote.from_address ?? "").trim();
          const pickupOnly =
            fromA && delivery && fromA !== delivery ? fromA : null;

          const html = binRentalConfirmationEmail({
            clientName,
            moveCode: input.moveCode,
            bundleLabel: binBundleLabelFromFactors(factors),
            dropOffDate: dropOffRaw || null,
            pickupDate: pickupRaw || null,
            moveDate: moveDateForEmail,
            deliveryAddress: delivery,
            pickupAddress: pickupOnly,
            totalWithTax,
            depositPaid: depositAmount,
            balanceRemaining: balanceAmount,
            trackingUrl,
          });
          const subject = `Your Yugo bin rental is confirmed, ${input.moveCode}`;
          const emailFrom = await getEmailFrom();
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
          return;
        }

        const TRUCK_DISPLAY: Record<string, string> = {
          sprinter: "Extended Sprinter Van",
          "16ft": "16ft Fully Equipped Truck",
          "20ft": "20ft Dedicated Moving Truck",
          "24ft": "24ft Full-Size Moving Truck",
          "26ft": "26ft Maximum-Capacity Truck",
        };

        // Single-item is NOT tiered (no Essential/Signature/Estate) and defaults
        // to a 2-person crew. Use a dedicated non-tiered template that lists the
        // actual items, so we never show a residential plan label or "3 movers".
        if (quote.service_type === "single_item") {
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
          const siTruckKey =
            (move.truck_info as string) || (quote.truck_primary as string) || "";
          const siTruck =
            TRUCK_DISPLAY[siTruckKey] || siTruckKey || "Dedicated moving vehicle";
          const html = singleItemConfirmationEmail({
            clientName,
            moveCode: input.moveCode,
            moveDate: quote.move_date,
            timeWindow:
              (move.arrival_window as string) || "Morning (8 AM, 12 PM)",
            fromAddress: quote.from_address,
            toAddress: quote.to_address,
            crewSize: siCrew,
            truckDisplayName: siTruck,
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
            welcomePackageUrl,
            addonLines:
              resolvedAddonLines.length > 0 ? resolvedAddonLines : undefined,
          });
          const emailFrom = await getEmailFrom();
          await resend.emails.send({
            from: emailFrom,
            to: clientEmail,
            subject: `Booking confirmed, ${input.moveCode}`,
            html,
            headers: {
              Precedence: "auto",
              "X-Auto-Response-Suppress": "All",
            },
          });
          return;
        }

        // Event bookings run as two legs (deliver + set up, then return to pack
        // up and optionally tear down). Dedicated event copy instead of the
        // residential move fallback.
        if (quote.service_type === "event") {
          const returnDateRaw =
            typeof factors.return_date === "string" && factors.return_date.trim()
              ? factors.return_date.trim()
              : null;
          const eventCrew =
            (move.crew_size as number) ||
            (quote.est_crew_size as number) ||
            (typeof factors.event_crew === "number"
              ? (factors.event_crew as number)
              : null);
          const html = eventConfirmationEmail({
            clientName,
            moveCode: input.moveCode,
            eventName:
              typeof factors.event_name === "string" && factors.event_name.trim()
                ? factors.event_name.trim()
                : null,
            venueAddress: quote.to_address,
            originAddress: quote.from_address,
            deliveryDate: quote.move_date,
            deliveryWindow: (move.arrival_window as string) || null,
            returnDate: returnDateRaw,
            sameDay: factors.event_same_day === true,
            teardownRequired: factors.teardown_required !== false,
            crewSize: eventCrew,
            totalWithTax,
            depositPaid: depositAmount,
            balanceRemaining: balanceAmount,
            trackingUrl,
            coordinatorName: (move.coordinator_name as string) || null,
          });
          const emailFrom = await getEmailFrom();
          await resend.emails.send({
            from: emailFrom,
            to: clientEmail,
            subject: `Your event is confirmed, ${input.moveCode}`,
            html,
            headers: {
              Precedence: "auto",
              "X-Auto-Response-Suppress": "All",
            },
          });
          return;
        }

        const tier = selectedTier ?? "signature";
        const truckKey =
          (move.truck_info as string) || (quote.truck_primary as string) || "";
        // Office moves may reserve multiple trucks; format "2 × 16ft ..."
        // when factors.office_trucks > 1. Shared helper keeps this in
        // lockstep with OfficeTrackHero + admin previews.
        let truckDisplayName: string;
        if (quote.service_type === "office_move") {
          const { formatOfficeFleetLabel } = await import(
            "@/lib/office/fleet-label"
          );
          const trucksRaw = (quote.factors_applied as Record<string, unknown>)
            ?.office_trucks;
          const trucks =
            typeof trucksRaw === "number"
              ? trucksRaw
              : Number(trucksRaw ?? 1) || 1;
          truckDisplayName = formatOfficeFleetLabel(truckKey, trucks);
        } else {
          truckDisplayName =
            TRUCK_DISPLAY[truckKey] || truckKey || "Dedicated moving truck";
        }

        const tierData =
          tier && quote.tiers
            ? (quote.tiers as Record<string, { includes: string[] }>)[tier]
            : null;
        const includes = tierData?.includes ?? [];
        const crewSize =
          (move.crew_size as number) || (quote.est_crew_size as number) || 3;
        const timeWindow =
          (move.arrival_window as string) || "Morning (7 AM, 12 PM)";

        // Office-specific: pull day count for the booked tier from
        // factors, and derive project manager name from quote
        // factors.project_manager_name (falls back to coordinator).
        const quoteFactors = (quote.factors_applied ?? {}) as Record<
          string,
          unknown
        >;
        const officeDayCount = (() => {
          if (quote.service_type !== "office_move") return null;
          const per = quoteFactors.office_per_tier_days as
            | Record<string, number>
            | undefined;
          const n = per?.[tier ?? "priority"];
          return typeof n === "number" && n > 0 ? n : null;
        })();
        const projectManagerName =
          (typeof quoteFactors.project_manager_name === "string" &&
            quoteFactors.project_manager_name.trim()) ||
          null;
        const projectManagerPhone =
          (typeof quoteFactors.project_manager_phone === "string" &&
            quoteFactors.project_manager_phone.trim()) ||
          null;

        // Office day plan sourced from move_project_days so the email
        // matches the track page timeline exactly. Without this the
        // hardcoded "Day 2: Move day" copy in the template drifts from
        // the DB (which stores "Move & set up" for Priority office).
        let officeDayPlan:
          | { label: string; title: string; body: string }[]
          | undefined;
        if (
          quote.service_type === "office_move" &&
          typeof officeDayCount === "number" &&
          officeDayCount >= 2
        ) {
          const mpId = (move as { move_project_id?: string | null })
            .move_project_id;
          if (mpId) {
            const { data: phases } = await supabase
              .from("move_project_phases")
              .select("id")
              .eq("project_id", mpId);
            const phaseIds = (phases ?? []).map(
              (p) => (p as { id: string }).id,
            );
            if (phaseIds.length > 0) {
              const { data: days } = await supabase
                .from("move_project_days")
                .select("day_number, day_type, label, description")
                .in("phase_id", phaseIds)
                .order("day_number");
              const rows = (days ?? []) as Array<{
                day_number: number;
                day_type?: string | null;
                label?: string | null;
                description?: string | null;
              }>;
              if (rows.length > 0) {
                officeDayPlan = rows.map((d) => ({
                  label: `Day ${d.day_number}`,
                  title: (d.label ?? "").trim() || "Move day",
                  body:
                    (d.description ?? "").trim() ||
                    // Same defaults as the template fallback so an
                    // unlabelled day still renders sensible copy.
                    (d.day_type === "pack"
                      ? "Our team walks both offices, photographs the IT setup, labels every workstation, installs floor and elevator protection, and packs every box."
                      : d.day_type === "unpack"
                        ? "Boxes unpacked and contents placed in your new space. Final walkthrough with your team, sign-off, and remaining materials removed."
                        : `Full transport to the new office. IT and furniture placed per your floor plan. ${projectManagerName ?? (move.coordinator_name as string | null) ?? "Your project manager"} on-site running the day. Packing debris removed before we leave.`),
                }));
              }
            }
          }
        }

        // welcomePackageUrl is computed once in shared scope above.
        const confirmParams: TierConfirmationParams = {
          clientName,
          moveCode: input.moveCode,
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
          addonLines: resolvedAddonLines.length > 0 ? resolvedAddonLines : undefined,
          officeDayCount,
          officeDayPlan,
          // PM defaults to coordinator until a distinct PM is captured
          // via crew assignment; phone always falls back to the shared
          // office line so the client never sees a blank contact row.
          projectManagerName:
            projectManagerName ??
            ((move.coordinator_name as string) || null),
          projectManagerPhone: projectManagerPhone ?? "(647) 370-4525",
        };

        // Priority + office_move now goes to a tailored office
        // template (was falling back to Estate as a placeholder until
        // dedicated office copy shipped 2026-06-30).
        const isOfficePriority =
          tier === "priority" && quote.service_type === "office_move";
        const templateFns: Record<
          string,
          (p: TierConfirmationParams) => string
        > = {
          essential: essentialConfirmationEmail,
          curated: essentialConfirmationEmail,
          signature: signatureConfirmationEmail,
          estate: estateConfirmationEmail,
          // Priority-tier residential (rare) keeps the Estate copy;
          // Priority-tier office_move (below) picks the dedicated
          // office template via the isOfficePriority override.
          priority: estateConfirmationEmail,
          // legacy keys for moves created before the rename
          essentials: essentialConfirmationEmail,
          premier: signatureConfirmationEmail,
        };
        // Service-type routing takes precedence over tier for services
        // that ship their own tailored confirmation template. Office
        // Priority is the highest-priority override; then white-glove,
        // specialty, labour-only, b2b-delivery each get their dedicated
        // green-premium wrapper so the client email matches the flow
        // they booked. Everything else falls through to the tier-based
        // residential ladder (essential / signature / estate / priority).
        const svcRoute = String(quote.service_type ?? "").toLowerCase();
        const templateFn = isOfficePriority
          ? officeConfirmationEmail
          : svcRoute === "white_glove"
            ? whiteGloveConfirmationEmail
            : svcRoute === "specialty"
              ? specialtyConfirmationEmail
              : svcRoute === "labour_only"
                ? labourOnlyConfirmationEmail
                : svcRoute === "b2b_delivery"
                  ? b2bDeliveryConfirmationEmail
                  : templateFns[tier] ?? signatureConfirmationEmail;

        const estateDateLabel = quote.move_date
          ? new Date(quote.move_date + "T12:00:00").toLocaleDateString(
              "en-CA",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "America/Toronto",
              },
            )
          : input.moveCode;

        const subjects: Record<string, string> = {
          essential: `Your Yugo move is confirmed, ${input.moveCode}`,
          curated: `Your Yugo move is confirmed, ${input.moveCode}`,
          signature: `Your Yugo Signature move is confirmed, ${input.moveCode}`,
          estate: `Welcome to your Yugo Estate experience, ${estateDateLabel}`,
          // legacy keys
          essentials: `Your Yugo move is confirmed, ${input.moveCode}`,
          premier: `Your Yugo Signature move is confirmed, ${input.moveCode}`,
        };
        const subject =
          subjects[tier] ?? `Booking confirmed, ${input.moveCode}`;

        const html = templateFn(confirmParams);
        const emailFrom = await getEmailFrom();

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
      },
    },

    /* ── 2b. Pre-move virtual survey (Essential / Signature only) ── */
    {
      name: "pre_move_survey_invite_email",
      critical: false,
      fn: async () => {
        if (!clientEmail || !surveyTokenForEmail) return;
        if (quote.service_type === "bin_rental") return;
        const tier = String(selectedTier ?? "").toLowerCase();
        if (tier === "estate") return;
        if (
          ![
            "essential",
            "curated",
            "signature",
            "essentials",
            "premier",
          ].includes(tier)
        )
          return;

        const surveyUrl = `${baseUrl}/survey/${surveyTokenForEmail}`;
        const resend = getResend();
        const first = clientName.trim().split(/\s+/)[0] || "there";

        // Move date and code give the client context below the CTA so the
        // email reads as "this is for a specific scheduled move" rather than
        // a generic ask. Stay defensive — quote.move_date may be missing for
        // some service types.
        const moveDateStr = quote.move_date
          ? formatMoveDate(String(quote.move_date))
          : null;
        const moveContextLine = [
          moveDateStr ? `Move date: ${moveDateStr}` : null,
          `Reference: ${input.moveCode}`,
        ]
          .filter(Boolean)
          .join("  ·  ");

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
            `<li>Check access details: elevators, stairs, narrow doors</li>` +
            `<li>Arrive with the right truck, blankets, and dollies</li>` +
            `</ul>` +
            `<br/>` +
            `<strong>What to photograph (about two minutes):</strong>` +
            `<br/>` +
            `<ul style="margin:0;padding-left:18px;line-height:1.55;">` +
            `<li>Each room from the doorway: wide shots, not close-ups</li>` +
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
        const emailFrom = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom,
          to: clientEmail,
          subject: moveDateStr
            ? `${first}, help us prepare for your ${moveDateStr} move`
            : `${first}, help us prepare for your move`,
          html,
          headers: {
            Precedence: "auto",
            "X-Auto-Response-Suppress": "All",
          },
        });
        // Suppress unused-var warning if moveContextLine is later promoted
        // into a structured footer slot of statusUpdateEmailHtml.
        void moveContextLine;
      },
    },

    /* ── 2c. Office pre-move survey (Priority tier only) ──
       Sent immediately after booking so the operator gets floor
       plans, IT counts, elevator windows, and building management
       contact within the first day. Same trigger point as the
       residential survey but different template + copy. */
    {
      name: "office_pre_move_survey_email",
      critical: false,
      fn: async () => {
        if (!clientEmail) return;
        if (quote.service_type !== "office_move") return;
        const tier = String(selectedTier ?? "").toLowerCase();
        if (tier !== "priority") return;
        const surveyUrl = surveyTokenForEmail
          ? `${baseUrl}/survey/${surveyTokenForEmail}`
          : null;
        const factorsForSurvey = (quote.factors_applied ?? {}) as Record<
          string,
          unknown
        >;
        const pmName =
          typeof factorsForSurvey.project_manager_name === "string" &&
          factorsForSurvey.project_manager_name.trim()
            ? factorsForSurvey.project_manager_name.trim()
            : null;
        const pmPhone =
          typeof factorsForSurvey.project_manager_phone === "string" &&
          factorsForSurvey.project_manager_phone.trim()
            ? factorsForSurvey.project_manager_phone.trim()
            : null;
        const first = clientName.trim().split(/\s+/)[0] || "there";
        await sendEmail({
          to: clientEmail,
          subject: `${first}, help us plan your office relocation`,
          template: "office-pre-move-survey",
          data: {
            clientName: clientName || "",
            moveCode: input.moveCode,
            moveDate: quote.move_date,
            fromAddress: quote.from_address,
            toAddress: quote.to_address,
            trackingUrl,
            surveyUrl,
            projectManagerName: pmName,
            projectManagerPhone: pmPhone,
          },
        });
      },
    },

    /* ── 3. Client confirmation SMS ── */
    {
      name: "client_confirmation_sms",
      critical: false,
      fn: async () => {
        if (
          !clientPhone ||
          !process.env.OPENPHONE_API_KEY ||
          !process.env.OPENPHONE_PHONE_NUMBER_ID
        )
          return;

        const digits = clientPhone.replace(/\D/g, "");
        if (digits.length < 10) return;

        const to = digits.startsWith("1") ? `+${digits}` : `+1${digits}`;

        const companyDisplayName = await getCompanyDisplayName();
        const first = clientName?.trim().split(/\s+/)[0] || "there";
        const isBinRental = quote.service_type === "bin_rental";
        // Move-day checklist is only meaningful for jobs where the client
        // has to pack, label, reserve elevators, prep appliances, etc.
        // Single-item runs, deliveries, bin rentals, events, etc. don't
        // need it — including the link in those SMS confuses the client
        // and creates a dead end.
        const needsMoveChecklist = isFullRelocationMove({
          serviceType: quote.service_type ?? null,
          whiteGloveKind:
            (factors as { white_glove_kind?: string | null } | null)
              ?.white_glove_kind ?? null,
        });
        const checklistLine =
          needsMoveChecklist && checklistTokenForEmail
            ? `Move-day checklist:\n${baseUrl}/checklist/${checklistTokenForEmail}`
            : null;

        // Office Priority: business-focused SMS mentioning the project
        // manager and shareable welcome guide. Estate: concierge tone.
        // Every other service type gets a tailored variant so the
        // client SMS matches the flow they booked (delivery, event,
        // white-glove, specialty, labour, bin-rental) instead of the
        // generic "your move is booked" fallback.
        const svc = String(quote.service_type ?? "").toLowerCase();
        const isOfficePrioritySms =
          (selectedTier ?? "") === "priority" && svc === "office_move";
        const trackLine = isBinRental
          ? `Track your order:\n${trackingUrl}`
          : svc === "single_item" ||
              svc === "b2b_delivery" ||
              svc === "b2b_oneoff"
            ? `Track your delivery:\n${trackingUrl}`
            : svc === "event"
              ? `Track your event:\n${trackingUrl}`
              : svc === "white_glove"
                ? `Track your service:\n${trackingUrl}`
                : `Track your move:\n${trackingUrl}`;

        let smsBody: string;
        if (isOfficePrioritySms) {
          smsBody = [
            `${first}, your ${companyDisplayName} office relocation is booked.`,
            `Reference: ${input.moveCode}. Your project manager will reach out today to walk through the plan.`,
            welcomePackageUrl
              ? `Your Priority welcome guide (share with your team):\n${welcomePackageUrl}`
              : null,
            `Track your relocation (share with your team):\n${trackingUrl}`,
            `Questions? Reply here or call (647) 370-4525.`,
          ]
            .filter((s): s is string => Boolean(s))
            .join("\n\n");
        } else if (isEstateBooking) {
          smsBody = [
            `${first}, welcome to ${companyDisplayName} Estate.`,
            `It is our privilege to handle your move (ref ${input.moveCode}). Your dedicated coordinator will call you personally within 24 hours to begin tailoring every detail.`,
            welcomePackageUrl
              ? `Your private Estate welcome package is ready, with your concierge contacts, your timeline, and everything to expect:\n${welcomePackageUrl}`
              : `Your private move portal:\n${trackingUrl}`,
            ...(welcomePackageUrl ? [`Track your move anytime:\n${trackingUrl}`] : []),
            `We are at your service. Reply here or call (647) 370-4525.`,
          ].join("\n\n");
        } else if (svc === "event") {
          smsBody = [
            `${first}, your event with ${companyDisplayName} is booked.`,
            `Reference: ${input.moveCode}. Your coordinator will confirm delivery and return logistics ahead of the event.`,
            trackLine,
            `Questions? Reply here or call (647) 370-4525.`,
          ].join("\n\n");
        } else if (svc === "white_glove") {
          smsBody = [
            `${first}, your white glove service is booked.`,
            `Reference: ${input.moveCode}. Your coordinator will reach out within 24 hours to walk through the plan.`,
            trackLine,
            `Questions? Reply here or call (647) 370-4525.`,
          ].join("\n\n");
        } else if (svc === "single_item" || svc === "b2b_delivery" || svc === "b2b_oneoff") {
          smsBody = [
            `${first}, your delivery is booked with ${companyDisplayName}.`,
            `Reference: ${input.moveCode}. Your coordinator will confirm timing shortly.`,
            trackLine,
          ].join("\n\n");
        } else if (svc === "specialty") {
          smsBody = [
            `${first}, your specialty transport is booked.`,
            `Reference: ${input.moveCode}. Your coordinator will call you within 24 hours to align on the plan.`,
            trackLine,
          ].join("\n\n");
        } else if (svc === "labour_only") {
          smsBody = [
            `Hi ${first},`,
            `Your labour booking with ${companyDisplayName} is confirmed. Reference: ${input.moveCode}.`,
            `Your coordinator will reach out shortly to confirm arrival and scope.`,
            trackLine,
          ].join("\n\n");
        } else {
          smsBody = [
            `Hi ${first},`,
            `You're booked with ${companyDisplayName}. Reference: ${input.moveCode}.`,
            `Your coordinator will reach out within 24 hours.`,
            trackLine,
            ...(checklistLine ? [checklistLine] : []),
          ].join("\n\n");
        }

        await sendSMS(to, smsBody);
      },
    },

    /* ── 4. Internal admin notification ── */
    {
      name: "admin_notification",
      critical: false,
      fn: async () => {
        const adminEmail = await getAdminNotificationEmail();
        if (!adminEmail) return;

        const resend = getResend();
        const isEstate = (selectedTier ?? "") === "estate";
        const html = internalBookingAlertEmail({
          clientName,
          clientEmail,
          clientPhone,
          moveCode: input.moveCode,
          serviceLabel,
          tierLabel,
          totalWithTax,
          depositPaid: depositAmount,
          fromAddress: quote.from_address,
          toAddress: quote.to_address,
          moveDate: quote.move_date,
          paymentId: input.paymentId,
          addonLines:
            resolvedAddonLines.length > 0 ? resolvedAddonLines : undefined,
        });

        const addonSubjectTag =
          resolvedAddonLines.length > 0
            ? ` + ${resolvedAddonLines.length} add-on${resolvedAddonLines.length > 1 ? "s" : ""}`
            : "";
        const subjectPrefix = isEstate ? "[Estate] New booking" : "New booking";
        const emailFrom2 = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom2,
          to: adminEmail,
          subject: `${subjectPrefix}: ${clientName} ${tierLabel || serviceLabel} $${totalWithTax}${addonSubjectTag}`,
          html,
        });
      },
    },

    /* ── 4a. In-app alert when the client selected add-ons ──
       Separate, always-on in-app notification (not just email) so no add-on
       booking is ever missed. "We almost got in trouble for not knowing what
       add-ons were added" (MV-30378) — this is the safety net. */
    {
      name: "addon_in_app_alert",
      critical: false,
      fn: async () => {
        if (resolvedAddonLines.length === 0) return;
        const { notifyAllAdmins } = await import("@/lib/notifications");
        const lines = resolvedAddonLines
          .map(
            (a) =>
              `${a.name}${a.qty && a.qty > 1 ? ` x${a.qty}` : ""}${a.detail ? ` (${a.detail})` : ""}`,
          )
          .join("; ");
        await notifyAllAdmins({
          title: `${clientName} booked with ${resolvedAddonLines.length} add-on${resolvedAddonLines.length > 1 ? "s" : ""}`,
          body: `${input.moveCode}: ${lines}. Confirm the crew brings these.`,
          icon: "package",
          link: `/admin/moves/${input.moveId}`,
          eventSlug: "client_addons_selected",
          sourceType: "move",
          sourceId: input.moveId,
        });
      },
    },

    /* ── 4b. Estate-specific: notify all admins to assign coordinator ──
       Also fires for Priority-tier office_move bookings so a
       project manager gets assigned promptly. Estate + office
       Priority both need a same-day human handoff; the alert
       copy is service-aware so admins can tell them apart. */
    {
      name: "estate_coordinator_notification",
      critical: false,
      fn: async () => {
        const tier = selectedTier ?? "";
        const isOfficePriority =
          tier === "priority" && quote.service_type === "office_move";
        if (tier !== "estate" && !isOfficePriority) return;

        const { notifyAdmins } = await import("@/lib/notifications/dispatch");
        const { estateBookingAdminEmailHtml } =
          await import("@/lib/email/admin-templates");
        const dateLabel = quote.move_date
          ? new Date(quote.move_date + "T12:00:00").toLocaleDateString(
              "en-CA",
              { month: "short", day: "numeric", timeZone: "America/Toronto" },
            )
          : "TBD";

        const labelPrefix = isOfficePriority ? "Office Priority" : "Estate";
        const actionCopy = isOfficePriority
          ? "Assign project manager, schedule site walkthrough."
          : "Assign coordinator and schedule walkthrough.";

        await notifyAdmins("quote_accepted", {
          subject: `${labelPrefix} booking: ${clientName} ${dateLabel} ${formatCurrency(totalWithTax)}`,
          body: `${labelPrefix} booking! ${clientName}, ${dateLabel}, ${formatCurrency(totalWithTax)}. ${actionCopy}`,
          description: `${labelPrefix} booking! ${clientName}, ${dateLabel}, ${formatCurrency(totalWithTax)}. ${actionCopy}`,
          moveId: input.moveId,
          clientName,
          amount: totalWithTax,
          excludeRecipientEmails: clientEmail.trim()
            ? [clientEmail.trim().toLowerCase()]
            : [],
          html: estateBookingAdminEmailHtml({
            clientName,
            dateLabel,
            totalFormatted: formatCurrency(totalWithTax),
            moveId: input.moveId,
          }),
        });
      },
    },

    /* ── 5. Quote analytics ── */
    {
      name: "quote_analytics",
      critical: false,
      fn: async () => {
        await supabase.from("quote_analytics").insert({
          quote_id: quote.id,
          outcome: "won",
          quoted_amount: basePrice,
          final_amount: totalWithTax,
          neighbourhood_tier: neighbourhoodTier,
          move_size: quote.move_size,
          service_type: quote.service_type,
          season: getSeason(quote.move_date),
          day_of_week: getDayOfWeek(quote.move_date),
          tier_selected: selectedTier,
          deposit_amount: depositAmount,
          move_id: input.moveId,
          square_payment_id: input.paymentId,
          addon_revenue: addonRevenue,
          addon_count: addonCount,
          addon_slugs: addonSlugs,
        });
      },
    },

    /* ── 6. Payment event log ── */
    {
      name: "payment_event_log",
      critical: false,
      fn: async () => {
        await supabase.from("quote_events").insert({
          quote_id: input.quoteId,
          event_type: "payment_started",
          metadata: {
            source: "server",
            payment_id: input.paymentId,
            amount: depositAmount,
            move_id: input.moveId,
            move_code: input.moveCode,
          },
        });
      },
    },

    /* ── 7a. Auto-scheduling ── */
    {
      name: "auto_scheduling",
      critical: false,
      fn: async () => {
        await autoScheduleMove(input.moveId, input.quoteId, input.moveCode);
      },
    },

    /* ── 7. Referral: mark used + notify referrer ── */
    {
      name: "referral_update",
      critical: false,
      fn: async () => {
        const referralId = quote.referral_id as string | null;
        if (!referralId) return;

        // Fetch referral to get referrer details
        const { data: ref } = await supabase
          .from("client_referrals")
          .select("id, referrer_email, referrer_name, referrer_credit, status")
          .eq("id", referralId)
          .single();

        if (!ref || ref.status !== "active") return;

        // Mark referral as used with referred client info
        await supabase
          .from("client_referrals")
          .update({
            status: "used",
            referred_name: clientName,
            referred_email: clientEmail,
            referred_move_id: input.moveId,
            used_at: new Date().toISOString(),
          })
          .eq("id", referralId);

        // Increment referral_count on referrer's contact record
        await supabase
          .rpc("increment_referral_count", {
            contact_email: ref.referrer_email,
          })
          .then(
            () => {},
            async () => {
              // Fallback if RPC not available: fetch and update manually
              const { data: contact } = await supabase
                .from("contacts")
                .select("referral_count")
                .eq("email", ref.referrer_email)
                .single();
              if (contact) {
                await supabase
                  .from("contacts")
                  .update({ referral_count: (contact.referral_count ?? 0) + 1 })
                  .eq("email", ref.referrer_email);
              }
            },
          );

        // Email referrer to notify their referral booked
        if (ref.referrer_email) {
          const resend = getResend();
          const emailFrom = await getEmailFrom();
          const referrerFirstName =
            (ref.referrer_name || "").split(" ")[0] || "there";
          const referredFirstName = clientName.split(" ")[0] || "Your friend";
          const referrerHtml = equinoxPromoLayout(
            `
            <h1 style="font-size:30px;font-weight:700;color:#3A3532;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${referrerFirstName}, your referral just booked.</h1>
            <p style="font-size:15px;color:#6B635C;line-height:1.6;margin:0 0 28px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${referredFirstName} confirmed their move with Yugo. Your <strong style="color:#3A3532;">$${ref.referrer_credit} credit</strong> will be applied to your next booking.</p>
            <div style="border-top:1px solid rgba(92,26,51,0.14);padding-top:24px;">
              <div style="font-size:32px;font-weight:700;color:#3A3532;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;letter-spacing:-0.02em;">$${ref.referrer_credit}</div>
              <div style="font-size:12px;color:#6B635C;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin-top:6px;">Referral credit &middot; applied on next booking</div>
            </div>
            ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:#2C3E2D;text-decoration:underline;">${getClientSupportEmail()}</a>`)}
          `,
            "generic",
          );

          await resend.emails.send({
            from: emailFrom,
            to: ref.referrer_email,
            subject: `Your referral just booked, $${ref.referrer_credit} credit earned`,
            html: referrerHtml,
            headers: { Precedence: "auto", "X-Auto-Response-Suppress": "All" },
          });
        }
      },
    },
    /* ── Google Calendar event ── */
    {
      name: "gcal_sync",
      critical: false,
      fn: async () => {
        if (!isGCalConfigured()) return;
        const result = await syncJobToGCal({
          jobType: "move",
          jobId: input.moveId,
          jobCode: input.moveCode,
          clientName,
          serviceType: String(quote.service_type || move.service_type || move.move_type || "residential"),
          status: "confirmed",
          scheduledDate: move.scheduled_date ? String(move.scheduled_date).slice(0, 10) : null,
          startTime: move.scheduled_start ? String(move.scheduled_start).slice(0, 5) : null,
          estimatedDurationMinutes: move.estimated_duration_minutes != null ? Number(move.estimated_duration_minutes) : null,
          fromAddress: move.from_address ? String(move.from_address) : null,
          toAddress: move.to_address ? String(move.to_address) : null,
          crewName: null,
          notes: move.notes ? String(move.notes) : null,
          existingEventId: (move as { gcal_event_id?: string | null }).gcal_event_id ?? null,
        });
        if (result.eventId !== undefined) {
          await supabase.from("moves").update({ gcal_event_id: result.eventId }).eq("id", input.moveId);
        }
        // Events are two linked move rows (delivery + return). The sync above
        // only covers this leg; sync the sibling leg(s) so BOTH event days land
        // on the calendar (MV-30369 return day was missing). `false` = don't
        // let the sibling re-sync back to this leg.
        const egid = (move as { event_group_id?: string | null }).event_group_id;
        if (egid) {
          const { data: legs } = await supabase
            .from("moves")
            .select("id")
            .eq("event_group_id", egid)
            .neq("id", input.moveId);
          for (const leg of legs ?? []) {
            await syncMoveGCalNow(leg.id as string, false);
          }
        }
      },
    },
  ];

  /* ── Execute all actions in parallel ── */
  const results = await Promise.allSettled(actionDefs.map((a) => a.fn()));

  /* ── Map results ── */
  const actionResults = results.map((r, i) => ({
    name: actionDefs[i].name,
    status: r.status as "fulfilled" | "rejected",
    error:
      r.status === "rejected"
        ? String((r as PromiseRejectedResult).reason)
        : undefined,
  }));

  /* ── Log failures to webhook_logs ── */
  const failures = actionResults.filter((a) => a.status === "rejected");
  if (failures.length > 0) {
    const logPromises = failures.map((f) =>
      supabase
        .from("webhook_logs")
        .insert({
          source: "post_payment_automation",
          event_type: `${f.name}:failed`,
          payload: {
            quote_id: input.quoteId,
            move_id: input.moveId,
            move_code: input.moveCode,
          },
          status: "error",
          error: f.error ?? "Unknown error",
        })
        .then(() => {}),
    );
    await Promise.allSettled(logPromises);

    const criticalFailures = failures.filter((f) => {
      const def = actionDefs.find((d) => d.name === f.name);
      return def?.critical;
    });

    if (criticalFailures.length > 0) {
      console.error(
        "[postPayment] CRITICAL failures:",
        criticalFailures.map((f) => `${f.name}: ${f.error}`),
      );
    }
  }

  return { actions: actionResults };
}

export interface PostPaymentB2BDeliveryInput {
  quoteId: string;
  deliveryId: string;
  deliveryNumber: string;
  paymentId: string;
  amount: number;
}

/** HubSpot, analytics, and event log when a B2B quote payment creates a delivery (not a move). */
export async function runPostPaymentActionsB2BDelivery(
  input: PostPaymentB2BDeliveryInput,
): Promise<PostPaymentResult> {
  const supabase = createAdminClient();

  const { data: quote, error: qErr } = await supabase
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", input.quoteId)
    .single();

  if (qErr || !quote) {
    return {
      actions: [
        { name: "data_fetch", status: "rejected", error: "quote missing" },
      ],
    };
  }

  const contact = quote.contacts as {
    name: string;
    email: string | null;
    phone: string | null;
  } | null;
  const clientName = contact?.name || "";
  const hubspotDealId = quote.hubspot_deal_id as string | null;
  const selectedTier = quote.selected_tier;
  let basePrice = 0;
  if (selectedTier && quote.tiers) {
    const tierData = (quote.tiers as Record<string, { price: number }>)[
      selectedTier
    ];
    basePrice = tierData?.price ?? 0;
  } else {
    basePrice = Number(quote.custom_price) || 0;
  }
  const totalWithTax = Math.round(basePrice * 1.13);
  const depositAmount = input.amount;
  // Net-terms invoice booking: delivery confirmed, no money taken yet. Keep the
  // downstream HubSpot + alerts from implying a payment.
  const isInvoiceBooking =
    input.paymentId === "invoice-booking" || (input.amount ?? 0) <= 0;
  const tierLabel = TIER_LABELS[selectedTier ?? ""] ?? selectedTier ?? "";
  const serviceLabel =
    SERVICE_LABELS[quote.service_type as string] ?? quote.service_type;

  const actionDefs: {
    name: string;
    critical: boolean;
    fn: () => Promise<void>;
  }[] = [
    {
      name: "hubspot_deal_update",
      critical: true,
      fn: async () => {
        if (!hubspotDealId) return;
        await syncDealStage(hubspotDealId, "confirmed");
        const token = process.env.HUBSPOT_ACCESS_TOKEN;
        if (!token) return;
        // Same canonical-name + property-set rebuild as the move path —
        // keeps deliveries on the same dealname format as quotes/moves.
        const firstNameForDelivery = (clientName || "")
          .trim()
          .split(/\s+/)[0] ?? "";
        const lastNameForDelivery = (clientName || "")
          .trim()
          .split(/\s+/)
          .slice(1)
          .join(" ");
        const rebuiltDeliveryDealName = buildHubSpotDealName({
          serviceType: String(quote.service_type ?? "") || undefined,
          isPmMove: false,
          firstName: firstNameForDelivery,
          lastName: lastNameForDelivery,
          tierLabel: (selectedTier as string | null | undefined) ?? undefined,
          moveSize: (quote.move_size as string | null | undefined) ?? undefined,
          fromAddress: (quote.from_address as string | null | undefined) ?? undefined,
          fallbackCode: `Delivery ${input.deliveryNumber}`,
        });
        const deliveryDealPayload: Record<string, string> = {
          dealname: rebuiltDeliveryDealName,
          amount: String(totalWithTax),
          // Only stamp payment fields when money was actually taken. An invoice
          // booking is confirmed on net terms with no payment, so leaving
          // deposit_received_at / square_invoice_id off prevents a HubSpot
          // "payment received" workflow from firing a false "paid" notice.
          ...(isInvoiceBooking
            ? {}
            : { deposit_received_at: new Date().toISOString(), square_invoice_id: input.paymentId }),
          opsplus_move_id: input.deliveryId,
          contract_signed: "true",
          package_type: tierLabel || serviceLabel,
          ...buildAllDealProperties({
            jobId: input.deliveryNumber,
            firstName: firstNameForDelivery,
            lastName: lastNameForDelivery,
            fromAddress: quote.from_address as string | null | undefined,
            toAddress: quote.to_address as string | null | undefined,
            fromAccess: quote.from_access as string | null | undefined,
            toAccess: quote.to_access as string | null | undefined,
            serviceType: String(quote.service_type ?? "") || undefined,
            moveDate: (quote.move_date as string | null | undefined) ?? undefined,
            moveSize: (quote.move_size as string | null | undefined) ?? undefined,
            subtotal: totalWithTax > 0 ? Math.round(totalWithTax / 1.13 * 100) / 100 : null,
            totalPrice: totalWithTax,
            tierSelected: (selectedTier as string | null | undefined) ?? null,
            isPmMove: false,
          }),
        };
        await safePatchDeal(token, hubspotDealId, deliveryDealPayload);
      },
    },
    {
      name: "quote_analytics",
      critical: false,
      fn: async () => {
        await supabase.from("quote_analytics").insert({
          quote_id: quote.id,
          outcome: "won",
          quoted_amount: basePrice,
          final_amount: totalWithTax,
          neighbourhood_tier: null,
          move_size: quote.move_size,
          service_type: quote.service_type,
          season: getSeason(quote.move_date),
          day_of_week: getDayOfWeek(quote.move_date),
          tier_selected: selectedTier,
          deposit_amount: depositAmount,
          move_id: null,
          square_payment_id: input.paymentId,
          addon_revenue: 0,
          addon_count: 0,
          addon_slugs: [],
        });
      },
    },
    {
      name: "payment_event_log",
      critical: false,
      fn: async () => {
        await supabase.from("quote_events").insert({
          quote_id: input.quoteId,
          event_type: "payment_started",
          metadata: {
            source: "server",
            payment_id: input.paymentId,
            amount: depositAmount,
            delivery_id: input.deliveryId,
            delivery_number: input.deliveryNumber,
          },
        });
      },
    },
    {
      name: "internal_b2b_delivery_alert",
      critical: false,
      fn: async () => {
        const adminEmail = getClientSupportEmail();
        if (!adminEmail) return;
        const resend = getResend();
        const emailFrom2 = await getEmailFrom();
        const base = getEmailBaseUrl().replace(/\/$/, "");
        // An invoice booking (net terms, no card) is a delivery confirmation,
        // NOT a payment. Only say "Paid" when money was actually taken
        // (isInvoiceBooking is computed once at the top of this function).
        // Full ops summary rather than a bare one-liner, so the team can see the
        // whole job at a glance. Fetch the delivery for route/items/schedule.
        const { data: dd } = await supabase
          .from("deliveries")
          .select(
            "delivery_number, business_name, customer_name, contact_name, pickup_address, delivery_address, scheduled_date, delivery_window, items, recipient_mode, recipient_name, override_price, admin_adjusted_price, total_price, calculated_price",
          )
          .eq("id", input.deliveryId)
          .maybeSingle();
        const esc = (v: unknown) =>
          String(v ?? "").replace(/[&<>"]/g, (c) =>
            ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] || c,
          );
        const fmtDate = (s: unknown) => {
          const raw = String(s ?? "").slice(0, 10);
          if (!raw) return null;
          try {
            return new Date(`${raw}T12:00:00`).toLocaleDateString("en-CA", {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
          } catch {
            return null;
          }
        };
        const itemRows = normalizeDeliveryItemsForDisplay(
          (dd?.items as Parameters<typeof normalizeDeliveryItemsForDisplay>[0]) || [],
        );
        const itemCount = itemRows.reduce((s, r) => s + (r.qty || 1), 0);
        const amt = Number(
          dd?.override_price ??
            dd?.admin_adjusted_price ??
            dd?.total_price ??
            dd?.calculated_price ??
            0,
        );
        const rows = emailDetailRows([
          ["Delivery", input.deliveryNumber],
          ["Quote", input.quoteId],
          ["Business", dd?.business_name || clientName || null],
          ["Contact", dd?.contact_name || dd?.customer_name || null],
          ["From", dd?.pickup_address || null],
          ["To", dd?.delivery_address || null],
          [
            "Receiving",
            dd?.recipient_mode === "separate" ? dd?.recipient_name || null : null,
          ],
          ["Date", fmtDate(dd?.scheduled_date)],
          ["Window", dd?.delivery_window || null],
          ["Items", itemCount > 0 ? `${itemCount} item${itemCount === 1 ? "" : "s"}` : null],
          ["Amount", amt > 0 ? `$${amt.toFixed(2)} plus HST` : null],
          [
            "Terms",
            isInvoiceBooking
              ? "Invoice raised after completion (net terms, no payment yet)"
              : "Paid",
          ],
        ]);
        const adminBtn = `<a href="${base}/admin/deliveries/${encodeURIComponent(input.deliveryNumber)}" style="display:inline-block;background:#2B3927;color:#F9EDE4;text-decoration:none;font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;padding:12px 22px;border-radius:6px;">Open in admin</a>`;
        const html = `<div style="max-width:560px;margin:0 auto;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;background:#F9EDE4;padding:28px;">
            <div style="font-size:18px;font-weight:800;letter-spacing:3px;color:#492A1D;margin-bottom:18px;">YUGO</div>
            <div style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#66143D;margin-bottom:6px;">${isInvoiceBooking ? "B2B delivery confirmed" : "B2B delivery paid"}</div>
            <div style="font-size:18px;font-weight:700;color:#2B0416;margin:0 0 16px;">${esc(dd?.business_name || clientName || "New commercial delivery")}</div>
            ${rows}
            ${adminBtn}
          </div>`;
        await resend.emails.send({
          from: emailFrom2,
          to: adminEmail,
          subject: isInvoiceBooking
            ? `[B2B Delivery] Confirmed: ${input.deliveryNumber}, ${clientName || "Client"}`
            : `[B2B Delivery] Paid: ${input.deliveryNumber}, ${clientName || "Client"}`,
          html,
        });
      },
    },
    /* ── Google Calendar event ── */
    {
      name: "gcal_sync",
      critical: false,
      fn: async () => {
        if (!isGCalConfigured()) return;
        const { data: delivery } = await supabase
          .from("deliveries")
          .select("id")
          .eq("delivery_number", input.deliveryNumber)
          .single();
        if (!delivery) return;
        // Route through the shared, concurrency-guarded delivery sync so the
        // atomic gcal_event_id claim runs — this action fires in parallel with
        // crew assignment (which can trigger its own resync), and GCal's
        // extendedProperty dedup is eventually consistent, so a direct
        // syncJobToGCal here double-booked the calendar (DLV-30379).
        await syncDeliveryGCalNow(String(delivery.id));
      },
    },
  ];

  const results = await Promise.allSettled(actionDefs.map((a) => a.fn()));
  const actionResults = results.map((r, i) => ({
    name: actionDefs[i].name,
    status: r.status as "fulfilled" | "rejected",
    error:
      r.status === "rejected"
        ? String((r as PromiseRejectedResult).reason)
        : undefined,
  }));

  return { actions: actionResults };
}

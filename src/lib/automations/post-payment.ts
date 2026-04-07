import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { signTrackToken } from "@/lib/track-token";
import { getClientSupportEmail } from "@/lib/email/client-support-email";
import {
  equinoxPromoLayout,
  equinoxPromoFinePrint,
} from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { formatCurrency } from "@/lib/format-currency";
import { getCompanyDisplayName } from "@/lib/config";
import { autoScheduleMove } from "@/lib/scheduling/auto-schedule";
import { generateWelcomePackageToken } from "@/lib/welcome-package-token";
import {
  bookingConfirmationEmail,
  internalBookingAlertEmail,
  essentialConfirmationEmail,
  curatedConfirmationEmail,
  signatureConfirmationEmail,
  estateConfirmationEmail,
  statusUpdateEmailHtml,
  type TierConfirmationParams,
} from "@/lib/email-templates";

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
};

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
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
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
  if (!existingSurveyTok) tokenUpdates.survey_token = randomBytes(24).toString("hex");
  if (!existingChecklistTok) tokenUpdates.checklist_token = randomBytes(24).toString("hex");
  if (Object.keys(tokenUpdates).length > 0) {
    const { error: tokUpErr } = await supabase
      .from("moves")
      .update(tokenUpdates)
      .eq("id", input.moveId);
    if (tokUpErr) console.error("[postPayment] survey/checklist tokens", tokUpErr);
  }
  const surveyTokenForEmail = String(
    tokenUpdates.survey_token ?? existingSurveyTok,
  ).trim();
  const checklistTokenForEmail = String(
    tokenUpdates.checklist_token ?? existingChecklistTok,
  ).trim();

  const selectedTier = move.tier_selected || quote.selected_tier;
  const tierLabel = TIER_LABELS[selectedTier ?? ""] ?? selectedTier ?? "";
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

  /* ── Compute addon analytics ── */
  const selectedAddons = (quote.selected_addons || []) as Array<{
    addon_id?: string;
    slug?: string;
    quantity?: number;
    tier_index?: number;
  }>;
  const addonCount = selectedAddons.length;
  const addonSlugs = selectedAddons
    .map((a) => a.slug)
    .filter(Boolean) as string[];

  let addonRevenue = 0;
  if (addonCount > 0) {
    const addonIds = selectedAddons
      .map((a) => a.addon_id)
      .filter(Boolean) as string[];

    if (addonIds.length > 0) {
      const { data: addonRecords } = await supabase
        .from("addons")
        .select("id, price, price_type, tiers, percent_value")
        .in("id", addonIds);

      for (const sel of selectedAddons) {
        const record = (addonRecords ?? []).find(
          (r) => r.id === sel.addon_id,
        ) as {
          price: number;
          price_type: string;
          tiers: { price: number }[] | null;
          percent_value: number | null;
        } | null;
        if (!record) continue;

        switch (record.price_type) {
          case "flat":
            addonRevenue += record.price;
            break;
          case "per_unit":
            addonRevenue += record.price * (sel.quantity || 1);
            break;
          case "tiered":
            addonRevenue += record.tiers?.[sel.tier_index ?? 0]?.price ?? 0;
            break;
          case "percent":
            addonRevenue += Math.round(basePrice * (record.percent_value ?? 0));
            break;
        }
      }
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

        await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${hubspotDealId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: {
                amount: String(totalWithTax),
                deposit_received_at: new Date().toISOString(),
                square_invoice_id: input.paymentId,
                opsplus_move_id: input.moveId,
                contract_signed: "true",
                package_type: tierLabel || serviceLabel,
              },
            }),
          },
        );
      },
    },

    /* ── 2. Client confirmation email (tier-specific) ── */
    {
      name: "client_confirmation_email",
      critical: true,
      fn: async () => {
        if (!clientEmail) return;

        const resend = getResend();
        const tier = selectedTier ?? "signature";

        const TRUCK_DISPLAY: Record<string, string> = {
          sprinter: "Extended Sprinter Van",
          "16ft": "16ft Fully Equipped Truck",
          "20ft": "20ft Dedicated Moving Truck",
          "24ft": "24ft Full-Size Moving Truck",
          "26ft": "26ft Maximum-Capacity Truck",
        };
        const truckKey =
          (move.truck_info as string) || (quote.truck_primary as string) || "";
        const truckDisplayName =
          TRUCK_DISPLAY[truckKey] || truckKey || "Dedicated moving truck";

        const tierData =
          tier && quote.tiers
            ? (quote.tiers as Record<string, { includes: string[] }>)[tier]
            : null;
        const includes = tierData?.includes ?? [];
        const crewSize =
          (move.crew_size as number) || (quote.est_crew_size as number) || 3;
        const timeWindow =
          (move.arrival_window as string) || "Morning (7 AM – 12 PM)";

        let welcomePackageUrl: string | null = null;
        if (tier === "estate") {
          let wpToken = String(
            (move as { welcome_package_token?: string | null })
              .welcome_package_token ?? "",
          ).trim();
          if (!wpToken) {
            wpToken = generateWelcomePackageToken();
            const { error: tokErr } = await supabase
              .from("moves")
              .update({ welcome_package_token: wpToken })
              .eq("id", input.moveId);
            if (tokErr) {
              console.error("[postPayment] welcome_package_token", tokErr);
              wpToken = "";
            }
          }
          if (wpToken) {
            welcomePackageUrl = `${baseUrl}/estate/welcome/${wpToken}`;
          }
        }

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
        };

        const templateFns: Record<
          string,
          (p: TierConfirmationParams) => string
        > = {
          essential: essentialConfirmationEmail,
          curated: essentialConfirmationEmail,
          signature: signatureConfirmationEmail,
          estate: estateConfirmationEmail,
          // legacy keys for moves created before the rename
          essentials: essentialConfirmationEmail,
          premier: signatureConfirmationEmail,
        };
        const templateFn = templateFns[tier] ?? signatureConfirmationEmail;

        const estateDateLabel = quote.move_date
          ? new Date(quote.move_date + "T00:00:00").toLocaleDateString(
              "en-CA",
              {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
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
        const tier = String(selectedTier ?? "").toLowerCase();
        if (tier === "estate") return;
        if (
          !["essential", "curated", "signature", "essentials", "premier"].includes(
            tier,
          )
        )
          return;

        const surveyUrl = `${baseUrl}/survey/${surveyTokenForEmail}`;
        const resend = getResend();
        const first = clientName.trim().split(/\s+/)[0] || "there";
        const html = statusUpdateEmailHtml({
          eyebrow: "Help us prepare",
          headline: "Quick room photos",
          body: `Hi ${first},<br/><br/>When you have a moment, snap a few photos of your main rooms so your coordinator can double-check the plan. It only takes a couple of minutes on your phone.`,
          ctaUrl: surveyUrl,
          ctaLabel: "TAKE PHOTOS",
          includeFooter: true,
          tone: "premium",
        });
        const emailFrom = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom,
          to: clientEmail,
          subject: "Help us prepare — quick photos of your rooms",
          html,
          headers: {
            Precedence: "auto",
            "X-Auto-Response-Suppress": "All",
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
        const checklistLine = checklistTokenForEmail
          ? `Move-day checklist:\n${baseUrl}/checklist/${checklistTokenForEmail}`
          : null;
        await sendSMS(
          to,
          [
            `Hi ${first},`,
            `You're booked with ${companyDisplayName}. Reference: ${input.moveCode}.`,
            `Your coordinator will reach out within 24 hours.`,
            `Track your move:\n${trackingUrl}`,
            ...(checklistLine ? [checklistLine] : []),
          ].join("\n\n"),
        );
      },
    },

    /* ── 4. Internal admin notification ── */
    {
      name: "admin_notification",
      critical: false,
      fn: async () => {
        const adminEmail = process.env.SUPER_ADMIN_EMAIL;
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
        });

        const subjectPrefix = isEstate ? "[Estate] New booking" : "New booking";
        const emailFrom2 = await getEmailFrom();
        await resend.emails.send({
          from: emailFrom2,
          to: adminEmail,
          subject: `${subjectPrefix}: ${clientName} ${tierLabel || serviceLabel} $${totalWithTax}`,
          html,
        });
      },
    },

    /* ── 4b. Estate-specific: notify all admins to assign coordinator ── */
    {
      name: "estate_coordinator_notification",
      critical: false,
      fn: async () => {
        const tier = selectedTier ?? "";
        if (tier !== "estate") return;

        const { notifyAdmins } = await import("@/lib/notifications/dispatch");
        const { estateBookingAdminEmailHtml } =
          await import("@/lib/email/admin-templates");
        const dateLabel = quote.move_date
          ? new Date(quote.move_date + "T00:00:00").toLocaleDateString(
              "en-CA",
              { month: "short", day: "numeric" },
            )
          : "TBD";

        await notifyAdmins("quote_accepted", {
          subject: `Estate booking: ${clientName} ${dateLabel} ${formatCurrency(totalWithTax)}`,
          body: `Estate booking! ${clientName}, ${dateLabel}, ${formatCurrency(totalWithTax)}. Assign coordinator and schedule walkthrough.`,
          description: `Estate booking! ${clientName}, ${dateLabel}, ${formatCurrency(totalWithTax)}. Assign coordinator and schedule walkthrough.`,
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
        await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${hubspotDealId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: {
                amount: String(totalWithTax),
                deposit_received_at: new Date().toISOString(),
                square_invoice_id: input.paymentId,
                opsplus_move_id: input.deliveryId,
                contract_signed: "true",
                package_type: tierLabel || serviceLabel,
              },
            }),
          },
        );
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
        await resend.emails.send({
          from: emailFrom2,
          to: adminEmail,
          subject: `[B2B Delivery] Paid: ${input.deliveryNumber} — ${clientName || "Client"}`,
          html: `<p>B2B quote <strong>${input.quoteId}</strong> paid. Delivery <strong>${input.deliveryNumber}</strong>.</p><p><a href="${base}/admin/deliveries/${encodeURIComponent(input.deliveryNumber)}">Open in admin</a></p>`,
        });
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

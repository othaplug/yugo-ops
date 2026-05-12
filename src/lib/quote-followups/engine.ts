/**
 * Quote follow-up engine: shared batch for Vercel cron and manual admin send.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getFeatureConfig } from "@/lib/platform-settings";
import {
  sendQuoteFollowupSms,
  sendQuoteUrgencySms,
  sendQuoteExpiryWarningSms,
} from "@/lib/quote-sms";
import { logActivity } from "@/lib/activity";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { processColdRules } from "@/lib/quote-followups/cold-intelligence";
import { getLocalClockPartsInAppTimezone } from "@/lib/business-timezone";
import { notifyAdmins } from "@/lib/notifications/dispatch";

/**
 * Quiet-hours guard: with the cron now firing hourly (instead of once daily
 * at 11 AM EST), we still want client-facing email + SMS to land during
 * waking hours. Returns true if the current app-timezone local time is within
 * 8 AM – 8 PM. Quote expiration still runs outside that window — it's silent.
 */
function withinBusinessHours(): boolean {
  const { hour } = getLocalClockPartsInAppTimezone(new Date());
  return hour >= 8 && hour < 20;
}

const HS_TASKS = "https://api.hubapi.com/crm/v3/objects/tasks";
const HS_ASSOC = "https://api.hubapi.com/crm/v4/objects/tasks";

const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  b2b_delivery: "Delivery",
  bin_rental: "Bin Rental",
};

interface EngagementSummary {
  tierClicked: string | null;
  contractViewed: boolean;
  paymentStarted: boolean;
  comparisonViewed: boolean;
  maxSessionSeconds: number;
  pageViews: number;
  addonsSeen: string[];
}

async function getEngagementSummary(
  supabase: ReturnType<typeof createAdminClient>,
  quoteInternalId: string,
): Promise<EngagementSummary> {
  let events: {
    event_type: string;
    event_data: Record<string, unknown> | null;
    session_duration_seconds: number | null;
  }[] | null = null;
  try {
    const { data, error } = await supabase
      .from("quote_engagement")
      .select("event_type, event_data, session_duration_seconds")
      .eq("quote_id", quoteInternalId);
    events = error ? null : data;
  } catch {
    events = null;
  }

  const summary: EngagementSummary = {
    tierClicked: null,
    contractViewed: false,
    paymentStarted: false,
    comparisonViewed: false,
    maxSessionSeconds: 0,
    pageViews: 0,
    addonsSeen: [],
  };

  for (const ev of events ?? []) {
    const data = ev.event_data as Record<string, unknown> | null;
    if (ev.session_duration_seconds && ev.session_duration_seconds > summary.maxSessionSeconds) {
      summary.maxSessionSeconds = ev.session_duration_seconds;
    }
    switch (ev.event_type) {
      case "page_view":
        summary.pageViews++;
        break;
      case "tier_clicked":
        summary.tierClicked = (data?.tier as string) ?? summary.tierClicked;
        break;
      case "contract_viewed":
        summary.contractViewed = true;
        break;
      case "payment_started":
        summary.paymentStarted = true;
        break;
      case "comparison_viewed":
        summary.comparisonViewed = true;
        break;
      case "addon_toggled":
        if (data?.addon && data?.action === "on") summary.addonsSeen.push(data.addon as string);
        break;
    }
  }

  return summary;
}

function chooseFollowUpVariant(
  ruleNumber: 2 | 3,
  eng: EngagementSummary,
): { subject: string; template: TemplateName; extraData: Record<string, unknown> } {
  if (ruleNumber === 2) {
    if (eng.paymentStarted || (eng.tierClicked && eng.contractViewed)) {
      const tier = eng.tierClicked ?? "signature";
      const tierLabel: Record<string, string> = {
        essential: "Essential",
        curated: "Essential",
        signature: "Signature",
        estate: "Estate",
        essentials: "Essential",
        premier: "Signature",
      };
      return {
        subject: `Your ${tierLabel[tier] ?? tier} package is ready to confirm`,
        template: "quote-followup-2-warm",
        extraData: { tier, addons: eng.addonsSeen },
      };
    }

    if (eng.tierClicked === "essential" || eng.tierClicked === "curated" || eng.tierClicked === "essentials") {
      return {
        subject: "A note about your Yugo quote",
        template: "quote-followup-2-essential",
        extraData: { tier: "essential" },
      };
    }

    if (eng.maxSessionSeconds < 30 && eng.pageViews <= 1) {
      return {
        subject: "Your Yugo quote is still available",
        template: "quote-followup-2",
        extraData: {},
      };
    }

    return {
      subject: "A gentle reminder about your move date",
      template: "quote-followup-2",
      extraData: {},
    };
  }

  if (eng.paymentStarted) {
    return {
      subject: "Pick up where you left off",
      template: "quote-followup-3-hot",
      extraData: { tier: eng.tierClicked },
    };
  }

  if (eng.pageViews === 0) {
    return {
      subject: "Your Yugo quote is waiting",
      template: "quote-followup-3-unseen",
      extraData: {},
    };
  }

  return {
    subject: "Your Yugo quote expires tomorrow",
    template: "quote-followup-3",
    extraData: {},
  };
}

async function createHubSpotTask(dealId: string, subject: string, body: string): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token) return;

  try {
    const taskRes = await fetch(HS_TASKS, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          hs_task_subject: subject,
          hs_task_body: body,
          hs_task_status: "NOT_STARTED",
          hs_task_priority: "HIGH",
          hs_due_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
      }),
    });

    if (!taskRes.ok) return;
    const task = await taskRes.json();
    const taskId = task?.id;
    if (!taskId) return;

    await fetch(`${HS_ASSOC}/${taskId}/associations/deals/${dealId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 }]),
    });
  } catch {
    /* non-critical */
  }
}

export type QuoteFollowupCronJobResult = {
  followup1: number;
  followup2: number;
  followup3: number;
  /** Move-date urgency: move_date ≤ 5 days away, quote not yet booked. */
  urgency: number;
  /** 48h expiry safety net: quote rate expires soon, not yet booked. */
  expiryWarning: number;
  /** Hot-quote coordinator alerts: 3+ page-view sessions logged. */
  hotFlagged: number;
  expired: number;
  coldMarked: number;
  errors: string[];
};

function followupEmailExtras(
  baseUrl: string,
  quoteId: string,
  token: string | null | undefined,
  followupRowId: string | null,
): { declineUrl: string | null; openPixelSrc: string | null } {
  const t = token?.trim();
  if (!t) return { declineUrl: null, openPixelSrc: null };
  const declineUrl = `${baseUrl}/quote/${encodeURIComponent(quoteId)}?action=decline&token=${encodeURIComponent(t)}`;
  const openPixelSrc = followupRowId
    ? `${baseUrl}/api/email/quote-followup-open?id=${encodeURIComponent(followupRowId)}&t=${encodeURIComponent(t)}`
    : null;
  return { declineUrl, openPixelSrc };
}

/**
 * Rules 1–3 (nurture) + rule 4 (mark expired). Caller must enforce auto_followup_enabled for cron-only runs.
 */
export async function runQuoteFollowupCronJob(): Promise<QuoteFollowupCronJobResult> {
  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();

  const cfg = await getFeatureConfig(["followup_max_attempts"]);
  const maxAttempts = Math.max(0, parseInt(cfg.followup_max_attempts, 10) || 3);

  const results: QuoteFollowupCronJobResult = {
    followup1: 0,
    followup2: 0,
    followup3: 0,
    urgency: 0,
    expiryWarning: 0,
    hotFlagged: 0,
    expired: 0,
    coldMarked: 0,
    errors: [],
  };

  const coldRun = await processColdRules(supabase);
  results.coldMarked = coldRun.marked;
  for (const e of coldRun.errors) results.errors.push(`cold:${e}`);

  const statusNotAcceptedOrExpired = ["draft", "sent", "viewed", "declined"];

  // Quiet-hours guard: only send client-facing follow-up email + SMS during business hours.
  // Expiration sweep below still runs regardless (it doesn't touch the client).
  const sendsAllowed = withinBusinessHours();

  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rule1Quotes } = sendsAllowed
    ? await supabase
        .from("quotes")
        .select(
          "id, quote_id, public_action_token, service_type, factors_applied, contact_id, contacts:contact_id(name, email, phone)",
        )
        .eq("status", "sent")
        .eq("auto_followup_active", true)
        .lt("sent_at", cutoff24h)
        .is("viewed_at", null)
        .is("followup_1_sent", null)
        .limit(50)
    : { data: null };

  if (rule1Quotes) {
    for (const q of rule1Quotes) {
      const contactRaw = q.contacts as
        | { name: string; email: string | null; phone?: string | null }
        | { name: string; email: string | null; phone?: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        const { data: claimed } = await supabase
          .from("quotes")
          .update({ followup_1_sent: now.toISOString() })
          .eq("quote_id", q.quote_id)
          .is("followup_1_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const internalId = (q as { id: string }).id;
        const token = (q as { public_action_token?: string | null }).public_action_token;
        const { data: fuRow, error: fuErr } = await supabase
          .from("quote_followups")
          .insert({ quote_id: internalId, type: "first_followup" })
          .select("id")
          .single();

        if (fuErr || !fuRow?.id) {
          await supabase.from("quotes").update({ followup_1_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f1:${q.quote_id}:followup_row`);
          continue;
        }

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const extras = followupEmailExtras(baseUrl, q.quote_id, token, fuRow.id);

        const res = await sendEmail({
          to: contact.email,
          subject: `Your Yugo quote is ready whenever you are`,
          template: "quote-followup-1",
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            declineUrl: extras.declineUrl,
            openPixelSrc: extras.openPixelSrc,
          },
        });

        if (res.success) {
          results.followup1++;
          logActivity({
            entity_type: "quote",
            entity_id: q.quote_id,
            event_type: "follow_up_sent",
            description: `Follow-up #1 sent to ${contact.name || contact.email}, ${q.quote_id}`,
            icon: "follow_up",
          }).catch(() => {});
          if (contact.phone) {
            const f1 = (q as { factors_applied?: Record<string, unknown> | null }).factors_applied;
            const eventName =
              q.service_type === "event" && typeof f1?.event_name === "string" ? f1.event_name : null;
            sendQuoteFollowupSms({
              phone: contact.phone,
              quoteUrl,
              quoteId: q.quote_id,
              firstName,
              serviceType: q.service_type,
              followupNumber: 1,
              eventName,
            }).catch(() => {});
          }
        } else {
          await supabase.from("quote_followups").delete().eq("id", fuRow.id);
          await supabase.from("quotes").update({ followup_1_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f1:${q.quote_id}:${res.error}`);
        }
      } catch (err) {
        results.errors.push(`f1:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: rule2Quotes } =
    maxAttempts >= 2 && sendsAllowed
      ? await supabase
          .from("quotes")
          .select(
            "id, quote_id, public_action_token, service_type, move_date, expires_at, tiers, custom_price, hubspot_deal_id, factors_applied, contact_id, contacts:contact_id(name, email, phone)",
          )
          .eq("status", "viewed")
          .eq("auto_followup_active", true)
          .lt("viewed_at", cutoff48h)
          .is("accepted_at", null)
          .is("followup_2_sent", null)
          .limit(50)
      : { data: null };

  if (rule2Quotes) {
    for (const q of rule2Quotes) {
      const contactRaw = q.contacts as
        | { name: string; email: string | null; phone?: string | null }
        | { name: string; email: string | null; phone?: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        const eng = await getEngagementSummary(supabase, q.id);
        const variant = chooseFollowUpVariant(2, eng);

        const { data: claimed } = await supabase
          .from("quotes")
          .update({
            followup_2_sent: now.toISOString(),
          })
          .eq("quote_id", q.quote_id)
          .is("followup_2_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const token = (q as { public_action_token?: string | null }).public_action_token;
        const { data: fuRow, error: fuErr } = await supabase
          .from("quote_followups")
          .insert({ quote_id: q.id, type: "second_followup" })
          .select("id")
          .single();

        if (fuErr || !fuRow?.id) {
          await supabase.from("quotes").update({ followup_2_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f2:${q.quote_id}:followup_row`);
          continue;
        }

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const extras = followupEmailExtras(baseUrl, q.quote_id, token, fuRow.id);

        const res = await sendEmail({
          to: contact.email,
          subject: variant.subject,
          template: variant.template,
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            moveDate: q.move_date,
            expiresAt: q.expires_at,
            declineUrl: extras.declineUrl,
            openPixelSrc: extras.openPixelSrc,
            ...variant.extraData,
          },
        });

        if (res.success) {
          results.followup2++;
          logActivity({
            entity_type: "quote",
            entity_id: q.quote_id,
            event_type: "follow_up_sent",
            description: `Follow-up #2 sent to ${contact.name || contact.email}, ${q.quote_id}`,
            icon: "follow_up",
          }).catch(() => {});
          if (contact.phone) {
            const f2 = (q as { factors_applied?: Record<string, unknown> | null }).factors_applied;
            const eventName =
              q.service_type === "event" && typeof f2?.event_name === "string" ? f2.event_name : null;
            sendQuoteFollowupSms({
              phone: contact.phone,
              quoteUrl,
              quoteId: q.quote_id,
              firstName,
              serviceType: q.service_type,
              followupNumber: 2,
              expiresAt: q.expires_at,
              eventName,
            }).catch(() => {});
          }
        } else {
          await supabase.from("quote_followups").delete().eq("id", fuRow.id);
          await supabase.from("quotes").update({ followup_2_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f2:${q.quote_id}:${res.error}`);
        }

        if (q.hubspot_deal_id) {
          await createHubSpotTask(
            q.hubspot_deal_id,
            `Follow up: ${contact.name || "Client"}, ${eng.tierClicked ? `explored ${eng.tierClicked}` : "viewed"}`,
            `Quote ${q.quote_id} was viewed 48+ hours ago. Engagement: ${eng.paymentStarted ? "started payment" : eng.contractViewed ? "viewed contract" : eng.tierClicked ? `clicked ${eng.tierClicked} tier` : "browsed briefly"}. ${eng.maxSessionSeconds}s max session.`,
          );
        }
      } catch (err) {
        results.errors.push(`f2:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  const cutoff5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rule3Quotes } =
    maxAttempts >= 3 && sendsAllowed
      ? await supabase
          .from("quotes")
          .select(
            "id, quote_id, public_action_token, service_type, expires_at, hubspot_deal_id, factors_applied, contact_id, contacts:contact_id(name, email, phone)",
          )
          .in("status", ["viewed", "sent"])
          .eq("auto_followup_active", true)
          .lt("viewed_at", cutoff5d)
          .is("accepted_at", null)
          .is("followup_3_sent", null)
          .limit(50)
      : { data: null };

  if (rule3Quotes) {
    for (const q of rule3Quotes) {
      const contactRaw = q.contacts as
        | { name: string; email: string | null; phone?: string | null }
        | { name: string; email: string | null; phone?: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        const eng = await getEngagementSummary(supabase, q.id);
        const variant = chooseFollowUpVariant(3, eng);

        const { data: claimed } = await supabase
          .from("quotes")
          .update({
            followup_3_sent: now.toISOString(),
          })
          .eq("quote_id", q.quote_id)
          .is("followup_3_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const token = (q as { public_action_token?: string | null }).public_action_token;
        const { data: fuRow, error: fuErr } = await supabase
          .from("quote_followups")
          .insert({ quote_id: q.id, type: "third_followup" })
          .select("id")
          .single();

        if (fuErr || !fuRow?.id) {
          await supabase.from("quotes").update({ followup_3_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f3:${q.quote_id}:followup_row`);
          continue;
        }

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const extras = followupEmailExtras(baseUrl, q.quote_id, token, fuRow.id);

        const res = await sendEmail({
          to: contact.email,
          subject: variant.subject,
          template: variant.template,
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            expiresAt: q.expires_at,
            declineUrl: extras.declineUrl,
            openPixelSrc: extras.openPixelSrc,
            ...variant.extraData,
          },
        });

        if (res.success) {
          results.followup3++;
          logActivity({
            entity_type: "quote",
            entity_id: q.quote_id,
            event_type: "follow_up_sent",
            description: `Follow-up #3 sent to ${contact.name || contact.email}, ${q.quote_id}`,
            icon: "follow_up",
          }).catch(() => {});
          if (contact.phone) {
            const f3 = (q as { factors_applied?: Record<string, unknown> | null }).factors_applied;
            const eventName =
              q.service_type === "event" && typeof f3?.event_name === "string" ? f3.event_name : null;
            sendQuoteFollowupSms({
              phone: contact.phone,
              quoteUrl,
              quoteId: q.quote_id,
              firstName,
              serviceType: q.service_type,
              followupNumber: 3,
              expiresAt: q.expires_at,
              eventName,
            }).catch(() => {});
          }
        } else {
          await supabase.from("quote_followups").delete().eq("id", fuRow.id);
          await supabase.from("quotes").update({ followup_3_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`f3:${q.quote_id}:${res.error}`);
        }

        if (q.hubspot_deal_id) {
          await createHubSpotTask(
            q.hubspot_deal_id,
            `URGENT: Final follow-up, ${eng.paymentStarted ? "payment was started" : "quote expiring"}`,
            `Quote ${q.quote_id} for ${contact.name || "client"} expires soon. Engagement level: ${eng.paymentStarted ? "HOT (started payment)" : eng.contractViewed ? "WARM (viewed contract)" : eng.tierClicked ? "ENGAGED (browsed tiers)" : "COLD"}. Personal outreach recommended.`,
          );
        }
      } catch (err) {
        results.errors.push(`f3:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── Rule: move-date urgency ──────────────────────────────────────────
  // Move date is within the next 5 days AND quote not yet accepted. Fires
  // independent of the F1/F2/F3 cadence. Closes the gap where a quote viewed
  // just yesterday with a 4-day-away move never trips Rule 3 in time.
  const fiveDaysOut = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);
  const todayStartIso = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  ).toISOString();
  const { data: urgencyQuotes } = sendsAllowed
    ? await supabase
        .from("quotes")
        .select(
          "id, quote_id, public_action_token, service_type, move_date, contact_id, contacts:contact_id(name, email, phone)",
        )
        .in("status", ["sent", "viewed"])
        .eq("auto_followup_active", true)
        .is("accepted_at", null)
        .is("followup_urgency_sent", null)
        .not("move_date", "is", null)
        .gte("move_date", todayStartIso)
        .lte("move_date", fiveDaysOut.toISOString())
        .limit(50)
    : { data: null };

  if (urgencyQuotes) {
    for (const q of urgencyQuotes) {
      const contactRaw = q.contacts as
        | { name: string; email: string | null; phone?: string | null }
        | { name: string; email: string | null; phone?: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email || !q.move_date) continue;

      try {
        const { data: claimed } = await supabase
          .from("quotes")
          .update({ followup_urgency_sent: now.toISOString() })
          .eq("quote_id", q.quote_id)
          .is("followup_urgency_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const internalId = (q as { id: string }).id;
        const token = (q as { public_action_token?: string | null }).public_action_token;
        const { data: fuRow, error: fuErr } = await supabase
          .from("quote_followups")
          .insert({ quote_id: internalId, type: "urgency" })
          .select("id")
          .single();
        if (fuErr || !fuRow?.id) {
          await supabase.from("quotes").update({ followup_urgency_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`urgency:${q.quote_id}:followup_row`);
          continue;
        }

        const daysUntilMove = Math.max(
          0,
          Math.ceil(
            (new Date(q.move_date).getTime() - now.getTime()) / 86_400_000,
          ),
        );
        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const extras = followupEmailExtras(baseUrl, q.quote_id, token, fuRow.id);
        const subject =
          daysUntilMove <= 1
            ? `Your move is ${daysUntilMove === 0 ? "today" : "tomorrow"} — confirm now`
            : `Your move is ${daysUntilMove} days away`;

        const res = await sendEmail({
          to: contact.email,
          subject,
          template: "quote-followup-urgency",
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            moveDate: q.move_date,
            daysUntilMove,
            declineUrl: extras.declineUrl,
            openPixelSrc: extras.openPixelSrc,
          },
        });

        if (res.success) {
          results.urgency++;
          logActivity({
            entity_type: "quote",
            entity_id: q.quote_id,
            event_type: "follow_up_sent",
            description: `Move-date urgency follow-up sent (${daysUntilMove}d to move), ${q.quote_id}`,
            icon: "alert",
          }).catch(() => {});
          if (contact.phone) {
            sendQuoteUrgencySms({
              phone: contact.phone,
              quoteUrl,
              quoteId: q.quote_id,
              firstName,
              daysUntilMove,
            }).catch(() => {});
          }
        } else {
          await supabase.from("quote_followups").delete().eq("id", fuRow.id);
          await supabase.from("quotes").update({ followup_urgency_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`urgency:${q.quote_id}:${res.error}`);
        }
      } catch (err) {
        results.errors.push(`urgency:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── Rule: 48h expiry warning ──────────────────────────────────────────
  // expires_at within 48h, not yet expired, not yet accepted. Fires regardless
  // of which other rules already ran — safety net for quotes that slipped
  // through the cadence.
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const { data: expiryWarnQuotes } = sendsAllowed
    ? await supabase
        .from("quotes")
        .select(
          "id, quote_id, public_action_token, service_type, expires_at, contact_id, contacts:contact_id(name, email, phone)",
        )
        .in("status", ["sent", "viewed"])
        .eq("auto_followup_active", true)
        .is("accepted_at", null)
        .is("followup_expiry_sent", null)
        .gt("expires_at", now.toISOString())
        .lte("expires_at", in48h.toISOString())
        .limit(50)
    : { data: null };

  if (expiryWarnQuotes) {
    for (const q of expiryWarnQuotes) {
      const contactRaw = q.contacts as
        | { name: string; email: string | null; phone?: string | null }
        | { name: string; email: string | null; phone?: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email || !q.expires_at) continue;

      try {
        const { data: claimed } = await supabase
          .from("quotes")
          .update({ followup_expiry_sent: now.toISOString() })
          .eq("quote_id", q.quote_id)
          .is("followup_expiry_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const internalId = (q as { id: string }).id;
        const token = (q as { public_action_token?: string | null }).public_action_token;
        const { data: fuRow, error: fuErr } = await supabase
          .from("quote_followups")
          .insert({ quote_id: internalId, type: "expiry_warning" })
          .select("id")
          .single();
        if (fuErr || !fuRow?.id) {
          await supabase.from("quotes").update({ followup_expiry_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`expiry:${q.quote_id}:followup_row`);
          continue;
        }

        const hoursUntilExpiry = Math.max(
          0,
          Math.ceil((new Date(q.expires_at).getTime() - now.getTime()) / 3_600_000),
        );
        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";
        const extras = followupEmailExtras(baseUrl, q.quote_id, token, fuRow.id);

        const res = await sendEmail({
          to: contact.email,
          subject: `Your Yugo quote expires soon`,
          template: "quote-followup-expiry-warning",
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            expiresAt: q.expires_at,
            hoursUntilExpiry,
            declineUrl: extras.declineUrl,
            openPixelSrc: extras.openPixelSrc,
          },
        });

        if (res.success) {
          results.expiryWarning++;
          logActivity({
            entity_type: "quote",
            entity_id: q.quote_id,
            event_type: "follow_up_sent",
            description: `Expiry warning sent (${hoursUntilExpiry}h to expiry), ${q.quote_id}`,
            icon: "clock",
          }).catch(() => {});
          if (contact.phone) {
            sendQuoteExpiryWarningSms({
              phone: contact.phone,
              quoteUrl,
              quoteId: q.quote_id,
              firstName,
              hoursUntilExpiry,
            }).catch(() => {});
          }
        } else {
          await supabase.from("quote_followups").delete().eq("id", fuRow.id);
          await supabase.from("quotes").update({ followup_expiry_sent: null }).eq("quote_id", q.quote_id);
          results.errors.push(`expiry:${q.quote_id}:${res.error}`);
        }
      } catch (err) {
        results.errors.push(`expiry:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  // ── Hot-quote coordinator alert ───────────────────────────────────────
  // Counts distinct page_view events from quote_engagement. ≥3 views and no
  // prior alert → notify admins so a real coordinator can call. Idempotent
  // via coordinator_alerted_at. Runs regardless of business hours (admin-only).
  const { data: candidateHot } = await supabase
    .from("quotes")
    .select(
      "id, quote_id, service_type, move_date, custom_price, hubspot_deal_id, contact_id, contacts:contact_id(name, email)",
    )
    .in("status", ["viewed"])
    .eq("auto_followup_active", true)
    .is("accepted_at", null)
    .is("coordinator_alerted_at", null)
    .limit(100);

  for (const q of candidateHot ?? []) {
    try {
      const { count: views } = await supabase
        .from("quote_engagement")
        .select("id", { count: "exact", head: true })
        .eq("quote_id", q.id)
        .eq("event_type", "page_view");
      if (!views || views < 3) continue;

      const { data: claimed } = await supabase
        .from("quotes")
        .update({ coordinator_alerted_at: now.toISOString() })
        .eq("id", q.id)
        .is("coordinator_alerted_at", null)
        .select("quote_id");
      if (!claimed?.length) continue;

      const contactRaw = q.contacts as
        | { name: string; email: string | null }
        | { name: string; email: string | null }[]
        | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      const contactEmail = (contact?.email || "").trim();
      const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
      const priceText =
        q.custom_price != null
          ? `$${Number(q.custom_price).toLocaleString()}`
          : "price TBD";
      const moveText = q.move_date
        ? `move ${new Date(q.move_date).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}`
        : "no move date";

      await notifyAdmins("quote_hot", {
        quoteId: q.quote_id,
        sourceId: q.id,
        description: `${q.quote_id} viewed ${views} times by ${contact?.name || "client"}. ${serviceLabel} · ${priceText} · ${moveText}. Consider a personal call.`,
        clientName: contact?.name ?? undefined,
        excludeRecipientEmails: contactEmail ? [contactEmail.toLowerCase()] : [],
      }).catch(() => {});

      if (q.hubspot_deal_id) {
        await createHubSpotTask(
          q.hubspot_deal_id,
          `Hot quote ${q.quote_id} — ${views} views, no booking`,
          `${contact?.name || "Client"} has viewed quote ${q.quote_id} ${views} times without booking. Engagement signals a real decision is being made — consider a 2-minute personal call.`,
        );
      }

      results.hotFlagged++;
    } catch (err) {
      results.errors.push(`hot:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const { data: expiredQuotes } = await supabase
    .from("quotes")
    .select("quote_id, hubspot_deal_id")
    .lt("expires_at", now.toISOString())
    .in("status", statusNotAcceptedOrExpired);

  if (expiredQuotes && expiredQuotes.length > 0) {
    const expiredIds = expiredQuotes.map((q) => q.quote_id);
    await supabase
      .from("quotes")
      .update({ status: "expired", updated_at: now.toISOString() })
      .in("quote_id", expiredIds);
    results.expired = expiredIds.length;
    for (const q of expiredQuotes) {
      const hid = (q as { hubspot_deal_id?: string | null }).hubspot_deal_id;
      if (hid) syncDealStage(hid, "expired").catch(() => {});
    }
  }

  if (results.errors.length > 0) {
    Promise.resolve(
      supabase.from("webhook_logs").insert({
        source: "cron_quote_followups",
        event_type: "partial_failure",
        payload: results,
        status: "error",
        error: results.errors.join("; ").slice(0, 500),
      }),
    ).catch(() => {});
  }

  // Structured run summary — shows up as a single grep-able line in Vercel logs.
  console.log(
    "[quote-followups]",
    JSON.stringify({
      ts: now.toISOString(),
      sendsAllowed,
      f1: results.followup1,
      f2: results.followup2,
      f3: results.followup3,
      urgency: results.urgency,
      expiryWarning: results.expiryWarning,
      hotFlagged: results.hotFlagged,
      expired: results.expired,
      coldMarked: results.coldMarked,
      errorCount: results.errors.length,
    }),
  );

  return results;
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail, type TemplateName } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getFeatureConfig } from "@/lib/platform-settings";
import { sendQuoteFollowupSms } from "@/lib/quote-sms";

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
  quoteUuid: string,
): Promise<EngagementSummary> {
  const { data: events } = await supabase
    .from("quote_engagement")
    .select("event_type, event_data, session_duration_seconds")
    .eq("quote_id", quoteUuid);

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
      const tierLabel: Record<string, string> = { curated: "Curated", signature: "Signature", estate: "Estate", essentials: "Curated", premier: "Signature" };
      return {
        subject: `Your ${tierLabel[tier] ?? tier} move is almost booked`,
        template: "quote-followup-2-warm",
        extraData: { tier, addons: eng.addonsSeen },
      };
    }

    if (eng.tierClicked === "curated" || eng.tierClicked === "essentials") {
      return {
        subject: "Quick question about your move",
        template: "quote-followup-2-curated",
        extraData: { tier: "curated" },
      };
    }

    if (eng.maxSessionSeconds < 30 && eng.pageViews <= 1) {
      return {
        subject: "Your Yugo quote quick summary",
        template: "quote-followup-2-cold",
        extraData: { includeInlinePrices: true },
      };
    }

    return {
      subject: "Your date is filling up secure it today",
      template: "quote-followup-2",
      extraData: {},
    };
  }

  if (eng.paymentStarted) {
    return {
      subject: "We saved your spot finish booking",
      template: "quote-followup-3-hot",
      extraData: { tier: eng.tierClicked },
    };
  }

  if (eng.pageViews === 0) {
    return {
      subject: "Did you receive your Yugo quote?",
      template: "quote-followup-3-unseen",
      extraData: {},
    };
  }

  return {
    subject: "Last chance your quote expires tomorrow",
    template: "quote-followup-3",
    extraData: {},
  };
}

/**
 * Vercel Cron: runs daily at 11 AM EST (16:00 UTC).
 * Automated nurture sequence for unbooked quotes.
 *
 * Rule 1: sent + 24hr, not viewed  → reminder email
 * Rule 2: viewed + 48hr, not booked → urgency/smart email + HubSpot task
 * Rule 3: viewed + 5 days, not booked → final follow-up + HubSpot task
 * Rule 4: expired quotes → mark as expired
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const baseUrl = getEmailBaseUrl();
  const now = new Date();

  const cfg = await getFeatureConfig(["auto_followup_enabled", "followup_max_attempts"]);
  const followupEnabled = cfg.auto_followup_enabled === "true";
  const maxAttempts = Math.max(0, parseInt(cfg.followup_max_attempts, 10) || 3);

  const results = {
    followup1: 0,
    followup2: 0,
    followup3: 0,
    expired: 0,
    errors: [] as string[],
    skipped: !followupEnabled,
  };

  const statusNotAcceptedOrExpired = ["draft", "sent", "viewed", "declined"];

  if (!followupEnabled) {
    // Still process expired quotes even when follow-ups are disabled
    const { data: expiredQuotes } = await supabase
      .from("quotes")
      .select("quote_id")
      .lt("expires_at", now.toISOString())
      .in("status", statusNotAcceptedOrExpired);

    if (expiredQuotes && expiredQuotes.length > 0) {
      const expiredIds = expiredQuotes.map((q) => q.quote_id);
      await supabase
        .from("quotes")
        .update({ status: "expired", updated_at: now.toISOString() })
        .in("quote_id", expiredIds);
      results.expired = expiredIds.length;
    }

    return NextResponse.json({ ok: true, ...results });
  }

  const dryRun = req.nextUrl.searchParams.get("dry_run") === "1";
  if (dryRun) {
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const { count: rule1Count } = await supabase
      .from("quotes")
      .select("quote_id", { count: "exact", head: true })
      .eq("status", "sent")
      .lt("sent_at", cutoff24h)
      .is("viewed_at", null)
      .is("followup_1_sent", null);
    const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const { count: rule2Count } = maxAttempts >= 2
      ? await supabase
          .from("quotes")
          .select("quote_id", { count: "exact", head: true })
          .eq("status", "viewed")
          .lt("viewed_at", cutoff48h)
          .is("accepted_at", null)
          .is("followup_2_sent", null)
      : { count: 0 };
    const cutoff5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
    const { count: rule3Count } = maxAttempts >= 3
      ? await supabase
          .from("quotes")
          .select("quote_id", { count: "exact", head: true })
          .in("status", ["viewed", "sent"])
          .lt("viewed_at", cutoff5d)
          .is("accepted_at", null)
          .is("followup_3_sent", null)
      : { count: 0 };
    return NextResponse.json({
      ok: true,
      dry_run: true,
      auto_followup_enabled: followupEnabled,
      followup_max_attempts: maxAttempts,
      would_send: { followup1: rule1Count ?? 0, followup2: rule2Count ?? 0, followup3: rule3Count ?? 0 },
    });
  }

  /* ═════════════════════════════════════════════════
     RULE 1 — Sent + 24hr, not viewed (counts as attempt 1)
     ═════════════════════════════════════════════════ */
  const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

  const { data: rule1Quotes } = await supabase
    .from("quotes")
    .select("quote_id, service_type, contact_id, contacts:contact_id(name, email, phone)")
    .eq("status", "sent")
    .lt("sent_at", cutoff24h)
    .is("viewed_at", null)
    .is("followup_1_sent", null)
    .limit(50);

  if (rule1Quotes) {
    for (const q of rule1Quotes) {
      const contactRaw = q.contacts as { name: string; email: string | null; phone?: string | null } | { name: string; email: string | null; phone?: string | null }[] | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        // Claim this quote so only one cron invocation sends (avoids duplicate emails if cron runs multiple times)
        const { data: claimed } = await supabase
          .from("quotes")
          .update({ followup_1_sent: now.toISOString() })
          .eq("quote_id", q.quote_id)
          .is("followup_1_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";

        const res = await sendEmail({
          to: contact.email,
          subject: `Just checking in your Yugo quote is ready`,
          template: "quote-followup-1",
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
          },
        });

        if (res.success) {
          results.followup1++;
        } else {
          results.errors.push(`f1:${q.quote_id}:${res.error}`);
        }

        // Also send SMS follow-up
        if (contact.phone) {
          sendQuoteFollowupSms({
            phone: contact.phone,
            quoteUrl,
            quoteId: q.quote_id,
            firstName,
            serviceType: q.service_type,
            followupNumber: 1,
          }).catch(() => {});
        }
      } catch (err) {
        results.errors.push(`f1:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /* ═════════════════════════════════════════════════
     RULE 2 — Viewed + 48hr, not booked (attempt 2)
     ═════════════════════════════════════════════════ */
  const cutoff48h = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();

  const { data: rule2Quotes } = maxAttempts >= 2
    ? await supabase
        .from("quotes")
        .select("id, quote_id, service_type, move_date, expires_at, tiers, custom_price, hubspot_deal_id, contact_id, contacts:contact_id(name, email, phone)")
        .eq("status", "viewed")
        .lt("viewed_at", cutoff48h)
        .is("accepted_at", null)
        .is("followup_2_sent", null)
        .limit(50)
    : { data: null };

  if (rule2Quotes) {
    for (const q of rule2Quotes) {
      const contactRaw = q.contacts as { name: string; email: string | null; phone?: string | null } | { name: string; email: string | null; phone?: string | null }[] | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        const eng = await getEngagementSummary(supabase, q.quote_id);
        const variant = chooseFollowUpVariant(2, eng);

        // Claim this quote so only one cron invocation sends (avoids duplicate emails if cron runs multiple times)
        const { data: claimed } = await supabase
          .from("quotes")
          .update({
            followup_2_sent: now.toISOString(),
            engagement_summary: eng,
          })
          .eq("quote_id", q.quote_id)
          .is("followup_2_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";

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
            ...variant.extraData,
          },
        });

        if (res.success) {
          results.followup2++;
        } else {
          results.errors.push(`f2:${q.quote_id}:${res.error}`);
        }

        // SMS follow-up alongside email
        if (contact.phone) {
          sendQuoteFollowupSms({
            phone: contact.phone,
            quoteUrl,
            quoteId: q.quote_id,
            firstName,
            serviceType: q.service_type,
            followupNumber: 2,
            expiresAt: q.expires_at,
          }).catch(() => {});
        }

        if (q.hubspot_deal_id) {
          await createHubSpotTask(
            q.hubspot_deal_id,
            `Follow up: ${contact.name || "Client"} — ${eng.tierClicked ? `explored ${eng.tierClicked}` : "viewed"}`,
            `Quote ${q.quote_id} was viewed 48+ hours ago. Engagement: ${eng.paymentStarted ? "started payment" : eng.contractViewed ? "viewed contract" : eng.tierClicked ? `clicked ${eng.tierClicked} tier` : "browsed briefly"}. ${eng.maxSessionSeconds}s max session.`,
          );
        }
      } catch (err) {
        results.errors.push(`f2:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /* ═════════════════════════════════════════════════
     RULE 3 — Viewed + 5 days, not booked
     ═════════════════════════════════════════════════ */
  const cutoff5d = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();

  const { data: rule3Quotes } = maxAttempts >= 3
    ? await supabase
        .from("quotes")
        .select("id, quote_id, service_type, expires_at, hubspot_deal_id, contact_id, contacts:contact_id(name, email, phone)")
        .in("status", ["viewed", "sent"])
        .lt("viewed_at", cutoff5d)
        .is("accepted_at", null)
        .is("followup_3_sent", null)
        .limit(50)
    : { data: null };

  if (rule3Quotes) {
    for (const q of rule3Quotes) {
      const contactRaw = q.contacts as { name: string; email: string | null; phone?: string | null } | { name: string; email: string | null; phone?: string | null }[] | null;
      const contact = Array.isArray(contactRaw) ? contactRaw[0] ?? null : contactRaw;
      if (!contact?.email) continue;

      try {
        const eng = await getEngagementSummary(supabase, q.quote_id);
        const variant = chooseFollowUpVariant(3, eng);

        // Claim this quote so only one cron invocation sends (avoids duplicate emails if cron runs multiple times)
        const { data: claimed } = await supabase
          .from("quotes")
          .update({
            followup_3_sent: now.toISOString(),
            engagement_summary: eng,
          })
          .eq("quote_id", q.quote_id)
          .is("followup_3_sent", null)
          .select("quote_id");
        if (!claimed?.length) continue;

        const quoteUrl = `${baseUrl}/quote/${q.quote_id}`;
        const serviceLabel = SERVICE_LABELS[q.service_type] ?? q.service_type;
        const firstName = contact.name ? contact.name.split(" ")[0] : "";

        const res = await sendEmail({
          to: contact.email,
          subject: variant.subject,
          template: variant.template,
          data: {
            clientName: contact.name || "",
            quoteUrl,
            serviceLabel,
            expiresAt: q.expires_at,
            ...variant.extraData,
          },
        });

        if (res.success) {
          results.followup3++;
        } else {
          results.errors.push(`f3:${q.quote_id}:${res.error}`);
        }

        // SMS final follow-up
        if (contact.phone) {
          sendQuoteFollowupSms({
            phone: contact.phone,
            quoteUrl,
            quoteId: q.quote_id,
            firstName,
            serviceType: q.service_type,
            followupNumber: 3,
            expiresAt: q.expires_at,
          }).catch(() => {});
        }

        if (q.hubspot_deal_id) {
          await createHubSpotTask(
            q.hubspot_deal_id,
            `URGENT: Final follow-up — ${eng.paymentStarted ? "payment was started" : "quote expiring"}`,
            `Quote ${q.quote_id} for ${contact.name || "client"} expires soon. Engagement level: ${eng.paymentStarted ? "HOT (started payment)" : eng.contractViewed ? "WARM (viewed contract)" : eng.tierClicked ? "ENGAGED (browsed tiers)" : "COLD"}. Personal outreach recommended.`,
          );
        }
      } catch (err) {
        results.errors.push(`f3:${q.quote_id}:${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  /* ═════════════════════════════════════════════════
     RULE 4 — Expired quotes
     ═════════════════════════════════════════════════ */
  const { data: expiredQuotes } = await supabase
    .from("quotes")
    .select("quote_id")
    .lt("expires_at", now.toISOString())
    .in("status", statusNotAcceptedOrExpired);

  if (expiredQuotes && expiredQuotes.length > 0) {
    const expiredIds = expiredQuotes.map((q) => q.quote_id);
    await supabase
      .from("quotes")
      .update({ status: "expired", updated_at: now.toISOString() })
      .in("quote_id", expiredIds);
    results.expired = expiredIds.length;
  }

  /* ── Log errors ── */
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

  return NextResponse.json({
    ok: true,
    followup1: results.followup1,
    followup2: results.followup2,
    followup3: results.followup3,
    expired: results.expired,
    errors: results.errors.length,
  });
}

/* ── HubSpot Task Creation ── */

async function createHubSpotTask(
  dealId: string,
  subject: string,
  body: string,
): Promise<void> {
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
      body: JSON.stringify([
        { associationCategory: "HUBSPOT_DEFINED", associationTypeId: 204 },
      ]),
    });
  } catch {
    // HubSpot task failures are non-critical
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { sendQuoteLinkSms } from "@/lib/quote-sms";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder";

/**
 * POST /api/admin/quotes/[quoteId]/details
 *
 * Metadata-only edit for quotes that are priced OUTSIDE the move engine
 * (event, specialty, white glove, B2B, bin). Those quotes carry a fixed
 * custom_price that the edit form can't safely re-run, so the form used to
 * block ALL edits — even a simple date change. This patches the logistics
 * fields (date, addresses, access, arrival window, coordinator) in place
 * WITHOUT touching pricing, keeps the client-facing event date in sync, and
 * optionally re-sends the updated quote to the client (email + SMS).
 */
const SERVICE_LABELS: Record<string, string> = {
  local_move: "Residential Move",
  long_distance: "Long Distance Move",
  office_move: "Office Relocation",
  single_item: "Single Item Delivery",
  white_glove: "White Glove Service",
  specialty: "Specialty Service",
  event: "Event Logistics",
  labour_only: "Labour Service",
  b2b_delivery: "Commercial Delivery",
  b2b_oneoff: "Commercial Delivery",
  bin_rental: "Bin Rental",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const { quoteId } = await params;
  if (!quoteId) return NextResponse.json({ error: "quoteId required" }, { status: 400 });

  let body: {
    move_date?: string;
    from_address?: string;
    to_address?: string;
    from_access?: string;
    to_access?: string;
    arrival_window?: string;
    preferred_time?: string;
    coordinator_name?: string;
    reason?: string;
    reason_code?: string | null;
    resend?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: q, error } = await admin
    .from("quotes")
    .select("*, contacts:contact_id(name, email, phone)")
    .eq("quote_id", quoteId)
    .single();
  if (error || !q) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  // Re-sending requires a reason (client sees it, same as the re-quote flow).
  if (body.resend && (!body.reason || body.reason.trim().length < 3)) {
    return NextResponse.json(
      { error: "Pick a reason for the update — the client sees it in the email." },
      { status: 400 },
    );
  }

  // ── Build the patch from only the fields that actually changed ──
  const patch: Record<string, unknown> = {};
  const changes: string[] = [];
  const norm = (v: unknown) => String(v ?? "").trim();
  const setIf = (col: string, val: string | undefined, label?: string) => {
    if (val === undefined) return;
    if (norm(val) === norm((q as Record<string, unknown>)[col])) return;
    patch[col] = val.trim() || null;
    if (label) changes.push(label);
  };

  setIf("move_date", body.move_date, body.move_date ? `Date changed to ${body.move_date}` : undefined);
  setIf("from_address", body.from_address, "Origin address updated");
  setIf("to_address", body.to_address, "Destination / venue updated");
  setIf("from_access", body.from_access);
  setIf("to_access", body.to_access);
  setIf("arrival_window", body.arrival_window);
  setIf("preferred_time", body.preferred_time);

  // ── factors_applied: coordinator + keep the event/client-facing date in sync ──
  const factors = { ...((q.factors_applied ?? {}) as Record<string, unknown>) };
  let factorsChanged = false;
  if (
    body.coordinator_name !== undefined &&
    norm(body.coordinator_name) !== norm(factors.coordinator_name)
  ) {
    factors.coordinator_name = body.coordinator_name.trim() || null;
    factorsChanged = true;
    changes.push("Coordinator updated");
  }
  // The event client page reads factors.delivery_date (falling back to move_date),
  // so a date change must update it too or the client would still show the old day.
  if (patch.move_date) {
    const newDate = String(patch.move_date);
    if (factors.delivery_date) {
      factors.delivery_date = newDate;
      factorsChanged = true;
    }
    // Single-leg events keep the first leg's delivery date aligned; multi-leg
    // date edits belong in the Generate flow, so leave 2+ legs untouched.
    if (Array.isArray(factors.event_legs) && factors.event_legs.length === 1) {
      const leg = { ...(factors.event_legs[0] as Record<string, unknown>) };
      leg.delivery_date = newDate;
      factors.event_legs = [leg];
      factorsChanged = true;
    }
  }
  if (factorsChanged) patch.factors_applied = factors;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ ok: true, unchanged: true, changes: [] });
  }

  patch.version = (Number(q.version) || 1) + 1;
  patch.updated_at = new Date().toISOString();

  const { error: upErr } = await admin.from("quotes").update(patch).eq("quote_id", quoteId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Best-effort activity log (never fails the request).
  try {
    await admin.from("quote_events").insert({
      quote_id: quoteId,
      event_type: "quote_updated",
      metadata: {
        changes,
        reason: body.reason ?? null,
        reason_code: body.reason_code ?? null,
        pricing_touched: false,
      },
    });
  } catch {
    /* ignore */
  }

  // ── HubSpot deal: keep the move date + addresses in lockstep (best-effort) ──
  const dealId = (q as { hubspot_deal_id?: string | null }).hubspot_deal_id;
  const hsToken = process.env.HUBSPOT_ACCESS_TOKEN;
  const contactRaw = q.contacts as
    | { name?: string | null; email?: string | null; phone?: string | null }
    | { name?: string | null; email?: string | null; phone?: string | null }[]
    | null;
  const contactRow = Array.isArray(contactRaw) ? (contactRaw[0] ?? null) : contactRaw;
  const fullName = (contactRow?.name || "").trim();
  const nameParts = fullName.split(/\s+/);
  if (dealId && hsToken) {
    const dealProps = buildAllDealProperties({
      jobId: quoteId,
      firstName: nameParts[0] ?? "",
      lastName: nameParts.slice(1).join(" "),
      fromAddress: String(patch.from_address ?? q.from_address ?? "") || undefined,
      toAddress: String(patch.to_address ?? q.to_address ?? "") || undefined,
      fromAccess: String(patch.from_access ?? q.from_access ?? "") || undefined,
      toAccess: String(patch.to_access ?? q.to_access ?? "") || undefined,
      serviceType: q.service_type ?? undefined,
      moveDate: String(patch.move_date ?? q.move_date ?? "") || undefined,
      moveSize: q.move_size ?? undefined,
      isPmMove: false,
    });
    safePatchDeal(hsToken, dealId, dealProps).catch(() => {});
  }

  // ── Optional re-send to the client ──
  let sent = false;
  if (body.resend) {
    const email = contactRow?.email;
    const phone = contactRow?.phone ?? null;
    const firstName = fullName ? fullName.split(/\s+/)[0]!.trim() : "";
    if (email) {
      const baseUrl = getEmailBaseUrl();
      const quoteUrl = `${baseUrl}/quote/${quoteId}`;
      const changesSummary = changes.length > 0 ? changes.join("<br/>") : "Quote details updated.";
      const subject = firstName
        ? `${firstName}, your updated quote is ready ${quoteId}`
        : `Your updated quote is ready ${quoteId}`;
      const mail = await sendEmail({
        to: email,
        subject,
        template: "quote-updated",
        data: {
          clientName: fullName,
          quoteUrl,
          serviceLabel: SERVICE_LABELS[q.service_type] ?? q.service_type,
          changesSummary,
        },
      });
      if (mail.success) {
        await sendQuoteLinkSms({
          phone,
          quoteId,
          firstName,
          serviceType: q.service_type,
          eventName: (factors.event_name as string) ?? null,
        }).catch(() => ({ ok: false }));
        await admin
          .from("quotes")
          .update({ status: "sent", sent_at: new Date().toISOString(), quote_url: quoteUrl })
          .eq("quote_id", quoteId);
        sent = true;
      } else {
        return NextResponse.json(
          { ok: true, saved: true, sent: false, error: "Saved, but the client email failed to send.", changes },
          { status: 200 },
        );
      }
    }
  }

  return NextResponse.json({ ok: true, saved: true, sent, changes, version: patch.version });
}

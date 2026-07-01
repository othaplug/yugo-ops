import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { isSuperAdminEmail, requireStaff } from "@/lib/api-auth";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { scheduleWinBackEmail } from "@/lib/quotes/win-back";

const PIPELINE_STATUSES = new Set([
  "draft",
  "sent",
  "viewed",
  "accepted",
  "expired",
  "declined",
  "superseded",
  "reactivated",
  "cold",
  "lost",
  "payment_failed",
]);

/**
 * PATCH /api/admin/quotes/[quoteId] — coordinator status & nurture controls (UUID).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Quote id required" }, { status: 400 });
  }

  const body = (await req.json()) as {
    status?: string;
    auto_followup_active?: boolean;
    loss_reason?: string | null;
    cold_reason?: string | null;
    /** ISO 8601 timestamp. Set when the coordinator extends the
     *  quote's expiry from the engagement banner on the detail page. */
    expires_at?: string;
  };

  const admin = createAdminClient();
  const { data: quote, error: fetchErr } = await admin
    .from("quotes")
    .select("id, quote_id, status, hubspot_deal_id")
    .eq("id", quoteId)
    .single();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const prevStatus = (quote.status || "").toLowerCase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.auto_followup_active === "boolean") {
    patch.auto_followup_active = body.auto_followup_active;
  }

  // Expiry extension. Only accept future ISO timestamps so the
  // banner's "Extend by N days" action can't accidentally write a
  // value in the past. When the operator reopens an already-expired
  // quote we also flip status from 'expired' back to 'sent' so the
  // pipeline reflects the new state.
  if (typeof body.expires_at === "string" && body.expires_at.trim()) {
    const next = new Date(body.expires_at.trim());
    if (Number.isNaN(next.getTime())) {
      return NextResponse.json(
        { error: "Invalid expires_at timestamp" },
        { status: 400 },
      );
    }
    if (next.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: "expires_at must be in the future" },
        { status: 400 },
      );
    }
    patch.expires_at = next.toISOString();
    if (prevStatus === "expired") {
      patch.status = "sent";
    }
  }

  if (body.status !== undefined) {
    const next = String(body.status || "").trim().toLowerCase();
    if (!PIPELINE_STATUSES.has(next)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    if (next === "accepted" && quote.status !== "accepted") {
      return NextResponse.json(
        { error: "Use the booking flow to mark a quote accepted" },
        { status: 400 },
      );
    }
    patch.status = next;

    if (next === "lost") {
      patch.lost_at = new Date().toISOString();
      patch.auto_followup_active = false;
      patch.loss_reason =
        typeof body.loss_reason === "string" && body.loss_reason.trim()
          ? body.loss_reason.trim()
          : null;
      const hid = quote.hubspot_deal_id?.trim();
      if (hid) syncDealStage(hid, "lost").catch(() => {});
    }

    if (next === "cold") {
      patch.went_cold_at = new Date().toISOString();
      patch.auto_followup_active = false;
      patch.cold_reason =
        typeof body.cold_reason === "string" && body.cold_reason.trim()
          ? body.cold_reason.trim()
          : "coordinator_marked";
      const hid = quote.hubspot_deal_id?.trim();
      if (hid) syncDealStage(hid, "cold").catch(() => {});
    }

    if (prevStatus === "cold" && next !== "cold") {
      patch.cold_reason = null;
      patch.went_cold_at = null;
    }
    if (prevStatus === "lost" && next !== "lost") {
      patch.loss_reason = null;
      patch.lost_at = null;
    }
  }

  const { error: upErr } = await admin.from("quotes").update(patch).eq("id", quoteId);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  if (body.status !== undefined) {
    const next = String(body.status || "").trim().toLowerCase();
    if (next === "lost") {
      const lr =
        typeof body.loss_reason === "string" && body.loss_reason.trim()
          ? body.loss_reason.trim()
          : null;
      await scheduleWinBackEmail(admin, quoteId, lr).catch(() => {});
    }
  }

  // When the operator extends expiry from the engagement banner,
  // also fire a nurture email so the client knows the quote is
  // still active. Non-blocking -- if email send fails the extend
  // itself still succeeds. Only fires when the sole change is the
  // expiry extension (not part of a bulk status update).
  if (
    typeof body.expires_at === "string" &&
    body.expires_at.trim() &&
    body.status === undefined
  ) {
    void sendExtendedExpiryNurtureEmail(
      admin,
      quoteId,
      String(patch.expires_at),
    ).catch((err) => {
      console.warn("[extend-expiry nurture email]", err?.message ?? err);
    });
  }

  return NextResponse.json({ ok: true });
}

/** Sends a one-off "we've extended your quote" email to the client
 *  contact. Reuses the platform email base URL so the CTA lands on
 *  the same client quote page the operator's banner extended. */
async function sendExtendedExpiryNurtureEmail(
  admin: ReturnType<typeof createAdminClient>,
  quoteInternalId: string,
  newExpiresAt: string,
): Promise<void> {
  const { data: quote } = await admin
    .from("quotes")
    .select("quote_id, contact_id, service_type")
    .eq("id", quoteInternalId)
    .maybeSingle();
  if (!quote) return;
  const contactId = (quote as { contact_id?: string | null }).contact_id;
  if (!contactId) return;
  const { data: contact } = await admin
    .from("contacts")
    .select("name, email")
    .eq("id", contactId)
    .maybeSingle();
  const email = (contact as { email?: string | null } | null)?.email?.trim();
  if (!email) return;
  const first =
    ((contact as { name?: string | null } | null)?.name ?? "").split(" ")[0] ||
    "there";
  const url = `${getEmailBaseUrl()}/quote/${(quote as { quote_id: string }).quote_id}`;
  const newDate = new Date(newExpiresAt).toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Toronto",
  });
  const subject = `${first}, your Yugo quote is still active (${(quote as { quote_id: string }).quote_id})`;
  const html = `
    <div style="font-family: Georgia, 'Times New Roman', serif; max-width: 560px; margin: 0 auto; padding: 32px 24px; color: #2c1a1a;">
      <h1 style="font-size: 24px; margin: 0 0 16px; font-weight: 400;">Hi ${first},</h1>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 20px;">
        Just a note that we've extended your Yugo quote so you have more time
        to review the details. Your new expiry is <strong>${newDate}</strong>.
      </p>
      <p style="font-size: 14px; line-height: 1.7; margin: 0 0 24px;">
        If you have questions or want to talk through the packages, reply to
        this email or give me a call — happy to help.
      </p>
      <p style="margin: 0 0 24px;">
        <a href="${url}" style="background: #4a1f1f; color: #ffffff; padding: 12px 22px; text-decoration: none; border-radius: 4px; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;">View your quote</a>
      </p>
      <p style="font-size: 12px; color: #7a6767; line-height: 1.6; margin: 24px 0 0;">
        Not the right time? Simply reply and let us know — we'll pause
        follow-ups.
      </p>
    </div>`;
  await sendEmail({ to: email, subject, html });
}

/**
 * DELETE /api/admin/quotes/[quoteId]
 * Hard-delete by UUID (quotes.id). Staff: drafts only. Superadmin: also sent/viewed/expired/declined/superseded.
 * Never deletes accepted quotes or any quote linked to a move.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> }
) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const { quoteId } = await params;
  if (!quoteId) {
    return NextResponse.json({ error: "Quote ID required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error: fetchErr } = await admin
    .from("quotes")
    .select("id, status, quote_id, hubspot_deal_id")
    .eq("id", quoteId)
    .single();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const status = (quote.status as string) || "";
  const superAdmin = isSuperAdminEmail(user?.email);

  if (!quoteStatusAllowsHardDelete(status, superAdmin)) {
    const msg = superAdmin
      ? "This quote cannot be deleted (e.g. accepted or unknown status)."
      : "Only draft quotes can be deleted. Superadmin can remove sent quotes that are not accepted.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const { data: moveRow } = await admin.from("moves").select("id").eq("quote_id", quoteId).maybeSingle();
  if (moveRow) {
    return NextResponse.json(
      { error: "Cannot delete a quote that has a linked move. Remove or reassign the move first." },
      { status: 400 },
    );
  }

  const { error: deleteErr } = await admin.from("quotes").delete().eq("id", quoteId);

  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message || "Failed to delete quote" },
      { status: 500 }
    );
  }

  const hid = (quote.hubspot_deal_id as string | null)?.trim();
  if (hid) syncDealStage(hid, "lost").catch(() => {});

  return NextResponse.json({ ok: true });
}

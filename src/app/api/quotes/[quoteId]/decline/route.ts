import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { scheduleWinBackEmail } from "@/lib/quotes/win-back";

const DECLINE_REASON_LABEL: Record<string, string> = {
  found_another: "Found another company",
  postponed: "Move postponed or cancelled",
  budget: "Over budget",
  diy: "Decided to move themselves",
  other: "Other",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ quoteId: string }> },
) {
  try {
    const { quoteId } = await params;
    if (!quoteId?.trim()) {
      return NextResponse.json({ error: "Invalid quote" }, { status: 400 });
    }

    const body = (await req.json()) as {
      reason?: string;
      comment?: string | null;
      token?: string | null;
    };
    const reason = (body.reason || "").trim();
    const comment = typeof body.comment === "string" ? body.comment.trim() : "";
    const token = (body.token || "").trim();

    if (!reason) {
      return NextResponse.json({ error: "Reason is required" }, { status: 400 });
    }
    if (!token) {
      return NextResponse.json({ error: "Invalid" }, { status: 403 });
    }

    const sb = createAdminClient();
    const { data: quote, error: qErr } = await sb
      .from("quotes")
      .select("id, quote_id, public_action_token, status, hubspot_deal_id, contact_id, contacts:contact_id(name, email)")
      .eq("quote_id", quoteId.trim())
      .single();

    if (qErr || !quote) {
      return NextResponse.json({ error: "Invalid" }, { status: 403 });
    }

    const stored = (quote as { public_action_token?: string | null }).public_action_token?.trim();
    if (!stored || stored !== token) {
      return NextResponse.json({ error: "Invalid" }, { status: 403 });
    }

    const st = ((quote as { status?: string }).status || "").toLowerCase();
    if (st === "accepted" || st === "declined" || st === "lost" || st === "superseded") {
      return NextResponse.json({ error: "Quote cannot be declined" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const { error: upErr } = await sb
      .from("quotes")
      .update({
        status: "declined",
        decline_reason: reason,
        decline_comment: comment || null,
        declined_at: now,
        auto_followup_active: false,
        updated_at: now,
      })
      .eq("id", (quote as { id: string }).id);

    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }

    const hid = (quote as { hubspot_deal_id?: string | null }).hubspot_deal_id;
    if (hid) {
      await syncDealStage(hid, "declined").catch(() => {});
    }

    const contactRaw = (quote as {
      contacts?: { name?: string; email?: string | null } | { name?: string; email?: string | null }[];
    }).contacts;
    const contactOne = Array.isArray(contactRaw) ? contactRaw[0] : contactRaw;
    const contactName = contactOne?.name;
    const contactEmail = (contactOne?.email || "").trim();
    const reasonLabel = DECLINE_REASON_LABEL[reason] ?? reason;

    await notifyAdmins("quote_declined", {
      quoteId,
      sourceId: (quote as { id: string }).id,
      description: `${quoteId}: ${reasonLabel}${comment ? ` — ${comment}` : ""}`,
      clientName: contactName ?? undefined,
      excludeRecipientEmails: contactEmail ? [contactEmail.toLowerCase()] : [],
    }).catch(() => {});

    await scheduleWinBackEmail(sb, (quote as { id: string }).id, reason).catch(() => {});

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed" },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail, requireStaff } from "@/lib/api-auth";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";
import { syncDealStage } from "@/lib/hubspot/sync-deal-stage";

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
]);

/**
 * PATCH /api/admin/quotes/[id] — coordinator status & nurture controls (UUID).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Quote id required" }, { status: 400 });
  }

  const body = (await req.json()) as {
    status?: string;
    auto_followup_active?: boolean;
    loss_reason?: string | null;
    cold_reason?: string | null;
  };

  const admin = createAdminClient();
  const { data: quote, error: fetchErr } = await admin
    .from("quotes")
    .select("id, quote_id, status, hubspot_deal_id")
    .eq("id", id)
    .single();

  if (fetchErr || !quote) {
    return NextResponse.json({ error: "Quote not found" }, { status: 404 });
  }

  const prevStatus = (quote.status || "").toLowerCase();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if (typeof body.auto_followup_active === "boolean") {
    patch.auto_followup_active = body.auto_followup_active;
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

  const { error: upErr } = await admin.from("quotes").update(patch).eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/quotes/[id]
 * Hard-delete by UUID (quotes.id). Staff: drafts only. Superadmin: also sent/viewed/expired/declined/superseded.
 * Never deletes accepted quotes or any quote linked to a move.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, error } = await requireStaff();
  if (error) return error;

  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Quote ID required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: quote, error: fetchErr } = await admin
    .from("quotes")
    .select("id, status, quote_id")
    .eq("id", id)
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

  const { data: moveRow } = await admin.from("moves").select("id").eq("quote_id", id).maybeSingle();
  if (moveRow) {
    return NextResponse.json(
      { error: "Cannot delete a quote that has a linked move. Remove or reassign the move first." },
      { status: 400 },
    );
  }

  const { error: deleteErr } = await admin.from("quotes").delete().eq("id", id);

  if (deleteErr) {
    return NextResponse.json(
      { error: deleteErr.message || "Failed to delete quote" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}

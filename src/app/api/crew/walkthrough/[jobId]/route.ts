import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { getDispatchPhone, getAdminNotificationEmail } from "@/lib/config";
import { sendSMS } from "@/lib/sms/sendSMS";
import { normalizePhone } from "@/lib/phone";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { getMoveCode, formatJobId } from "@/lib/move-code";
import {
  buildTruckAssessment,
  formatItemsForStorage,
  scoreForCustomClass,
  summarizePricing,
  type ItemAddedInput,
  type ItemRemovedInput,
} from "@/lib/inventory-change-requests";
import { getFeatureConfig } from "@/lib/platform-settings";

// ─────────────────────────────────────────────────────────────
// POST /api/crew/walkthrough/[jobId]
// Crew submits the inventory walkthrough change request.
// No pricing authority — just flags items and submits.
// ─────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { jobId } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Resolve move by UUID or code
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(jobId);
  let move: Record<string, unknown> | null = null;
  let moveId = jobId;

  if (isUuid) {
    const { data } = await admin.from("moves").select("*").eq("id", jobId).maybeSingle();
    move = data as Record<string, unknown> | null;
  } else {
    const { data } = await admin
      .from("moves")
      .select("*")
      .ilike("move_code", jobId.replace(/^#/, "").toUpperCase())
      .maybeSingle();
    move = data as Record<string, unknown> | null;
  }

  if (!move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  moveId = String(move.id);

  // Verify crew assignment
  if (move.crew_id !== payload.teamId) {
    return NextResponse.json({ error: "This move is not assigned to your team" }, { status: 403 });
  }

  const cfg = await getFeatureConfig(["change_request_per_score_rate"]);
  const perScoreRate = Math.max(1, parseFloat(cfg.change_request_per_score_rate) || 35);

  // Parse added/removed items
  const addedRaw = Array.isArray(body.items_added) ? body.items_added : [];
  const removedRaw = Array.isArray(body.items_removed) ? body.items_removed : [];

  const added: ItemAddedInput[] = addedRaw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => {
      const item_name = String(r.item_name || "").trim();
      const is_custom = !!r.is_custom;
      const weight_score = is_custom
        ? scoreForCustomClass(String(r.custom_weight_class || "medium"))
        : Math.max(0.1, Number(r.weight_score) || 1);
      const quantity = Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1)));
      return { item_name, item_slug: r.item_slug != null ? String(r.item_slug) : null, weight_score, quantity, is_custom, custom_weight_class: is_custom ? String(r.custom_weight_class || "medium") : null };
    })
    .filter((r) => r.item_name);

  const removed: ItemRemovedInput[] = removedRaw
    .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
    .map((r) => ({
      move_inventory_id: String(r.move_inventory_id || "").trim(),
      item_name: String(r.item_name || "").trim(),
      item_slug: r.item_slug != null ? String(r.item_slug) : null,
      weight_score: Math.max(0.1, Number(r.weight_score) || 1),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1))),
    }))
    .filter((r) => r.move_inventory_id && r.item_name);

  // Even if no items changed, we still record the walkthrough completion
  const { addedScore, removedScore, autoDelta } = summarizePricing(added, removed, perScoreRate);
  const invScore = Number(move.inventory_score) || 0;
  const truckAssessment = buildTruckAssessment({
    inventoryScore: invScore,
    truckPrimary: move.truck_primary as string | null,
    addedScore,
    removedScore,
  });

  const { items_added, items_removed } = formatItemsForStorage(added, removed, perScoreRate);
  const originalSubtotal = Number(move.amount) || 0;

  const itemsMatched = Math.max(0, Math.floor(Number(body.items_matched) || 0));
  const itemsMissing = Math.max(0, Math.floor(Number(body.items_missing) || 0));
  const itemsExtra = Math.max(0, Math.floor(Number(body.items_extra) || 0));

  let insertedId: string | null = null;

  if (added.length > 0 || removed.length > 0) {
    const { data: inserted, error: insErr } = await admin
      .from("inventory_change_requests")
      .insert({
        move_id: moveId,
        quote_id: move.quote_id ?? null,
        status: "pending",
        source: "crew",
        move_phase: "at_pickup",
        crew_walkthrough_completed: true,
        items_added,
        items_removed,
        auto_calculated_delta: autoDelta,
        original_subtotal: originalSubtotal,
        new_subtotal: originalSubtotal + autoDelta,
        truck_assessment: truckAssessment,
        items_matched: itemsMatched,
        items_missing: itemsMissing,
        items_extra: itemsExtra,
        submitted_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr || !inserted?.id) {
      return NextResponse.json({ error: insErr?.message || "Failed to create request" }, { status: 500 });
    }

    insertedId = inserted.id;

    // Link on move
    await admin
      .from("moves")
      .update({ pending_inventory_change_request_id: insertedId })
      .eq("id", moveId);
  }

  // Mark walkthrough completed on move
  await admin
    .from("moves")
    .update({
      walkthrough_completed: true,
      walkthrough_completed_at: new Date().toISOString(),
      walkthrough_crew_member: payload.crewMemberId ?? null,
    })
    .eq("id", moveId);

  const moveCode = formatJobId(getMoveCode(move as Parameters<typeof getMoveCode>[0]), "move");
  const baseUrl = getEmailBaseUrl();
  const adminUrl = `${baseUrl}/admin/moves/${encodeURIComponent(moveCode)}`;
  const trackUrl = `${baseUrl}/track/move/${moveId}?token=${signTrackToken("move", moveId)}`;

  // ── Admin SMS (only when there are changes) ──
  if ((added.length > 0 || removed.length > 0) && insertedId) {
    try {
      const phone = await getDispatchPhone();
      const smsBody = `${moveCode}: Crew walkthrough complete. +${added.length} extra / -${removed.length} missing. Net ${autoDelta >= 0 ? "+" : ""}$${autoDelta}. Review: ${adminUrl}`;
      await sendSMS(normalizePhone(phone), smsBody);
    } catch { /* optional */ }

    // ── Admin email ──
    if (process.env.RESEND_API_KEY) {
      try {
        const resend = getResend();
        const to = await getAdminNotificationEmail();
        const emailFrom = await getEmailFrom();
        const extraLines = added.map((a) => `• ${a.item_name} ×${a.quantity} +$${Math.round(a.weight_score * a.quantity * perScoreRate)}`).join("\n");
        const missingLines = removed.map((r) => `• ${r.item_name} ×${r.quantity} -$${Math.round(r.weight_score * r.quantity * perScoreRate)}`).join("\n");
        const html = `<p>Crew walkthrough complete for <strong>${moveCode}</strong> (${String(move.client_name || "Client")}).</p>
${added.length > 0 ? `<p><strong>Extra items found:</strong><br>${extraLines.replace(/\n/g, "<br>")}</p>` : ""}
${removed.length > 0 ? `<p><strong>Missing items:</strong><br>${missingLines.replace(/\n/g, "<br>")}</p>` : ""}
<p><strong>Net change: ${autoDelta >= 0 ? "+" : ""}$${autoDelta}</strong></p>
<p><a href="${adminUrl}">Review in Admin →</a></p>`;
        await resend.emails.send({
          from: emailFrom,
          to,
          subject: `Walkthrough change request — ${moveCode} — ${String(move.client_name || "Client")}`,
          html,
        });
      } catch { /* non-fatal */ }
    }

    // ── Client SMS ──
    try {
      const { data: moveData } = await admin
        .from("moves")
        .select("client_phone, client_name")
        .eq("id", moveId)
        .single();
      if (moveData?.client_phone) {
        const addedSummary = added
          .map((a) => `${a.item_name} ×${a.quantity}`)
          .join(", ");
        const hst = Math.round(autoDelta * 0.13 * 100) / 100;
        const total = Math.round((autoDelta + hst) * 100) / 100;
        const clientSms = `Hi ${moveData.client_name?.split(" ")[0] ?? "there"}, your Yugo crew found items not on your original quote. Additional charge: $${total > 0 ? total.toFixed(2) : "0"} (incl. HST). Review and approve here: ${trackUrl}`;
        await sendSMS(normalizePhone(moveData.client_phone), clientSms);
      }
    } catch { /* optional */ }
  }

  return NextResponse.json({
    ok: true,
    id: insertedId,
    auto_calculated_delta: autoDelta,
    walkthrough_completed: true,
  });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";
import { getFeatureConfig } from "@/lib/platform-settings";
import { getAdminNotificationEmail, getDispatchPhone } from "@/lib/config";
import { getResend } from "@/lib/resend";
import { getEmailFrom } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import {
  buildTruckAssessment,
  formatItemsForStorage,
  scoreForCustomClass,
  summarizePricing,
  type ItemAddedInput,
  type ItemRemovedInput,
} from "@/lib/inventory-change-requests";
import { inventoryChangeRequestAdminEmail } from "@/lib/email-templates";
import { parseDateOnly } from "@/lib/date-format";
import { getMoveCode, formatJobId } from "@/lib/move-code";
import { getEmailBaseUrl } from "@/lib/email-base-url";

const PENDING_STATUSES = ["pending", "admin_reviewing", "client_confirming"];

function parseBodyItems(raw: unknown): { added: ItemAddedInput[]; removed: ItemRemovedInput[]; error?: string } {
  if (!raw || typeof raw !== "object") return { added: [], removed: [], error: "Invalid body" };
  const o = raw as Record<string, unknown>;
  const addedRaw = Array.isArray(o.items_added) ? o.items_added : [];
  const removedRaw = Array.isArray(o.items_removed) ? o.items_removed : [];
  const added: ItemAddedInput[] = [];
  for (const row of addedRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const item_name = String(r.item_name || "").trim();
    if (!item_name) continue;
    const is_custom = !!r.is_custom;
    const weight_score = is_custom
      ? scoreForCustomClass(String(r.custom_weight_class || "medium"))
      : Math.max(0.1, Number(r.weight_score) || 1);
    const quantity = Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1)));
    added.push({
      item_name,
      item_slug: r.item_slug != null ? String(r.item_slug) : null,
      weight_score,
      quantity,
      is_custom,
      custom_weight_class: is_custom ? String(r.custom_weight_class || "medium") : null,
    });
  }
  const removed: ItemRemovedInput[] = [];
  for (const row of removedRaw) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const move_inventory_id = String(r.move_inventory_id || "").trim();
    const item_name = String(r.item_name || "").trim();
    if (!move_inventory_id || !item_name) continue;
    removed.push({
      move_inventory_id,
      item_name,
      item_slug: r.item_slug != null ? String(r.item_slug) : null,
      weight_score: Math.max(0.1, Number(r.weight_score) || 1),
      quantity: Math.max(1, Math.min(99, Math.floor(Number(r.quantity) || 1))),
    });
  }
  return { added, removed };
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: moveId } = await params;
  const token = req.nextUrl.searchParams.get("token") || "";
  if (!verifyTrackToken("move", moveId, token)) {
    return NextResponse.json({ error: "Invalid or missing token" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cfg = await getFeatureConfig([
    "change_request_enabled",
    "change_request_per_score_rate",
    "change_request_min_hours_before_move",
    "change_request_max_items_per_request",
  ]);

  if (cfg.change_request_enabled !== "true") {
    return NextResponse.json({ error: "Inventory change requests are not enabled" }, { status: 403 });
  }

  const perScoreRate = Math.max(1, parseFloat(cfg.change_request_per_score_rate) || 35);
  const minHours = Math.max(1, parseInt(cfg.change_request_min_hours_before_move, 10) || 48);
  const maxItems = Math.max(1, parseInt(cfg.change_request_max_items_per_request, 10) || 10);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseBodyItems(body);
  if (parsed.error) return NextResponse.json({ error: parsed.error }, { status: 400 });
  if (parsed.added.length === 0 && parsed.removed.length === 0) {
    return NextResponse.json({ error: "Add at least one item or remove at least one line" }, { status: 400 });
  }
  if (parsed.added.length + parsed.removed.length > maxItems) {
    return NextResponse.json({ error: `Maximum ${maxItems} lines per request` }, { status: 400 });
  }

  const { data: move, error: moveErr } = await admin.from("moves").select("*").eq("id", moveId).single();
  if (moveErr || !move) return NextResponse.json({ error: "Move not found" }, { status: 404 });

  const st = String(move.status || "").toLowerCase();
  if (!["confirmed", "scheduled", "paid"].includes(st)) {
    return NextResponse.json({ error: "Changes can only be requested for confirmed moves before move day" }, { status: 400 });
  }
  if (["in_progress", "completed", "delivered", "cancelled"].includes(st)) {
    return NextResponse.json({ error: "This move is no longer eligible for inventory changes" }, { status: 400 });
  }

  if (!move.scheduled_date) {
    return NextResponse.json({ error: "Move must have a scheduled date" }, { status: 400 });
  }
  const moveDate = parseDateOnly(move.scheduled_date) ?? new Date(move.scheduled_date);
  const msUntil = moveDate.getTime() - Date.now();
  if (msUntil < minHours * 3600_000) {
    return NextResponse.json(
      { error: `Inventory changes must be submitted at least ${minHours} hours before move day` },
      { status: 400 },
    );
  }

  if (move.pending_inventory_change_request_id) {
    return NextResponse.json({ error: "You already have a pending inventory change request" }, { status: 400 });
  }

  const { data: existingPending } = await admin
    .from("inventory_change_requests")
    .select("id")
    .eq("move_id", moveId)
    .in("status", PENDING_STATUSES)
    .limit(1);

  if (existingPending?.length) {
    return NextResponse.json({ error: "You already have a pending inventory change request" }, { status: 400 });
  }

  // Validate removed rows belong to this move
  if (parsed.removed.length > 0) {
    const ids = parsed.removed.map((r) => r.move_inventory_id);
    const { data: invRows } = await admin.from("move_inventory").select("id").eq("move_id", moveId).in("id", ids);
    const ok = new Set((invRows || []).map((r) => r.id));
    for (const r of parsed.removed) {
      if (!ok.has(r.move_inventory_id)) {
        return NextResponse.json({ error: "Invalid inventory line for removal" }, { status: 400 });
      }
    }
  }

  const { addedScore, removedScore, autoDelta } = summarizePricing(parsed.added, parsed.removed, perScoreRate);
  const invScore = Number(move.inventory_score) || 0;
  const truckAssessment = buildTruckAssessment({
    inventoryScore: invScore,
    truckPrimary: move.truck_primary,
    addedScore,
    removedScore,
  });

  const { items_added, items_removed } = formatItemsForStorage(parsed.added, parsed.removed, perScoreRate);
  const originalSubtotal = Number(move.amount) || 0;

  const { data: inserted, error: insErr } = await admin
    .from("inventory_change_requests")
    .insert({
      move_id: moveId,
      quote_id: move.quote_id ?? null,
      status: "pending",
      items_added: items_added,
      items_removed: items_removed,
      auto_calculated_delta: autoDelta,
      original_subtotal: originalSubtotal,
      new_subtotal: originalSubtotal + autoDelta,
      truck_assessment: truckAssessment,
      submitted_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (insErr || !inserted?.id) {
    return NextResponse.json({ error: insErr?.message || "Failed to create request" }, { status: 400 });
  }

  await admin.from("moves").update({ pending_inventory_change_request_id: inserted.id }).eq("id", moveId);

  const moveCode = formatJobId(getMoveCode(move), "move");
  const adminUrl = `${getEmailBaseUrl()}/admin/moves/${encodeURIComponent(moveCode)}`;

  // Notify admin email
  if (process.env.RESEND_API_KEY) {
    try {
      const resend = getResend();
      const to = await getAdminNotificationEmail();
      const html = inventoryChangeRequestAdminEmail({
        moveCode,
        clientName: move.client_name || "Client",
        addedCount: parsed.added.length,
        removedCount: parsed.removed.length,
        netDelta: autoDelta,
        adminUrl,
      });
      const emailFrom = await getEmailFrom();
      await resend.emails.send({
        from: emailFrom,
        to,
        subject: `Inventory change request, ${moveCode}, ${move.client_name || "Client"}`,
        html,
      });
    } catch {
      /* non-fatal */
    }
  }

  // SMS admin / dispatch
  try {
    const phone = await getDispatchPhone();
    const bodySms = `Inventory change: ${moveCode}. +${parsed.added.length} / -${parsed.removed.length} lines. Net ${autoDelta >= 0 ? "+" : ""}$${autoDelta}. Review in admin.`;
    await sendSMS(phone.replace(/\s/g, ""), bodySms);
  } catch {
    /* optional */
  }

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    auto_calculated_delta: autoDelta,
    truck_assessment: truckAssessment,
  });
}

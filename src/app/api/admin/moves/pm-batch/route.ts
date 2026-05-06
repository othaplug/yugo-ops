import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/api-auth";
import { notifyAdmins } from "@/lib/notifications/dispatch";
import { triggerMoveGCalSync } from "@/lib/google-calendar/sync-utils";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { getEmailBaseUrl } from "@/lib/email-base-url";
import { signTrackToken } from "@/lib/track-token";
import { getTrackMoveSlug } from "@/lib/move-code";
import {
  partnerMayUseReason,
  normalizePmReasonCode,
} from "@/lib/partners/pm-book-helpers";
import {
  pricePmBatchLine,
  type PmBatchLineInput,
} from "@/lib/partners/pm-batch-create";
import { hubspotPortfolioMoveDealAfterInsert } from "@/lib/hubspot/hubspot-portfolio-move-after-insert";
import {
  buildPmBatchPartnerEmailHtml,
  buildPmBatchStaffNotifyBody,
  lookupPmReasonLabel,
  type PmBatchMailDetailRow,
} from "@/lib/email/pm-batch-email-detail";

const PM_VERTICALS = [
  "property_management_residential",
  "property_management_commercial",
] as const;

function asLine(raw: unknown): PmBatchLineInput | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const partner_property_id = String(o.partner_property_id || "").trim();
  const unit_number = String(o.unit_number || "").trim();
  const unit_type = String(o.unit_type || "2br").trim() || "2br";
  const reason_code = normalizePmReasonCode(o);
  const tenant_name = String(o.tenant_name || "").trim();
  const scheduled_date = String(o.scheduled_date || o.move_out_date || o.move_in_date || "")
    .trim()
    .slice(0, 10);
  if (!partner_property_id || !unit_number || !reason_code || !scheduled_date) return null;
  const linked = o.linked_batch_index;
  const linked_batch_index =
    linked == null || linked === ""
      ? null
      : typeof linked === "number"
        ? linked
        : parseInt(String(linked), 10);
  return {
    partner_property_id,
    unit_number,
    unit_type,
    reason_code,
    tenant_name,
    tenant_phone: String(o.tenant_phone || "").trim() || undefined,
    tenant_email: String(o.tenant_email || "").trim() || undefined,
    scheduled_date,
    holding_unit: String(o.holding_unit || "").trim() || undefined,
    packing_required: !!o.packing_required,
    after_hours: !!o.after_hours,
    holiday: !!o.holiday,
    tenant_present: o.tenant_present === false ? false : true,
    linked_batch_index:
      linked_batch_index != null && !Number.isNaN(linked_batch_index)
        ? linked_batch_index
        : null,
  };
}

/** GET: list PM partners, or bootstrap buildings + contract for one partner. */
export async function GET(req: NextRequest) {
  const { error: authError } = await requireStaff();
  if (authError) return authError;

  const db = createAdminClient();
  const partnerId = req.nextUrl.searchParams.get("partner_id")?.trim() || "";

  if (!partnerId) {
    const { data: orgs, error } = await db
      .from("organizations")
      .select("id, name, vertical")
      .in("vertical", [...PM_VERTICALS])
      .order("name");
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ partners: orgs ?? [] });
  }

  const [{ data: org }, { data: contract }, { data: properties }] = await Promise.all([
    db.from("organizations").select("id, name, vertical").eq("id", partnerId).single(),
    db
      .from("partner_contracts")
      .select("id, partner_id, rate_card, status, tenant_comms_by")
      .eq("partner_id", partnerId)
      .in("status", ["active", "negotiating", "proposed"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("partner_properties")
      .select(
        "id, building_name, address, service_region, building_contact_name, building_contact_phone",
      )
      .eq("partner_id", partnerId)
      .eq("active", true)
      .order("building_name"),
  ]);

  if (!org) {
    return NextResponse.json({ error: "Partner not found" }, { status: 404 });
  }

  const { data: globals } = await db.from("pm_move_reasons").select("reason_code, label").is("partner_id", null);
  const { data: customs } = await db
    .from("pm_move_reasons")
    .select("reason_code, label")
    .eq("partner_id", partnerId)
    .eq("active", true);

  const reasonLabels: Record<string, string> = {};
  for (const g of globals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of customs ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  let matrixSample: { reason_code: string; unit_size: string; base_rate: number }[] = [];
  if (contract?.id) {
    const { data: rows } = await db
      .from("pm_rate_cards")
      .select("reason_code, unit_size, base_rate")
      .eq("contract_id", contract.id)
      .eq("active", true)
      .eq("zone", "local")
      .limit(24);
    matrixSample = (rows ?? []) as typeof matrixSample;
  }

  return NextResponse.json({
    org,
    contract: contract ?? null,
    properties: properties ?? [],
    reason_labels: reasonLabels,
    rate_preview: matrixSample,
  });
}

/** POST: create many PM moves for a partner (coordinator batch). */
export async function POST(req: NextRequest) {
  const { user, error: authError } = await requireStaff();
  if (authError) return authError;

  try {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const partnerId = String(body.partner_id || "").trim();
  const draft = !!body.draft;
  const rawMoves = Array.isArray(body.moves) ? body.moves : [];
  if (!partnerId || rawMoves.length === 0) {
    return NextResponse.json({ error: "partner_id and moves[] required" }, { status: 400 });
  }

  const lines: PmBatchLineInput[] = [];
  for (const r of rawMoves) {
    const line = asLine(r);
    if (line) lines.push(line);
  }
  if (lines.length === 0) {
    return NextResponse.json({ error: "No valid move rows" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: contract } = await admin
    .from("partner_contracts")
    .select("id, partner_id, rate_card, status, tenant_comms_by")
    .eq("partner_id", partnerId)
    .in("status", ["active", "negotiating", "proposed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!contract || contract.partner_id !== partnerId) {
    return NextResponse.json({ error: "No active contract for partner" }, { status: 400 });
  }

  const contractId = contract.id as string;
  const legacyRateCard = contract.rate_card;

  const { data: org } = await admin
    .from("organizations")
    .select("id, name, email, billing_email")
    .eq("id", partnerId)
    .single();
  const partnerName = (org as { name?: string } | null)?.name || "Partner";

  const propRows = await admin
    .from("partner_properties")
    .select("id, partner_id, building_name, address, service_region")
    .eq("partner_id", partnerId);

  const propById = new Map((propRows.data ?? []).map((p) => [p.id as string, p]));

  const [{ data: reasonGlobals }, { data: reasonCustoms }] = await Promise.all([
    admin.from("pm_move_reasons").select("reason_code, label").is("partner_id", null),
    admin
      .from("pm_move_reasons")
      .select("reason_code, label")
      .eq("partner_id", partnerId)
      .eq("active", true),
  ]);
  const reasonLabels: Record<string, string> = {};
  for (const g of reasonGlobals ?? []) reasonLabels[g.reason_code as string] = g.label as string;
  for (const c of reasonCustoms ?? []) reasonLabels[c.reason_code as string] = c.label as string;

  for (const line of lines) {
    const allowed = await partnerMayUseReason(admin, partnerId, contractId, line.reason_code);
    if (!allowed) {
      return NextResponse.json(
        { error: `Move type not enabled for contract: ${line.reason_code}` },
        { status: 400 },
      );
    }
    const pr = propById.get(line.partner_property_id);
    if (!pr) {
      return NextResponse.json({ error: "Invalid building for partner" }, { status: 400 });
    }
  }

  type Created = { id: string; move_code: string | null };
  const created: Created[] = [];
  const batchMailRows: PmBatchMailDetailRow[] = [];

  const status = draft ? "pending_approval" : "confirmed";
  const coordinatorName = user?.email?.trim() || "Coordinator";

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const pr = propById.get(line.partner_property_id)!;
    const buildingName = (pr.building_name as string) || "Building";
    const addr = String(pr.address || "").trim();
    const unit = String(line.unit_number || "").trim();
    const fromAddress = `${addr} · Unit ${unit}`;
    const hold = String(line.holding_unit || "").trim();
    const toAddress = hold ? `${hold} (holding)` : addr;

    let subtotal: number;
    let zone: string;
    try {
      const priced = await pricePmBatchLine(admin, contractId, legacyRateCard, line, {
        address: addr,
        service_region: (pr.service_region as string | null) ?? null,
      });
      subtotal = priced.subtotal;
      zone = priced.zone;
    } catch (err) {
      const hint = err instanceof Error ? err.message : "Pricing lookup failed";
      return NextResponse.json(
        {
          error: `${hint.endsWith(".") ? hint : `${hint}.`} Row ${i + 1}: move type ${line.reason_code}, unit size ${line.unit_type}, unit ${unit}. Add matching rows to the portfolio rate matrix or legacy rate card for this contract.`,
        },
        { status: 400 },
      );
    }

    const displayTenant = line.tenant_name || "Tenant";

    const notesParts = [
      draft ? "PM batch draft (coordinator)" : "PM batch (coordinator)",
      `Building: ${buildingName}`,
      `Zone: ${zone}`,
      line.packing_required ? "Packing required" : "",
      hold ? `Holding: ${hold}` : "",
      line.tenant_present === false ? "Tenant may not be on site for walkthrough" : "",
    ];

    const insertPayload: Record<string, unknown> = {
      organization_id: partnerId,
      contract_id: contractId,
      partner_property_id: line.partner_property_id,
      unit_number: unit,
      tenant_name: displayTenant,
      tenant_phone: line.tenant_phone || null,
      tenant_email: line.tenant_email || null,
      client_name: displayTenant,
      client_phone: line.tenant_phone || null,
      client_email: line.tenant_email || null,
      from_address: fromAddress,
      to_address: toAddress,
      scheduled_date: line.scheduled_date,
      scheduled_time: "8 AM to 10 AM",
      status,
      service_type: "b2b_oneoff",
      move_type: "residential",
      tier_selected: "essential",
      move_size: line.unit_type,
      pm_move_kind: line.reason_code,
      pm_reason_code: line.reason_code,
      pm_zone: zone,
      pm_urgency: "standard",
      is_pm_move: true,
      holding_unit: hold || null,
      pm_packing_required: !!line.packing_required,
      tenant_present: line.tenant_present !== false,
      pm_pricing_source: "partner_rate_card",
      amount: subtotal,
      estimate: subtotal,
      internal_notes: notesParts.filter(Boolean).join("\n"),
      coordinator_name: coordinatorName,
    };

    const { data: move, error: insErr } = await admin
      .from("moves")
      .insert(insertPayload)
      .select("id, move_code")
      .single();

    if (insErr || !move) {
      return NextResponse.json({ error: insErr?.message || "Insert failed" }, { status: 400 });
    }
    const newId = move.id as string;
    const newCode = (move.move_code as string) || null;
    created.push({ id: newId, move_code: newCode });

    batchMailRows.push({
      moveCode: (newCode || newId).toString(),
      unit,
      unitSize: line.unit_type,
      tenantName: displayTenant,
      tenantPhone: line.tenant_phone ?? null,
      tenantEmail: line.tenant_email ?? null,
      buildingName,
      propertyAddress: addr,
      scheduledDate: line.scheduled_date,
      arrivalWindowLabel: "8 AM to 10 AM",
      reasonLabel: lookupPmReasonLabel(line.reason_code, reasonLabels),
      reasonCode: line.reason_code,
      zone,
      estimatedPreTax: subtotal,
      packingRequired: !!line.packing_required,
      holdingUnit: hold || null,
      afterHours: !!line.after_hours,
      holidaySurcharge: !!line.holiday,
      tenantMayNotBeOnSite: line.tenant_present === false,
    });

    const orgRow = org as { billing_email?: string | null; email?: string | null } | null;
    await hubspotPortfolioMoveDealAfterInsert(admin, {
      moveId: newId,
      moveCode: newCode,
      tenantEmail: line.tenant_email,
      partnerBillingEmail: orgRow?.billing_email,
      partnerOrgEmail: orgRow?.email,
      displayName: displayTenant,
      tenantPhone: line.tenant_phone,
      serviceType: "b2b_oneoff",
      moveSize: line.unit_type,
      scheduledDate: line.scheduled_date,
      fromAddress,
      toAddress,
      estimate: subtotal,
      tierSelected: "essential",
    });
  }

  for (let i = 0; i < lines.length; i++) {
    const li = lines[i]!.linked_batch_index;
    if (li == null || li < 0 || li >= lines.length || li === i) continue;
    const a = created[i]!;
    const b = created[li]!;
    if (!a?.id || !b?.id) continue;
    await admin
      .from("moves")
      .update({
        linked_move_id: b.id,
        linked_move_code: b.move_code,
      })
      .eq("id", a.id);
    await admin
      .from("moves")
      .update({
        linked_move_id: a.id,
        linked_move_code: a.move_code,
      })
      .eq("id", b.id);
  }

  for (let i = 0; i < lines.length; i++) {
    const li = lines[i]!.linked_batch_index;
    if (li == null || li < 0 || li >= lines.length || li === i) continue;
    const peerCode =
      created[li]?.move_code != null ? String(created[li]?.move_code) : "";
    if (batchMailRows[i]) {
      batchMailRows[i] = {
        ...batchMailRows[i]!,
        linkedMoveCode: peerCode.trim() || created[li]?.id || null,
      };
    }
  }

  const earliest = lines.map((l) => l.scheduled_date).sort()[0];
  const latest = lines.map((l) => l.scheduled_date).sort().slice(-1)[0];
  const uniqueTenants = new Set(lines.map((l) => l.tenant_name.trim().toLowerCase()).filter(Boolean)).size;

  try {
    const staffBody = buildPmBatchStaffNotifyBody({
      partnerName,
      coordinatorLabel: coordinatorName,
      draft,
      earliestDate: earliest,
      latestDate: latest,
      moveCount: created.length,
      uniqueTenantCount: uniqueTenants,
      rows: batchMailRows,
    });
    await notifyAdmins("partner_pm_batch", {
      subject: `${draft ? "Draft " : ""}PM batch: ${partnerName} (${created.length} move${created.length === 1 ? "" : "s"})`,
      body: staffBody,
      description: `${created.length} moves · ${uniqueTenants} tenant profiles · ${earliest} to ${latest}`,
      moveId: created[0]?.id,
      sourceId: created[0]?.id,
      partnerName,
    });
  } catch (e) {
    console.error("[pm-batch] notifyAdmins failed (moves already created)", e);
  }

  const contractPrefYugo =
    String((contract as { tenant_comms_by?: string }).tenant_comms_by || "").toLowerCase() ===
    "yugo";

  if (!draft && contractPrefYugo) {
    const baseUrl = getEmailBaseUrl().replace(/\/$/, "");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]!;
      const move = created[i]!;
      const phone = (line.tenant_phone || "").trim();
      if (!phone) continue;
      const digits = phone.replace(/\D/g, "");
      if (digits.length < 10) continue;
      try {
        const trackUrl = `${baseUrl}/track/move/${getTrackMoveSlug({ move_code: move.move_code, id: move.id })}?token=${signTrackToken("move", move.id)}`;
        const msg = [
          `Hi ${line.tenant_name || "there"},`,
          `Your building management has scheduled a move for unit ${line.unit_number} on ${line.scheduled_date}.`,
          `Track your move: ${trackUrl}`,
          `Questions? Call (647) 370-4525.`,
        ].join("\n");
        await sendSMS(
          digits.length === 11 && digits.startsWith("1") ? `+${digits}` : `+1${digits.slice(-10)}`,
          msg,
        );
      } catch (smsErr) {
        console.warn("[pm-batch] tenant SMS skipped (signing or carrier)", smsErr);
      }
    }
  }

  const orgEmails = org as { email?: string | null; billing_email?: string | null } | null;
  const partnerEmail = ((orgEmails?.billing_email ?? orgEmails?.email) ?? "").trim();
  if (!draft && partnerEmail) {
    try {
      const partnerHtml = buildPmBatchPartnerEmailHtml({
        partnerName,
        adminBaseUrl: getEmailBaseUrl(),
        moveCount: created.length,
        rows: batchMailRows,
      });
      await sendEmail({
        to: partnerEmail,
        subject: `Yugo portfolio batch · ${created.length} scheduled move${created.length === 1 ? "" : "s"} (${partnerName})`,
        html: partnerHtml,
      });
    } catch {
      /* non-fatal */
    }
  }

  // GCal sync for all created moves (fire-and-forget, only for non-draft)
  if (!draft) {
    created.forEach((c) => triggerMoveGCalSync(String(c.id)));
  }

  return NextResponse.json({
    ok: true,
    draft,
    move_ids: created.map((c) => c.id),
    move_codes: created.map((c) => c.move_code),
  });
  } catch (e) {
    console.error("[pm-batch] POST uncaught:", e);
    return NextResponse.json(
      {
        error:
          e instanceof Error ? e.message : "Unexpected server error creating PM batch. Check logs.",
      },
      { status: 500 },
    );
  }
}

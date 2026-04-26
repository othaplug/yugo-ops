import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCrewToken, CREW_COOKIE_NAME } from "@/lib/crew-token";
import { CREW_JOB_UUID_RE, normalizeCrewJobId, selectDeliveryByJobId } from "@/lib/resolve-delivery-by-job-id";
import {
  computeCrewTipReportNeeded,
  type TipReportTipRow,
} from "@/lib/crew/tip-report-eligibility";

const METHODS = ["none", "cash", "interac"] as const;

function isPlaceholderTip(r: TipReportTipRow & { id?: string }): boolean {
  const amt = Number(r.amount ?? 0);
  return !r.square_payment_id && amt <= 0;
}

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jobType = (req.nextUrl.searchParams.get("jobType") || "move") as "move" | "delivery";
  const rawId = normalizeCrewJobId(req.nextUrl.searchParams.get("jobId") || "");
  if (!rawId || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = CREW_JOB_UUID_RE.test(rawId);
  let entityId: string;

  if (jobType === "move") {
    const { data: m } = isUuid
      ? await admin.from("moves").select("id, crew_id").eq("id", rawId).maybeSingle()
      : await admin
          .from("moves")
          .select("id, crew_id")
          .ilike("move_code", rawId.replace(/^#/, "").toUpperCase())
          .maybeSingle();
    if (!m || m.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    entityId = m.id;
  } else {
    const { data: d } = await selectDeliveryByJobId(admin, rawId, "id, crew_id");
    const row = d as { id: string; crew_id: string | null } | null;
    if (!row || row.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    entityId = row.id;
  }

  const sel = jobType === "move" ? "move_id" : "delivery_id";
  const { data: tip } = await admin
    .from("tips")
    .select("id, square_payment_id, amount, method, reported_by")
    .eq(sel, entityId)
    .maybeSingle();

  const t = tip as (TipReportTipRow & { id?: string }) | null;
  const needsReport = computeCrewTipReportNeeded(t);

  return NextResponse.json({ needsReport, tipId: (t as { id?: string } | null)?.id ?? null });
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(CREW_COOKIE_NAME)?.value;
  const payload = token ? verifyCrewToken(token) : null;
  if (!payload) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const jobType = (body.jobType || "move") as "move" | "delivery";
  const rawId = normalizeCrewJobId(String(body.jobId || ""));
  const method = String(body.method || "").toLowerCase() as (typeof METHODS)[number];
  const amountRaw = body.amountDollars;
  const amountDollars =
    typeof amountRaw === "number" && Number.isFinite(amountRaw)
      ? Math.max(0, amountRaw)
      : Number.parseFloat(String(amountRaw || "0")) || 0;
  const neighbourhood = String(body.neighbourhood || "").trim() || null;
  const reportNote = String(body.reportNote || "").trim() || null;

  if (!rawId || !["move", "delivery"].includes(jobType)) {
    return NextResponse.json({ error: "jobId and jobType required" }, { status: 400 });
  }
  if (!METHODS.includes(method)) {
    return NextResponse.json({ error: "method must be none, cash, or interac" }, { status: 400 });
  }
  if (method === "none" && amountDollars > 0) {
    return NextResponse.json({ error: "Amount must be zero when method is none" }, { status: 400 });
  }
  if (method !== "none" && amountDollars <= 0) {
    return NextResponse.json({ error: "Enter tip amount or choose no tip" }, { status: 400 });
  }

  const admin = createAdminClient();
  const isUuid = CREW_JOB_UUID_RE.test(rawId);
  let entityId: string;
  let crewId: string | null = null;
  let clientName: string | null = null;
  let crewName: string | null = null;
  let serviceType: string | null = null;
  let tier: string | null = null;

  if (jobType === "move") {
    const { data: m } = isUuid
      ? await admin
          .from("moves")
          .select(
            "id, crew_id, client_name, service_type, tier_selected, status, stage",
          )
          .eq("id", rawId)
          .maybeSingle()
      : await admin
          .from("moves")
          .select(
            "id, crew_id, client_name, service_type, tier_selected, status, stage",
          )
          .ilike("move_code", rawId.replace(/^#/, "").toUpperCase())
          .maybeSingle();
    if (!m || m.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const st = String(m.status || "").toLowerCase();
    if (!["completed", "done"].includes(st)) {
      return NextResponse.json({ error: "Job must be completed before tip report" }, { status: 400 });
    }
    entityId = m.id;
    crewId = m.crew_id;
    clientName = (m.client_name as string) || null;
    serviceType = (m.service_type as string) || null;
    tier = (m.tier_selected as string) || null;
  } else {
    const { data: d } = await selectDeliveryByJobId(
      admin,
      rawId,
      "id, crew_id, customer_name, client_name, status",
    );
    const row = d as {
      id: string;
      crew_id: string | null;
      customer_name?: string | null;
      client_name?: string | null;
      status?: string | null;
    } | null;
    if (!row || row.crew_id !== payload.teamId) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const st = String(row.status || "").toLowerCase();
    if (!["delivered", "completed", "done"].includes(st)) {
      return NextResponse.json({ error: "Job must be completed before tip report" }, { status: 400 });
    }
    entityId = row.id;
    crewId = row.crew_id;
    clientName =
      `${row.customer_name || ""}${row.client_name ? ` (${row.client_name})` : ""}`.trim() ||
      null;
  }

  if (crewId) {
    const { data: crew } = await admin.from("crews").select("name").eq("id", crewId).maybeSingle();
    crewName = (crew?.name as string) || null;
  }

  const sel = jobType === "move" ? "move_id" : "delivery_id";
  const { data: existing } = await admin
    .from("tips")
    .select("id, square_payment_id, amount, method")
    .eq(sel, entityId)
    .maybeSingle();

  const ex = existing as (TipReportTipRow & { id: string }) | null;
  if (ex?.square_payment_id) {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }
  if (ex && !isPlaceholderTip(ex) && Number(ex.amount ?? 0) > 0 && ex.method === "square") {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }

  const now = new Date().toISOString();
  const insertPayload: Record<string, unknown> = {
    crew_id: crewId,
    client_name: clientName,
    crew_name: crewName,
    amount: method === "none" ? 0 : Math.round(amountDollars * 100) / 100,
    processing_fee: null,
    net_amount: method === "none" ? 0 : Math.round(amountDollars * 100) / 100,
    charged_at: now,
    job_type: jobType,
    method,
    reported_at: now,
    reported_by: payload.crewMemberId,
    service_type: serviceType,
    tier,
    neighbourhood,
    report_note: reportNote,
  };
  if (jobType === "move") {
    insertPayload.move_id = entityId;
    insertPayload.delivery_id = null;
  } else {
    insertPayload.delivery_id = entityId;
    insertPayload.move_id = null;
  }

  if (ex?.id && isPlaceholderTip(ex)) {
    const { error: upErr } = await admin.from("tips").update(insertPayload).eq("id", ex.id);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true, id: ex.id, updated: true });
  }

  if (ex?.id) {
    return NextResponse.json({ ok: true, alreadyRecorded: true });
  }

  const { data: ins, error: insErr } = await admin
    .from("tips")
    .insert(insertPayload)
    .select("id")
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
  return NextResponse.json({ ok: true, id: ins?.id });
}

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/api-auth";
import { getTodayString, getLocalDateString } from "@/lib/business-timezone";
import { ARRIVAL_CHECKPOINTS_MOVE, ARRIVAL_CHECKPOINTS_DELIVERY } from "@/lib/parse-time-window";
import { normalizeDeliveryStatus } from "@/lib/crew-tracking-status";
import {
  evaluateArrivalVsCommitmentWindow,
  parseDeliveryScheduleWindow,
  parseMoveScheduleWindow,
} from "@/lib/crew/arrival-punctuality";
import { CREW_JOB_UUID_RE } from "@/lib/resolve-delivery-by-job-id";

type Checkpoint = {
  status: string;
  timestamp: string;
  lat?: number | null;
  lng?: number | null;
  note?: string | null;
};

type Stage = {
  status: string;
  label: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null; // minutes
};

const STAGE_LABELS: Record<string, string> = {
  en_route_to_pickup: "Travel to Pickup",
  arrived_at_pickup: "At Pickup",
  loading: "Loading",
  en_route_to_destination: "Travel to drop off",
  arrived_at_destination: "At Drop off",
  unloading: "Unloading",
  completed: "Complete",
  en_route: "En Route",
  arrived: "Arrived",
  delivering: "Delivering",
};

/**
 * First arrival for on-time (pickup / job start): priority order from `statuses`, earliest
 * matching checkpoint time per level; `normalizeDeliveryStatus` ties legacy "arrived" to pickup, etc.
 */
function getFirstArrivalIso(
  checkpoints: Checkpoint[],
  statuses: readonly string[],
): string | null {
  if (!Array.isArray(checkpoints) || checkpoints.length === 0) return null;
  const matches = (c: Checkpoint, want: string) => {
    const wr = c.status;
    if (wr === want) return true;
    return (
      normalizeDeliveryStatus(wr) === want ||
      normalizeDeliveryStatus(wr) === normalizeDeliveryStatus(want)
    );
  };
  for (const want of statuses) {
    const hits = checkpoints.filter((c) => c.timestamp && matches(c, want));
    if (hits.length === 0) continue;
    hits.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    );
    const ts = String(hits[0]!.timestamp).trim();
    if (ts) return ts;
  }
  return null;
}

/**
 * Time between checkpoint A and B is spent *in* the phase that started at A, not the one reached at B.
 * (E.g. en_route_to_pickup → arrived_at_pickup is travel time, not "at pickup".)
 */
function intervalLabelAndStatus(fromStatus: string): { label: string; status: string } {
  if (fromStatus === "started") {
    return { label: STAGE_LABELS.en_route_to_pickup, status: "en_route_to_pickup" };
  }
  const s = normalizeDeliveryStatus(fromStatus);
  if (s === "en_route_to_pickup") {
    return { label: STAGE_LABELS.en_route_to_pickup, status: "en_route_to_pickup" };
  }
  if (s === "arrived_at_pickup" || s === "loading") {
    return { label: STAGE_LABELS.arrived_at_pickup, status: "arrived_at_pickup" };
  }
  if (s === "en_route_to_destination") {
    return { label: STAGE_LABELS.en_route_to_destination, status: "en_route_to_destination" };
  }
  if (s === "arrived_at_destination" || s === "unloading") {
    return { label: STAGE_LABELS.arrived_at_destination, status: "arrived_at_destination" };
  }
  if (s === "completed") {
    return { label: STAGE_LABELS.completed, status: "completed" };
  }
  return {
    label: STAGE_LABELS[fromStatus] || fromStatus.replace(/_/g, " "),
    status: fromStatus,
  };
}

function buildStages(
  checkpoints: Checkpoint[],
  sessionStart: string,
  completedAt: string | null | undefined,
): Stage[] {
  if (!checkpoints || checkpoints.length === 0) return [];
  const pts: { status: string; timestamp: string }[] = [
    { status: "started", timestamp: sessionStart },
    ...checkpoints,
  ];
  const lastCp = checkpoints[checkpoints.length - 1];
  const lastCpMs = new Date(lastCp.timestamp).getTime();
  const doneMs = completedAt ? new Date(completedAt).getTime() : NaN;
  if (
    Number.isFinite(doneMs) &&
    doneMs > lastCpMs &&
    lastCp.status !== "completed"
  ) {
    pts.push({ status: "completed", timestamp: completedAt! });
  }
  const raw: Stage[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const from = pts[i];
    const to = pts[i + 1];
    const { label, status } = intervalLabelAndStatus(from.status);
    const startMs = new Date(from.timestamp).getTime();
    const endMs = new Date(to.timestamp).getTime();
    const duration = Math.max(0, Math.round((endMs - startMs) / 60000));
    raw.push({
      status,
      label,
      startedAt: from.timestamp,
      endedAt: to.timestamp,
      duration,
    });
  }
  const stages: Stage[] = [];
  for (const seg of raw) {
    const prev = stages[stages.length - 1];
    if (prev && prev.label === seg.label) {
      prev.endedAt = seg.endedAt;
      prev.duration = (prev.duration ?? 0) + (seg.duration ?? 0);
    } else {
      stages.push({ ...seg });
    }
  }
  return stages;
}

const IN_CHUNK = 100;
function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return [];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(ids.slice(i, i + IN_CHUNK));
  return out;
}

export async function GET(req: NextRequest) {
  const { error: authErr } = await requireAdmin();
  if (authErr) return authErr;

  const url = new URL(req.url);
  const crewId = url.searchParams.get("id");
  if (!crewId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const today = getTodayString();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000);
  const from = url.searchParams.get("from") || getLocalDateString(thirtyDaysAgo);
  const to = url.searchParams.get("to") || today;

  const admin = createAdminClient();

  const [crewRes, sessionsRes, signOffsRes, tipsRes] = await Promise.all([
    admin.from("crews").select("id, name, members").eq("id", crewId).single(),
    admin
      .from("tracking_sessions")
      .select("id, job_id, job_type, team_id, status, started_at, completed_at, checkpoints")
      .eq("team_id", crewId)
      .gte("started_at", from)
      .lte("started_at", to + "T23:59:59.999Z")
      .order("started_at", { ascending: false }),
    admin
      .from("client_sign_offs")
      .select("job_id, job_type, satisfaction_rating, signed_at")
      .gte("signed_at", from)
      .lte("signed_at", to + "T23:59:59.999Z"),
    admin
      .from("tips")
      .select("move_id, amount, charged_at")
      .eq("crew_id", crewId)
      .gte("charged_at", from)
      .lte("charged_at", to + "T23:59:59.999Z"),
  ]);

  const crew = crewRes.data;
  if (!crew) return NextResponse.json({ error: "Crew not found" }, { status: 404 });

  const sessions = sessionsRes.data || [];
  const signOffs = signOffsRes.data || [];
  const tips = tipsRes.data || [];
  const totalTipsFromTable = tips.reduce((s, t) => s + (Number(t.amount) || 0), 0);
  const tipByMoveId = new Map<string, number>();
  tips.forEach((t) => {
    if (t.move_id) tipByMoveId.set(t.move_id, Number(t.amount) || 0);
  });

  const completedSessions = sessions.filter((s) => s.status === "completed");
  /** Every distinct job id on a session. Fetch both moves and deliveries for this set so mis-tagged `job_type` still resolves. */
  const allJobIds = [
    ...new Set(
      completedSessions
        .map((s) => String(s.job_id || "").trim())
        .filter((id) => id.length > 0),
    ),
  ];

  const MOVE_SELECT =
    "id, client_name, from_address, to_address, move_date, quoted_hours, move_size, arrival_window, scheduled_date, scheduled_time, quote_id, move_project_id, estimated_duration_minutes, est_hours, arrived_on_time, move_code";
  const DELIVERY_SELECT =
    "id, customer_name, client_name, business_name, pickup_address, delivery_address, scheduled_date, scheduled_start, scheduled_end, delivery_window, time_slot, source_quote_id, estimated_duration_minutes, estimated_duration_hours, day_type, delivery_number";

  type MoveRow = {
    id: string;
    client_name?: string | null;
    from_address?: string | null;
    to_address?: string | null;
    move_date?: string | null;
    quoted_hours?: number | null;
    move_size?: string | null;
    arrival_window?: string | null;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    quote_id?: string | null;
    move_project_id?: string | null;
    estimated_duration_minutes?: number | null;
    est_hours?: number | null;
    arrived_on_time?: boolean | null;
    move_code?: string | null;
  };
  /** Map keys for job refs: case and # can differ between tracking_sessions and rows */
  const caseKeyTries = (k: string): string[] => {
    const t = k.trim();
    if (!t) return [];
    const noHash = t.replace(/^#/, "");
    return [...new Set([t, noHash, t.toLowerCase(), t.toUpperCase(), noHash.toLowerCase(), noHash.toUpperCase()])];
  };
  const mapPutAll = <T,>(m: Map<string, T>, key: string | null | undefined, value: T) => {
    if (key == null) return;
    for (const k of caseKeyTries(String(key))) m.set(k, value);
  };
  const mapGet = <T,>(m: Map<string, T>, key: string | null | undefined): T | undefined => {
    if (key == null) return undefined;
    for (const k of caseKeyTries(String(key))) {
      const v = m.get(k);
      if (v !== undefined) return v;
    }
    return undefined;
  };

  /** Primary key for moveByPk / delByPk: avoids duplicate orphan work when UUID / code casing differs. */
  const norm = (s: string | null | undefined) =>
    String(s ?? "")
      .trim()
      .replace(/^#/, "")
      .toLowerCase();

  type DeliveryRow = {
    id: string;
    customer_name?: string | null;
    client_name?: string | null;
    business_name?: string | null;
    pickup_address?: string | null;
    delivery_address?: string | null;
    scheduled_date?: string | null;
    scheduled_start?: string | null;
    scheduled_end?: string | null;
    delivery_window?: string | null;
    time_slot?: string | null;
    source_quote_id?: string | null;
    estimated_duration_minutes?: number | null;
    estimated_duration_hours?: number | null;
    day_type?: string | null;
    delivery_number?: string | null;
  };

  const expandIdsForTextColumn = (ids: string[]) => [
    ...new Set(ids.flatMap((id) => [id, id.toLowerCase(), id.toUpperCase(), id.replace(/^#/, ""), id.replace(/^#/, "").toLowerCase(), id.replace(/^#/, "").toUpperCase()])),
  ];
  const fetchMovesIn = async (col: "id" | "quote_id" | "move_code" | "move_project_id", ids: string[]) => {
    if (ids.length === 0) return [] as MoveRow[];
    const rows: MoveRow[] = [];
    for (const part of chunkIds(col === "move_code" ? expandIdsForTextColumn(ids) : ids)) {
      const { data } = await admin.from("moves").select(MOVE_SELECT).in(col, part);
      if (data) rows.push(...(data as MoveRow[]));
    }
    return rows;
  };
  const fetchDeliveriesIn = async (
    col: "id" | "source_quote_id" | "delivery_number",
    ids: string[],
  ) => {
    if (ids.length === 0) return [] as DeliveryRow[];
    const useExpand = col === "delivery_number";
    const rows: DeliveryRow[] = [];
    for (const part of chunkIds(useExpand ? expandIdsForTextColumn(ids) : ids)) {
      const { data } = await admin.from("deliveries").select(DELIVERY_SELECT).in(col, part);
      if (data) rows.push(...(data as DeliveryRow[]));
    }
    return rows;
  };

  const [moveRowsById, deliveryRowsById, benchmarksRes] = await Promise.all([
    fetchMovesIn("id", allJobIds),
    fetchDeliveriesIn("id", allJobIds),
    admin.from("volume_benchmarks").select("move_size, baseline_hours"),
  ]);

  const moveByPk = new Map<string, MoveRow>();
  const putMove = (m: MoveRow) => {
    moveByPk.set(norm(m.id), m);
  };
  const delByPk = new Map<string, DeliveryRow>();
  const putDel = (d: DeliveryRow) => {
    delByPk.set(norm(d.id), d);
  };

  for (const m of moveRowsById) putMove(m);
  for (const d of deliveryRowsById) putDel(d);

  const orphanJobIds = allJobIds.filter(
    (j) => !moveByPk.has(norm(j)) && !delByPk.has(norm(j)),
  );

  if (orphanJobIds.length > 0) {
    const [mq, mc, mproj, dsq, dnum] = await Promise.all([
      fetchMovesIn("quote_id", orphanJobIds),
      fetchMovesIn("move_code", orphanJobIds),
      fetchMovesIn("move_project_id", orphanJobIds),
      fetchDeliveriesIn("source_quote_id", orphanJobIds),
      fetchDeliveriesIn("delivery_number", orphanJobIds),
    ]);
    for (const m of [...mq, ...mc, ...mproj]) putMove(m);
    for (const d of [...dsq, ...dnum]) putDel(d);
  }

  const buildJidLookups = () => {
    const mr = Array.from(moveByPk.values());
    const dr = Array.from(delByPk.values());
    const mJ = new Map<string, MoveRow>();
    for (const m of mr) {
      mapPutAll(mJ, m.id, m);
      mapPutAll(mJ, m.quote_id, m);
      mapPutAll(mJ, m.move_code, m);
      if (m.move_project_id) mapPutAll(mJ, m.move_project_id, m);
    }
    const dJ = new Map<string, DeliveryRow>();
    for (const d of dr) {
      mapPutAll(dJ, d.id, d);
      mapPutAll(dJ, d.source_quote_id, d);
      mapPutAll(dJ, d.delivery_number, d);
    }
    return { moveRows: mr, deliveryRows: dr, moveByJid: mJ, deliveryByJid: dJ };
  };

  let { moveRows, deliveryRows, moveByJid, deliveryByJid } = buildJidLookups();

  const stillMissing = allJobIds.filter(
    (j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j),
  );
  if (stillMissing.length > 0) {
    const [mById, mByQ, mByProj, dById, dByQ, dByNum] = await Promise.all([
      fetchMovesIn("id", stillMissing),
      fetchMovesIn("quote_id", stillMissing),
      fetchMovesIn("move_project_id", stillMissing),
      fetchDeliveriesIn("id", stillMissing),
      fetchDeliveriesIn("source_quote_id", stillMissing),
      fetchDeliveriesIn("delivery_number", stillMissing),
    ]);
    for (const m of [...mById, ...mByQ, ...mByProj]) putMove(m);
    for (const d of [...dById, ...dByQ, ...dByNum]) putDel(d);
    const again = buildJidLookups();
    moveRows = again.moveRows;
    deliveryRows = again.deliveryRows;
    moveByJid = again.moveByJid;
    deliveryByJid = again.deliveryByJid;
  }

  const contactNameByQuoteId = new Map<string, string>();
  /** Match `CREW_JOB_UUID_RE` and tracking `job_id` storage: generic 8-4-4-4-12 hex, not RFC nibble rules. */
  const isLikelyUuid = (s: string) => CREW_JOB_UUID_RE.test(String(s).trim());

  const stillMissing2 = allJobIds.filter(
    (j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j),
  );
  if (stillMissing2.length > 0) {
    const byQuoteKey = new Map<string, { id: string; quote_id: string | null; contacts?: unknown }>();
    const mergeQuote = (q: { id?: string; quote_id?: string | null; contacts?: unknown } | null) => {
      if (!q || !q.id) return;
      byQuoteKey.set(norm(String(q.id)), q as { id: string; quote_id: string | null; contacts?: unknown });
    };
    const uuidPart = stillMissing2.filter((j) => isLikelyUuid(j));
    const textPart = stillMissing2.filter((j) => !isLikelyUuid(j));
    for (const part of chunkIds(uuidPart)) {
      if (part.length === 0) continue;
      const { data: qrows } = await admin
        .from("quotes")
        .select("id, quote_id, contact_id, contacts:contact_id(name)")
        .in("id", part);
      (qrows || []).forEach((q) => mergeQuote(q as { id: string; quote_id: string | null; contacts?: unknown }));
    }
    for (const part of chunkIds(expandIdsForTextColumn(textPart))) {
      if (part.length === 0) continue;
      const { data: qrows } = await admin
        .from("quotes")
        .select("id, quote_id, contact_id, contacts:contact_id(name)")
        .in("quote_id", part);
      (qrows || []).forEach((q) => mergeQuote(q as { id: string; quote_id: string | null; contacts?: unknown }));
    }
    const uniqueQuotes = Array.from(byQuoteKey.values());
    for (const q of uniqueQuotes) {
      const contactsRel = (q as { contacts?: { name?: string | null } | { name?: string | null }[] | null })
        .contacts;
      const nm = Array.isArray(contactsRel)
        ? contactsRel[0]?.name
        : contactsRel?.name;
      const clean = String(nm || "").trim();
      if (clean) mapPutAll(contactNameByQuoteId, String(q.id), clean);
    }
    if (uniqueQuotes.length > 0) {
      const quotePkIds = uniqueQuotes.map((q) => q.id);
      const [mByQuotePk, dByQuotePk] = await Promise.all([
        fetchMovesIn("quote_id", quotePkIds),
        fetchDeliveriesIn("source_quote_id", quotePkIds),
      ]);
      for (const m of [...(mByQuotePk || [])]) putMove(m);
      for (const d of [...(dByQuotePk || [])]) putDel(d);
      const re = buildJidLookups();
      moveRows = re.moveRows;
      deliveryRows = re.deliveryRows;
      moveByJid = re.moveByJid;
      deliveryByJid = re.deliveryByJid;
      for (const q of uniqueQuotes) {
        const mHit = moveRows.find(
          (row) => row.quote_id && norm(String(row.quote_id)) === norm(String(q.id)),
        );
        if (mHit) {
          mapPutAll(moveByJid, String(q.id), mHit);
          if (q.quote_id) mapPutAll(moveByJid, String(q.quote_id), mHit);
        }
        const dHit = deliveryRows.find(
          (row) =>
            row.source_quote_id && norm(String(row.source_quote_id)) === norm(String(q.id)),
        );
        if (dHit) {
          mapPutAll(deliveryByJid, String(q.id), dHit);
          if (q.quote_id) mapPutAll(deliveryByJid, String(q.quote_id), dHit);
        }
      }
    }
  }

  const idsWithMoveRows = moveRows.map((m) => m.id);
  const idsWithDeliveryRows = deliveryRows.map((d) => d.id);

  const [podsMoveRes, podsDeliveryRes] = await Promise.all([
    idsWithMoveRows.length > 0
      ? admin
          .from("proof_of_delivery")
          .select("move_id, satisfaction_rating")
          .in("move_id", idsWithMoveRows)
          .not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
    idsWithDeliveryRows.length > 0
      ? admin
          .from("proof_of_delivery")
          .select("delivery_id, satisfaction_rating")
          .in("delivery_id", idsWithDeliveryRows)
          .not("satisfaction_rating", "is", null)
      : Promise.resolve({ data: [] }),
  ]);
  const baselineBySize = new Map<string, number>();
  (benchmarksRes.data || []).forEach((b) => {
    if (b.move_size && b.baseline_hours != null) baselineBySize.set(b.move_size, Number(b.baseline_hours));
  });

  // Fallback name source: join moves → quotes → contacts (name), deliveries → quotes → contacts.
  // Many older moves have `client_name` empty; the canonical name lives on the contact record.
  const linkedQuoteIds = [
    ...new Set(
      [
        ...moveRows.map((m) => m.quote_id),
        ...deliveryRows.map((d) => d.source_quote_id),
      ].filter((v): v is string => typeof v === "string" && v.length > 0),
    ),
  ];

  if (linkedQuoteIds.length > 0) {
    for (const part of chunkIds(linkedQuoteIds)) {
      const { data: quoteRows } = await admin
        .from("quotes")
        .select("id, contact_id, contacts:contact_id(name)")
        .in("id", part);
      for (const q of quoteRows || []) {
        const qid = (q as { id?: string }).id;
        const contactsRel = (q as { contacts?: { name?: string | null } | { name?: string | null }[] | null })
          .contacts;
        const nm = Array.isArray(contactsRel)
          ? contactsRel[0]?.name
          : contactsRel?.name;
        const clean = String(nm || "").trim();
        if (qid && clean) mapPutAll(contactNameByQuoteId, qid, clean);
      }
    }
  }

  const signOffByJob = new Map<string, { rating: number | null }>();
  signOffs.forEach((s) => signOffByJob.set(`${s.job_id}:${s.job_type}`, { rating: s.satisfaction_rating }));

  const podRatingByMove = new Map<string, number>();
  (podsMoveRes.data || []).forEach((p) => {
    if (p.move_id && p.satisfaction_rating != null) podRatingByMove.set(p.move_id, p.satisfaction_rating);
  });
  const podRatingByDelivery = new Map<string, number>();
  (podsDeliveryRes.data || []).forEach((p) => {
    if (p.delivery_id && p.satisfaction_rating != null) podRatingByDelivery.set(p.delivery_id, p.satisfaction_rating);
  });

  function getRating(jobId: string, resolvedKind: "move" | "delivery"): number | null {
    const soPrimary = signOffByJob.get(`${jobId}:${resolvedKind}`);
    if (soPrimary?.rating != null) return soPrimary.rating;
    const altKind = resolvedKind === "move" ? "delivery" : "move";
    const soAlt = signOffByJob.get(`${jobId}:${altKind}`);
    if (soAlt?.rating != null) return soAlt.rating;
    if (resolvedKind === "move") {
      return podRatingByMove.get(jobId) ?? podRatingByDelivery.get(jobId) ?? null;
    }
    return podRatingByDelivery.get(jobId) ?? podRatingByMove.get(jobId) ?? null;
  }

  /** Prefer the canonical move/delivery `id` (proof + tips use it); fall back to session `job_id` (quote id, etc.) */
  function getRatingForSession(
    sessionJid: string,
    canonicalId: string,
    kind: "move" | "delivery",
  ): number | null {
    return (
      getRating(canonicalId, kind) ??
      (sessionJid !== canonicalId ? getRating(sessionJid, kind) : null)
    );
  }

  function getSignOffEntry(
    sessionJid: string,
    canonicalId: string,
    resolvedKind: "move" | "delivery" | null,
    sessionJobType: string,
  ) {
    const rk = (resolvedKind ?? sessionJobType) as "move" | "delivery";
    return (
      (canonicalId ? signOffByJob.get(`${canonicalId}:${rk}`) : null) ||
      signOffByJob.get(`${sessionJid}:${rk}`) ||
      (canonicalId ? signOffByJob.get(`${canonicalId}:${sessionJobType}`) : null) ||
      signOffByJob.get(`${sessionJid}:${sessionJobType}`)
    );
  }

  const jobs = completedSessions.map((s) => {
    const cps = (s.checkpoints as Checkpoint[]) || [];
    const stages = buildStages(
      cps,
      s.started_at || s.completed_at || new Date().toISOString(),
      s.completed_at,
    );

    const startMs = s.started_at ? new Date(s.started_at).getTime() : null;
    const endMs = s.completed_at
      ? new Date(s.completed_at).getTime()
      : cps.length > 0
        ? new Date(cps[cps.length - 1].timestamp).getTime()
        : null;
    const totalDuration = startMs && endMs ? Math.round((endMs - startMs) / 60000) : null;

    const jid = String(s.job_id ?? "").trim();
    const mRow = mapGet(moveByJid, jid);
    const dRow = mapGet(deliveryByJid, jid);
    const declaredMove = s.job_type === "move";

    type Resolved = { kind: "move"; row: MoveRow } | { kind: "delivery"; row: DeliveryRow };
    let resolved: Resolved | null = null;
    if (declaredMove) {
      if (mRow) resolved = { kind: "move", row: mRow };
      else if (dRow) resolved = { kind: "delivery", row: dRow };
    } else {
      if (dRow) resolved = { kind: "delivery", row: dRow };
      else if (mRow) resolved = { kind: "move", row: mRow };
    }

    if (!resolved) {
      const dateStrOr = s.started_at?.split("T")[0];
      return {
        sessionId: s.id,
        jobId: jid,
        jobType: declaredMove ? ("move" as const) : ("delivery" as const),
        date: dateStrOr || null,
        clientName: "—",
        route: "—",
        totalDuration,
        quotedMinutes: null,
        onTime: null,
        rating: getRating(jid, declaredMove ? "move" : "delivery"),
        tip: declaredMove ? tipByMoveId.get(jid) ?? 0 : 0,
        hasSignOff: !!getSignOffEntry(jid, jid, null, s.job_type),
        stages,
      };
    }

    if (resolved.kind === "move") {
      const m = resolved.row;
      const quotedMinutes = (() => {
        const est = m.estimated_duration_minutes;
        if (est != null && Number.isFinite(Number(est)) && Number(est) > 0) return Number(est);
        const estH = m.est_hours;
        if (estH != null && Number.isFinite(Number(estH)) && Number(estH) > 0) return Number(estH) * 60;
        if (m.quoted_hours != null) return Number(m.quoted_hours) * 60;
        if (m.move_size) {
          const baseline = baselineBySize.get(m.move_size);
          if (baseline != null) return Number(baseline) * 60;
        }
        return null;
      })();

      let onTime: boolean | null = null;
      const dateStr = m.move_date || s.started_at?.split("T")[0];
      const arrivalIso = getFirstArrivalIso(cps, ARRIVAL_CHECKPOINTS_MOVE);
      const moveWin = parseMoveScheduleWindow({
        scheduled_date: m.move_date || m.scheduled_date,
        arrival_window: m.arrival_window,
        scheduled_time: m.scheduled_time,
      });
      if (arrivalIso && moveWin) {
        onTime = evaluateArrivalVsCommitmentWindow({
          scheduledYmd: moveWin.scheduledYmd,
          startMin: moveWin.startMin,
          endMin: moveWin.endMin,
          arrivalIso,
        });
      }
      if (onTime == null && (m.arrived_on_time === true || m.arrived_on_time === false)) {
        onTime = m.arrived_on_time;
      }

      const contactName = m.quote_id ? mapGet(contactNameByQuoteId, m.quote_id) : undefined;
      const clientName = String(m.client_name || "").trim() || contactName || "—";
      const fromA = String(m.from_address || "").trim();
      const toA = String(m.to_address || "").trim();
      const route = fromA || toA ? `${fromA || "?"} → ${toA || "?"}` : "—";

      return {
        sessionId: s.id,
        jobId: jid,
        jobType: "move" as const,
        date: dateStr || null,
        clientName,
        route,
        totalDuration,
        quotedMinutes,
        onTime,
        rating: getRatingForSession(jid, m.id, "move"),
        tip: tipByMoveId.get(m.id) ?? (jid !== m.id ? tipByMoveId.get(jid) : undefined) ?? 0,
        hasSignOff: !!getSignOffEntry(jid, m.id, "move", s.job_type),
        stages,
      };
    }

    const d = resolved.row;
    const dateStr = d.scheduled_date || s.started_at?.split("T")[0];
    const arrivalIso = getFirstArrivalIso(cps, ARRIVAL_CHECKPOINTS_DELIVERY);
    const deliveryWin = parseDeliveryScheduleWindow({
      scheduled_date: d.scheduled_date,
      scheduled_start: d.scheduled_start,
      scheduled_end: d.scheduled_end,
      time_slot: d.time_slot,
      delivery_window: d.delivery_window,
      estimated_duration_hours: d.estimated_duration_hours,
      day_type: d.day_type,
    });

    const quotedMinutes = (() => {
      const est = d.estimated_duration_minutes;
      if (est != null && Number.isFinite(Number(est)) && Number(est) > 0) return Number(est);
      return null;
    })();

    let onTime: boolean | null = null;
    if (arrivalIso && deliveryWin) {
      onTime = evaluateArrivalVsCommitmentWindow({
        scheduledYmd: deliveryWin.scheduledYmd,
        startMin: deliveryWin.startMin,
        endMin: deliveryWin.endMin,
        arrivalIso,
      });
    }

    const contactName = d.source_quote_id ? mapGet(contactNameByQuoteId, d.source_quote_id) : undefined;
    const baseName =
      String(d.customer_name || "").trim() ||
      String(d.client_name || "").trim() ||
      String(d.business_name || "").trim();
    const clientName = baseName || contactName || "—";
    const fromA = String(d.pickup_address || "").trim();
    const toA = String(d.delivery_address || "").trim();
    const route = fromA || toA ? `${fromA || "?"} → ${toA || "?"}` : "—";

    return {
      sessionId: s.id,
      jobId: jid,
      jobType: "delivery" as const,
      date: dateStr || null,
      clientName,
      route,
      totalDuration,
      quotedMinutes,
      onTime,
      rating: getRatingForSession(jid, d.id, "delivery"),
      tip: 0,
      hasSignOff: !!getSignOffEntry(jid, d.id, "delivery", s.job_type),
      stages,
    };
  });

  // #region agent log
  {
    const unresJids = allJobIds.filter((j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j));
    const nClientDash = jobs.filter((j) => j.clientName === "—").length;
    const nOnTimeSet = jobs.filter((j) => j.onTime !== null).length;
    const _payload = {
      sessionId: "02a6ee",
      runId: "post-move-project",
      hypothesisId: "H6",
      location: "crew-analytics/crew/route.ts:jobsBuilt",
      message: "crew resolution summary (incl move_project_id + jid map key)",
      data: {
        nJobs: jobs.length,
        nDistinctJids: allJobIds.length,
        nJidStillUnresolved: unresJids.length,
        nClientDash,
        nOnTimeSet,
      },
      timestamp: Date.now(),
    };
    fetch("http://127.0.0.1:7708/ingest/73e1bfae-92f4-4901-bddd-f41e1a91c881", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "02a6ee" },
      body: JSON.stringify(_payload),
    }).catch(() => {});
    try {
      const { appendFileSync } = await import("node:fs");
      const { join } = await import("node:path");
      appendFileSync(
        join(process.cwd(), ".cursor", "debug-02a6ee.log"),
        `${JSON.stringify(_payload)}\n`,
        { encoding: "utf8" },
      );
    } catch {
      /* local-only */
    }
  }
  // #endregion

  // Build weekly trend data
  const weekMap = new Map<
    string,
    { jobs: number; totalDuration: number; ratings: number[]; tips: number }
  >();
  jobs.forEach((j) => {
    if (!j.date) return;
    const d = new Date(j.date + "T00:00:00");
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay());
    const wk = weekStart.toISOString().split("T")[0];
    if (!weekMap.has(wk)) weekMap.set(wk, { jobs: 0, totalDuration: 0, ratings: [], tips: 0 });
    const w = weekMap.get(wk)!;
    w.jobs += 1;
    if (j.totalDuration) w.totalDuration += j.totalDuration;
    if (j.rating != null) w.ratings.push(j.rating);
    w.tips += j.tip;
  });
  const trends = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, w]) => ({
      week,
      weekLabel: new Date(week + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      jobs: w.jobs,
      avgDuration: w.jobs > 0 ? Math.round(w.totalDuration / w.jobs) : null,
      avgRating:
        w.ratings.length > 0
          ? Math.round((w.ratings.reduce((a, b) => a + b, 0) / w.ratings.length) * 10) / 10
          : null,
      tips: w.tips,
    }));

  const totalTips = totalTipsFromTable;
  const onTimeJobs = jobs.filter((j) => j.onTime === true).length;
  const timedJobs = jobs.filter((j) => j.onTime !== null).length;
  const onTimeRate = timedJobs > 0 ? Math.round((onTimeJobs / timedJobs) * 100) : null;
  const allRatings = jobs.filter((j) => j.rating != null).map((j) => j.rating!);
  const avgRating =
    allRatings.length > 0
      ? Math.round((allRatings.reduce((a, b) => a + b, 0) / allRatings.length) * 10) / 10
      : null;

  return NextResponse.json({
    crew: { id: crew.id, name: crew.name, members: (crew.members as string[]) || [] },
    jobs,
    trends,
    summary: {
      totalJobs: jobs.length,
      avgRating,
      onTimeRate,
      totalTips,
    },
    from,
    to,
  });
}

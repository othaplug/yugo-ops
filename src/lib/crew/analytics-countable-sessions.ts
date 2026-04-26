import type { SupabaseClient } from "@supabase/supabase-js";
import {
  CREW_JOB_UUID_RE,
  selectDeliveryByJobId,
} from "@/lib/resolve-delivery-by-job-id";

/**
 * Keeps `/api/admin/crew-analytics` job totals aligned with `/api/admin/crew-analytics/crew`:
 * only completed sessions whose `job_id` resolves to a move or delivery (same rules as job history).
 */

const IN_CHUNK = 100;

function chunkIds(ids: string[]): string[][] {
  if (ids.length === 0) return [];
  const out: string[][] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) out.push(ids.slice(i, i + IN_CHUNK));
  return out;
}

function caseKeyTries(k: string): string[] {
  const t = k.trim();
  if (!t) return [];
  const noHash = t.replace(/^#/, "");
  return [...new Set([t, noHash, t.toLowerCase(), t.toUpperCase(), noHash.toLowerCase(), noHash.toUpperCase()])];
}

function mapPutAll<T>(m: Map<string, T>, key: string | null | undefined, value: T) {
  if (key == null) return;
  for (const k of caseKeyTries(String(key))) m.set(k, value);
}

function mapGet<T>(m: Map<string, T>, key: string | null | undefined): T | undefined {
  if (key == null) return undefined;
  for (const k of caseKeyTries(String(key))) {
    const v = m.get(k);
    if (v !== undefined) return v;
  }
  return undefined;
}

const norm = (s: string | null | undefined) =>
  String(s ?? "")
    .trim()
    .replace(/^#/, "")
    .toLowerCase();

const MOVE_SELECT =
  "id, client_name, from_address, to_address, move_size, arrival_window, scheduled_date, scheduled_time, quote_id, move_project_id, estimated_duration_minutes, est_hours, arrived_on_time, move_code";
const DELIVERY_SELECT =
  "id, customer_name, client_name, business_name, pickup_address, delivery_address, scheduled_date, scheduled_start, scheduled_end, delivery_window, time_slot, source_quote_id, estimated_duration_minutes, estimated_duration_hours, day_type, delivery_number, score_arrived_late";

type MoveRow = Record<string, unknown> & { id: string };
type DeliveryRow = Record<string, unknown> & { id: string };

function expandIdsForTextColumn(ids: string[]) {
  return [
    ...new Set(
      ids.flatMap((id) => [
        id,
        id.toLowerCase(),
        id.toUpperCase(),
        id.replace(/^#/, ""),
        id.replace(/^#/, "").toLowerCase(),
        id.replace(/^#/, "").toUpperCase(),
      ]),
    ),
  ];
}

async function fetchMovesIn(
  admin: SupabaseClient,
  col: "id" | "quote_id" | "move_code" | "move_project_id",
  ids: string[],
): Promise<MoveRow[]> {
  if (ids.length === 0) return [];
  const rows: MoveRow[] = [];
  for (const part of chunkIds(col === "move_code" ? expandIdsForTextColumn(ids) : ids)) {
    const { data } = await admin.from("moves").select(MOVE_SELECT).in(col, part);
    if (data) rows.push(...(data as MoveRow[]));
  }
  return rows;
}

async function fetchDeliveriesIn(
  admin: SupabaseClient,
  col: "id" | "source_quote_id" | "delivery_number",
  ids: string[],
): Promise<DeliveryRow[]> {
  if (ids.length === 0) return [];
  const rows: DeliveryRow[] = [];
  for (const part of chunkIds(col === "delivery_number" ? expandIdsForTextColumn(ids) : ids)) {
    const { data } = await admin.from("deliveries").select(DELIVERY_SELECT).in(col, part);
    if (data) rows.push(...(data as DeliveryRow[]));
  }
  return rows;
}

function buildJidLookups(moveByPk: Map<string, MoveRow>, delByPk: Map<string, DeliveryRow>) {
  const mr = Array.from(moveByPk.values());
  const dr = Array.from(delByPk.values());
  const mJ = new Map<string, MoveRow>();
  for (const m of mr) {
    mapPutAll(mJ, m.id as string, m);
    mapPutAll(mJ, m.quote_id as string | null | undefined, m);
    mapPutAll(mJ, m.move_code as string | null | undefined, m);
    if (m.move_project_id) mapPutAll(mJ, String(m.move_project_id), m);
  }
  const dJ = new Map<string, DeliveryRow>();
  for (const d of dr) {
    mapPutAll(dJ, d.id as string, d);
    mapPutAll(dJ, d.source_quote_id as string | null | undefined, d);
    mapPutAll(dJ, d.delivery_number as string | null | undefined, d);
  }
  return { moveRows: mr, deliveryRows: dr, moveByJid: mJ, deliveryByJid: dJ };
}

export type CompletedSessionLite = {
  job_id: string;
  job_type: string;
};

export async function filterCompletedSessionsWithResolvableJobs<T extends CompletedSessionLite>(
  admin: SupabaseClient,
  completedSessions: T[],
): Promise<T[]> {
  if (completedSessions.length === 0) return [];

  const allJobIds = [
    ...new Set(
      completedSessions
        .map((s) => String(s.job_id || "").trim())
        .filter((id) => id.length > 0),
    ),
  ];

  const moveByPk = new Map<string, MoveRow>();
  const delByPk = new Map<string, DeliveryRow>();
  const putMove = (m: MoveRow) => {
    moveByPk.set(norm(m.id), m);
  };
  const putDel = (d: DeliveryRow) => {
    delByPk.set(norm(d.id), d);
  };

  const [moveRowsById, moveRowsByQuoteId, deliveryRowsById] = await Promise.all([
    fetchMovesIn(admin, "id", allJobIds),
    fetchMovesIn(admin, "quote_id", allJobIds),
    fetchDeliveriesIn(admin, "id", allJobIds),
  ]);
  for (const m of moveRowsById) putMove(m);
  for (const m of moveRowsByQuoteId) putMove(m);
  for (const d of deliveryRowsById) putDel(d);

  const orphanJobIds = allJobIds.filter((j) => !moveByPk.has(norm(j)) && !delByPk.has(norm(j)));
  if (orphanJobIds.length > 0) {
    const [mq, mc, mproj, dsq, dnum] = await Promise.all([
      fetchMovesIn(admin, "quote_id", orphanJobIds),
      fetchMovesIn(admin, "move_code", orphanJobIds),
      fetchMovesIn(admin, "move_project_id", orphanJobIds),
      fetchDeliveriesIn(admin, "source_quote_id", orphanJobIds),
      fetchDeliveriesIn(admin, "delivery_number", orphanJobIds),
    ]);
    for (const m of [...mq, ...mc, ...mproj]) putMove(m);
    for (const d of [...dsq, ...dnum]) putDel(d);
  }

  let { moveByJid, deliveryByJid } = buildJidLookups(moveByPk, delByPk);

  const stillMissing = allJobIds.filter((j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j));
  if (stillMissing.length > 0) {
    const [mById, mByQ, mByProj, dById, dByQ, dByNum] = await Promise.all([
      fetchMovesIn(admin, "id", stillMissing),
      fetchMovesIn(admin, "quote_id", stillMissing),
      fetchMovesIn(admin, "move_project_id", stillMissing),
      fetchDeliveriesIn(admin, "id", stillMissing),
      fetchDeliveriesIn(admin, "source_quote_id", stillMissing),
      fetchDeliveriesIn(admin, "delivery_number", stillMissing),
    ]);
    for (const m of [...mById, ...mByQ, ...mByProj]) putMove(m);
    for (const d of [...dById, ...dByQ, ...dByNum]) putDel(d);
    const again = buildJidLookups(moveByPk, delByPk);
    moveByJid = again.moveByJid;
    deliveryByJid = again.deliveryByJid;
  }

  const isLikelyUuid = (s: string) => CREW_JOB_UUID_RE.test(String(s).trim());

  const stillMissing2 = allJobIds.filter((j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j));
  if (stillMissing2.length > 0) {
    const byQuoteKey = new Map<string, { id: string; quote_id: string | null }>();
    const mergeQuote = (q: { id?: string; quote_id?: string | null } | null) => {
      if (!q || !q.id) return;
      byQuoteKey.set(norm(String(q.id)), q as { id: string; quote_id: string | null });
    };
    const uuidPart = stillMissing2.filter((j) => isLikelyUuid(j));
    const textPart = stillMissing2.filter((j) => !isLikelyUuid(j));
    for (const part of chunkIds(uuidPart)) {
      if (part.length === 0) continue;
      const { data: qrows } = await admin.from("quotes").select("id, quote_id").in("id", part);
      (qrows || []).forEach((q) => mergeQuote(q as { id: string; quote_id: string | null }));
    }
    for (const part of chunkIds(expandIdsForTextColumn(textPart))) {
      if (part.length === 0) continue;
      const { data: qrows } = await admin.from("quotes").select("id, quote_id").in("quote_id", part);
      (qrows || []).forEach((q) => mergeQuote(q as { id: string; quote_id: string | null }));
    }
    const uniqueQuotes = Array.from(byQuoteKey.values());
    if (uniqueQuotes.length > 0) {
      const quotePkIds = uniqueQuotes.map((q) => q.id);
      const [mByQuotePk, dByQuotePk] = await Promise.all([
        fetchMovesIn(admin, "quote_id", quotePkIds),
        fetchDeliveriesIn(admin, "source_quote_id", quotePkIds),
      ]);
      for (const m of [...(mByQuotePk || [])]) putMove(m);
      for (const d of [...(dByQuotePk || [])]) putDel(d);
      const re = buildJidLookups(moveByPk, delByPk);
      moveByJid = re.moveByJid;
      deliveryByJid = re.deliveryByJid;
      for (const q of uniqueQuotes) {
        const mHit = re.moveRows.find(
          (row) => row.quote_id && norm(String(row.quote_id)) === norm(String(q.id)),
        );
        if (mHit) {
          mapPutAll(moveByJid, String(q.id), mHit);
          if (q.quote_id) mapPutAll(moveByJid, String(q.quote_id), mHit);
        }
        const dHit = re.deliveryRows.find(
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

  const stillMissing3 = allJobIds.filter((j) => !mapGet(moveByJid, j) && !mapGet(deliveryByJid, j));
  const jobTypeByJid = new Map<string, string>();
  for (const s of completedSessions) {
    const j = String(s.job_id ?? "").trim();
    if (j) jobTypeByJid.set(j, String(s.job_type ?? ""));
  }

  const explicitMoveJid = new Map<string, MoveRow>();
  const explicitDelJid = new Map<string, DeliveryRow>();

  if (stillMissing3.length > 0) {
    const tryMove = async (jid: string) => {
      const raw = String(jid).trim();
      if (!raw) return false;
      let m: MoveRow | null = null;
      if (CREW_JOB_UUID_RE.test(raw)) {
        const { data } = await admin.from("moves").select(MOVE_SELECT).eq("id", raw).maybeSingle();
        if (data) m = data as MoveRow;
      }
      if (!m) {
        const { data } = await admin
          .from("moves")
          .select(MOVE_SELECT)
          .ilike("move_code", raw.replace(/^#/, "").toUpperCase())
          .maybeSingle();
        if (data) m = data as MoveRow;
      }
      if (m?.id) {
        putMove(m);
        explicitMoveJid.set(jid, m);
        return true;
      }
      return false;
    };
    const tryDel = async (jid: string) => {
      const { data } = await selectDeliveryByJobId(admin, jid, DELIVERY_SELECT);
      const d = data as DeliveryRow | null;
      if (d?.id) {
        putDel(d);
        explicitDelJid.set(jid, d);
        return true;
      }
      return false;
    };
    const resolveJid = async (jid: string) => {
      const jt = jobTypeByJid.get(jid);
      const moveFirst = jt === "move";
      if (moveFirst) {
        if (await tryMove(jid)) return;
        await tryDel(jid);
      } else {
        if (await tryDel(jid)) return;
        await tryMove(jid);
      }
    };
    await Promise.all(stillMissing3.map((jid) => resolveJid(jid)));
    if (explicitMoveJid.size > 0 || explicitDelJid.size > 0) {
      const re = buildJidLookups(moveByPk, delByPk);
      moveByJid = re.moveByJid;
      deliveryByJid = re.deliveryByJid;
      for (const [jid, m] of explicitMoveJid) mapPutAll(moveByJid, jid, m);
      for (const [jid, d] of explicitDelJid) mapPutAll(deliveryByJid, jid, d);
    }
  }

  const sessionResolves = (s: CompletedSessionLite): boolean => {
    const jid = String(s.job_id ?? "").trim();
    if (!jid) return false;
    const mRow = mapGet(moveByJid, jid);
    const dRow = mapGet(deliveryByJid, jid);
    const declaredMove = s.job_type === "move";
    if (declaredMove) {
      if (mRow) return true;
      if (dRow) return true;
    } else {
      if (dRow) return true;
      if (mRow) return true;
    }
    return false;
  };

  return completedSessions.filter((s) => sessionResolves(s));
}

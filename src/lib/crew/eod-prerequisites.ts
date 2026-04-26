import type { SupabaseClient } from "@supabase/supabase-js";
import { formatJobId } from "@/lib/move-code";
import {
  computeCrewTipReportNeeded,
  type TipReportTipRow,
} from "@/lib/crew/tip-report-eligibility";

export type EodPrerequisiteJob = {
  jobId: string;
  jobType: "move" | "delivery";
  displayId: string;
};

export type EodPrerequisites = {
  canSubmit: boolean;
  missingEquipment: EodPrerequisiteJob[];
  missingTipReport: EodPrerequisiteJob[];
};

/**
 * Completed jobs today must have a post-job equipment check row and a tip report
 * (cash / interac / none) before end-of-day can be submitted or the next job opened.
 */
export async function getCrewEodPrerequisites(
  admin: SupabaseClient,
  teamId: string,
  today: string,
): Promise<EodPrerequisites> {
  const { data: sessions } = await admin
    .from("tracking_sessions")
    .select("id, job_id, job_type, started_at, status, completed_at, updated_at, checkpoints")
    .eq("team_id", teamId)
    .gte("started_at", today);

  const completed = (sessions || []).filter((s) => s.status === "completed");
  if (completed.length === 0) {
    return { canSubmit: true, missingEquipment: [], missingTipReport: [] };
  }

  const moveIds = [
    ...new Set(completed.filter((s) => s.job_type === "move").map((s) => s.job_id as string)),
  ];
  const deliveryIds = [
    ...new Set(
      completed.filter((s) => s.job_type === "delivery").map((s) => s.job_id as string),
    ),
  ];

  const [movesRes, delRes, eqMoves, eqDel, tipsM, tipsD] = await Promise.all([
    moveIds.length
      ? admin.from("moves").select("id, move_code").in("id", moveIds)
      : { data: [] as { id: string; move_code?: string | null }[] },
    deliveryIds.length
      ? admin
          .from("deliveries")
          .select("id, delivery_number")
          .in("id", deliveryIds)
      : { data: [] as { id: string; delivery_number?: string | null }[] },
    moveIds.length
      ? admin.from("equipment_checks").select("job_id").eq("job_type", "move").in("job_id", moveIds)
      : { data: [] as { job_id: string }[] },
    deliveryIds.length
      ? admin
          .from("equipment_checks")
          .select("job_id")
          .eq("job_type", "delivery")
          .in("job_id", deliveryIds)
      : { data: [] as { job_id: string }[] },
    moveIds.length
      ? admin
          .from("tips")
          .select("move_id, square_payment_id, amount, method, reported_by, delivery_id")
          .in("move_id", moveIds)
      : { data: [] as Record<string, unknown>[] },
    deliveryIds.length
      ? admin
          .from("tips")
          .select("move_id, square_payment_id, amount, method, reported_by, delivery_id")
          .in("delivery_id", deliveryIds)
      : { data: [] as Record<string, unknown>[] },
  ]);

  const display = new Map<string, string>();
  for (const m of movesRes.data || []) {
    display.set(
      `move:${m.id}`,
      formatJobId(m.move_code || m.id, "move"),
    );
  }
  for (const d of delRes.data || []) {
    display.set(
      `delivery:${d.id}`,
      formatJobId(d.delivery_number || d.id, "delivery"),
    );
  }

  const hasEq = new Set<string>();
  for (const r of eqMoves.data || []) {
    if (r.job_id) hasEq.add(`move:${r.job_id}`);
  }
  for (const r of eqDel.data || []) {
    if (r.job_id) hasEq.add(`delivery:${r.job_id}`);
  }

  const missingEquipment: EodPrerequisiteJob[] = [];
  for (const s of completed) {
    const jt = s.job_type as "move" | "delivery";
    const jid = s.job_id as string;
    const key = `${jt}:${jid}`;
    if (!hasEq.has(key)) {
      missingEquipment.push({
        jobId: jid,
        jobType: jt,
        displayId: display.get(key) || jid,
      });
    }
  }

  const tipByMove = new Map<string, TipReportTipRow | null>();
  for (const t of tipsM.data || []) {
    const mid = t.move_id as string | null | undefined;
    if (mid) tipByMove.set(mid, t as TipReportTipRow);
  }
  const tipByDel = new Map<string, TipReportTipRow | null>();
  for (const t of tipsD.data || []) {
    const did = t.delivery_id as string | null | undefined;
    if (did) tipByDel.set(did, t as TipReportTipRow);
  }

  const missingTipReport: EodPrerequisiteJob[] = [];
  for (const s of completed) {
    const jt = s.job_type as "move" | "delivery";
    const jid = s.job_id as string;
    const key = `${jt}:${jid}`;
    const row =
      jt === "move" ? tipByMove.get(jid) ?? null : tipByDel.get(jid) ?? null;
    if (computeCrewTipReportNeeded(row)) {
      missingTipReport.push({
        jobId: jid,
        jobType: jt,
        displayId: display.get(key) || jid,
      });
    }
  }

  return {
    canSubmit: missingEquipment.length === 0 && missingTipReport.length === 0,
    missingEquipment,
    missingTipReport,
  };
}

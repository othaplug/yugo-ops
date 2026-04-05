/**
 * Pure derivation of Estate checklist flags from move row (safe for client + server).
 */

import { parseDateOnly } from "@/lib/date-format";
import { buildEstateServiceChecklistItems } from "@/lib/estate-service-checklist";
import { calculateEstateDays } from "@/lib/quotes/estate-schedule";

export type EstateChecklistMoveRow = {
  tier_selected?: string | null;
  service_tier?: string | null;
  status?: string | null;
  stage?: string | null;
  scheduled_date?: string | null;
  move_size?: string | null;
  inventory_score?: number | null;
};

function isEstateTier(row: EstateChecklistMoveRow): boolean {
  const t = String(row.tier_selected || row.service_tier || "")
    .toLowerCase()
    .trim();
  return t === "estate";
}

function normStage(stage: string | null | undefined): string {
  return String(stage || "")
    .toLowerCase()
    .trim()
    .replace(/-/g, "_");
}

function startOfLocalDay(d: Date): Date {
  const x = new Date(d.getTime());
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Stages that mean the truck / destination leg has started (not pack-day pickup only). */
const MOVE_TRANSPORT_DESTINATION_STAGES = new Set([
  "en_route_to_destination",
  "in_transit",
  "arrived_at_destination",
  "unloading",
  "job_complete",
  "completed",
]);

/**
 * Keys the product should treat as completed from ops data alone (client UI + DB merge).
 */
export function deriveEstateServiceChecklistAutomation(
  row: EstateChecklistMoveRow,
): Record<string, boolean> {
  if (!isEstateTier(row)) return {};

  const plan = calculateEstateDays(
    row.move_size,
    Number(row.inventory_score) || 0,
  );
  const items = buildEstateServiceChecklistItems(plan);
  const allowed = new Set(items.map((i) => i.id));

  const status = String(row.status || "").toLowerCase().trim();
  const stage = normStage(row.stage);
  const inJob = status === "in_progress" || status === "completed";

  const out: Record<string, boolean> = {};

  if (
    allowed.has("estate_unpacking") &&
    plan.unpackIncluded &&
    (status === "completed" ||
      stage === "completed" ||
      stage === "job_complete")
  ) {
    out.estate_unpacking = true;
  }

  if (allowed.has("estate_move") && inJob) {
    if (MOVE_TRANSPORT_DESTINATION_STAGES.has(stage)) {
      out.estate_move = true;
    } else if (stage === "loading") {
      const sched = String(row.scheduled_date || "").trim().slice(0, 10);
      if (!plan.packDay) {
        out.estate_move = true;
      } else if (sched) {
        const moveDay = parseDateOnly(sched);
        const today = startOfLocalDay(new Date());
        if (moveDay && today.getTime() >= startOfLocalDay(moveDay).getTime()) {
          out.estate_move = true;
        }
      } else {
        out.estate_move = true;
      }
    }
  }

  return out;
}

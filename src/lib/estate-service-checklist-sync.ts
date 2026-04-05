/**
 * Estate track: auto-check milestones from move status / live stage (crew + admin completion).
 * Merges `true` into `moves.estate_service_checklist` — never clears client-set flags.
 */

import {
  deriveEstateServiceChecklistAutomation,
  type EstateChecklistMoveRow,
} from "@/lib/estate-service-checklist-automation";
import { createAdminClient } from "@/lib/supabase/admin";

export type { EstateChecklistMoveRow };

/**
 * Writes automated `true` flags into `estate_service_checklist` when missing.
 */
type AdminClient = ReturnType<typeof createAdminClient>;

export async function applyEstateServiceChecklistAutomation(
  admin: AdminClient,
  moveId: string,
): Promise<void> {
  const { data: move, error } = await admin
    .from("moves")
    .select(
      "id, tier_selected, service_tier, status, stage, scheduled_date, move_size, inventory_score, estate_service_checklist",
    )
    .eq("id", moveId)
    .single();

  if (error || !move) return;

  const auto = deriveEstateServiceChecklistAutomation(move as EstateChecklistMoveRow);
  if (Object.keys(auto).length === 0) return;

  const cur =
    (move.estate_service_checklist as Record<string, boolean> | null) || {};
  const next = { ...cur };
  let changed = false;
  for (const [k, v] of Object.entries(auto)) {
    if (v && !next[k]) {
      next[k] = true;
      changed = true;
    }
  }
  if (!changed) return;

  await admin.from("moves").update({ estate_service_checklist: next }).eq("id", moveId);
}

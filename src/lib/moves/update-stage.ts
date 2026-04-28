/**
 * Re-exports the guarded checkpoint sync used everywhere crew progress touches moves/deliveries.
 * Direct `.update({ status, stage })` on jobs from tracking should go through
 * `applyCheckpointProgressToJobRow` or `ensureJobCompleted` only.
 */
export {
  applyCheckpointProgressToJobRow,
  ensureJobCompleted,
} from "@/lib/moves/complete-move-job";

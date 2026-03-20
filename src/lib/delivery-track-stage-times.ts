/**
 * Maps crew tracking checkpoint history to the 4 client-facing delivery tracker steps.
 * Checkpoints are appended in `/api/tracking/checkpoint` with `{ status, timestamp, ... }`.
 */

const LEGACY_STATUS: Record<string, string> = {
  en_route: "en_route_to_pickup",
  on_route: "en_route_to_pickup",
  arrived: "arrived_at_pickup",
  arrived_on_site: "arrived_at_pickup",
  delivering: "en_route_to_destination",
};

function normalizeCheckpointStatus(status: string): string {
  return LEGACY_STATUS[status] || status;
}

type CheckpointRow = { status?: string; timestamp?: string };

function firstCheckpointTimestamp(checkpoints: CheckpointRow[], statuses: Set<string>): string | null {
  for (const cp of checkpoints) {
    if (!cp || typeof cp !== "object") continue;
    const st = normalizeCheckpointStatus(String(cp.status || ""));
    const ts = cp.timestamp;
    if (!ts || typeof ts !== "string") continue;
    if (statuses.has(st)) return ts;
  }
  return null;
}

/** Four entries aligned with CLIENT_MAIN_STEPS on the public delivery track page. ISO timestamps or null. */
export function buildClientMainStepCompletedAt(
  checkpointsRaw: unknown,
  deliveryCompletedAt: string | null | undefined,
): [string | null, string | null, string | null, string | null] {
  const checkpoints: CheckpointRow[] = Array.isArray(checkpointsRaw)
    ? checkpointsRaw.filter((c) => c && typeof c === "object")
    : [];

  const step0 = firstCheckpointTimestamp(checkpoints, new Set(["arrived_at_pickup", "loading"]));
  const step1 = firstCheckpointTimestamp(checkpoints, new Set(["arrived_at_destination"]));
  const step2 = firstCheckpointTimestamp(checkpoints, new Set(["unloading"]));
  let step3 = firstCheckpointTimestamp(checkpoints, new Set(["completed"]));
  if (!step3 && deliveryCompletedAt) step3 = deliveryCompletedAt;

  return [step0, step1, step2, step3];
}

/** Stages/statuses where crew reassignment is blocked (matches /api/dispatch/assign). */
const IN_PROGRESS = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
  "in_transit",
] as const;

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().replace(/-/g, "_");
}

const IN_PROGRESS_SET = new Set<string>(IN_PROGRESS);

/** True when a move or delivery is actively underway; reassignment is not allowed. */
export function isDispatchJobInProgress(status: string | null | undefined, stage: string | null | undefined): boolean {
  return IN_PROGRESS_SET.has(norm(status)) || IN_PROGRESS_SET.has(norm(stage));
}

/**
 * Infer on-time completion from crew completion time vs scheduled window when
 * `moves.arrived_on_time` is unavailable (e.g. column not migrated yet).
 */
export function inferMoveOnTimeFromCompletion(params: {
  completed_at?: string | null;
  scheduled_time?: string | null;
}): boolean {
  const completedAt = params.completed_at;
  if (!completedAt) return true;
  const completed = new Date(completedAt);
  if (Number.isNaN(completed.getTime())) return true;
  const w = String(params.scheduled_time || "").toLowerCase();
  if (
    w.includes("morning") ||
    w.includes("8 am") ||
    w.includes("8am") ||
    w.includes("10 am") ||
    w.includes("10am")
  ) {
    return completed.getHours() < 12;
  }
  if (
    w.includes("afternoon") ||
    w.includes("12 pm") ||
    w.includes("12pm") ||
    w.includes("2 pm") ||
    w.includes("4 pm")
  ) {
    return completed.getHours() < 17;
  }
  return completed.getHours() < 20;
}

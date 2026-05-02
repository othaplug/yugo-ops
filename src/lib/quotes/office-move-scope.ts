/**
 * Office relocation day-count hint for coordinator scope UI (Generate Quote).
 * Mirrors residential move_scope styling; workstation pricing stays in calcOffice.
 */

export type OfficeDaysDetectionInput = {
  workstations?: number;
  square_footage?: number;
  server_room?: boolean;
  /** Schedule dropdown label, e.g. "Phased multi-day". */
  schedule?: string;
};

export function detectOfficeDays(input: OfficeDaysDetectionInput): number {
  let days = 1;

  const workstations = Math.max(0, input.workstations || 0);
  const sqft = Math.max(
    0,
    typeof input.square_footage === "number" && Number.isFinite(input.square_footage)
      ? input.square_footage
      : Number(input.square_footage) || 0,
  );

  if (workstations > 30 || sqft > 5000) days += 1;
  if (workstations > 60 || sqft > 10000) days += 1;

  if (input.server_room) days += 1;

  const sched = (input.schedule || "").toLowerCase();
  if (sched.includes("phased") && sched.includes("multi")) days += 1;

  return Math.min(Math.max(days, 1), 14);
}

export function describeOfficeMoveScopeAutoReason(
  input: OfficeDaysDetectionInput,
): string {
  const n = detectOfficeDays(input);
  const parts: string[] = [];
  const ws = Math.max(0, input.workstations || 0);
  if (ws > 0) parts.push(`${ws} workstations`);
  const sched = (input.schedule || "").toLowerCase();
  if (sched.includes("phased") && sched.includes("multi")) parts.push("phased");
  if (input.server_room && !parts.some((p) => p.includes("server") || p.includes("IT"))) {
    parts.push("server / IT areas");
  }
  const suffix = parts.length > 0 ? parts.join(", ") : "detected footprint";
  return `${n} days (${suffix})`;
}

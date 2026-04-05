/** Rough Toronto core heuristic for parking-permit style reminders. */
export function isLikelyDowntownTorontoPostal(postal: string | null | undefined): boolean {
  const c = (postal || "").trim().toUpperCase().replace(/\s+/g, "");
  if (c.length < 3) return false;
  if (c.startsWith("M5")) return true;
  if (c.startsWith("M4W")) return true;
  return false;
}

export function accessMentionsElevator(
  fromAccess: string | null | undefined,
  toAccess: string | null | undefined,
): boolean {
  const a = `${fromAccess || ""} ${toAccess || ""}`.toLowerCase();
  return a.includes("elevator");
}

export function parkingReminderLikelyNeeded(move: {
  from_postal?: string | null;
  to_postal?: string | null;
  from_parking?: string | null;
  to_parking?: string | null;
}): boolean {
  const fp = String(move.from_parking || "").toLowerCase();
  const tp = String(move.to_parking || "").toLowerCase();
  if (fp.includes("street") || tp.includes("street")) return true;
  return (
    isLikelyDowntownTorontoPostal(move.from_postal) ||
    isLikelyDowntownTorontoPostal(move.to_postal)
  );
}

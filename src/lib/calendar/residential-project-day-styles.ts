/** Calendar pill accent for residential move_project_days (distinct from legacy move_project_day default). */

export function calendarColorForResidentialProjectDay(dayType: string | null | undefined): string {
  const t = String(dayType || "move").toLowerCase().trim()
  switch (t) {
    case "pack":
      return "#047857";
    case "unpack":
      return "#0D9488";
    case "crating":
      return "#B45309";
    case "volume":
      return "#4338CA";
    case "move":
      return "#4F46E5";
    default:
      return "#6366F1";
  }
}

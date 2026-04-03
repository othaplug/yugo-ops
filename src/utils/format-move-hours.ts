/** Map stored PM / building move-hours codes to readable copy (admin + partner UI). */
export function formatMoveHoursLabel(hours: string | null | undefined): string {
  const raw = String(hours || "").trim();
  if (!raw) return "";
  const k = raw.toLowerCase().replace(/\s+/g, "_");
  if (k === "8to6" || k === "8_to_6") return "8:00 AM – 6:00 PM";
  if (k === "24_7" || k === "24/7") return "24/7";
  if (k === "custom") return "Custom (see notes)";
  return raw.replace(/to/gi, "–").replace(/_/g, " ");
}

/**
 * Parse the START time (minutes since midnight) from a job's time label so
 * jobs/moves sort chronologically by when they actually start.
 *
 * Handles "Early Morning (6:00 AM – 8:00 AM)", "8 AM to 10 AM", "9:30 AM",
 * 24h "06:00", and bare slot names ("Morning", "Afternoon"). The old sorts
 * stripped to digits and string-compared, so "10:00" sorted before "9:00",
 * AM/PM was ignored, and a 6–8 AM job rendered behind an 8–10 AM job.
 * Unparseable / TBD / flexible values return a value that sorts last.
 */
export function jobStartMinutes(label: string | null | undefined): number {
  const s = String(label ?? "").trim();
  if (!s) return 24 * 60 + 1;
  // First "H[:MM] am/pm" token (handles "6:00 AM", "8 AM", "9:30am").
  const ampm = s.match(/(\d{1,2})(?::(\d{2}))?\s*([ap])\.?\s*m/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    const min = ampm[2] ? parseInt(ampm[2], 10) : 0;
    if (/p/i.test(ampm[3])) h += 12;
    return h * 60 + min;
  }
  // First 24h "HH:MM" token.
  const h24 = s.match(/\b(\d{1,2}):(\d{2})\b/);
  if (h24) {
    const h = parseInt(h24[1], 10);
    const min = parseInt(h24[2], 10);
    if (h <= 23 && min <= 59) return h * 60 + min;
  }
  // Named slots without an explicit clock time. Check "early morning" before
  // "morning" since the former contains the latter.
  const lc = s.toLowerCase();
  if (lc.includes("early morning")) return 6 * 60;
  if (lc.includes("morning")) return 8 * 60;
  if (lc.includes("afternoon")) return 13 * 60;
  if (lc.includes("evening")) return 17 * 60;
  if (lc.includes("night")) return 19 * 60;
  return 24 * 60 + 1; // TBD / flexible / unknown → last
}

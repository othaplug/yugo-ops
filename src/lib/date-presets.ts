/** Move Date filter presets - used globally across admin filter bars */

export const MOVE_DATE_OPTIONS: { value: string; label: string; group: string }[] = [
  { value: "", label: "All dates", group: "" },
  { value: "today", label: "Today", group: "Days" },
  { value: "yesterday", label: "Yesterday", group: "Days" },
  { value: "tomorrow", label: "Tomorrow", group: "Days" },
  { value: "this_week", label: "This week", group: "Weeks" },
  { value: "last_week", label: "Last week", group: "Weeks" },
  { value: "next_week", label: "Next week", group: "Weeks" },
  { value: "this_month", label: "This month", group: "Months" },
  { value: "last_month", label: "Last month", group: "Months" },
  { value: "next_month", label: "Next month", group: "Months" },
  { value: "this_quarter", label: "This quarter", group: "Quarter" },
  { value: "last_quarter", label: "Last quarter", group: "Quarter" },
  { value: "next_quarter", label: "Next quarter", group: "Quarter" },
  { value: "this_year", label: "This year", group: "Years" },
  { value: "last_year", label: "Last year", group: "Years" },
  { value: "next_year", label: "Next year", group: "Years" },
];

function startOfDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function getQuarterBounds(d: Date): { start: Date; end: Date } {
  const q = Math.floor(d.getMonth() / 3) + 1;
  const start = new Date(d.getFullYear(), (q - 1) * 3, 1);
  const end = new Date(d.getFullYear(), q * 3, 0);
  return { start, end };
}

function getWeekBounds(d: Date): { start: Date; end: Date } {
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday = start
  const start = new Date(d);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Returns [from, to] as YYYY-MM-DD or null if no filter */
export function getDateRangeFromPreset(preset: string): { from: string; to: string } | null {
  if (!preset) return null;
  const now = new Date();
  const today = startOfDay(now);

  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = new Date(now);
      y.setDate(y.getDate() - 1);
      const ys = startOfDay(y);
      return { from: ys, to: ys };
    }
    case "tomorrow": {
      const t = new Date(now);
      t.setDate(t.getDate() + 1);
      const ts = startOfDay(t);
      return { from: ts, to: ts };
    }
    case "this_week": {
      const { start, end } = getWeekBounds(now);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "last_week": {
      const lastMon = new Date(now);
      lastMon.setDate(lastMon.getDate() - 7);
      const { start, end } = getWeekBounds(lastMon);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "next_week": {
      const nextMon = new Date(now);
      nextMon.setDate(nextMon.getDate() + 7);
      const { start, end } = getWeekBounds(nextMon);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "last_month": {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "next_month": {
      const start = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "this_quarter": {
      const { start, end } = getQuarterBounds(now);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "last_quarter": {
      const lastQ = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      const { start, end } = getQuarterBounds(lastQ);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "next_quarter": {
      const nextQ = new Date(now.getFullYear(), now.getMonth() + 3, 1);
      const { start, end } = getQuarterBounds(nextQ);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "this_year": {
      const start = new Date(now.getFullYear(), 0, 1);
      const end = new Date(now.getFullYear(), 11, 31);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "last_year": {
      const start = new Date(now.getFullYear() - 1, 0, 1);
      const end = new Date(now.getFullYear() - 1, 11, 31);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    case "next_year": {
      const start = new Date(now.getFullYear() + 1, 0, 1);
      const end = new Date(now.getFullYear() + 1, 11, 31);
      return { from: startOfDay(start), to: startOfDay(end) };
    }
    default:
      return null;
  }
}

/** English ordinal suffix for day-of-month labels (1st, 2nd, 21st, 22nd, 31st). */
export function ordinalDay(n: number): string {
  const v = Math.floor(Math.abs(n)) % 100;
  const suffix = (() => {
    if (v >= 11 && v <= 13) return "th";
    switch (v % 10) {
      case 1:
        return "st";
      case 2:
        return "nd";
      case 3:
        return "rd";
      default:
        return "th";
    }
  })();
  return `${n}${suffix}`;
}

/** e.g. ordinalDayOfMonthLabel(21) → "21st of month" */
export function ordinalDayOfMonthLabel(day: number): string {
  return `${ordinalDay(day)} of month`;
}

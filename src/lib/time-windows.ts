/** 2-hour time window options for arrival/delivery windows */
export const TIME_WINDOW_OPTIONS = (() => {
  const windows: string[] = [];
  for (let start = 6; start <= 20; start += 2) {
    const end = start + 2;
    const start12 = start > 12 ? start - 12 : start;
    const end12 = end > 12 ? end - 12 : end;
    const startAmpm = start < 12 ? "AM" : "PM";
    const endAmpm = end < 12 ? "AM" : "PM";
    windows.push(`${start12} ${startAmpm} - ${end12} ${endAmpm}`);
  }
  return windows;
})();

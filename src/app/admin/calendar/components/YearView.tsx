"use client";

import type { YearHeatData } from "@/lib/calendar/types";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["M", "T", "W", "T", "F", "S", "S"];

interface Props {
  year: number;
  heatData: YearHeatData;
  todayKey: string;
  onDayClick: (date: string) => void;
  onMonthClick: (month: number) => void;
}

function getHeatColor(count: number): string {
  if (count === 0) return "var(--card)";
  if (count === 1) return "rgba(184,150,46,0.25)";
  if (count <= 3) return "rgba(184,150,46,0.5)";
  return "rgba(184,150,46,0.8)";
}

export default function YearView({ year, heatData, todayKey, onDayClick, onMonthClick }: Props) {
  return (
    <div className="px-3 sm:px-5 pb-3">
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-4">
        {MONTH_NAMES.map((name, monthIdx) => {
          const firstDay = new Date(year, monthIdx, 1).getDay();
          const adjusted = firstDay === 0 ? 6 : firstDay - 1;
          const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

          const cells: (number | null)[] = [];
          for (let i = 0; i < adjusted; i++) cells.push(null);
          for (let d = 1; d <= daysInMonth; d++) cells.push(d);
          while (cells.length % 7 !== 0) cells.push(null);

          return (
            <div key={monthIdx}>
              <button
                type="button"
                onClick={() => onMonthClick(monthIdx)}
                className="text-[11px] font-bold text-[var(--tx)] mb-1 hover:text-[var(--accent-text)] transition-colors block"
              >
                {name}
              </button>
              <div className="grid grid-cols-7 gap-[2px]">
                {DAY_NAMES.map((d, i) => (
                  <div key={`h-${i}`} className="text-[7px] text-[var(--tx3)]/40 text-center font-medium">{d}</div>
                ))}
                {cells.map((day, i) => {
                  if (day === null) return <div key={`e-${i}`} className="w-full aspect-square" />;
                  const dk = `${year}-${String(monthIdx + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
                  const data = heatData[dk];
                  const count = data?.total || 0;
                  const isToday = dk === todayKey;

                  return (
                    <button
                      key={dk}
                      type="button"
                      onClick={() => onDayClick(dk)}
                      className={`w-full aspect-square rounded-[2px] transition-colors hover:ring-1 hover:ring-[var(--gold)]/50 ${
                        isToday ? "ring-1 ring-[var(--gold)]" : ""
                      }`}
                      style={{ backgroundColor: getHeatColor(count) }}
                      title={count > 0 ? `${dk}: ${count} job${count > 1 ? "s" : ""} (${data?.moves || 0} moves, ${data?.deliveries || 0} deliveries)` : dk}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-2 mt-3 justify-center">
        <span className="text-[9px] text-[var(--tx3)]">Less</span>
        {[0, 1, 2, 4].map((n) => (
          <div key={n} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: getHeatColor(n) }} />
        ))}
        <span className="text-[9px] text-[var(--tx3)]">More</span>
      </div>
    </div>
  );
}

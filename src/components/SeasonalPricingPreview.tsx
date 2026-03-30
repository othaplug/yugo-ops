"use client";

import { useMemo } from "react";

const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const GOLD = "#B8962E";
const CREAM = "#FAF7F2";

/**
 * Monthly multipliers relative to base rate (mid-week, mid-month, non-peak).
 * These mirror the SEASON_MODS in the widget estimate API.
 */
const SEASON_MODS: Record<number, number> = {
  1: 0.88, 2: 0.88, 3: 0.92, 4: 0.95, 5: 1.0, 6: 1.1,
  7: 1.15, 8: 1.15, 9: 1.05, 10: 0.95, 11: 0.9, 12: 0.88,
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const PEAK_MONTHS = [6, 7, 8];
const OFF_PEAK_MONTHS = [1, 2, 12, 11];

interface Props {
  basePrice?: number;
  selectedMonth?: number;
  onSelectMonth?: (month: number) => void;
  compact?: boolean;
}

export default function SeasonalPricingPreview({ basePrice = 1200, selectedMonth, onSelectMonth, compact = false }: Props) {
  const currentMonth = new Date().getMonth() + 1;

  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mod = SEASON_MODS[month] ?? 1.0;
      const price = Math.round(basePrice * mod / 50) * 50;
      const isPeak = PEAK_MONTHS.includes(month);
      const isOffPeak = OFF_PEAK_MONTHS.includes(month);
      const isPast = month < currentMonth;
      return { month, name: MONTH_NAMES[i]!, price, mod, isPeak, isOffPeak, isPast };
    });
  }, [basePrice, currentMonth]);

  const maxPrice = Math.max(...months.map((m) => m.price));
  const minPrice = Math.min(...months.map((m) => m.price));
  const cheapestMonth = months.find((m) => m.price === minPrice && !m.isPast);
  const selectedMonthData = months.find((m) => m.month === selectedMonth);

  if (compact) {
    return (
      <div
        style={{
          borderRadius: 12,
          padding: "12px 14px",
          background: `${GOLD}08`,
          border: `1.5px solid ${GOLD}20`,
        }}
      >
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: FOREST, opacity: 0.5, margin: "0 0 8px" }}>
          Price by Month
        </p>
        <div style={{ display: "flex", gap: 4, alignItems: "flex-end", height: 40 }}>
          {months.map(({ month, price, isPeak, isPast }) => {
            const height = Math.round(((price - minPrice) / (maxPrice - minPrice + 1)) * 28) + 8;
            const isSelected = month === selectedMonth;
            return (
              <button
                key={month}
                type="button"
                onClick={() => onSelectMonth?.(month)}
                title={`${MONTH_NAMES[month - 1]}: ~$${price.toLocaleString()}`}
                style={{
                  flex: 1,
                  height,
                  borderRadius: 3,
                  border: "none",
                  background: isSelected
                    ? GOLD
                    : isPeak
                    ? `${WINE}30`
                    : isPast
                    ? "#e0dcd6"
                    : `${FOREST}20`,
                  cursor: onSelectMonth ? "pointer" : "default",
                  opacity: isPast ? 0.4 : 1,
                  transition: "all 0.15s",
                  outline: isSelected ? `2px solid ${GOLD}` : "none",
                }}
              />
            );
          })}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
          <span style={{ fontSize: 9, color: FOREST, opacity: 0.4 }}>Jan</span>
          <span style={{ fontSize: 9, color: FOREST, opacity: 0.4 }}>Dec</span>
        </div>
        {cheapestMonth && !selectedMonthData?.isPeak && (
          <p style={{ fontSize: 11, color: FOREST, opacity: 0.6, margin: "8px 0 0", lineHeight: 1.4 }}>
            Cheapest: <strong style={{ color: FOREST, opacity: 1 }}>{MONTH_NAMES[cheapestMonth.month - 1]}</strong> saves ~${(maxPrice - cheapestMonth.price).toLocaleString()}
          </p>
        )}
        {selectedMonthData?.isPeak && (
          <p style={{ fontSize: 11, color: WINE, margin: "8px 0 0", lineHeight: 1.4 }}>
            Peak season pricing applies. Moving in May or Sep saves ~${(selectedMonthData.price - (months.find(m => m.month === 5)?.price ?? 0)).toLocaleString()}.
          </p>
        )}
      </div>
    );
  }

  return (
    <div style={{ background: CREAM, borderRadius: 16, padding: "20px 20px 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: FOREST, opacity: 0.5, margin: "0 0 2px" }}>
            Seasonal Pricing
          </p>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: FOREST, margin: 0 }}>
            Best time to move
          </h3>
        </div>
        {cheapestMonth && (
          <div style={{ background: `${GOLD}15`, borderRadius: 8, padding: "4px 10px", textAlign: "center" }}>
            <p style={{ fontSize: 9, color: GOLD, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", margin: "0 0 1px" }}>Cheapest</p>
            <p style={{ fontSize: 13, fontWeight: 700, color: WINE, margin: 0 }}>{MONTH_NAMES[cheapestMonth.month - 1]}</p>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div style={{ display: "flex", gap: 5, alignItems: "flex-end", height: 64, marginBottom: 6 }}>
        {months.map(({ month, price, isPeak, isPast }) => {
          const height = Math.round(((price - minPrice) / (maxPrice - minPrice + 1)) * 44) + 18;
          const isSelected = month === selectedMonth;
          const isCheapest = month === cheapestMonth?.month;
          return (
            <div key={month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
              <button
                type="button"
                onClick={() => onSelectMonth?.(month)}
                title={`${MONTH_NAMES[month - 1]}: ~$${price.toLocaleString()}`}
                style={{
                  width: "100%",
                  height,
                  borderRadius: 4,
                  border: "none",
                  background: isSelected
                    ? GOLD
                    : isCheapest
                    ? `${FOREST}40`
                    : isPeak
                    ? `${WINE}25`
                    : isPast
                    ? "#e8e4de"
                    : `${FOREST}15`,
                  cursor: onSelectMonth ? "pointer" : "default",
                  opacity: isPast ? 0.4 : 1,
                  transition: "all 0.15s",
                  outline: isSelected ? `2px solid ${GOLD}` : "none",
                  position: "relative",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div style={{ display: "flex", gap: 5 }}>
        {months.map(({ month, name, isPast }) => (
          <div key={month} style={{ flex: 1, textAlign: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 600, color: FOREST, opacity: isPast ? 0.3 : 0.5 }}>
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: `${WINE}25` }} />
          <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>Peak (Jun–Aug)</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: `${FOREST}40` }} />
          <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>Best value</span>
        </div>
        {selectedMonth && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: 2, background: GOLD }} />
            <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>Selected</span>
          </div>
        )}
      </div>

      {/* Insight */}
      {selectedMonthData?.isPeak && (
        <div style={{ marginTop: 12, padding: "10px 12px", background: `${WINE}08`, borderRadius: 10, borderLeft: `3px solid ${WINE}` }}>
          <p style={{ fontSize: 11, color: WINE, fontWeight: 600, margin: "0 0 2px" }}>Peak Season Notice</p>
          <p style={{ fontSize: 11, color: FOREST, opacity: 0.7, margin: 0, lineHeight: 1.4 }}>
            Moving in Jun–Aug costs ~15% more. Booking in May or September could save you ${((selectedMonthData.price) - Math.round(basePrice * 1.0 / 50) * 50).toLocaleString()}.
          </p>
        </div>
      )}
    </div>
  );
}

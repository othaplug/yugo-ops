"use client";

import { useMemo } from "react";
import { widgetEmbedMonthMultiplier } from "@/lib/pricing/widget-estimate";

/** Canonical wine — matches quote widget / quote-shared */
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const CREAM = "#FAF7F2";

/** Min / max bar height (px) so off-peak months stay visible (no “flat line” bars). */
function barHeightPx(
  price: number,
  minPrice: number,
  maxPrice: number,
  minPx: number,
  maxPx: number,
): number {
  if (maxPrice <= minPrice) return Math.round((minPx + maxPx) / 2);
  const t = (price - minPrice) / (maxPrice - minPrice);
  return minPx + Math.round(t * (maxPx - minPx));
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const PEAK_MONTHS = [6, 7, 8];
const OFF_PEAK_MONTHS = [1, 2, 12, 11];

interface Props {
  basePrice?: number;
  selectedMonth?: number;
  onSelectMonth?: (month: number) => void;
  compact?: boolean;
  /** When compact + true (e.g. Estate quote on wine), use cream/wine-tinted chart on dark shell. */
  onDarkBackground?: boolean;
}

export default function SeasonalPricingPreview({
  basePrice = 1200,
  selectedMonth,
  onSelectMonth,
  compact = false,
  onDarkBackground = false,
}: Props) {
  const months = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => {
      const month = i + 1;
      const mod = widgetEmbedMonthMultiplier(month);
      const price = Math.round((basePrice * mod) / 50) * 50;
      const isPeak = PEAK_MONTHS.includes(month);
      const isOffPeak = OFF_PEAK_MONTHS.includes(month);
      return {
        month,
        name: MONTH_NAMES[i]!,
        price,
        mod,
        isPeak,
        isOffPeak,
      };
    });
  }, [basePrice]);

  const maxPrice = Math.max(...months.map((m) => m.price));
  const minPrice = Math.min(...months.map((m) => m.price));
  const cheapestMonth = months.reduce((a, b) => (a.price <= b.price ? a : b));
  const selectedMonthData = months.find((m) => m.month === selectedMonth);

  if (compact) {
    const dark = onDarkBackground;
    const labelMuted = dark ? "rgba(249,237,228,0.55)" : FOREST;
    const labelMuted2 = dark ? "rgba(249,237,228,0.45)" : FOREST;
    return (
      <div
        style={{
          borderRadius: 0,
          padding: "14px 16px",
          background: dark ? "rgba(249, 237, 228, 0.08)" : `${FOREST}04`,
          borderLeft: dark
            ? "3px solid rgba(249,237,228,0.4)"
            : `3px solid ${FOREST}`,
          borderTop: dark
            ? "1px solid rgba(249,237,228,0.15)"
            : `1px solid ${FOREST}10`,
          borderRight: dark
            ? "1px solid rgba(249,237,228,0.15)"
            : `1px solid ${FOREST}10`,
          borderBottom: dark
            ? "1px solid rgba(249,237,228,0.15)"
            : `1px solid ${FOREST}10`,
        }}
      >
        <p
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "1.5px",
            textTransform: "uppercase",
            color: labelMuted,
            opacity: dark ? 1 : 0.5,
            margin: "0 0 8px",
          }}
        >
          Price by Month
        </p>
        <div
          style={{
            display: "flex",
            gap: 4,
            alignItems: "flex-end",
            height: 44,
          }}
        >
          {months.map(({ month, price, isPeak }) => {
            const height = barHeightPx(price, minPrice, maxPrice, 14, 36);
            const isSelected = month === selectedMonth;
            const bg = dark
              ? isSelected
                ? "#66143D"
                : isPeak
                  ? "rgba(249,237,228,0.35)"
                  : "rgba(249,237,228,0.22)"
              : isSelected
                ? WINE
                : isPeak
                  ? "rgba(92,26,51,0.38)"
                  : "rgba(92,26,51,0.12)";
            const outline = dark
              ? isSelected
                ? "2px solid rgba(249,237,228,0.85)"
                : "none"
              : isSelected
                ? `2px solid ${WINE}`
                : "none";
            return (
              <button
                key={month}
                type="button"
                onClick={() => onSelectMonth?.(month)}
                title={`${MONTH_NAMES[month - 1]}: ~$${price.toLocaleString()}`}
                style={{
                  flex: 1,
                  height,
                  minHeight: 14,
                  borderRadius: 3,
                  border: "none",
                  background: bg,
                  cursor: onSelectMonth ? "pointer" : "default",
                  transition: "all 0.15s",
                  outline,
                }}
              />
            );
          })}
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
          }}
        >
          <span
            style={{ fontSize: 9, color: labelMuted2, opacity: dark ? 1 : 0.4 }}
          >
            Jan
          </span>
          <span
            style={{ fontSize: 9, color: labelMuted2, opacity: dark ? 1 : 0.4 }}
          >
            Dec
          </span>
        </div>
        {cheapestMonth && !selectedMonthData?.isPeak && (
          <p
            style={{
              fontSize: 11,
              color: dark ? "rgba(249,237,228,0.85)" : FOREST,
              opacity: dark ? 1 : 0.6,
              margin: "8px 0 0",
              lineHeight: 1.4,
            }}
          >
            Cheapest:{" "}
            <strong style={{ color: dark ? "#F9EDE4" : WINE, opacity: 1 }}>
              {MONTH_NAMES[cheapestMonth.month - 1]}
            </strong>{" "}
            saves ~${(maxPrice - cheapestMonth.price).toLocaleString()}
          </p>
        )}
        {selectedMonthData?.isPeak && (
          <p
            style={{
              fontSize: 11,
              color: dark ? "rgba(249,237,228,0.92)" : WINE,
              margin: "8px 0 0",
              lineHeight: 1.4,
            }}
          >
            Peak season pricing applies. Moving in May or Sep saves ~$
            {(
              selectedMonthData.price -
              (months.find((m) => m.month === 5)?.price ?? 0)
            ).toLocaleString()}
            .
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{ background: CREAM, borderRadius: 16, padding: "20px 20px 16px" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: 16,
        }}
      >
        <div>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "1.5px",
              textTransform: "uppercase",
              color: FOREST,
              opacity: 0.5,
              margin: "0 0 2px",
            }}
          >
            Seasonal Pricing
          </p>
          <h3
            style={{ fontSize: 16, fontWeight: 700, color: FOREST, margin: 0 }}
          >
            Best time to move
          </h3>
        </div>
        {cheapestMonth && (
          <div
            style={{
              background: `${FOREST}15`,
              borderRadius: 8,
              padding: "4px 10px",
              textAlign: "center",
            }}
          >
            <p
              style={{
                fontSize: 9,
                color: FOREST,
                fontWeight: 700,
                letterSpacing: "1px",
                textTransform: "uppercase",
                margin: "0 0 1px",
              }}
            >
              Cheapest
            </p>
            <p
              style={{ fontSize: 13, fontWeight: 700, color: WINE, margin: 0 }}
            >
              {MONTH_NAMES[cheapestMonth.month - 1]}
            </p>
          </div>
        )}
      </div>

      {/* Bar chart */}
      <div
        style={{
          display: "flex",
          gap: 5,
          alignItems: "flex-end",
          height: 64,
          marginBottom: 6,
        }}
      >
        {months.map(({ month, price, isPeak }) => {
          const height = barHeightPx(price, minPrice, maxPrice, 20, 54);
          const isSelected = month === selectedMonth;
          const isCheapest = month === cheapestMonth?.month;
          return (
            <div
              key={month}
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <button
                type="button"
                onClick={() => onSelectMonth?.(month)}
                title={`${MONTH_NAMES[month - 1]}: ~$${price.toLocaleString()}`}
                style={{
                  width: "100%",
                  height,
                  minHeight: 20,
                  borderRadius: 4,
                  border: "none",
                  background: isSelected
                    ? WINE
                    : isCheapest
                      ? "rgba(92,26,51,0.28)"
                      : isPeak
                        ? "rgba(92,26,51,0.35)"
                        : "rgba(92,26,51,0.14)",
                  cursor: onSelectMonth ? "pointer" : "default",
                  transition: "all 0.15s",
                  outline: isSelected ? `2px solid ${WINE}` : "none",
                  position: "relative",
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Month labels */}
      <div style={{ display: "flex", gap: 5 }}>
        {months.map(({ month, name }) => (
          <div key={month} style={{ flex: 1, textAlign: "center" }}>
            <span
              style={{
                fontSize: 8,
                fontWeight: 600,
                color: FOREST,
                opacity: 0.55,
              }}
            >
              {name}
            </span>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div
        style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: `${WINE}25`,
            }}
          />
          <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>
            Peak (Jun–Aug)
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: `${FOREST}40`,
            }}
          />
          <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>
            Best value
          </span>
        </div>
        {selectedMonth && (
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 2,
                background: FOREST,
              }}
            />
            <span style={{ fontSize: 10, color: FOREST, opacity: 0.6 }}>
              Selected
            </span>
          </div>
        )}
      </div>

      {/* Insight */}
      {selectedMonthData?.isPeak && (
        <div
          style={{
            marginTop: 12,
            padding: "10px 12px",
            background: `${WINE}08`,
            borderRadius: 10,
            borderLeft: `3px solid ${WINE}`,
          }}
        >
          <p
            style={{
              fontSize: 11,
              color: WINE,
              fontWeight: 600,
              margin: "0 0 2px",
            }}
          >
            Peak Season Notice
          </p>
          <p
            style={{
              fontSize: 11,
              color: FOREST,
              opacity: 0.7,
              margin: 0,
              lineHeight: 1.4,
            }}
          >
            Moving in Jun–Aug costs ~15% more. Booking in May or September could
            save you $
            {(
              selectedMonthData.price -
              Math.round((basePrice * 1.0) / 50) * 50
            ).toLocaleString()}
            .
          </p>
        </div>
      )}
    </div>
  );
}

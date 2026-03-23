"use client";

import { useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import SeasonalPricingPreview from "@/components/SeasonalPricingPreview";

const MOVE_SIZES = [
  { key: "studio", label: "Studio" },
  { key: "1br", label: "1 Bedroom" },
  { key: "2br", label: "2 Bedrooms" },
  { key: "3br", label: "3 Bedrooms" },
  { key: "4br", label: "4 Bedrooms" },
  { key: "5br_plus", label: "5+ Bedrooms" },
];

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const GOLD = "#B8962E";
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const CREAM = "#FAF7F2";

function getMonthNumber(): number {
  return new Date().getMonth() + 1;
}

interface Estimate {
  low: number;
  high: number;
}

interface Props {
  fullQuoteUrl?: string;
}

export default function EmbedQuoteCalculator({ fullQuoteUrl = "/quote-widget" }: Props) {
  const [moveSize, setMoveSize] = useState("2br");
  const [fromPostal, setFromPostal] = useState("");
  const [toPostal, setToPostal] = useState("");
  const [month, setMonth] = useState(String(getMonthNumber()));
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPeakSeason, setIsPeakSeason] = useState(false);

  async function calculate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/widget/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveSize, fromPostal: fromPostal.trim(), toPostal: toPostal.trim(), month }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to estimate"); return; }
      setEstimate({ low: data.low, high: data.high });
      setIsPeakSeason([6, 7, 8].includes(Number(month)));
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const getQuoteUrl = `${fullQuoteUrl}?size=${moveSize}&from=${encodeURIComponent(fromPostal)}&to=${encodeURIComponent(toPostal)}`;

  return (
    <div
      className="rounded-2xl overflow-hidden shadow-lg"
      style={{ background: CREAM, fontFamily: "Inter, system-ui, sans-serif", maxWidth: 420 }}
    >
      {/* Header */}
      <div className="px-5 py-4" style={{ background: WINE }}>
        <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: GOLD, margin: "0 0 2px" }}>
          Yugo Moving
        </p>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: "#fff", margin: 0 }}>
          Get Your Moving Quote
        </h2>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", margin: "4px 0 0" }}>
          Flat rate. No surprises.
        </p>
      </div>

      {/* Form */}
      <div className="px-5 py-5 space-y-4">
        {/* Move size */}
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: FOREST, opacity: 0.6, marginBottom: 8 }}>
            Home Size
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
            {MOVE_SIZES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => { setMoveSize(s.key); setEstimate(null); }}
                style={{
                  padding: "8px 6px",
                  borderRadius: 10,
                  border: `1.5px solid ${moveSize === s.key ? GOLD : "#D6D0C8"}`,
                  background: moveSize === s.key ? `${GOLD}14` : "transparent",
                  color: moveSize === s.key ? WINE : FOREST,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Postal codes */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: FOREST, opacity: 0.6, marginBottom: 6 }}>
              From Postal
            </label>
            <input
              type="text"
              value={fromPostal}
              onChange={(e) => { setFromPostal(e.target.value.toUpperCase()); setEstimate(null); }}
              placeholder="M5R 2A3"
              maxLength={7}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid #D6D0C8`,
                background: "#fff",
                fontSize: 13,
                color: FOREST,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: FOREST, opacity: 0.6, marginBottom: 6 }}>
              To Postal
            </label>
            <input
              type="text"
              value={toPostal}
              onChange={(e) => { setToPostal(e.target.value.toUpperCase()); setEstimate(null); }}
              placeholder="M4W 1L4"
              maxLength={7}
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: `1.5px solid #D6D0C8`,
                background: "#fff",
                fontSize: 13,
                color: FOREST,
                boxSizing: "border-box",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Month */}
        <div>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase", color: FOREST, opacity: 0.6, marginBottom: 6 }}>
            When
          </label>
          <select
            value={month}
            onChange={(e) => { setMonth(e.target.value); setEstimate(null); }}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: 10,
              border: `1.5px solid #D6D0C8`,
              background: "#fff",
              fontSize: 13,
              color: FOREST,
              outline: "none",
            }}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m} {new Date().getFullYear()}</option>
            ))}
          </select>
        </div>

        {/* Estimate result */}
        {estimate && (
          <div
            style={{
              borderRadius: 12,
              padding: "14px 16px",
              background: `${GOLD}0D`,
              border: `1.5px solid ${GOLD}30`,
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase", color: GOLD, margin: "0 0 4px" }}>
              Estimated Price
            </p>
            <p style={{ fontSize: 26, fontWeight: 700, color: WINE, margin: 0 }}>
              ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}
            </p>
            {isPeakSeason && (
              <p style={{ fontSize: 11, color: FOREST, opacity: 0.6, margin: "6px 0 0", lineHeight: 1.4 }}>
                You&apos;re booking in peak season. Moving a few weeks earlier could save $100–$150.
              </p>
            )}
          </div>
        )}

        {/* Seasonal pricing preview — shown once estimate is visible */}
        {estimate && (
          <SeasonalPricingPreview
            basePrice={Math.round((estimate.low + estimate.high) / 2)}
            selectedMonth={Number(month)}
            onSelectMonth={(m) => { setMonth(String(m)); setEstimate(null); }}
            compact
          />
        )}

        {error && (
          <p style={{ fontSize: 12, color: "#C0392B", margin: "0 0 4px" }}>{error}</p>
        )}

        {/* Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button"
            onClick={calculate}
            disabled={loading}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: 12,
              border: "none",
              background: estimate ? "#F5F2EE" : GOLD,
              color: estimate ? FOREST : "#FAF7F2",
              fontSize: 13,
              fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              letterSpacing: "0.5px",
              opacity: loading ? 0.7 : 1,
              transition: "all 0.15s",
            }}
          >
            {loading ? "Calculating…" : estimate ? "Recalculate" : "Get Instant Estimate"}
          </button>

          {estimate && (
            <a
              href={getQuoteUrl}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                width: "100%",
                padding: "13px",
                borderRadius: 12,
                background: WINE,
                color: "#fff",
                fontSize: 13,
                fontWeight: 700,
                textDecoration: "none",
                letterSpacing: "0.5px",
                transition: "opacity 0.15s",
              }}
            >
              Get Your Exact Quote
              <ArrowRight size={14} weight="bold" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

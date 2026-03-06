"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { formatCurrency } from "@/lib/format-currency";

interface TipScreenProps {
  moveId: string;
  token: string;
  clientName: string;
  crewName: string;
  crewMembers?: string[];
  moveTotal: number;
  hoursWorked?: number;
  cardLast4?: string | null;
  onComplete: () => void;
  onSkip: () => void;
}

type Phase = "tip" | "processing" | "success" | "skipped";

function roundToNearest5(n: number): number {
  return Math.round(n / 5) * 5;
}

function SkippedBanner({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[150] pb-10 px-4 flex justify-center"
      style={{ pointerEvents: "none" }}
    >
      <div
        className="w-full max-w-[400px] rounded-[20px] shadow-xl px-7 py-5 text-center"
        style={{ backgroundColor: CREAM, pointerEvents: "auto" }}
      >
        <p className="text-[16px] font-semibold" style={{ color: FOREST }}>No problem!</p>
        <p className="text-[13px] mt-1 opacity-60" style={{ color: FOREST }}>We&apos;re glad we could help with your move.</p>
      </div>
    </div>
  );
}

function ConfettiEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const colors = ["#C9A962", "#D4AF37", "#5C1A33", "#2A3D2E", "#FFD700", "#E8C87A"];
    const particles: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rotation: number; rotationSpeed: number; opacity: number }[] = [];
    for (let i = 0; i < 90; i++) {
      particles.push({ x: Math.random() * canvas.width, y: -20 - Math.random() * 200, w: 4 + Math.random() * 6, h: 8 + Math.random() * 8, color: colors[Math.floor(Math.random() * colors.length)], vx: (Math.random() - 0.5) * 3, vy: 2 + Math.random() * 4, rotation: Math.random() * Math.PI * 2, rotationSpeed: (Math.random() - 0.5) * 0.2, opacity: 1 });
    }
    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx; p.y += p.vy; p.vy += 0.05; p.rotation += p.rotationSpeed;
        if (p.y > canvas.height + 20) { p.opacity = 0; continue; }
        p.opacity = Math.max(0, p.opacity - 0.003);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation); ctx.globalAlpha = p.opacity; ctx.fillStyle = p.color; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); ctx.restore();
      }
      if (alive) animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);
  return <canvas ref={canvasRef} className="fixed inset-0 z-[200] pointer-events-none" />;
}

export default function TipScreen({ moveId, token, clientName, crewName, crewMembers = [], moveTotal, hoursWorked, cardLast4, onComplete, onSkip }: TipScreenProps) {
  const [phase, setPhase] = useState<Phase>("tip");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customDollars, setCustomDollars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(0);

  const presets = (() => {
    const p10 = Math.max(20, roundToNearest5(moveTotal * 0.10));
    const p15 = Math.max(35, roundToNearest5(moveTotal * 0.15));
    const p20 = Math.max(50, roundToNearest5(moveTotal * 0.20));
    return [
      { amount: p10, pct: "10%", label: "Good" },
      { amount: p15, pct: "15%", label: "Great" },
      { amount: p20, pct: "20%", label: "Amazing" },
    ];
  })();

  useEffect(() => {
    if (selectedPreset === null) setSelectedPreset(presets[1].amount);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const currentAmount = (() => {
    if (selectedPreset != null) return selectedPreset;
    const custom = parseFloat(customDollars);
    if (Number.isFinite(custom) && custom >= 5) return custom;
    return 0;
  })();

  const handleSubmit = useCallback(async () => {
    if (currentAmount < 5) return;
    setError(null);
    setPhase("processing");
    try {
      const res = await fetch("/api/tips/charge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moveId, amount: currentAmount, token }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError((data as { error?: string }).error || "Could not process tip. Please try again."); setPhase("tip"); return; }
      setTipAmount(currentAmount);
      setPhase("success");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("tip");
    }
  }, [currentAmount, moveId, token]);

  const handleSkip = useCallback(async () => {
    setPhase("skipped");
    fetch("/api/tips/skip", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ moveId, token }) }).catch(() => {});
    setTimeout(onSkip, 900);
  }, [moveId, token, onSkip]);

  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(onComplete, 5000);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const firstName = (clientName || "").split(" ")[0] || "there";
  const crewDisplay = crewMembers.length > 1 ? `${crewMembers[0].split(" ")[0]} & the crew` : crewName || "your crew";

  /* ── Success ── */
  if (phase === "success") {
    return (
      <>
        <ConfettiEffect />
        <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center modal-overlay" style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}>
          <div
            className="w-full max-w-[400px] rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl mx-0 sm:mx-4 sheet-card sm:modal-card"
            style={{ backgroundColor: CREAM }}
          >
            <div className="pt-8 pb-8 px-7 text-center">
              <div
                className="w-16 h-16 mx-auto rounded-full flex items-center justify-center mb-5 shadow-lg"
                style={{ background: `linear-gradient(135deg, ${GOLD}, #8B7332)` }}
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              </div>
              <h2 className="font-hero text-[28px] font-semibold" style={{ color: WINE }}>Thank you!</h2>
              <p className="text-[14px] mt-2 leading-relaxed" style={{ color: FOREST }}>
                Your <strong style={{ color: GOLD }}>{formatCurrency(tipAmount)}</strong> tip has been sent to {crewDisplay}.
              </p>
              <p className="text-[11px] mt-1.5 opacity-55" style={{ color: FOREST }}>
                100% goes directly to your moving crew.
              </p>
              <div className="mt-6 flex flex-col gap-2.5">
                <a
                  href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full font-semibold text-[13px] py-3 px-6 transition-all hover:opacity-90 active:scale-[0.98]"
                  style={{ backgroundColor: FOREST, color: CREAM }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                  Leave a Google Review
                </a>
                <button type="button" onClick={onComplete} className="w-full text-[12px] font-medium py-2 opacity-50 hover:opacity-80 transition-opacity" style={{ color: FOREST }}>
                  Back to dashboard
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  /* ── Skipped ── auto-dismiss after 1.5 s ── */
  if (phase === "skipped") {
    return <SkippedBanner onDone={onComplete} />;
  }

  /* ── Main tip screen ── */
  return (
    <div
      className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center modal-overlay"
      style={{ backgroundColor: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
    >
      <div
        className="w-full max-w-[420px] rounded-t-[28px] sm:rounded-[28px] overflow-hidden shadow-2xl mx-0 sm:mx-4 sheet-card sm:modal-card"
        style={{ backgroundColor: CREAM }}
      >
        {/* Drag handle (mobile) */}
        <div className="pt-3 pb-0 flex justify-center sm:hidden">
          <div className="w-10 h-1 rounded-full opacity-20" style={{ backgroundColor: FOREST }} />
        </div>

        {/* Close button */}
        <div className="flex justify-end px-5 pt-4 pb-0">
          <button
            type="button"
            onClick={handleSkip}
            className="w-7 h-7 rounded-full flex items-center justify-center opacity-30 hover:opacity-60 transition-opacity"
            style={{ backgroundColor: `${FOREST}15` }}
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={FOREST} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="px-6 pb-8 pt-2">
          {/* Header */}
          <div className="text-center mb-6">
            <p className="text-[11px] font-bold uppercase tracking-widest mb-1.5 opacity-40" style={{ color: FOREST }}>
              Move Complete
            </p>
            <h2 className="font-hero text-[26px] sm:text-[28px] font-semibold leading-tight" style={{ color: WINE }}>
              Tip your crew
            </h2>
            <p className="text-[13px] mt-1.5 opacity-70 leading-snug" style={{ color: FOREST }}>
              {firstName}, your crew worked hard today.{hoursWorked ? ` ${hoursWorked} hours of effort.` : ""}<br />
              100% goes directly to your movers.
            </p>
          </div>

          {/* Crew avatars */}
          {crewMembers.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mb-5">
              {crewMembers.slice(0, 4).map((name, i) => (
                <div
                  key={i}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm shrink-0 border-2"
                  style={{ background: `linear-gradient(135deg, ${GOLD}, #8B7332)`, borderColor: CREAM, marginLeft: i > 0 ? "-8px" : 0 }}
                >
                  {(name || "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
              ))}
              <span className="ml-2 text-[12px] font-semibold opacity-70" style={{ color: FOREST }}>
                {crewMembers.length === 1 ? crewMembers[0].split(" ")[0] : `${crewMembers.length} movers`}
              </span>
            </div>
          )}

          {/* Preset amounts */}
          <div className="grid grid-cols-3 gap-2.5 mb-3">
            {presets.map((p) => {
              const isSelected = selectedPreset === p.amount;
              return (
                <button
                  key={p.amount}
                  type="button"
                  onClick={() => { setSelectedPreset(p.amount); setCustomDollars(""); }}
                  className="rounded-2xl border-2 py-4 text-center transition-all duration-150"
                  style={{
                    borderColor: isSelected ? GOLD : `${FOREST}18`,
                    backgroundColor: isSelected ? `${GOLD}12` : "white",
                    boxShadow: isSelected ? `0 2px 12px ${GOLD}25` : "none",
                  }}
                >
                  <div className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-0.5" style={{ color: isSelected ? GOLD : FOREST }}>
                    {p.pct}
                  </div>
                  <div className="text-[20px] font-bold leading-tight" style={{ color: isSelected ? WINE : FOREST }}>
                    {formatCurrency(p.amount)}
                  </div>
                  <div className="text-[10px] font-semibold mt-0.5 opacity-60" style={{ color: isSelected ? GOLD : FOREST }}>
                    {p.label}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom amount */}
          <button
            type="button"
            onClick={() => setSelectedPreset(null)}
            className="w-full rounded-2xl border-2 transition-all duration-150 mb-4"
            style={{
              borderColor: selectedPreset === null ? GOLD : `${FOREST}18`,
              backgroundColor: selectedPreset === null ? `${GOLD}08` : "white",
            }}
          >
            {selectedPreset === null ? (
              <div className="flex items-center px-4 py-3">
                <span className="text-[16px] font-bold mr-1.5" style={{ color: GOLD }}>$</span>
                <input
                  type="number"
                  min={5}
                  step={1}
                  placeholder="Custom amount (min $5)"
                  value={customDollars}
                  onChange={(e) => setCustomDollars(e.target.value.replace(/[^0-9.]/g, ""))}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent text-[15px] font-semibold outline-none min-w-0 placeholder:opacity-40"
                  style={{ color: FOREST }}
                  autoFocus
                />
              </div>
            ) : (
              <div className="px-4 py-2.5 text-[12px] font-semibold text-center opacity-50" style={{ color: FOREST }}>
                Custom amount
              </div>
            )}
          </button>

          {/* Card info */}
          {cardLast4 && (
            <p className="text-center text-[11px] mb-3 opacity-45" style={{ color: FOREST }}>
              Charged to card ending in <span className="font-bold">····{cardLast4}</span>
            </p>
          )}

          {error && (
            <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[12px] text-red-700 text-center">
              {error}
            </div>
          )}

          {/* CTA */}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === "processing" || currentAmount < 5}
            className="w-full rounded-full py-3.5 text-[14px] font-bold transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 shadow-sm"
            style={{ backgroundColor: GOLD, color: "#1A1A1A", boxShadow: `0 3px 16px ${GOLD}45` }}
          >
            {phase === "processing"
              ? "Processing…"
              : currentAmount >= 5
              ? `Send ${formatCurrency(currentAmount)} Tip`
              : "Select an amount"}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full text-[11px] font-medium mt-3 py-1 opacity-35 hover:opacity-60 transition-opacity"
            style={{ color: FOREST }}
          >
            No thanks
          </button>
        </div>
      </div>
    </div>
  );
}

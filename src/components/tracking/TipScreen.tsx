"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import { formatCurrency } from "@/lib/format-currency";
import YugoLogo from "@/components/YugoLogo";

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

function ConfettiEffect() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ["#C9A962", "#B8962E", "#5C1A33", "#22C55E", "#D4AF37", "#FFD700"];
    const particles: { x: number; y: number; w: number; h: number; color: string; vx: number; vy: number; rotation: number; rotationSpeed: number; opacity: number }[] = [];

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: -20 - Math.random() * 200,
        w: 4 + Math.random() * 6,
        h: 8 + Math.random() * 8,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 3,
        vy: 2 + Math.random() * 4,
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.2,
        opacity: 1,
      });
    }

    let animId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of particles) {
        if (p.opacity <= 0) continue;
        alive = true;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.05;
        p.rotation += p.rotationSpeed;
        if (p.y > canvas.height + 20) { p.opacity = 0; continue; }
        p.opacity = Math.max(0, p.opacity - 0.003);

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.globalAlpha = p.opacity;
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animId);
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-[200] pointer-events-none" />;
}

export default function TipScreen({
  moveId,
  token,
  clientName,
  crewName,
  crewMembers = [],
  moveTotal,
  hoursWorked,
  cardLast4,
  onComplete,
  onSkip,
}: TipScreenProps) {
  const [phase, setPhase] = useState<Phase>("tip");
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null);
  const [customDollars, setCustomDollars] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [tipAmount, setTipAmount] = useState(0);

  // Calculate percentage-based presets
  const presets = (() => {
    const p5 = Math.max(10, roundToNearest5(moveTotal * 0.05));
    const p10 = Math.max(20, roundToNearest5(moveTotal * 0.10));
    const p15 = Math.max(30, roundToNearest5(moveTotal * 0.15));
    return [
      { amount: p5, label: "Good", emoji: "👍" },
      { amount: p10, label: "Great", emoji: "🙌" },
      { amount: p15, label: "Amazing", emoji: "🤩" },
    ];
  })();

  // Default to middle preset
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
      const res = await fetch(`/api/tips/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moveId, amount: currentAmount, token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error || "Could not process tip. Please try again.");
        setPhase("tip");
        return;
      }
      setTipAmount(currentAmount);
      setPhase("success");
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("tip");
    }
  }, [currentAmount, moveId, token]);

  const handleSkip = useCallback(async () => {
    setPhase("skipped");
    // Record skip on server
    fetch(`/api/tips/skip`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moveId, token }),
    }).catch(() => {});
    setTimeout(onSkip, 1500);
  }, [moveId, token, onSkip]);

  // Auto-dismiss success after 5 seconds
  useEffect(() => {
    if (phase !== "success") return;
    const t = setTimeout(onComplete, 5000);
    return () => clearTimeout(t);
  }, [phase, onComplete]);

  const firstName = (clientName || "").split(" ")[0] || "there";
  const crewInitials = (crewName || "Team").replace("Team ", "").slice(0, 2).toUpperCase();

  if (phase === "success") {
    return (
      <>
        <ConfettiEffect />
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-6" style={{ backgroundColor: CREAM }}>
          <div className="max-w-md w-full text-center animate-fade-up">
            <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6" style={{ background: `linear-gradient(135deg, ${GOLD}, #A07F26)` }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h2 className="font-hero text-h1 sm:text-hero font-semibold" style={{ color: WINE }}>Thank you!</h2>
            <p className="text-h3-sm mt-3 leading-relaxed" style={{ color: FOREST }}>
              Your {formatCurrency(tipAmount)} tip has been sent to {crewName}.
            </p>
            <p className="text-body mt-2 opacity-70" style={{ color: FOREST }}>
              100% of your tip goes directly to your moving crew.
            </p>

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <a
                href="https://maps.app.goo.gl/oC8fkJT8yqSpZMpXA?g_st=ic"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center rounded-xl font-semibold text-body py-3 px-6 transition-colors hover:opacity-90 shadow-sm"
                style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
              >
                Leave a Google Review
              </a>
              <button
                type="button"
                onClick={onComplete}
                className="inline-flex items-center justify-center rounded-xl font-semibold text-body py-3 px-6 transition-colors hover:opacity-90 border-2"
                style={{ borderColor: `${FOREST}30`, color: FOREST }}
              >
                Back to Summary
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (phase === "skipped") {
    return (
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-6" style={{ backgroundColor: CREAM }}>
        <div className="max-w-md w-full text-center animate-fade-up">
          <p className="text-h3 font-semibold" style={{ color: FOREST }}>No problem!</p>
          <p className="text-title mt-2 opacity-80" style={{ color: FOREST }}>We&apos;re glad we could help with your move.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 overflow-y-auto" style={{ backgroundColor: CREAM }}>
      <div className="max-w-md w-full py-8 animate-fade-up">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <YugoLogo size={20} variant="gold" onLightBackground />
          </div>
          <h1 className="font-hero text-h1-lg sm:text-hero-md font-semibold leading-tight" style={{ color: WINE }}>
            Move Complete!
          </h1>
          <p className="text-title mt-2 opacity-80" style={{ color: FOREST }}>
            Thank you for choosing Yugo, {firstName}.<br />
            We hope your experience was exceptional.
          </p>
        </div>

        {/* Crew card */}
        <div className="rounded-2xl border-2 p-5 mb-6 bg-white" style={{ borderColor: `${GOLD}30` }}>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-h3 font-bold text-white shadow-md shrink-0"
              style={{ background: `linear-gradient(135deg, ${GOLD}, #8B7332)` }}
            >
              {crewInitials}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-h3 font-bold truncate" style={{ color: FOREST }}>{crewName}</h3>
              <div className="flex items-center gap-1 mt-0.5">
                {[1, 2, 3, 4, 5].map((i) => (
                  <svg key={i} width="14" height="14" viewBox="0 0 24 24" fill={GOLD} stroke={GOLD} strokeWidth="1"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" /></svg>
                ))}
              </div>
              <div className="text-ui mt-1 opacity-70" style={{ color: FOREST }}>
                {crewMembers.length > 0 ? `${crewMembers.length} movers` : "Your crew"}
                {hoursWorked ? ` · ${hoursWorked} hours` : ""}
              </div>
            </div>
          </div>
        </div>

        {/* Tip prompt */}
        <div className="text-center mb-5">
          <p className="text-h3-sm font-semibold" style={{ color: FOREST }}>Would you like to leave a tip for your crew?</p>
        </div>

        {/* Preset amounts */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {presets.map((p) => (
            <button
              key={p.amount}
              type="button"
              onClick={() => { setSelectedPreset(p.amount); setCustomDollars(""); }}
              className="rounded-xl border-2 py-4 text-center transition-all"
              style={{
                borderColor: selectedPreset === p.amount ? GOLD : `${FOREST}25`,
                backgroundColor: selectedPreset === p.amount ? `${GOLD}15` : "white",
              }}
            >
              <div className="text-h2-sm font-bold" style={{ color: selectedPreset === p.amount ? WINE : FOREST }}>
                {formatCurrency(p.amount)}
              </div>
              <div className="text-caption font-semibold mt-0.5 opacity-70" style={{ color: FOREST }}>
                {p.label}
              </div>
            </button>
          ))}
        </div>

        {/* Custom amount */}
        <div className="mb-5">
          <button
            type="button"
            onClick={() => { setSelectedPreset(null); }}
            className="w-full rounded-xl border-2 transition-all"
            style={{
              borderColor: selectedPreset === null ? GOLD : `${FOREST}25`,
              backgroundColor: selectedPreset === null ? `${GOLD}15` : "white",
            }}
          >
            {selectedPreset === null ? (
              <div className="flex items-center px-4 py-3">
                <span className="text-h3 font-bold mr-2" style={{ color: FOREST }}>$</span>
                <input
                  type="number"
                  min={5}
                  step={1}
                  placeholder="Custom amount (min $5)"
                  value={customDollars}
                  onChange={(e) => setCustomDollars(e.target.value.replace(/[^0-9.]/g, ""))}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 bg-transparent text-h3 font-bold outline-none min-w-0"
                  style={{ color: FOREST }}
                  autoFocus
                />
              </div>
            ) : (
              <div className="px-4 py-3 text-body font-semibold text-center" style={{ color: FOREST }}>
                Custom amount
              </div>
            )}
          </button>
        </div>

        {/* Card info */}
        {cardLast4 && (
          <div className="text-center mb-5">
            <p className="text-ui opacity-60" style={{ color: FOREST }}>
              Charged to your card ending in <span className="font-bold">····{cardLast4}</span>
            </p>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-body text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={handleSkip}
            className="flex-1 rounded-xl border-2 py-3.5 text-title font-semibold transition-colors"
            style={{ borderColor: `${FOREST}25`, color: FOREST }}
          >
            Skip
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={phase === "processing" || currentAmount < 5}
            className="flex-1 rounded-xl py-3.5 text-title font-bold transition-colors disabled:opacity-50 hover:opacity-90 shadow-sm"
            style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
          >
            {phase === "processing" ? "Processing…" : currentAmount >= 5 ? `Leave ${formatCurrency(currentAmount)} Tip` : "Leave Tip"}
          </button>
        </div>

        {/* Fine print */}
        <p className="text-center text-caption opacity-50" style={{ color: FOREST }}>
          100% of tips go directly to your moving crew.
        </p>
      </div>
    </div>
  );
}

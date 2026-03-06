"use client";

import { useState, useCallback } from "react";
import YugoLogo from "@/components/YugoLogo";

const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const GOLD = "#B8962E";
const CREAM = "#FAF7F2";

const SIZES = [
  { key: "studio", label: "Studio", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { key: "1br", label: "1 Bed", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { key: "2br", label: "2 Bed", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { key: "3br", label: "3 Bed", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { key: "4br", label: "4 Bed", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
  { key: "5br_plus", label: "5+", icon: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" },
];

const SIZE_LABELS: Record<string, string> = {
  studio: "Studio",
  "1br": "1 Bedroom",
  "2br": "2 Bedroom",
  "3br": "3 Bedroom",
  "4br": "4 Bedroom",
  "5br_plus": "5+ Bedroom",
};

interface Estimate {
  low: number;
  high: number;
  factors: string[];
  moveSize: string;
  fromPostal: string;
  toPostal: string;
  moveDate: string | null;
  disabled?: boolean;
  message?: string;
}

export default function QuoteWidgetClient() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");

  const [moveSize, setMoveSize] = useState("");
  const [fromPostal, setFromPostal] = useState("");
  const [toPostal, setToPostal] = useState("");
  const [moveDate, setMoveDate] = useState("");
  const [flexible, setFlexible] = useState(false);
  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadNumber, setLeadNumber] = useState("");

  const goNext = useCallback(() => {
    setDirection("left");
    setStep((s) => s + 1);
  }, []);

  const goBack = useCallback(() => {
    setDirection("right");
    setStep((s) => s - 1);
  }, []);

  const fetchEstimate = useCallback(async () => {
    setEstimateLoading(true);
    setEstimateError(false);
    try {
      const res = await fetch("/api/widget/estimate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveSize,
          fromPostalCode: fromPostal,
          toPostalCode: toPostal,
          moveDate: moveDate || null,
        }),
      });
      if (!res.ok) {
        setEstimate(null);
        setEstimateError(true);
        return;
      }
      const data = await res.json();
      if (data.disabled) {
        setEstimate({ ...data, low: 0, high: 0, factors: [] });
      } else if (typeof data.low !== "number" || typeof data.high !== "number") {
        setEstimate(null);
        setEstimateError(true);
      } else {
        setEstimate(data);
      }
    } catch {
      setEstimate(null);
      setEstimateError(true);
    } finally {
      setEstimateLoading(false);
    }
  }, [moveSize, fromPostal, toPostal, moveDate]);

  const handleDateNext = useCallback(() => {
    goNext();
    fetchEstimate();
  }, [goNext, fetchEstimate]);

  const handleSubmitLead = useCallback(async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/widget/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || null,
          moveSize,
          fromPostal,
          toPostal,
          moveDate: moveDate || null,
          flexibleDate: flexible,
          estimateLow: estimate?.low,
          estimateHigh: estimate?.high,
          factors: estimate?.factors,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setLeadNumber(data.leadNumber || "");
      }
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }, [name, email, phone, moveSize, fromPostal, toPostal, moveDate, flexible, estimate]);

  const formatPostal = (val: string) => {
    const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (clean.length <= 3) return clean;
    return clean.slice(0, 3) + " " + clean.slice(3, 6);
  };

  const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

  const canProceedStep1 = moveSize !== "";
  const canProceedStep2 = fromPostal.replace(/\s/g, "").length >= 3 && toPostal.replace(/\s/g, "").length >= 3;

  const inputClass = "w-full px-4 py-3.5 rounded-xl border text-[14px] outline-none transition-all duration-200 bg-white placeholder:text-[#B5AFA5]";

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "white",
          boxShadow: "0 8px 40px rgba(44,62,45,0.08), 0 1px 3px rgba(44,62,45,0.04)",
          border: `1px solid ${FOREST}0A`,
        }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between">
          <YugoLogo size={16} variant="gold" onLightBackground hidePlus={false} />
          {step > 0 && step < 4 && !submitted && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-[12px] font-semibold tracking-wide uppercase transition-opacity hover:opacity-70"
              style={{ color: FOREST, opacity: 0.5 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
              Back
            </button>
          )}
        </div>

        {/* Progress bar */}
        {!submitted && (
          <div className="px-6 pb-5">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-[3px] rounded-full flex-1 transition-all duration-500"
                  style={{
                    backgroundColor: i <= step ? GOLD : `${FOREST}10`,
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="relative overflow-hidden min-h-[300px]">

          {/* Step 0: Home Size */}
          {step === 0 && (
            <StepContainer direction={direction}>
              <div className="px-6 pb-7">
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: WINE }}>Step 1</div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: FOREST }}>How big is your home?</h2>
                <p className="text-[13px] mb-6" style={{ color: `${FOREST}90` }}>Select the size of your current home.</p>
                <div className="grid grid-cols-3 gap-2.5">
                  {SIZES.map((s) => {
                    const active = moveSize === s.key;
                    return (
                      <button
                        key={s.key}
                        onClick={() => setMoveSize(s.key)}
                        className="py-4 px-3 rounded-xl text-[13px] font-semibold border transition-all duration-200"
                        style={{
                          borderColor: active ? GOLD : `${FOREST}12`,
                          backgroundColor: active ? `${GOLD}08` : "white",
                          color: active ? FOREST : `${FOREST}80`,
                          boxShadow: active ? `0 0 0 1px ${GOLD}` : "none",
                        }}
                      >
                        <svg
                          width="20"
                          height="20"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={active ? GOLD : `${FOREST}40`}
                          strokeWidth="1.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          className="mx-auto mb-1.5"
                        >
                          <path d={s.icon} />
                          <polyline points="9 22 9 12 15 12 15 22" />
                        </svg>
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={goNext}
                  disabled={!canProceedStep1}
                  className="w-full mt-6 py-3.5 rounded-xl text-[13px] font-bold text-white tracking-wide uppercase transition-all duration-200 disabled:opacity-30"
                  style={{ backgroundColor: FOREST }}
                >
                  Continue
                </button>
              </div>
            </StepContainer>
          )}

          {/* Step 1: Locations */}
          {step === 1 && (
            <StepContainer direction={direction}>
              <div className="px-6 pb-7">
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: WINE }}>Step 2</div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: FOREST }}>Where are you moving?</h2>
                <p className="text-[13px] mb-6" style={{ color: `${FOREST}90` }}>Postal code or first 3 characters is enough.</p>
                <div className="space-y-3.5">
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: `${FOREST}60` }}>Moving from</label>
                    <input
                      type="text"
                      value={fromPostal}
                      onChange={(e) => setFromPostal(formatPostal(e.target.value))}
                      placeholder="M4M 1A1"
                      maxLength={7}
                      className={inputClass}
                      style={{ borderColor: `${FOREST}12`, color: FOREST }}
                      onFocus={(e) => (e.target.style.borderColor = GOLD)}
                      onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold tracking-[0.14em] uppercase mb-1.5" style={{ color: `${FOREST}60` }}>Moving to</label>
                    <input
                      type="text"
                      value={toPostal}
                      onChange={(e) => setToPostal(formatPostal(e.target.value))}
                      placeholder="M5V 2T6"
                      maxLength={7}
                      className={inputClass}
                      style={{ borderColor: `${FOREST}12`, color: FOREST }}
                      onFocus={(e) => (e.target.style.borderColor = GOLD)}
                      onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                    />
                  </div>
                </div>
                <button
                  onClick={goNext}
                  disabled={!canProceedStep2}
                  className="w-full mt-6 py-3.5 rounded-xl text-[13px] font-bold text-white tracking-wide uppercase transition-all duration-200 disabled:opacity-30"
                  style={{ backgroundColor: FOREST }}
                >
                  Continue
                </button>
              </div>
            </StepContainer>
          )}

          {/* Step 2: Move Date */}
          {step === 2 && (
            <StepContainer direction={direction}>
              <div className="px-6 pb-7">
                <div className="text-[9px] font-bold tracking-[0.16em] uppercase mb-1.5" style={{ color: WINE }}>Step 3</div>
                <h2 className="text-[22px] font-bold mb-1" style={{ color: FOREST }}>When are you moving?</h2>
                <p className="text-[13px] mb-6" style={{ color: `${FOREST}90` }}>Pick a date or skip if you&rsquo;re flexible.</p>
                <input
                  type="date"
                  value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)}
                  min={new Date().toISOString().split("T")[0]}
                  className={inputClass}
                  style={{ borderColor: `${FOREST}12`, color: moveDate ? FOREST : "#B5AFA5" }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                />
                <label className="flex items-center gap-2.5 mt-3.5 cursor-pointer select-none">
                  <div
                    className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors"
                    style={{
                      borderColor: flexible ? GOLD : `${FOREST}20`,
                      backgroundColor: flexible ? GOLD : "transparent",
                    }}
                  >
                    {flexible && (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    )}
                  </div>
                  <input type="checkbox" checked={flexible} onChange={(e) => setFlexible(e.target.checked)} className="sr-only" />
                  <span className="text-[13px]" style={{ color: `${FOREST}90` }}>I&rsquo;m flexible on the date</span>
                </label>
                <button
                  onClick={handleDateNext}
                  className="w-full mt-6 py-3.5 rounded-xl text-[13px] font-bold tracking-wide uppercase transition-all duration-200"
                  style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                >
                  Get My Estimate
                </button>
              </div>
            </StepContainer>
          )}

          {/* Step 3: Estimate + Lead Capture */}
          {step === 3 && !submitted && (
            <StepContainer direction={direction}>
              <div className="px-6 pb-7">
                {estimateLoading ? (
                  <div className="text-center py-10">
                    <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4" style={{ borderColor: GOLD, borderTopColor: "transparent" }} />
                    <p className="text-[14px] font-medium" style={{ color: `${FOREST}70` }}>Calculating your estimate…</p>
                  </div>
                ) : estimate?.disabled ? (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${GOLD}12` }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="1.5" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" /></svg>
                    </div>
                    <p className="text-[15px] font-semibold mb-2" style={{ color: FOREST }}>{estimate.message || "Contact us for a quote"}</p>
                    <p className="text-[13px]" style={{ color: `${FOREST}60` }}>We&rsquo;ll respond within 2 hours.</p>
                  </div>
                ) : estimate && typeof estimate.low === "number" ? (
                  <>
                    <div className="text-center mb-5">
                      <div className="text-[9px] font-bold tracking-[0.16em] uppercase mb-2" style={{ color: `${FOREST}50` }}>Your Estimated Move</div>
                      <p className="text-[38px] font-extrabold leading-none mb-2" style={{ color: WINE }}>
                        {fmtCurrency(estimate.low)} – {fmtCurrency(estimate.high)}
                      </p>
                      <p className="text-[13px] font-medium" style={{ color: `${FOREST}80` }}>
                        {SIZE_LABELS[moveSize] || moveSize} &middot; {fromPostal.toUpperCase()} &rarr; {toPostal.toUpperCase()}
                      </p>
                      {moveDate && (
                        <p className="text-[12px] mt-1" style={{ color: `${FOREST}50` }}>
                          {new Date(moveDate + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
                          {estimate.factors.includes("Peak season") && (
                            <span className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${WINE}10`, color: WINE }}>
                              peak season
                            </span>
                          )}
                        </p>
                      )}
                    </div>

                    {estimate.factors.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center mb-5">
                        {estimate.factors.map((f) => (
                          <span key={f} className="px-2.5 py-1 rounded-full text-[10px] font-semibold" style={{ backgroundColor: CREAM, color: `${FOREST}70` }}>
                            {f}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="rounded-xl p-4 mb-5 border" style={{ backgroundColor: CREAM, borderColor: `${FOREST}08` }}>
                      <p className="text-[12px] leading-relaxed" style={{ color: `${FOREST}80` }}>
                        This is a ballpark range. Enter your details below to receive your exact <strong style={{ color: FOREST }}>guaranteed price</strong>.
                      </p>
                    </div>

                    <div className="space-y-2.5">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Your name"
                        className={inputClass}
                        style={{ borderColor: `${FOREST}12`, color: FOREST }}
                        onFocus={(e) => (e.target.style.borderColor = GOLD)}
                        onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                      />
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="Email address"
                        className={inputClass}
                        style={{ borderColor: `${FOREST}12`, color: FOREST }}
                        onFocus={(e) => (e.target.style.borderColor = GOLD)}
                        onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                      />
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="Phone (optional)"
                        className={inputClass}
                        style={{ borderColor: `${FOREST}12`, color: FOREST }}
                        onFocus={(e) => (e.target.style.borderColor = GOLD)}
                        onBlur={(e) => (e.target.style.borderColor = `${FOREST}12`)}
                      />
                    </div>

                    <button
                      onClick={handleSubmitLead}
                      disabled={!name.trim() || !email.trim() || submitting}
                      className="w-full mt-5 py-3.5 rounded-xl text-[13px] font-bold tracking-wide uppercase transition-all duration-200 disabled:opacity-30"
                      style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
                    >
                      {submitting ? "Submitting…" : "Get My Guaranteed Quote"}
                    </button>

                    <p className="text-center text-[10px] mt-3 flex items-center justify-center gap-1.5" style={{ color: `${FOREST}40` }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
                      No spam. Your detailed quote within 2 hours.
                    </p>
                  </>
                ) : (
                  <div className="text-center py-10">
                    <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: `${WINE}08` }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={WINE} strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                    </div>
                    <p className="text-[15px] font-semibold mb-2" style={{ color: FOREST }}>
                      {estimateError ? "Unable to calculate estimate" : "Something went wrong"}
                    </p>
                    <button
                      onClick={fetchEstimate}
                      className="mt-2 px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
                      style={{ backgroundColor: CREAM, color: FOREST }}
                    >
                      Try Again
                    </button>
                  </div>
                )}
              </div>
            </StepContainer>
          )}

          {/* Submitted confirmation */}
          {submitted && (
            <StepContainer direction="left">
              <div className="px-6 pb-8 text-center">
                <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#E8F5E9" }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#2E7D32" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
                <h2 className="text-[22px] font-bold mb-2" style={{ color: FOREST }}>You&rsquo;re all set!</h2>
                <p className="text-[14px] leading-relaxed mb-4" style={{ color: `${FOREST}80` }}>
                  We&rsquo;ll send your exact guaranteed price to <strong style={{ color: FOREST }}>{email}</strong> within 2 hours.
                </p>
                {leadNumber && (
                  <p className="text-[11px] font-mono" style={{ color: `${FOREST}40` }}>Reference: {leadNumber}</p>
                )}
                {estimate && typeof estimate.low === "number" && estimate.low > 0 && (
                  <div className="mt-5 rounded-xl p-4 border" style={{ backgroundColor: CREAM, borderColor: `${FOREST}08` }}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide mb-1" style={{ color: `${FOREST}50` }}>Your ballpark</p>
                    <p className="text-[22px] font-bold" style={{ color: WINE }}>
                      {fmtCurrency(estimate.low)} – {fmtCurrency(estimate.high)}
                    </p>
                  </div>
                )}
              </div>
            </StepContainer>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5 pt-1">
          <div className="flex items-center justify-center gap-1.5" style={{ opacity: 0.3 }}>
            <span className="text-[9px] font-medium" style={{ color: FOREST }}>Powered by</span>
            <YugoLogo size={10} variant="gold" onLightBackground hidePlus />
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContainer({ children, direction }: { children: React.ReactNode; direction: "left" | "right" }) {
  return (
    <div
      className="animate-widget-slide"
      style={{
        // @ts-expect-error -- CSS custom property for animation direction
        "--slide-from": direction === "left" ? "40px" : "-40px",
      }}
    >
      <style>{`
        @keyframes widgetSlideIn {
          from { opacity: 0; transform: translateX(var(--slide-from)); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-widget-slide {
          animation: widgetSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
        }
      `}</style>
      {children}
    </div>
  );
}

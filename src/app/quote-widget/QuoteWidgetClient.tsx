"use client";

import { useState, useCallback } from "react";

const SIZES = [
  { key: "studio", label: "Studio" },
  { key: "1br", label: "1 Bed" },
  { key: "2br", label: "2 Bed" },
  { key: "3br", label: "3 Bed" },
  { key: "4br", label: "4 Bed" },
  { key: "5br_plus", label: "5+" },
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
      const data = await res.json();
      setEstimate(data);
    } catch {
      setEstimate(null);
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

  const canProceedStep1 = moveSize !== "";
  const canProceedStep2 = fromPostal.replace(/\s/g, "").length >= 3 && toPostal.replace(/\s/g, "").length >= 3;

  return (
    <div className="w-full max-w-[480px] mx-auto">
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] overflow-hidden">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[18px] font-bold tracking-wide" style={{ color: "#722F37" }}>
              YUGO+
            </span>
          </div>
          {step > 0 && step < 4 && (
            <button
              onClick={goBack}
              className="text-[13px] font-medium transition-colors"
              style={{ color: "#722F37" }}
            >
              &larr; Back
            </button>
          )}
        </div>

        {/* Progress */}
        {!submitted && (
          <div className="px-6 pb-4">
            <div className="flex gap-1.5">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-1 rounded-full flex-1 transition-all duration-500"
                  style={{
                    backgroundColor: i <= step ? "#722F37" : "#e8e0d8",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Steps */}
        <div className="relative overflow-hidden min-h-[280px]">
          <div
            className="transition-transform duration-400 ease-out"
            style={{
              transform: `translateX(${step === 0 ? "0" : direction === "left" ? "0" : "0"})`,
            }}
          >
            {/* Step 0: Home Size */}
            {step === 0 && (
              <StepContainer direction={direction}>
                <div className="px-6 pb-6">
                  <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1">How big is your home?</h2>
                  <p className="text-[13px] text-[#888] mb-5">Select the size of your current home.</p>
                  <div className="grid grid-cols-3 gap-2.5">
                    {SIZES.map((s) => (
                      <button
                        key={s.key}
                        onClick={() => setMoveSize(s.key)}
                        className="py-3.5 px-3 rounded-xl text-[14px] font-semibold border-2 transition-all duration-200"
                        style={{
                          borderColor: moveSize === s.key ? "#722F37" : "#e8e0d8",
                          backgroundColor: moveSize === s.key ? "#722F37" : "transparent",
                          color: moveSize === s.key ? "#fff" : "#444",
                        }}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={goNext}
                    disabled={!canProceedStep1}
                    className="w-full mt-5 py-3 rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-40"
                    style={{ backgroundColor: "#722F37" }}
                  >
                    Continue
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Step 1: Locations */}
            {step === 1 && (
              <StepContainer direction={direction}>
                <div className="px-6 pb-6">
                  <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1">Where are you moving?</h2>
                  <p className="text-[13px] text-[#888] mb-5">Postal code or neighbourhood is enough.</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#666] mb-1.5 uppercase tracking-wide">From</label>
                      <input
                        type="text"
                        value={fromPostal}
                        onChange={(e) => setFromPostal(formatPostal(e.target.value))}
                        placeholder="M4M 1A1"
                        maxLength={7}
                        className="w-full px-4 py-3 rounded-xl border-2 text-[15px] outline-none transition-colors bg-white"
                        style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
                        onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                        onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#666] mb-1.5 uppercase tracking-wide">To</label>
                      <input
                        type="text"
                        value={toPostal}
                        onChange={(e) => setToPostal(formatPostal(e.target.value))}
                        placeholder="M5V 2T6"
                        maxLength={7}
                        className="w-full px-4 py-3 rounded-xl border-2 text-[15px] outline-none transition-colors bg-white"
                        style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
                        onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                        onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                      />
                    </div>
                  </div>
                  <button
                    onClick={goNext}
                    disabled={!canProceedStep2}
                    className="w-full mt-5 py-3 rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-40"
                    style={{ backgroundColor: "#722F37" }}
                  >
                    Continue
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Step 2: Move Date */}
            {step === 2 && (
              <StepContainer direction={direction}>
                <div className="px-6 pb-6">
                  <h2 className="text-[20px] font-bold text-[#1a1a1a] mb-1">When are you moving?</h2>
                  <p className="text-[13px] text-[#888] mb-5">Pick a date or mark as flexible.</p>
                  <input
                    type="date"
                    value={moveDate}
                    onChange={(e) => setMoveDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="w-full px-4 py-3 rounded-xl border-2 text-[15px] outline-none transition-colors bg-white"
                    style={{ borderColor: "#e8e0d8", color: moveDate ? "#1a1a1a" : "#aaa" }}
                    onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                    onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                  />
                  <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={flexible}
                      onChange={(e) => setFlexible(e.target.checked)}
                      className="w-4.5 h-4.5 rounded accent-[#722F37]"
                    />
                    <span className="text-[14px] text-[#555]">I&rsquo;m flexible on the date</span>
                  </label>
                  <button
                    onClick={handleDateNext}
                    className="w-full mt-5 py-3 rounded-xl text-[14px] font-bold text-white transition-all duration-200"
                    style={{ backgroundColor: "#722F37" }}
                  >
                    Get My Estimate
                  </button>
                </div>
              </StepContainer>
            )}

            {/* Step 3: Estimate + Lead Capture */}
            {step === 3 && !submitted && (
              <StepContainer direction={direction}>
                <div className="px-6 pb-6">
                  {estimateLoading ? (
                    <div className="text-center py-8">
                      <div className="w-8 h-8 border-3 border-[#722F37] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
                      <p className="text-[14px] text-[#888]">Calculating your estimate...</p>
                    </div>
                  ) : estimate?.disabled ? (
                    <div className="text-center py-8">
                      <p className="text-[16px] text-[#555] mb-4">{estimate.message}</p>
                    </div>
                  ) : estimate ? (
                    <>
                      <h2 className="text-[16px] font-bold text-[#888] uppercase tracking-wide mb-1">Your Estimated Move</h2>
                      <p
                        className="text-[36px] font-extrabold mb-2"
                        style={{ color: "#722F37" }}
                      >
                        ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}
                      </p>
                      <p className="text-[14px] text-[#555] mb-1">
                        {SIZE_LABELS[moveSize] || moveSize} · {fromPostal.toUpperCase()} &rarr; {toPostal.toUpperCase()}
                      </p>
                      {moveDate && (
                        <p className="text-[13px] text-[#888] mb-1">
                          {new Date(moveDate + "T12:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })}
                          {estimate.factors.includes("Peak season") && (
                            <span className="ml-1.5 inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: "#722F3715", color: "#722F37" }}>
                              peak season
                            </span>
                          )}
                        </p>
                      )}
                      {estimate.factors.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2 mb-4">
                          {estimate.factors.map((f) => (
                            <span key={f} className="px-2.5 py-1 rounded-full text-[11px] font-medium" style={{ backgroundColor: "#FAF7F2", color: "#888" }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}

                      <div className="rounded-xl p-4 mb-4" style={{ backgroundColor: "#FAF7F2" }}>
                        <p className="text-[13px] text-[#666] leading-relaxed">
                          This is a ballpark range. Get your exact <strong>guaranteed price</strong>:
                        </p>
                      </div>

                      <div className="space-y-2.5">
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Your name"
                          className="w-full px-4 py-3 rounded-xl border-2 text-[14px] outline-none bg-white"
                          style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
                          onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                          onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                        />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className="w-full px-4 py-3 rounded-xl border-2 text-[14px] outline-none bg-white"
                          style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
                          onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                          onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                        />
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="Phone (optional)"
                          className="w-full px-4 py-3 rounded-xl border-2 text-[14px] outline-none bg-white"
                          style={{ borderColor: "#e8e0d8", color: "#1a1a1a" }}
                          onFocus={(e) => (e.target.style.borderColor = "#722F37")}
                          onBlur={(e) => (e.target.style.borderColor = "#e8e0d8")}
                        />
                      </div>

                      <button
                        onClick={handleSubmitLead}
                        disabled={!name.trim() || !email.trim() || submitting}
                        className="w-full mt-4 py-3.5 rounded-xl text-[14px] font-bold text-white transition-all duration-200 disabled:opacity-40"
                        style={{ backgroundColor: "#C5A55A" }}
                      >
                        {submitting ? "Submitting..." : "Get My Guaranteed Quote →"}
                      </button>

                      <p className="text-center text-[11px] text-[#aaa] mt-3 flex items-center justify-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        No spam. We&rsquo;ll send your detailed quote within 2 hours.
                      </p>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-[14px] text-[#888]">Unable to calculate estimate. Please try again.</p>
                      <button onClick={fetchEstimate} className="mt-3 text-[13px] font-semibold" style={{ color: "#722F37" }}>
                        Retry
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
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: "#f0fdf4" }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <h2 className="text-[22px] font-bold text-[#1a1a1a] mb-2">You&rsquo;re all set!</h2>
                  <p className="text-[14px] text-[#555] leading-relaxed mb-4">
                    We&rsquo;ll send your exact guaranteed price to <strong>{email}</strong> within 2 hours.
                  </p>
                  {leadNumber && (
                    <p className="text-[12px] text-[#aaa]">Reference: {leadNumber}</p>
                  )}
                  {estimate && (
                    <div className="mt-4 rounded-xl p-4" style={{ backgroundColor: "#FAF7F2" }}>
                      <p className="text-[13px] text-[#888] mb-1">Your ballpark</p>
                      <p className="text-[20px] font-bold" style={{ color: "#722F37" }}>
                        ${estimate.low.toLocaleString()} – ${estimate.high.toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </StepContainer>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContainer({ children, direction }: { children: React.ReactNode; direction: "left" | "right" }) {
  return (
    <div
      className="animate-slide-in"
      style={{
        // @ts-expect-error -- CSS custom property for animation direction
        "--slide-from": direction === "left" ? "40px" : "-40px",
      }}
    >
      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(var(--slide-from)); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-slide-in {
          animation: slideIn 0.35s ease-out forwards;
        }
      `}</style>
      {children}
    </div>
  );
}

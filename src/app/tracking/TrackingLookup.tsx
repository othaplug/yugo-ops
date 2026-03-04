"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";

export default function TrackingLookup() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = code.trim();
    if (!q) {
      setError("Please enter a tracking number");
      inputRef.current?.focus();
      return;
    }
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/tracking/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: q }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Not found");
        setLoading(false);
        return;
      }
      router.push(data.url.replace(/^https?:\/\/[^/]+/, ""));
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: CREAM }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        {/* Wine header strip + logo */}
        <div className="w-full max-w-md flex justify-center mb-8">
          <div className="rounded-xl px-5 py-3 flex items-center gap-2" style={{ backgroundColor: `${WINE}12`, border: `1px solid ${WINE}25` }}>
            <YugoLogo size={26} variant="gold" />
          </div>
        </div>

        <div className="text-center max-w-md mb-8">
          <h1 className="text-[22px] md:text-[28px] font-bold mb-3 leading-tight" style={{ color: WINE }}>
            Track Your Move or Delivery
          </h1>
          <p className="text-[13px] md:text-[14px] leading-relaxed opacity-80" style={{ color: FOREST }}>
            Enter your tracking number to see real-time status, live crew location, and delivery details.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="w-full max-w-md">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder="e.g. MV1234 or PJ1024"
              autoFocus
              className="w-full px-5 py-4 pr-[100px] rounded-2xl text-[15px] font-semibold tracking-wide placeholder:font-normal focus:outline-none focus:ring-2 transition-all"
              style={{
                backgroundColor: "#fff",
                border: `2px solid ${FOREST}20`,
                color: FOREST,
              }}
              onFocus={(e) => {
                e.target.style.borderColor = GOLD;
                e.target.style.boxShadow = `0 0 0 3px ${GOLD}30`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = `${FOREST}20`;
                e.target.style.boxShadow = "none";
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-2 top-1/2 -translate-y-1/2 px-5 py-2.5 rounded-xl text-[12px] font-bold tracking-wide disabled:opacity-50 transition-colors"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              ) : (
                "TRACK"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </form>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-12 w-full max-w-lg">
          {[
            { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", title: "Live GPS", desc: "Real-time crew location on map" },
            { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", title: "Status Updates", desc: "Step-by-step progress tracking" },
            { icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", title: "ETA & Schedule", desc: "Scheduled date, time window" },
          ].map((c) => (
            <div key={c.title} className="p-4 rounded-xl bg-white text-center border" style={{ borderColor: `${FOREST}20`, color: FOREST }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-2.5 opacity-90">
                <path d={c.icon} />
              </svg>
              <div className="text-[11px] font-bold mb-0.5" style={{ color: FOREST }}>{c.title}</div>
              <div className="text-[10px] opacity-80">{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center py-6 border-t" style={{ borderColor: `${FOREST}15` }}>
        <p className="text-[10px] opacity-70" style={{ color: FOREST }}>
          <Link href="/" className="hover:underline font-semibold" style={{ color: GOLD }}>YUGO</Link> · Logistics & Moving
        </p>
      </footer>
    </div>
  );
}

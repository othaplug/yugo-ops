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

        {/* Logo — no card, no border */}
        <div className="mb-8">
          <Link href="/">
            <YugoLogo size={30} variant="gold" />
          </Link>
        </div>

        {/* Hero text */}
        <div className="text-center max-w-sm mb-10">
          <h1
            className="font-hero text-[30px] md:text-[38px] leading-tight mb-4"
            style={{ color: WINE }}
          >
            Track Your Move<br />or Delivery
          </h1>
          <p className="text-[13px] leading-relaxed opacity-65" style={{ color: FOREST }}>
            Enter your tracking number to see real-time status, live crew location, and delivery details.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-[400px]">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(""); }}
              placeholder="e.g. MV1234 or DLV-4467"
              autoFocus
              className="w-full px-5 py-3.5 pr-[90px] rounded-full text-[14px] font-semibold tracking-wide placeholder:font-normal placeholder:opacity-40 focus:outline-none transition-all"
              style={{
                backgroundColor: "#fff",
                border: `1.5px solid ${FOREST}18`,
                color: FOREST,
                boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = GOLD;
                e.target.style.boxShadow = `0 0 0 3px ${GOLD}25, 0 2px 16px rgba(0,0,0,0.08)`;
              }}
              onBlur={(e) => {
                e.target.style.borderColor = `${FOREST}18`;
                e.target.style.boxShadow = "0 2px 16px rgba(0,0,0,0.06)";
              }}
            />
            <button
              type="submit"
              disabled={loading}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 px-4 py-2 rounded-full text-[11px] font-bold tracking-widest uppercase disabled:opacity-50 transition-all hover:opacity-90 active:scale-95"
              style={{ backgroundColor: WINE, color: "#FAF8F4" }}
            >
              {loading ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                  <path d="M4 12a8 8 0 018-8" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="opacity-75" />
                </svg>
              ) : "Track"}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/8 border border-red-400/20">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </form>

        {/* Feature hints — seamless, no cards */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-8 mt-14 w-full max-w-lg">
          {[
            { icon: "M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z", title: "Live GPS", desc: "Real-time crew location" },
            { icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2", title: "Status Updates", desc: "Step-by-step progress" },
            { icon: "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z", title: "ETA & Schedule", desc: "Date, time window" },
          ].map((c) => (
            <div key={c.title} className="flex flex-col items-center gap-2 text-center">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WINE} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.55 }}>
                <path d={c.icon} />
              </svg>
              <div className="text-[11px] font-semibold" style={{ color: FOREST }}>{c.title}</div>
              <div className="text-[10px] opacity-50" style={{ color: FOREST }}>{c.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <footer className="text-center py-5">
        <div className="flex items-center justify-center gap-1.5 opacity-30">
          <span className="text-[10px]" style={{ color: FOREST }}>Powered by</span>
          <YugoLogo size={13} variant="gold" />
        </div>
      </footer>
    </div>
  );
}

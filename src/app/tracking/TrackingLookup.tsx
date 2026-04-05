"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import YugoMarketingFooter from "@/components/YugoMarketingFooter";
import { WINE, FOREST, GOLD, CREAM } from "@/lib/client-theme";
import {
  CircleNotch,
  WarningCircle,
  MapPin,
  CalendarBlank,
  ClipboardText,
} from "@phosphor-icons/react";

export default function TrackingLookup({
  companyContactEmail = process.env.NEXT_PUBLIC_YUGO_EMAIL || "support@helloyugo.com",
}: {
  companyContactEmail?: string;
} = {}) {
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
    <div
      className="min-h-screen flex flex-col"
      style={{ backgroundColor: CREAM }}
    >
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-12">
        {/* Logo, no card, no border */}
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
            Track Your Service
          </h1>
          <p
            className="text-[13px] leading-relaxed opacity-65"
            style={{ color: FOREST }}
          >
            Enter your tracking number to see real-time status, live crew
            location, and delivery details.
          </p>
        </div>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="w-full max-w-[400px]">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              placeholder="e.g. MV1234 or DLV-4467"
              autoFocus
              className="w-full px-5 py-3.5 pr-[90px] rounded-full text-[var(--text-base)] font-semibold tracking-wide placeholder:font-normal placeholder:opacity-40 focus:outline-none transition-all"
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
                <CircleNotch
                  size={14}
                  className="animate-spin text-[#FAF8F4]"
                />
              ) : (
                "Track"
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-2xl bg-red-500/8 border border-red-400/20">
              <WarningCircle size={13} color="#EF4444" />
              <p className="text-[12px] text-red-600">{error}</p>
            </div>
          )}
        </form>

        {/* Feature hints, Live GPS and ETA side by side, Status Updates below */}
        <div className="flex flex-col items-center gap-8 mt-14 w-full max-w-lg">
          <div className="flex flex-row items-center justify-center gap-10 sm:gap-14 w-full">
            {[
              {
                Icon: MapPin,
                title: "Live GPS",
                desc: "Real-time crew location",
              },
              {
                Icon: CalendarBlank,
                title: "ETA & Schedule",
                desc: "Date, time window",
              },
            ].map((c) => {
              const HintIcon = c.Icon;
              return (
                <div
                  key={c.title}
                  className="flex flex-col items-center gap-2 text-center"
                >
                  <HintIcon size={18} color={WINE} className="opacity-[0.55]" />
                  <div
                    className="text-[11px] font-semibold"
                    style={{ color: FOREST }}
                  >
                    {c.title}
                  </div>
                  <div
                    className="text-[10px] opacity-50"
                    style={{ color: FOREST }}
                  >
                    {c.desc}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <ClipboardText size={18} color={WINE} className="opacity-[0.55]" />
            <div
              className="text-[11px] font-semibold"
              style={{ color: FOREST }}
            >
              Status Updates
            </div>
            <div className="text-[10px] opacity-50" style={{ color: FOREST }}>
              Step-by-step progress
            </div>
          </div>
        </div>
      </div>

      <footer className="text-center py-5 px-4">
        <YugoMarketingFooter
          contactEmail={companyContactEmail}
          logoVariant="wine"
          onLightBackground
          logoSize={13}
          mutedColor={`${FOREST}99`}
          linkColor={FOREST}
        />
      </footer>
    </div>
  );
}

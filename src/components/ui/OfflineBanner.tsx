"use client";

import { useEffect, useState } from "react";
import { Check, WifiSlash } from "@phosphor-icons/react";

export default function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const handleOffline = () => setOnline(false);
    const handleOnline = () => {
      setOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };

    setOnline(navigator.onLine);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);
    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  if (online && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className={`fixed top-0 left-0 right-0 z-[100001] flex items-center justify-center gap-2 py-2 px-4 text-[12px] font-semibold transition-all duration-300 ${
        online
          ? "bg-[var(--grn)] text-white"
          : "bg-[#1A1A1A] text-[var(--tx2)] border-b border-[var(--brd)]"
      }`}
    >
      {online ? (
        <>
          <Check weight="bold" size={13} className="shrink-0 text-current" aria-hidden />
          Back online
        </>
      ) : (
        <>
          <WifiSlash size={13} className="shrink-0 text-current" aria-hidden />
          You&apos;re offline — some features may be unavailable
        </>
      )}
    </div>
  );
}

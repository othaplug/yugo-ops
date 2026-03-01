"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function PartnerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Partner error:", error); }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[#FAF8F5]">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#E53E3E" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h1 className="text-[18px] font-bold text-[#1A1714] font-serif">Something went wrong</h1>
        <p className="text-[13px] text-[#888]">{error.message || "An unexpected error occurred."}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white">Try again</button>
          <Link href="/partner" className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[#E8E4DF] text-[#1A1714]">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

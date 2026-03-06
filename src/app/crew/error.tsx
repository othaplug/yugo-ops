"use client";

import { useEffect } from "react";

export default function CrewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Crew error:", error); }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[#0F0F0F]">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-red-900/30 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h1 className="text-[18px] font-bold text-white">Something went wrong</h1>
        <p className="text-[13px] text-gray-400">{error.message || "An unexpected error occurred."}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[#C9A962] text-black">Try again</button>
          <a href="/crew/dashboard" className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-gray-700 text-white">Dashboard</a>
        </div>
      </div>
    </div>
  );
}

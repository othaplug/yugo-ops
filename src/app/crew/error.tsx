"use client";

import { useEffect } from "react";
import { X } from "@phosphor-icons/react";

export default function CrewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Crew error:", error); }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 bg-[#0F0F0F]">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-red-900/30 flex items-center justify-center">
          <X size={24} color="#EF4444" />
        </div>
        <h1 className="text-[18px] font-bold text-white">Something went wrong</h1>
        <p className="text-[13px] text-gray-400">{error.message || "An unexpected error occurred."}</p>
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-3 py-1.5 text-[12px] font-semibold bg-[#2C3E2D] text-black">Try again</button>
          <a href="/crew/dashboard" className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-gray-700 text-white">Dashboard</a>
        </div>
      </div>
    </div>
  );
}

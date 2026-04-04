"use client";

import { useEffect } from "react";
import { XCircle } from "@phosphor-icons/react";

export default function PayError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("Payment error:", error); }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#FAF8F5] to-white">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-red-50 border border-red-100 flex items-center justify-center">
          <XCircle size={24} color="#E53E3E" aria-hidden />
        </div>
        <h1 className="text-[18px] font-bold text-[#1A1714]">Payment Error</h1>
        <p className="text-[13px] text-[#4F4B47]">{error.message || "Something went wrong processing your payment. Please try again."}</p>
        <button onClick={reset} className="px-5 py-2.5 rounded-lg text-[12px] font-semibold bg-[#2C3E2D] text-white">Try again</button>
      </div>
    </div>
  );
}

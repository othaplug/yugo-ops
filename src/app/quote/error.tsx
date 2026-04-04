"use client";

import { useEffect } from "react";
import { XCircle } from "@phosphor-icons/react";
import { SafeText } from "@/components/SafeText";

export default function QuoteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Quote error:", error);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#FAF8F5] to-white">
      <div className="max-w-md w-full text-center space-y-5">
        <XCircle
          className="mx-auto block"
          size={24}
          color="#E53E3E"
          aria-hidden
        />
        <h1 className="text-[18px] font-bold text-[#1A1714]">
          Something went wrong
        </h1>
        <p className="text-[13px] text-[#4F4B47]">
          <SafeText fallback="We couldn't load this quote. It may have expired or been removed.">
            {error.message ||
              "We couldn't load this quote. It may have expired or been removed."}
          </SafeText>
        </p>
        <button
          onClick={reset}
          className="px-5 py-2.5 rounded-lg text-[12px] font-semibold bg-[#2C3E2D] text-white"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

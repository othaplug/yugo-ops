"use client";

import { useEffect } from "react";
import Link from "next/link";

interface SectionErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
  section?: string;
}

export default function SectionError({ error, reset, section }: SectionErrorProps) {
  useEffect(() => {
    console.error(`[${section ?? "admin"} error]`, error);
  }, [error, section]);

  return (
    <div className="min-h-[50vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-sm w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--rdim)] flex items-center justify-center">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--red)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div>
          <h2 className="text-[16px] font-bold text-[var(--tx)]">
            {section ? `${section} failed to load` : "Something went wrong"}
          </h2>
          <p className="text-[12px] text-[var(--tx3)] mt-1.5 leading-relaxed">
            {error.message && !error.message.includes("fetch")
              ? error.message
              : "An unexpected error occurred. Your data is safe."}
          </p>
          {error.digest && (
            <p className="text-[10px] text-[var(--tx3)]/50 mt-1 font-mono">
              ref: {error.digest}
            </p>
          )}
        </div>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors touch-manipulation"
          >
            Try again
          </button>
          <Link
            href="/admin"
            className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors touch-manipulation"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

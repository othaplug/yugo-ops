"use client";

import { useEffect } from "react";
import Link from "next/link";
import { XCircle } from "@phosphor-icons/react";

const isDev = process.env.NODE_ENV === "development";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Admin error:", error);
    if (isDev) {
      fetch("/api/debug-capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          location: "admin/error.tsx",
          message: "Admin error boundary caught",
          data: { message: error.message, stack: error.stack, digest: error.digest },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-5">
        <div className="w-12 h-12 mx-auto rounded-xl bg-[var(--rdim)] flex items-center justify-center">
          <XCircle size={24} color="var(--red)" aria-hidden />
        </div>
        <h1 className="text-[18px] font-bold text-[var(--tx)]">Something went wrong</h1>
        <p className="text-[13px] text-[var(--tx3)]">{error.message || "An unexpected error occurred."}</p>
        {isDev && error.stack && (
          <pre
            style={{
              fontSize: "9px",
              textAlign: "left",
              opacity: 0.5,
              maxHeight: "120px",
              overflow: "auto",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {error.stack}
          </pre>
        )}
        <div className="flex gap-3 justify-center">
          <button onClick={reset} className="px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]">Try again</button>
          <Link href="/admin" className="px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)]">Dashboard</Link>
        </div>
      </div>
    </div>
  );
}

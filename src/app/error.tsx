"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [dashboardUrl, setDashboardUrl] = useState("/admin");

  useEffect(() => {
    console.error("App error:", error);
    const path = window.location.pathname;
    if (path.startsWith("/partner")) setDashboardUrl("/partner");
    else if (path.startsWith("/crew")) setDashboardUrl("/crew/dashboard");
    else setDashboardUrl("/admin");
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        <h1 className="font-heading text-[20px] font-bold text-[var(--tx)]">
          Something went wrong
        </h1>
        <p className="text-[14px] text-[var(--tx3)]">
          {error.message || "An unexpected error occurred."}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
          >
            Try again
          </button>
          <Link
            href={dashboardUrl}
            className="px-5 py-2.5 rounded-lg text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
          >
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

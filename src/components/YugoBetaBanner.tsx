"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "yugo_beta_banner_dismissed";

/**
 * One-time dismissible beta notice for client/partner-facing surfaces.
 */
export function YugoBetaBanner() {
  const [dismissed, setDismissed] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(STORAGE_KEY) === "true");
    } catch {
      setDismissed(false);
    }
  }, []);

  if (dismissed === null || dismissed) return null;

  return (
    <div
      className="shrink-0 w-full px-4 py-3 text-center text-[13px] leading-snug border-b border-white/10"
      style={{ background: "#2B0416", color: "#F9EDE4" }}
      role="region"
      aria-label="Beta notice"
    >
      <span className="opacity-90">
        Welcome to the new Yugo experience. We are in beta — if you notice anything, let us know at{" "}
        <a
          href="mailto:support@helloyugo.com"
          className="underline underline-offset-2 hover:opacity-100 opacity-95"
        >
          support@helloyugo.com
        </a>
        .
      </span>
      <button
        type="button"
        onClick={() => {
          try {
            localStorage.setItem(STORAGE_KEY, "true");
          } catch {
            /* ignore */
          }
          setDismissed(true);
        }}
        className="ml-4 text-[11px] font-semibold uppercase tracking-wider opacity-70 hover:opacity-100"
      >
        Dismiss
      </button>
    </div>
  );
}

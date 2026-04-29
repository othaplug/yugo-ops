"use client";

import { X } from "@phosphor-icons/react";

type DraftBannerVariant = "v1" | "v2";

interface DraftBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
  /** Admin v2 (Yugo+): token-based subtle strip */
  variant?: DraftBannerVariant;
}

export default function DraftBanner({
  onRestore,
  onDismiss,
  variant = "v1",
}: DraftBannerProps) {
  const isV2 = variant === "v2";

  return (
    <div
      role="status"
      className={
        isV2
          ? "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-line/60 bg-surface-sunken/50 px-3 py-2"
          : "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-[var(--brd)]/35 bg-[var(--card)]/60 px-3 py-2"
      }
    >
      <p
        className={
          isV2
            ? "min-w-0 flex-1 text-[11px] leading-snug text-fg-subtle"
            : "min-w-0 flex-1 text-[11px] leading-snug text-[var(--tx3)]"
        }
      >
        <span className={isV2 ? "text-fg/90" : "text-[var(--tx2)]"}>
          Unsaved draft
        </span>
        <span className={isV2 ? "text-fg-subtle" : "text-[var(--tx3)]"}>
          {" "}
          · you can pick up where you left off.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onRestore}
          className={
            isV2
              ? "rounded-md px-2 py-1 text-[11px] font-semibold text-accent underline-offset-2 transition-colors hover:underline"
              : "rounded-md px-2 py-1 text-[11px] font-semibold text-[#2C3E2D] underline-offset-2 transition-colors hover:underline dark:text-[#B8D4BA]"
          }
        >
          Restore
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={
            isV2
              ? "rounded p-1 text-fg-subtle/70 transition-colors hover:bg-surface-sunken hover:text-fg-subtle"
              : "rounded p-1 text-[var(--tx3)]/70 transition-colors hover:bg-[var(--bg)] hover:text-[var(--tx2)]"
          }
          aria-label="Ignore draft"
          title="Ignore draft"
        >
          <X size={14} weight="bold" aria-hidden />
        </button>
      </div>
    </div>
  );
}

"use client";

import { X } from "@phosphor-icons/react";

type DraftBannerVariant = "v1" | "v2";

interface DraftBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
  /** Admin v2 (Yugo+): surface + purple accent, no gold restore pill */
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
      className={
        isV2
          ? "flex items-center justify-between gap-3 rounded-xl border border-line bg-surface-subtle px-4 py-3"
          : "flex items-center justify-between gap-3 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30 px-4 py-3"
      }
    >
      <div className="flex items-center gap-2.5">
        <span
          className={
            isV2
              ? "text-[12px] font-medium text-fg"
              : "text-[12px] font-medium text-[var(--tx)]"
          }
        >
          You have an unsaved draft. Would you like to continue where you left
          off?
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onRestore}
          className={
            isV2
              ? "rounded-md bg-accent px-3 py-1.5 text-[11px] font-semibold text-white transition-opacity hover:opacity-90"
              : "px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:opacity-90 transition-opacity"
          }
        >
          Restore Draft
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className={
            isV2
              ? "rounded-md p-1.5 text-fg-subtle transition-colors hover:bg-surface-sunken hover:text-fg"
              : "p-1.5 rounded-lg text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
          }
          title="Discard draft"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

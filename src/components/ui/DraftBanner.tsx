"use client";

import { X } from "@phosphor-icons/react";

interface DraftBannerProps {
  onRestore: () => void;
  onDismiss: () => void;
}

export default function DraftBanner({ onRestore, onDismiss }: DraftBannerProps) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-[var(--gold)]/10 border border-[var(--gold)]/30">
      <div className="flex items-center gap-2.5">
        <span className="text-[12px] font-medium text-[var(--tx)]">
          You have an unsaved draft. Would you like to continue where you left off?
        </span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onRestore}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:opacity-90 transition-opacity"
        >
          Restore Draft
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="p-1.5 rounded-lg text-[var(--tx2)] hover:text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
          title="Discard draft"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

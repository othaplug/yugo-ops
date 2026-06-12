"use client";

import {
  ArrowLeft,
  ArrowsClockwise as RefreshCw,
  PaperPlaneTilt as Send,
} from "@phosphor-icons/react";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { quoteDetailDateLabel } from "@/lib/quotes/quote-field-labels";

interface Props {
  quoteId: string;
  /** Current version on the quote record. */
  version: number;
  /** When true, suppress the "→ v(n+1) on save" hint (post-regenerate). */
  hasResult: boolean;
  clientName: string | null | undefined;
  serviceType: string;
  moveDate: string | null | undefined;

  /** Disabled state + button labels. */
  generating: boolean;
  linking: boolean;
  hasChanges: boolean;

  onBack: () => void;
  onSaveChanges: () => void | Promise<void>;
  onSaveAndResend: () => void | Promise<void>;
}

/**
 * Sticky top header for the edit quote page.
 *
 * Holds the version chip (v(n) → v(n+1) on save), client/service meta,
 * and the Save changes / Save & resend action cluster. The amber
 * unsaved-changes banner lives inside the same sticky element so it
 * stays visible while the operator scrolls through the form below.
 *
 * All state lives in the parent — this component is purely presentational.
 */
export default function EditQuoteHeader({
  quoteId,
  version,
  hasResult,
  clientName,
  serviceType,
  moveDate,
  generating,
  linking,
  hasChanges,
  onBack,
  onSaveChanges,
  onSaveAndResend,
}: Props) {
  return (
    <div
      className="sticky top-0 z-20 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-3 pb-3 mb-5 bg-[var(--bg)] border-b border-[var(--brd)]"
      data-edit-quote-header
    >
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={onBack}
          className="text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
          aria-label="Back"
        >
          <ArrowLeft size={18} weight="regular" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="text-[9px] font-bold text-[var(--gold)] tracking-widest uppercase">
            Re-Quote
          </div>
          <h1 className="text-lg font-bold text-[var(--tx)] flex items-baseline gap-2 flex-wrap">
            Edit Quote {quoteId}
            <span className="text-[11px] font-medium text-[var(--tx3)]">
              v{version || 1}
              {!hasResult && (
                <>
                  {" → "}
                  <span className="text-[var(--gold)]">
                    v{(version || 1) + 1} on save
                  </span>
                </>
              )}
            </span>
          </h1>
          <div className="text-[11px] text-[var(--tx3)] flex items-center gap-2 flex-wrap mt-0.5">
            <span>{clientName || "—"}</span>
            <span>·</span>
            <span>{serviceTypeDisplayLabel(serviceType)}</span>
            {moveDate && (
              <>
                <span>·</span>
                <span>
                  {quoteDetailDateLabel(serviceType)} {moveDate}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Action cluster — primary action on the right. Disabled
            when no changes vs baseline; clicking Save & resend
            without a reason surfaces the validation error inline. */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveChanges}
            disabled={generating || !hasChanges}
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:bg-[var(--card)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            <RefreshCw
              size={12}
              className={generating ? "animate-spin" : ""}
            />
            {generating ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onSaveAndResend}
            disabled={generating || linking || (!hasChanges && !hasResult)}
            className="btn-p text-[11px] font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={12} />
            {linking ? "Sending…" : "Save & resend"}
          </button>
        </div>
      </div>

      {hasChanges && (
        <div className="mt-2.5 px-3 py-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center gap-2 text-[11px]">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
          <span className="font-semibold text-amber-700 dark:text-amber-400">
            Unsaved changes
          </span>
          <span className="text-amber-700/70 dark:text-amber-400/70">
            · click Save changes to preview the new pricing or Save
            &amp; resend to publish &amp; email the client.
          </span>
        </div>
      )}
    </div>
  );
}

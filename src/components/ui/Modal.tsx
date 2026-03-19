"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/AppIcons";

export interface GlobalModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg";
  /** Optional: render without header (for custom layouts) */
  noHeader?: boolean;
}

export default function GlobalModal({
  open,
  onClose,
  title = "",
  children,
  maxWidth = "md",
  noHeader = false,
}: GlobalModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [open, handleEscape]);

  if (!open || typeof document === "undefined") return null;

  const maxW = maxWidth === "sm" ? "sm:max-w-sm" : maxWidth === "lg" ? "sm:max-w-lg" : "sm:max-w-md";

  const modal = (
    <div
      className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-0 bg-black/60 backdrop-blur-sm modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content panel:
          - Mobile: slides up from bottom, full width, rounded top corners, respects safe area
          - Desktop: centered card with max-width */}
      <div
        className={`relative z-10 w-full ${maxW} flex flex-col bg-[var(--card)] border border-[var(--brd)] sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden modal-card pointer-events-auto animate-slide-up sm:animate-none`}
        style={{ maxHeight: "min(92dvh, 92vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        {!noHeader && (
          <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between shrink-0">
            <h2 id="modal-title" className="font-heading text-[17px] font-bold text-[var(--tx)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)] hover:text-[var(--tx)] transition-colors touch-manipulation"
              aria-label="Close"
            >
              <Icon name="x" className="w-[18px] h-[18px]" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0 p-5">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

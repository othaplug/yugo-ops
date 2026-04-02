"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/AppIcons";

export interface GlobalModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
  /** Render without header (for custom layouts) */
  noHeader?: boolean;
  /** Remove the default p-5 / overflow-y-auto wrapper so children manage their own layout */
  noPadding?: boolean;
}

export default function GlobalModal({
  open,
  onClose,
  title = "",
  children,
  maxWidth = "md",
  noHeader = false,
  noPadding = false,
}: GlobalModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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
    // Move focus into the modal on open
    const frame = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const focusable = containerRef.current.querySelector<HTMLElement>(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])"
      );
      (focusable ?? containerRef.current).focus();
    });
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", handleEscape);
      cancelAnimationFrame(frame);
    };
  }, [open, handleEscape]);

  if (!open || typeof document === "undefined") return null;

  const maxW =
    maxWidth === "sm" ? "sm:max-w-sm" :
    maxWidth === "lg" ? "sm:max-w-lg" :
    maxWidth === "xl" ? "sm:max-w-xl" :
    maxWidth === "2xl" ? "sm:max-w-2xl" :
    "sm:max-w-md";

  const modal = (
    <div
      ref={containerRef}
      data-modal-root
      className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      tabIndex={-1}
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-0 bg-black/60 modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content: viewport-centered on all breakpoints (avoids bottom-sheet clipping when ancestor has transform) */}
      <div
        className={`relative z-10 w-full ${maxW} flex flex-col bg-[var(--card)] border border-[var(--brd)] rounded-2xl shadow-2xl overflow-hidden modal-card pointer-events-auto`}
        style={{ maxHeight: "min(90dvh, 90vh)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
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
        {noPadding ? (
          <div className="flex-1 min-h-0 overflow-hidden flex flex-col">{children}</div>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0 p-5">{children}</div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

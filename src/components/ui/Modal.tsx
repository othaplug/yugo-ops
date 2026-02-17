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

  const maxW = maxWidth === "sm" ? "max-w-sm" : maxWidth === "lg" ? "max-w-lg" : "max-w-md";

  const modal = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Dimmed backdrop - covers viewport */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content panel - centered */}
      <div
        className={`relative w-full ${maxW} max-h-[85vh] flex flex-col bg-[var(--card)] border border-[var(--brd)] rounded-xl shadow-2xl overflow-hidden animate-fade-up my-auto`}
        onClick={(e) => e.stopPropagation()}
      >
        {!noHeader && (
          <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between shrink-0">
            <h2 id="modal-title" className="font-heading text-[16px] font-bold text-[var(--tx)]">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg)] text-[var(--tx2)] transition-colors"
              aria-label="Close"
            >
              <Icon name="x" className="w-[16px] h-[16px]" />
            </button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 min-h-0">{children}</div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

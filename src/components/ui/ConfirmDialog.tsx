"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    },
    [onCancel]
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

  const isDanger = variant === "danger";

  const modal = (
    <div
      className="fixed inset-0 z-[100000] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fade-in"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full sm:max-w-sm bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl shadow-2xl modal-card overflow-hidden animate-slide-up sm:animate-none"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {/* Icon */}
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${
              isDanger ? "bg-[var(--rdim)]" : "bg-[var(--gdim)]"
            }`}
          >
            {isDanger ? (
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke={isDanger ? "var(--red)" : "var(--gold)"}
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            ) : (
              <svg
                width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            )}
          </div>

          {/* Text */}
          <h2 id="confirm-title" className="text-[16px] font-bold text-[var(--tx)] mb-2">
            {title}
          </h2>
          {message && (
            <p className="text-[13px] text-[var(--tx3)] leading-relaxed">{message}</p>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 px-4 py-3.5 sm:py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--tx3)] hover:text-[var(--tx)] transition-colors touch-manipulation"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); }}
            className={`flex-1 px-4 py-3.5 sm:py-2.5 rounded-xl text-[13px] font-bold transition-all active:scale-95 touch-manipulation ${
              isDanger
                ? "bg-[var(--red)] text-white hover:opacity-90"
                : "bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}

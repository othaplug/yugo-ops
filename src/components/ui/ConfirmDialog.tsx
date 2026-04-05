"use client";

import { useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { Info, Warning } from "@phosphor-icons/react";

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
      data-modal-root
      className="fixed inset-0 z-[100000] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div
        className="fixed inset-0 bg-black/60 modal-overlay"
        aria-hidden="true"
        onClick={onCancel}
      />
      <div
        className="relative z-10 w-full max-w-sm bg-[var(--card)] border border-[var(--brd)] rounded-2xl shadow-2xl modal-card overflow-hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)", maxHeight: "min(90dvh, 90vh)" }}
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
              <Warning size={20} color="var(--red)" aria-hidden />
            ) : (
              <Info size={20} color="var(--gold)" aria-hidden />
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
                : "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)]"
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

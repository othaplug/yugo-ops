"use client"

import { useEffect, useCallback } from "react"
import { createPortal } from "react-dom"
import { Info, Warning } from "@phosphor-icons/react"
import { Button } from "@/design-system/admin/primitives"
import { cn } from "@/design-system/admin/lib/cn"
import { useAdminShellTheme } from "@/hooks/useAdminShellTheme"

export interface ConfirmDialogProps {
  open: boolean
  title: string
  message?: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: "danger" | "default"
  onConfirm: () => void
  onCancel: () => void
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
  const adminShellTheme = useAdminShellTheme()
  const handleEscape = useCallback(
    (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") onCancel()
    },
    [onCancel],
  )

  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", handleEscape)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener("keydown", handleEscape)
    }
  }, [open, handleEscape])

  if (!open || typeof document === "undefined") return null

  const isDanger = variant === "danger"

  const modal = (
    <div
      data-modal-root
      className="fixed inset-0 z-[100000] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
    >
      <div className="modal-overlay fixed inset-0" aria-hidden="true" onClick={onCancel} />
      <div
        data-yugo-admin-v3=""
        data-theme={adminShellTheme}
        className="modal-card relative z-10 w-full max-w-sm overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] shadow-2xl"
        style={{
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          maxHeight: "min(90dvh, 90vh)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div
            className={`mb-4 flex h-11 w-11 items-center justify-center rounded-[var(--yu3-r-md)] ${
              isDanger ? "bg-[var(--yu3-danger-tint)]" : "bg-[var(--yu3-wine-tint)]"
            }`}
          >
            {isDanger ? (
              <Warning size={20} className="text-[var(--yu3-danger)]" aria-hidden />
            ) : (
              <Info size={20} className="text-[var(--yu3-wine)]" aria-hidden />
            )}
          </div>

          <h2
            id="confirm-title"
            className="mb-2 text-[16px] font-bold text-[var(--yu3-ink-strong)]"
          >
            {title}
          </h2>
          {message && (
            <p className="text-[13px] leading-relaxed text-[var(--yu3-ink-muted)]">
              {message}
            </p>
          )}
        </div>

        <div className="flex gap-3 px-6 pb-6">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="min-h-[44px] flex-1 touch-manipulation sm:min-h-0"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant="primary"
            size="md"
            className={cn(
              "min-h-[44px] flex-1 touch-manipulation sm:min-h-0",
              isDanger &&
                "!border-[var(--yu3-danger)] !bg-[var(--yu3-danger)] !text-white hover:!border-[var(--yu3-danger)] hover:!bg-[var(--yu3-danger)] hover:!opacity-90",
            )}
            onClick={() => {
              onConfirm()
            }}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

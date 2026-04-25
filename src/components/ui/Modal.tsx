"use client"

import * as React from "react"
import { useEffect, useCallback, useRef } from "react"
import { createPortal } from "react-dom"
import { Icon } from "@/components/AppIcons"
import { cn } from "@/design-system/admin/lib/cn"
import { useAdminShellTheme } from "@/hooks/useAdminShellTheme"

export interface GlobalModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl"
  noHeader?: boolean
  noPadding?: boolean
  /** Override default title color (default: yu3 ink strong) */
  titleClassName?: string
}

type ModalHandle = { onClose: () => void }
const modalStack: ModalHandle[] = []
let globalEscapeBound = false

function bindGlobalEscape() {
  if (globalEscapeBound || typeof window === "undefined") return
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return
    const top = modalStack[modalStack.length - 1]
    if (!top) return
    e.stopPropagation()
    top.onClose()
  }
  window.addEventListener("keydown", handler, { capture: true })
  globalEscapeBound = true
}

function pushModal(handle: ModalHandle) {
  if (process.env.NODE_ENV !== "production" && modalStack.length >= 1) {
    // eslint-disable-next-line no-console
    console.warn(
      "[drawer-policy] A second GlobalModal opened while one was already visible. Close the first before opening another; stacking leads to ambiguous ESC + focus behavior.",
    )
  }
  modalStack.push(handle)
  bindGlobalEscape()
}

function popModal(handle: ModalHandle) {
  const idx = modalStack.indexOf(handle)
  if (idx >= 0) modalStack.splice(idx, 1)
}

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])"

export default function GlobalModal({
  open,
  onClose,
  title = "",
  children,
  maxWidth = "md",
  noHeader = false,
  noPadding = false,
  titleClassName,
}: GlobalModalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose
  const adminShellTheme = useAdminShellTheme()
  const yu3ShellProps = { "data-yugo-admin-v3": "" as const, "data-theme": adminShellTheme }

  useEffect(() => {
    if (!open) return
    const handle: ModalHandle = {
      onClose: () => onCloseRef.current(),
    }
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    pushModal(handle)
    return () => {
      document.body.style.overflow = prev
      popModal(handle)
    }
  }, [open])

  const handleTrapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !containerRef.current) return
    const nodes = containerRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    if (nodes.length === 0) return
    const first = nodes[0]
    const last = nodes[nodes.length - 1]
    const active = document.activeElement as HTMLElement | null
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [])

  useEffect(() => {
    if (!open) return
    const frame = requestAnimationFrame(() => {
      if (!containerRef.current) return
      const focusable =
        containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)
      ;(focusable ?? containerRef.current).focus()
    })
    return () => cancelAnimationFrame(frame)
  }, [open])

  if (!open || typeof document === "undefined") return null

  const maxW =
    maxWidth === "sm"
      ? "sm:max-w-sm"
      : maxWidth === "lg"
        ? "sm:max-w-lg"
        : maxWidth === "xl"
          ? "sm:max-w-xl"
          : maxWidth === "2xl"
            ? "sm:max-w-2xl"
            : maxWidth === "3xl"
              ? "sm:max-w-3xl"
              : maxWidth === "4xl"
                ? "sm:max-w-4xl"
                : maxWidth === "5xl"
                  ? "sm:max-w-5xl"
                  : "sm:max-w-md"

  const modal = (
    <div
      ref={containerRef}
      data-modal-root
      className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      tabIndex={-1}
      onKeyDown={handleTrapTab}
    >
      <div
        className="modal-overlay fixed inset-0 z-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        {...yu3ShellProps}
        className={cn(
          "modal-card pointer-events-auto relative z-10 flex w-full flex-col overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] shadow-2xl",
          maxW,
        )}
        style={{
          maxHeight: "min(90dvh, 90vh)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {!noHeader && (
          <div
            className="flex shrink-0 items-center justify-between border-b border-[var(--yu3-line)] px-5 py-4"
          >
            <h2
              id="modal-title"
              className={cn(
                "font-heading text-[17px] font-bold",
                titleClassName ?? "text-[var(--yu3-ink-strong)]",
              )}
            >
              {title}
            </h2>
            <button
              onClick={onClose}
              type="button"
              className="flex h-9 w-9 touch-manipulation items-center justify-center rounded-[var(--yu3-r-md)] text-[var(--yu3-ink-muted)] transition-colors hover:bg-[var(--yu3-bg-surface-sunken)] hover:text-[var(--yu3-ink)]"
              aria-label="Close"
            >
              <Icon name="x" className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
        {noPadding ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
        ) : (
          <div className="min-h-0 max-h-full flex-1 overflow-y-auto p-5">{children}</div>
        )}
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

"use client"

import type { AriaRole, CSSProperties, ReactNode } from "react"
import { useAdminShellTheme } from "@/hooks/useAdminShellTheme"

export type ModalDialogFrameProps = {
  zClassName?: string
  className?: string
  yugoGlassChrome?: boolean
  backdropClassName?: string
  onBackdropClick?: () => void
  panelClassName: string
  role?: AriaRole
  ariaModal?: boolean
  ariaLabelledBy?: string
  panelStyle?: CSSProperties
  children: ReactNode
}

/**
 * Standard portal-style dialog: backdrop + panel. Panel is wrapped with
 * `data-yugo-admin-v3` so `var(--yu3-*)` resolves when portaled to `document.body`.
 */
export function ModalDialogFrame({
  zClassName = "z-[var(--z-modal)]",
  className = "",
  yugoGlassChrome = false,
  backdropClassName = "",
  onBackdropClick,
  panelClassName,
  role = "dialog",
  ariaModal = true,
  ariaLabelledBy,
  panelStyle,
  children,
}: ModalDialogFrameProps) {
  const adminShellTheme = useAdminShellTheme()

  return (
    <div
      data-modal-root
      {...(yugoGlassChrome ? { "data-yugo-glass-modal": "" } : {})}
      className={`fixed inset-0 ${zClassName} flex min-h-0 items-center justify-center overflow-y-auto overscroll-contain p-4 sm:p-5 ${className}`.trim()}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={ariaLabelledBy}
    >
      <div
        className={`modal-overlay fixed inset-0 z-0 ${backdropClassName}`.trim()}
        aria-hidden
        onClick={onBackdropClick}
      />
      <div
        data-yugo-admin-v3=""
        data-theme={adminShellTheme}
        className={`relative z-10 w-full min-w-0 pointer-events-auto ${panelClassName}`.trim()}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}

"use client";

import type { CSSProperties, ReactNode } from "react";

export type ModalDialogFrameProps = {
  /** z-index for the full-screen host (e.g. z-50, z-[99999]) */
  zClassName?: string;
  className?: string;
  /** Yugo+ tinted modal host: dim overlay + `yugo-glass-light` panel (see globals.css). */
  yugoGlassChrome?: boolean;
  /** Backdrop fill (default matches GlobalModal) */
  backdropClassName?: string;
  onBackdropClick?: () => void;
  /**
   * Panel wrapper classes. Include `modal-card` for centered dialogs (fade + rise + scale),
   * or `sheet-card sm:modal-card` for bottom sheet on small screens.
   */
  panelClassName: string;
  role?: React.AriaRole;
  ariaModal?: boolean;
  ariaLabelledBy?: string;
  panelStyle?: CSSProperties;
  children: ReactNode;
};

/**
 * Standard portal-style dialog: animated backdrop + animated panel (same motion as GlobalModal / add-partner flow).
 * Renders `data-modal-root` for stacking / reduced-motion rules in globals.css.
 * `yugoGlassChrome` enables `data-yugo-glass-modal` so `.yugo-glass-light` panels pick up frosted styles.
 */
export function ModalDialogFrame({
  zClassName = "z-[var(--z-modal)]",
  className = "",
  yugoGlassChrome = true,
  backdropClassName = "bg-black/60",
  onBackdropClick,
  panelClassName,
  role = "dialog",
  ariaModal = true,
  ariaLabelledBy,
  panelStyle,
  children,
}: ModalDialogFrameProps) {
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
        className={`fixed inset-0 z-0 modal-overlay ${backdropClassName}`.trim()}
        aria-hidden
        onClick={onBackdropClick}
      />
      <div
        className={`relative z-10 w-full min-w-0 pointer-events-auto ${panelClassName}`.trim()}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

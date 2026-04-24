"use client";

import { useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/AppIcons";

export interface GlobalModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl";
  /** Render without header (for custom layouts) */
  noHeader?: boolean;
  /** Remove the default p-5 / overflow-y-auto wrapper so children manage their own layout */
  noPadding?: boolean;
}

// PR 6 drawer policy: a single last-in-wins ESC target plus a dev-only
// warning when more than one modal is open at a time. Everything is
// client-only so the module is safe under SSR.
type ModalHandle = { onClose: () => void };
const modalStack: ModalHandle[] = [];
let globalEscapeBound = false;

function bindGlobalEscape() {
  if (globalEscapeBound || typeof window === "undefined") return;
  const handler = (e: KeyboardEvent) => {
    if (e.key !== "Escape") return;
    const top = modalStack[modalStack.length - 1];
    if (!top) return;
    e.stopPropagation();
    top.onClose();
  };
  window.addEventListener("keydown", handler, { capture: true });
  globalEscapeBound = true;
}

function pushModal(handle: ModalHandle) {
  if (process.env.NODE_ENV !== "production" && modalStack.length >= 1) {
    // eslint-disable-next-line no-console
    console.warn(
      "[drawer-policy] A second GlobalModal opened while one was already visible. Close the first before opening another; stacking leads to ambiguous ESC + focus behavior.",
    );
  }
  modalStack.push(handle);
  bindGlobalEscape();
}

function popModal(handle: ModalHandle) {
  const idx = modalStack.indexOf(handle);
  if (idx >= 0) modalStack.splice(idx, 1);
}

const FOCUSABLE_SELECTOR =
  "button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

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
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handle: ModalHandle = {
      onClose: () => onCloseRef.current(),
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    pushModal(handle);
    return () => {
      document.body.style.overflow = prev;
      popModal(handle);
    };
  }, [open]);

  // Basic focus trap — Tab/Shift+Tab wraps inside the dialog. Keeps keyboard
  // focus scoped to the currently-open drawer per PR 6 drawer policy.
  const handleTrapTab = useCallback((e: React.KeyboardEvent) => {
    if (e.key !== "Tab" || !containerRef.current) return;
    const nodes = containerRef.current.querySelectorAll<HTMLElement>(
      FOCUSABLE_SELECTOR,
    );
    if (nodes.length === 0) return;
    const first = nodes[0];
    const last = nodes[nodes.length - 1];
    const active = document.activeElement as HTMLElement | null;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  // Focus first focusable only when the dialog opens. Must not depend on onClose —
  // unstable callbacks from parents would re-run this every render and steal
  // focus from inputs after each keystroke.
  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      if (!containerRef.current) return;
      const focusable =
        containerRef.current.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (focusable ?? containerRef.current).focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const maxW =
    maxWidth === "sm" ? "sm:max-w-sm" :
    maxWidth === "lg" ? "sm:max-w-lg" :
    maxWidth === "xl" ? "sm:max-w-xl" :
    maxWidth === "2xl" ? "sm:max-w-2xl" :
    maxWidth === "3xl" ? "sm:max-w-3xl" :
    maxWidth === "4xl" ? "sm:max-w-4xl" :
    maxWidth === "5xl" ? "sm:max-w-5xl" :
    "sm:max-w-md";

  const modal = (
    <div
      ref={containerRef}
      data-modal-root
      data-yugo-glass-modal
      className="fixed inset-0 z-[var(--z-modal)] flex min-h-0 items-center justify-center p-4 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      tabIndex={-1}
      onKeyDown={handleTrapTab}
    >
      {/* Dimmed backdrop */}
      <div
        className="fixed inset-0 z-0 bg-black/60 modal-overlay"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Content: viewport-centered on all breakpoints (avoids bottom-sheet clipping when ancestor has transform) */}
      <div
        className={`relative z-10 w-full ${maxW} flex flex-col yugo-glass-light rounded-2xl shadow-2xl overflow-hidden modal-card pointer-events-auto`}
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

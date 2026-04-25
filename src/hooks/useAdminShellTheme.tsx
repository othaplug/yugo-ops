"use client"

import type { ComponentProps, ReactNode } from "react"
import { useSyncExternalStore } from "react"

/**
 * The real admin app shell (first [data-yugo-admin-v3] that is not inside a portaled dialog).
 * Portaled modals on document.body are outside the shell, so yu3 CSS variables must be
 * re-scoped on the dialog panel, with theme synced to the app shell.
 */
export function getAdminAppShellNode(): Element | null {
  if (typeof document === "undefined") return null
  const matches = document.querySelectorAll("[data-yugo-admin-v3]")
  for (const node of matches) {
    if (node.hasAttribute("data-modal-root")) continue
    if (node.closest?.("[data-modal-root]")) continue
    return node
  }
  return null
}

/**
 * `light` | `dark` for portaled UIs. Uses the yugo admin shell when present, otherwise
 * `data-theme` on `document.documentElement` (e.g. partner/crew without admin layout).
 */
export function useAdminShellTheme(): "light" | "dark" {
  return useSyncExternalStore(
    (onStoreChange) => {
      if (typeof document === "undefined") return () => undefined
      const obs = new MutationObserver(() => onStoreChange())
      const shell = getAdminAppShellNode()
      if (shell) {
        obs.observe(shell, { attributes: true, attributeFilter: ["data-theme"] })
      }
      obs.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["data-theme"],
      })
      return () => obs.disconnect()
    },
    () => {
      if (typeof document === "undefined") return "light"
      const shell = getAdminAppShellNode()
      const t =
        shell?.getAttribute("data-theme") ??
        document.documentElement.getAttribute("data-theme")
      return t === "dark" ? "dark" : "light"
    },
    () => "light",
  )
}

export type Yu3PortaledTokenRootProps = {
  className?: string
  children: ReactNode
  /** When set, locks portaled yu3 tokens (e.g. crew modals that must match `data-theme="light"` on `.crew-app`). */
  dataTheme?: "light" | "dark"
} & Omit<ComponentProps<"div">, "children">

/**
 * Use as the direct child of `createPortal(..., document.body)` (or wrap the solid panel
 * so children resolve `var(--yu3-*)` from tokens.css).
 */
export function Yu3PortaledTokenRoot({ className, children, dataTheme, ...rest }: Yu3PortaledTokenRootProps) {
  const shellTheme = useAdminShellTheme()
  const t = dataTheme ?? shellTheme
  return (
    <div data-yugo-admin-v3="" data-theme={t} className={className} {...rest}>
      {children}
    </div>
  )
}

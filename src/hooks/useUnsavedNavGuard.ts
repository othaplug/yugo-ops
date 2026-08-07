"use client";

import { useEffect } from "react";

/**
 * Confirms before the user navigates AWAY from the current page (in-app) while
 * `active` is true — e.g. an admin with a quote half-built clicking a sidebar
 * link. Next.js App Router exposes no route-change guard, so we intercept
 * clicks on internal links in the capture phase and block them if the user
 * cancels. Tab close / refresh is covered separately by the browser's
 * `beforeunload` (wired in useFormDraft). Modifier-clicks, new-tab links,
 * downloads, hash links, and same-page links are ignored.
 */
export function useUnsavedNavGuard(active: boolean, message: string) {
  useEffect(() => {
    if (!active || typeof document === "undefined") return;

    const onClickCapture = (e: MouseEvent) => {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const anchor = (e.target as HTMLElement | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (
        !href ||
        href.startsWith("#") ||
        anchor.target === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }
      let dest: URL;
      try {
        dest = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      // Cross-origin is handled by the browser's own beforeunload prompt.
      if (dest.origin !== window.location.origin) return;
      // Same page (or in-page query change) — not a "leave".
      if (
        dest.pathname === window.location.pathname &&
        dest.search === window.location.search
      ) {
        return;
      }
      if (!window.confirm(message)) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("click", onClickCapture, true);
    return () => document.removeEventListener("click", onClickCapture, true);
  }, [active, message]);
}

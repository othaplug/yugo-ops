"use client";

import type { ReactNode } from "react";

/**
 * Safety net for dynamic strings on client-facing pages: avoids rendering
 * obvious DB-style tokens when upstream data slips through.
 * Prefer proper labeling via getDisplayLabel; use this only where content is fully dynamic.
 */
export function SafeText({
  children,
  fallback = null,
}: {
  children: string;
  /** Shown when `children` looks like raw DB/debug text (optional; default hides). */
  fallback?: ReactNode;
}) {
  const suspicious = /[a-z]+_[a-z]+|uuid|null|undefined|\[object/i;
  if (suspicious.test(children)) {
    if (typeof console !== "undefined" && console.warn) {
      console.warn("SafeText: suspicious value detected:", children);
    }
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

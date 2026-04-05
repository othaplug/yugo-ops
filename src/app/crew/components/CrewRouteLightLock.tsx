"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyDocumentLightTheme } from "@/lib/document-theme-tokens";

/**
 * Re-applies light document tokens on every in-app crew navigation so nothing
 * can leave the html element in dark mode between transitions.
 */
export default function CrewRouteLightLock() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    applyDocumentLightTheme();
  }, [pathname]);
  return null;
}

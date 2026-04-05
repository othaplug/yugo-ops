"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyDocumentLightTheme } from "@/lib/document-theme-tokens";

/** Resets `html` from admin dark mode so all `/track/*` pages stay light. */
export default function TrackLightTheme() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    applyDocumentLightTheme();
  }, [pathname]);
  return null;
}

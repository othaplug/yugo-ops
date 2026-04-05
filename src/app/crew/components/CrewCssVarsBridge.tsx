"use client";

import { useEffect } from "react";
import { useTheme } from "@/app/admin/components/ThemeContext";
import { WINE } from "@/app/quote/[quoteId]/quote-shared";

const GDIM = "rgba(92, 26, 51, 0.12)";

/**
 * Portaled crew UI (modals) sits under `body`, not `.crew-app`, so it misses scoped
 * inline vars. Remap theme accent on `documentElement` for any `/crew/*` session.
 * Cleanup restores when leaving the crew layout.
 */
export default function CrewCssVarsBridge() {
  const { theme } = useTheme();

  useEffect(() => {
    const el = document.documentElement;
    el.style.setProperty("--gold", WINE);
    el.style.setProperty("--gdim", GDIM);
    return () => {
      el.style.removeProperty("--gold");
      el.style.removeProperty("--gdim");
    };
  }, [theme]);

  return null;
}

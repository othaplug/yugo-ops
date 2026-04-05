"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";
import { applyPartnerPortalLightTheme } from "@/lib/partner-portal-theme";

/** Forces light document tokens for all `/partner/*` routes (including login). */
export default function PartnerLightTheme() {
  const pathname = usePathname();
  useLayoutEffect(() => {
    applyPartnerPortalLightTheme();
  }, [pathname]);
  return null;
}

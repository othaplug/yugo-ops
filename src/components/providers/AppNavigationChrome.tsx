"use client"

import NextTopLoader from "nextjs-toploader"

/**
 * Global route transition bar (entire app). Use one instance only.
 * Admin v3 no longer mounts its own top loader; this uses brand wine on any surface.
 */
export function AppNavigationChrome() {
  return (
    <NextTopLoader
      color="var(--gold, #5C1A33)"
      height={2.5}
      showSpinner={false}
      easing="cubic-bezier(0.4, 0, 0.2, 1)"
      speed={320}
      shadow="0 0 12px rgba(92, 26, 51, 0.25)"
    />
  )
}

"use client"

import * as React from "react"

const Yu3PortalContext = React.createContext<HTMLDivElement | null>(null)

export function useYu3PortalContainer(): HTMLDivElement | null {
  return React.useContext(Yu3PortalContext)
}

export function Yu3PortalProvider({
  children,
  portalNode,
}: {
  children: React.ReactNode
  /** Ref target for Radix `Portal` `container` so portaled UIs keep `data-yugo-admin-v3` token scope */
  portalNode: HTMLDivElement | null
}) {
  return <Yu3PortalContext.Provider value={portalNode}>{children}</Yu3PortalContext.Provider>
}

"use client"

import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

type SidebarState = {
  collapsed: boolean
  mobileOpen: boolean
  setCollapsed: (collapsed: boolean) => void
  toggleCollapsed: () => void
  setMobileOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set, get) => ({
      collapsed: false,
      mobileOpen: false,
      setCollapsed: (collapsed) => set({ collapsed }),
      toggleCollapsed: () => set({ collapsed: !get().collapsed }),
      setMobileOpen: (open) => set({ mobileOpen: open }),
    }),
    {
      name: "yugo-admin-sidebar",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ collapsed: state.collapsed }),
    },
  ),
)

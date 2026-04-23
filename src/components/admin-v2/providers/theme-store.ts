"use client"

import { create } from "zustand"
import { persist, createJSONStorage } from "zustand/middleware"

export type ThemePreference = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

type ThemeState = {
  theme: ThemePreference
  resolvedTheme: ResolvedTheme
  setTheme: (next: ThemePreference) => void
  setResolvedTheme: (next: ResolvedTheme) => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      resolvedTheme: "light",
      setTheme: (next) => set({ theme: next }),
      setResolvedTheme: (next) => set({ resolvedTheme: next }),
    }),
    {
      name: "yugo-theme",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ theme: state.theme }),
    },
  ),
)

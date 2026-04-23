"use client"

import { useEffect, useMemo } from "react"
import { useThemeStore, type ResolvedTheme, type ThemePreference } from "./theme-store"

const MEDIA_QUERY = "(prefers-color-scheme: dark)"

const resolvePreference = (preference: ThemePreference): ResolvedTheme => {
  if (preference === "system") {
    if (typeof window === "undefined") return "light"
    return window.matchMedia(MEDIA_QUERY).matches ? "dark" : "light"
  }
  return preference
}

type ThemeProviderProps = {
  children: React.ReactNode
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const theme = useThemeStore((s) => s.theme)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const setResolvedTheme = useThemeStore((s) => s.setResolvedTheme)

  useEffect(() => {
    const resolved = resolvePreference(theme)
    if (resolved !== resolvedTheme) setResolvedTheme(resolved)
  }, [theme, resolvedTheme, setResolvedTheme])

  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return
    const mql = window.matchMedia(MEDIA_QUERY)
    const handleChange = (event: MediaQueryListEvent) => {
      setResolvedTheme(event.matches ? "dark" : "light")
    }
    mql.addEventListener("change", handleChange)
    return () => mql.removeEventListener("change", handleChange)
  }, [theme, setResolvedTheme])

  const themeAttributes = useMemo(
    () => ({
      "data-yugo-admin": "",
      "data-theme": resolvedTheme,
      className: "min-h-dvh",
    }),
    [resolvedTheme],
  )

  return <div {...themeAttributes}>{children}</div>
}

export const useTheme = () => {
  const theme = useThemeStore((s) => s.theme)
  const resolvedTheme = useThemeStore((s) => s.resolvedTheme)
  const setTheme = useThemeStore((s) => s.setTheme)
  return { theme, resolvedTheme, setTheme }
}

"use client"

import { useLayoutEffect, useState } from "react"

/**
 * True when the document is in Yugo admin dark mode (`html.dark` or `data-theme="dark"`).
 * Avoids `next-themes` so this matches applyDocumentDarkTheme in admin.
 */
export const useDocumentDark = () => {
  const [isDark, setIsDark] = useState(false)
  useLayoutEffect(() => {
    const el = document.documentElement
    const read = () => {
      setIsDark(
        el.classList.contains("dark") || el.getAttribute("data-theme") === "dark"
      )
    }
    read()
    const mo = new MutationObserver(read)
    mo.observe(el, { attributes: true, attributeFilter: ["class", "data-theme"] })
    return () => {
      mo.disconnect()
    }
  }, [])
  return isDark
}

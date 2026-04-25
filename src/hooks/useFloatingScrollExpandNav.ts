"use client"

import * as React from "react"

const DEFAULT_COLLAPSE_MS = 3000

type Params = {
  mainElementId: string
  pathname: string
  collapseAfterMs?: number
}

/**
 * Compact floating nav that expands on scroll and auto-collapses after idle.
 * Used by admin and crew mobile bottom navigation.
 */
export const useFloatingScrollExpandNav = ({
  mainElementId,
  pathname,
  collapseAfterMs = DEFAULT_COLLAPSE_MS,
}: Params) => {
  const [expanded, setExpanded] = React.useState(false)
  const collapseRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const pathnameString = String(pathname)

  const clearCollapseTimer = React.useCallback(() => {
    if (collapseRef.current) {
      clearTimeout(collapseRef.current)
      collapseRef.current = null
    }
  }, [])

  const scheduleCollapse = React.useCallback(() => {
    clearCollapseTimer()
    collapseRef.current = setTimeout(() => {
      setExpanded(false)
    }, collapseAfterMs)
  }, [clearCollapseTimer, collapseAfterMs])

  const onScrollExpand = React.useCallback(() => {
    setExpanded(true)
    scheduleCollapse()
  }, [scheduleCollapse])

  React.useEffect(() => {
    const onScroll = () => onScrollExpand()
    window.addEventListener("scroll", onScroll, { passive: true })
    const main = document.getElementById(mainElementId)
    main?.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      window.removeEventListener("scroll", onScroll)
      main?.removeEventListener("scroll", onScroll)
    }
  }, [mainElementId, onScrollExpand])

  React.useEffect(
    () => () => {
      clearCollapseTimer()
    },
    [clearCollapseTimer],
  )

  React.useEffect(() => {
    setExpanded(false)
    clearCollapseTimer()
  }, [pathnameString, clearCollapseTimer])

  React.useEffect(() => {
    if (!expanded) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setExpanded(false)
        clearCollapseTimer()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [expanded, clearCollapseTimer])

  const handleCompactTap = React.useCallback(() => {
    if (expanded) {
      setExpanded(false)
      clearCollapseTimer()
    } else {
      setExpanded(true)
      scheduleCollapse()
    }
  }, [expanded, clearCollapseTimer, scheduleCollapse])

  return {
    expanded,
    setExpanded,
    clearCollapseTimer,
    scheduleCollapse,
    onScrollExpand,
    handleCompactTap,
  } as const
}

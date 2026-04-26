"use client"

import { motion } from "framer-motion"
import * as React from "react"

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

export interface PillTab {
  value: string
  label: React.ReactNode
  panel?: React.ReactNode
}

interface PillMorphTabsProps {
  items?: PillTab[]
  defaultValue?: string
  onValueChange?: (value: string) => void
  className?: string
}

/**
 * PillMorphTabs: shadcn Tabs (Radix) for a11y, framer-motion pill indicator, glassy bar.
 * Keyboard and focus: Radix Tabs.
 */
const PillMorphTabs = ({
  items = [
    { value: "overview", label: "Overview", panel: <div>Overview content</div> },
    { value: "features", label: "Features", panel: <div>Feature list</div> },
    { value: "pricing", label: "Pricing", panel: <div>Pricing and plans</div> },
    { value: "faq", label: "FAQ", panel: <div>FAQ content</div> },
  ],
  defaultValue,
  onValueChange,
  className,
}: PillMorphTabsProps) => {
  const first = items[0]?.value ?? "tab-0"
  const [value, setValue] = React.useState<string>(defaultValue ?? first)
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const triggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})

  const [indicator, setIndicator] = React.useState<{
    left: number
    width: number
  } | null>(null)
  const [isExpanding, setIsExpanding] = React.useState(false)

  const measure = React.useCallback(() => {
    const list = listRef.current
    const activeEl = triggerRefs.current[value]
    if (!list || !activeEl) {
      setIndicator(null)
      return
    }
    const listRect = list.getBoundingClientRect()
    const tRect = activeEl.getBoundingClientRect()
    setIndicator({
      left: tRect.left - listRect.left + list.scrollLeft,
      width: tRect.width,
    })
  }, [value])

  React.useEffect(() => {
    measure()
    const ro = new ResizeObserver(measure)
    if (listRef.current) {
      ro.observe(listRef.current)
    }
    Object.values(triggerRefs.current).forEach((el) => {
      if (el) {
        ro.observe(el)
      }
    })
    window.addEventListener("resize", measure)
    return () => {
      ro.disconnect()
      window.removeEventListener("resize", measure)
    }
  }, [measure])

  React.useEffect(() => {
    setIsExpanding(true)
    const id = window.setTimeout(() => {
      setIsExpanding(false)
    }, 300)
    return () => {
      window.clearTimeout(id)
    }
  }, [value])

  React.useEffect(() => {
    if (onValueChange) {
      onValueChange(value)
    }
  }, [value, onValueChange])

  return (
    <div className={cn("w-full", className)}>
      <Tabs value={value} onValueChange={setValue}>
        <div
          className={cn(
            "relative",
            "inline-flex items-center gap-2 rounded-full border border-[var(--yu3-line)] p-1",
            "bg-[var(--yu3-bg-surface-sunken)]/90 backdrop-blur-sm"
          )}
          ref={listRef}
        >
          {indicator ? (
            <motion.div
              animate={{
                left: indicator.left,
                width: indicator.width,
                scaleY: isExpanding ? 1.06 : 1,
                borderRadius: isExpanding ? 24 : 999,
              }}
              className="pointer-events-none absolute top-1 bottom-1 rounded-full"
              initial={false}
              layout
              style={{
                background:
                  "linear-gradient(90deg, color-mix(in srgb, var(--yu3-wine) 20%, var(--yu3-bg-surface)) , color-mix(in srgb, var(--yu3-forest) 12%, var(--yu3-bg-surface)))",
                border: "1px solid color-mix(in srgb, var(--yu3-line) 80%, transparent)",
                boxShadow: "var(--yu3-shadow-sm)",
                left: indicator.left,
                width: indicator.width,
              }}
              transition={{
                type: "spring",
                stiffness: 300,
                damping: 28,
              }}
            />
          ) : null}

          {indicator ? (
            <motion.div
              animate={{ left: indicator.left, width: indicator.width }}
              className="pointer-events-none absolute top-0 bottom-0 rounded-full opacity-30 blur-2xl filter"
              initial={false}
              layout
              style={{
                background:
                  "linear-gradient(90deg, var(--yu3-wine), var(--yu3-forest))",
                left: indicator.left,
                width: indicator.width,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
            />
          ) : null}

          <TabsList
            variant="button"
            shape="pill"
            className="relative z-10 flex gap-1 bg-transparent p-1 shadow-none"
          >
            {items.map((it) => {
              const isActive = it.value === value
              return (
                <TabsTrigger
                  className={cn(
                    "relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                    "bg-transparent data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                    isActive
                      ? "text-[var(--yu3-ink-strong)]"
                      : "text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
                  )}
                  key={it.value}
                  ref={(el: HTMLButtonElement | null) => {
                    triggerRefs.current[it.value] = el
                  }}
                  value={it.value}
                >
                  {it.label}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </div>

        <div className="mt-4">
          {items.map((it) => (
            <TabsContent className="p-2" key={it.value} value={it.value}>
              {it.panel ?? null}
            </TabsContent>
          ))}
        </div>
      </Tabs>
    </div>
  )
}

export default PillMorphTabs

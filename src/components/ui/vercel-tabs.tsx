"use client"

import * as React from "react"
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { cn } from "@/lib/utils"

export interface VercelTab {
  id: string
  label: string
}

export interface VercelTabsProps extends React.HTMLAttributes<HTMLDivElement> {
  tabs: VercelTab[]
  activeTab?: string
  onTabChange?: (tabId: string) => void
}

const getIndexForId = (list: VercelTab[], id: string | undefined) => {
  if (id === undefined) {
    return 0
  }
  const i = list.findIndex((t) => t.id === id)
  return i >= 0 ? i : 0
}

const VercelTabs = React.forwardRef<HTMLDivElement, VercelTabsProps>(
  (
    { className, tabs, activeTab, onTabChange, ...props },
    ref
  ) => {
    const isControlled = activeTab !== undefined
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [activeIndex, setActiveIndex] = useState(() =>
      getIndexForId(tabs, activeTab)
    )
    const [hoverStyle, setHoverStyle] = useState<React.CSSProperties>({})
    const [activeStyle, setActiveStyle] = useState<React.CSSProperties>({
      left: "0px",
      width: "0px",
    })
    const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

    const measureActive = useCallback(
      (index: number) => {
        const el = tabRefs.current[index]
        if (el) {
          const { offsetLeft, offsetWidth } = el
          setActiveStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          })
        }
      },
      []
    )

    useEffect(() => {
      if (isControlled) {
        setActiveIndex(getIndexForId(tabs, activeTab))
      }
    }, [activeTab, isControlled, tabs])

    useEffect(() => {
      if (hoveredIndex !== null) {
        const hoveredElement = tabRefs.current[hoveredIndex]
        if (hoveredElement) {
          const { offsetLeft, offsetWidth } = hoveredElement
          setHoverStyle({
            left: `${offsetLeft}px`,
            width: `${offsetWidth}px`,
          })
        }
      }
    }, [hoveredIndex])

    useLayoutEffect(() => {
      measureActive(activeIndex)
    }, [activeIndex, measureActive, tabs])

    useEffect(() => {
      if (isControlled) {
        return
      }
      setActiveIndex((prev) => {
        if (prev < tabs.length) {
          return prev
        }
        return Math.max(0, tabs.length - 1)
      })
    }, [isControlled, tabs.length])

    const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
      if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault()
        const next = index - 1
        if (!isControlled) {
          setActiveIndex(next)
        }
        onTabChange?.(tabs[next]!.id)
        tabRefs.current[next]?.focus()
      }
      if (e.key === "ArrowRight" && index < tabs.length - 1) {
        e.preventDefault()
        const next = index + 1
        if (!isControlled) {
          setActiveIndex(next)
        }
        onTabChange?.(tabs[next]!.id)
        tabRefs.current[next]?.focus()
      }
    }

    return (
      <div className={cn("relative", className)} ref={ref} {...props}>
        <div
          className="relative"
          onBlur={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget)) {
              setHoveredIndex(null)
            }
          }}
          role="tablist"
        >
          <div
            aria-hidden
            className="absolute flex h-[30px] items-center rounded-sm bg-[color-mix(in_srgb,var(--yu3-ink)_5%,var(--yu3-bg-surface))] transition-all duration-300 ease-out"
            style={{
              ...hoverStyle,
              opacity: hoveredIndex !== null ? 1 : 0,
            }}
          />

          <div
            aria-hidden
            className="absolute bottom-[-6px] h-[2px] bg-[var(--yu3-ink)] transition-all duration-300 ease-out"
            style={activeStyle}
          />

          <div className="relative flex items-center space-x-[6px]">
            {tabs.map((tab, index) => (
              <button
                aria-selected={index === activeIndex}
                className={cn(
                  "h-[30px] cursor-pointer px-3 py-2 transition-colors duration-300",
                  index === activeIndex
                    ? "text-[var(--yu3-ink-strong)]"
                    : "text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
                )}
                id={`vercel-tab-${tab.id}`}
                key={tab.id}
                onClick={() => {
                  if (!isControlled) {
                    setActiveIndex(index)
                  }
                  onTabChange?.(tab.id)
                }}
                onKeyDown={(e) => {
                  handleKeyDown(e, index)
                }}
                onMouseEnter={() => {
                  setHoveredIndex(index)
                }}
                onMouseLeave={() => {
                  setHoveredIndex(null)
                }}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                role="tab"
                tabIndex={index === activeIndex ? 0 : -1}
                type="button"
              >
                <div className="text-sm font-medium h-full flex items-center justify-center leading-5 whitespace-nowrap">
                  {tab.label}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    )
  }
)
VercelTabs.displayName = "VercelTabs"

export type { VercelTab as Tab }

export { VercelTabs as Tabs }

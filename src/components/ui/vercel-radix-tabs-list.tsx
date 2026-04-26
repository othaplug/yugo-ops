"use client"

import * as TabsPrimitive from "@radix-ui/react-tabs"
import * as React from "react"
import {
  Children,
  cloneElement,
  isValidElement,
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
} from "react"

import { cn } from "@/lib/utils"

/** Shared trigger styling for Radix tabs using the Vercel-style chrome (see vercel-tabs.tsx). */
export const vercelRadixTabTriggerClassName = cn(
  "relative z-[1] inline-flex h-[30px] shrink-0 cursor-pointer items-center justify-center gap-1.5",
  "border-0 bg-transparent px-3 py-0 shadow-none outline-none",
  "text-sm font-medium leading-5 whitespace-nowrap",
  "text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]",
  "data-[state=active]:text-[var(--yu3-ink-strong)]",
  "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
)

const measureTabVsList = (list: HTMLElement, tab: HTMLElement) => {
  const lr = list.getBoundingClientRect()
  const tr = tab.getBoundingClientRect()
  return {
    left: `${tr.left - lr.left + list.scrollLeft}px`,
    width: `${tr.width}px`,
  }
}

type VercelRadixTabsListProps = React.ComponentPropsWithoutRef<
  typeof TabsPrimitive.List
>

export const VercelRadixTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  VercelRadixTabsListProps
>(({ className, children, ...props }, ref) => {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const [hoverStyle, setHoverStyle] = useState<React.CSSProperties>({})
  const [activeStyle, setActiveStyle] = useState<React.CSSProperties>({
    left: "0px",
    width: "0px",
  })

  const mergedRef = (node: HTMLDivElement | null) => {
    innerRef.current = node
    if (typeof ref === "function") {
      ref(node)
    } else if (ref) {
      ;(ref as React.MutableRefObject<HTMLDivElement | null>).current = node
    }
  }

  const measureActive = useCallback(() => {
    const list = innerRef.current
    if (!list) {
      return
    }
    const active = list.querySelector(
      '[role="tab"][data-state="active"]'
    ) as HTMLElement | null
    if (active) {
      setActiveStyle(measureTabVsList(list, active))
    }
  }, [])

  const measureHover = useCallback(() => {
    const list = innerRef.current
    if (!list || hoveredIndex === null) {
      setHoverStyle({})
      return
    }
    const tabs = [...list.querySelectorAll('[role="tab"]')]
    const el = tabs[hoveredIndex] as HTMLElement | undefined
    if (el) {
      setHoverStyle(measureTabVsList(list, el))
    }
  }, [hoveredIndex])

  useLayoutEffect(() => {
    measureActive()
  }, [measureActive, children])

  useLayoutEffect(() => {
    measureHover()
  }, [measureHover, hoveredIndex])

  useLayoutEffect(() => {
    const list = innerRef.current
    if (!list) {
      return
    }
    const obs = new MutationObserver(() => {
      measureActive()
    })
    obs.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ["data-state"],
    })
    const ro = new ResizeObserver(() => {
      measureActive()
      measureHover()
    })
    ro.observe(list)
    return () => {
      obs.disconnect()
      ro.disconnect()
    }
  }, [measureActive, measureHover])

  useLayoutEffect(() => {
    const list = innerRef.current
    if (!list) {
      return
    }
    const onScroll = () => {
      measureActive()
      measureHover()
    }
    list.addEventListener("scroll", onScroll, { passive: true })
    return () => {
      list.removeEventListener("scroll", onScroll)
    }
  }, [measureActive, measureHover])

  const enhancedChildren = Children.map(children, (child, index) => {
    if (!isValidElement(child)) {
      return child
    }
    type WithPointer = {
      onPointerEnter?: (e: React.PointerEvent<HTMLElement>) => void
      onPointerLeave?: (e: React.PointerEvent<HTMLElement>) => void
    }
    const c = child as React.ReactElement<WithPointer>
    return cloneElement(c, {
      onPointerEnter: (e: React.PointerEvent<HTMLElement>) => {
        setHoveredIndex(index)
        c.props.onPointerEnter?.(e)
      },
      onPointerLeave: (e: React.PointerEvent<HTMLElement>) => {
        setHoveredIndex(null)
        c.props.onPointerLeave?.(e)
      },
    })
  })

  return (
    <TabsPrimitive.List
      ref={mergedRef}
      className={cn(
        "relative flex min-h-[30px] w-full min-w-0 flex-wrap items-center gap-[6px] pb-2",
        className
      )}
      {...props}
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-0 top-0 z-0 flex h-[30px] items-center rounded-sm",
          "bg-[color-mix(in_srgb,var(--yu3-ink)_5%,var(--yu3-bg-surface))]",
          "transition-all duration-300 ease-out"
        )}
        style={{
          ...hoverStyle,
          opacity: hoveredIndex !== null ? 1 : 0,
        }}
      />
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute bottom-0 left-0 z-0 h-0.5 bg-(--yu3-ink)",
          "transition-all duration-300 ease-out"
        )}
        style={activeStyle}
      />
      {enhancedChildren}
    </TabsPrimitive.List>
  )
})
VercelRadixTabsList.displayName = "VercelRadixTabsList"

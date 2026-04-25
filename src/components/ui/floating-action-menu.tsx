"use client"

import * as React from "react"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { X } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type FloatingActionMenuOption = {
  label: string
  onClick?: () => void
  href?: string
  Icon?: React.ReactNode
  disabled?: boolean
  title?: string
  active?: boolean
  form?: string
}

export type FloatingActionMenuProps = {
  options: FloatingActionMenuOption[]
  className?: string
  triggerIcon: React.ReactNode
  triggerLabelClosed?: string
  triggerLabelOpen?: string
  align?: "left" | "right"
  zIndexClass?: string
}

/** White circular FAB: native button avoids shadcn size/ghost merging hiding or shrinking the control. */
const triggerButtonClass = cn(
  "inline-flex items-center justify-center",
  "h-14 w-14 min-h-14 min-w-14 shrink-0 cursor-pointer touch-manipulation rounded-full border-0 bg-white p-0 shadow-[0_2px_14px_rgba(0,0,0,0.08)]",
  "transition-[transform,box-shadow] active:scale-[0.97] active:shadow-[0_1px_8px_rgba(0,0,0,0.06)]",
  "hover:bg-white hover:shadow-[0_4px_18px_rgba(0,0,0,0.1)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/25 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
)

const optionButtonClass = cn(
  "flex h-9 items-center gap-2 rounded-xl border px-3 text-sm font-medium shadow-[var(--yu3-shadow-md)] backdrop-blur-sm transition-colors",
  "border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]/95 text-[var(--yu3-ink-strong)]",
  "hover:bg-[var(--yu3-bg-surface-sunken)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]",
  "disabled:pointer-events-none disabled:opacity-45",
)

export function FloatingActionMenu({
  options,
  className,
  triggerIcon,
  triggerLabelClosed = "Open menu",
  triggerLabelOpen = "Close menu",
  align = "left",
  zIndexClass = "z-[var(--yu3-z-sidebar)]",
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!isOpen) return
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [isOpen])

  React.useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  const handleToggle = () => setIsOpen((v) => !v)

  const close = () => setIsOpen(false)

  const positionClass =
    align === "right"
      ? "right-[max(1rem,env(safe-area-inset-right,0px))]"
      : "left-[max(1rem,env(safe-area-inset-left,0px))]"

  const panelSlideX = align === "right" ? 10 : -10
  const itemSlideX = align === "right" ? 20 : -20

  return (
    <div
      ref={ref}
      className={cn(
        "pointer-events-auto fixed bottom-[max(2rem,env(safe-area-inset-bottom,0px)+0.5rem)]",
        positionClass,
        zIndexClass,
        className,
      )}
      style={{ zIndex: "var(--z-top)" }}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-label={isOpen ? triggerLabelOpen : triggerLabelClosed}
        aria-expanded={isOpen}
        className={triggerButtonClass}
      >
        <AnimatePresence mode="wait" initial={false}>
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ opacity: 0, rotate: -45, scale: 0.85 }}
              animate={{ opacity: 1, rotate: 0, scale: 1 }}
              exit={{ opacity: 0, rotate: 45, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center text-[var(--yu3-wine)]"
            >
              <X size={24} weight="bold" aria-hidden />
            </motion.div>
          ) : (
            <motion.div
              key="trigger"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="flex items-center justify-center text-[var(--yu3-ink-muted)]"
            >
              {triggerIcon}
            </motion.div>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {isOpen ? (
          <motion.div
            initial={{
              opacity: 0,
              x: panelSlideX,
              y: 10,
              filter: "blur(10px)",
            }}
            animate={{ opacity: 1, x: 0, y: 0, filter: "blur(0px)" }}
            exit={{
              opacity: 0,
              x: panelSlideX,
              y: 10,
              filter: "blur(10px)",
            }}
            transition={{
              duration: 0.6,
              type: "spring",
              stiffness: 300,
              damping: 20,
              delay: 0.1,
            }}
            className={cn(
              "absolute bottom-[calc(3.5rem+0.125rem)] mb-0 flex flex-col gap-2",
              align === "right" ? "right-0 items-end" : "left-0 items-start",
            )}
          >
            {options.map((option, index) => {
              const activeRing = option.active
                ? "ring-2 ring-[var(--yu3-wine)]/30 ring-offset-2 ring-offset-[var(--yu3-bg-surface)]"
                : ""

              const inner = (
                <>
                  {option.Icon ? (
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[var(--yu3-wine)] [&_svg]:h-4 [&_svg]:w-4">
                      {option.Icon}
                    </span>
                  ) : null}
                  <span>{option.label}</span>
                </>
              )

              return (
                <motion.div
                  key={`${option.label}-${index}`}
                  initial={{ opacity: 0, x: itemSlideX }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: itemSlideX }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className={align === "left" ? "self-start" : "self-end"}
                >
                  {option.href && !option.disabled ? (
                    <Button
                      asChild
                      variant="ghost"
                      size="sm"
                      className={cn(optionButtonClass, activeRing)}
                    >
                      <Link
                        href={option.href}
                        onClick={close}
                        title={option.title}
                        aria-current={option.active ? "page" : undefined}
                      >
                        {inner}
                      </Link>
                    </Button>
                  ) : option.form ? (
                    <Button
                      type="submit"
                      form={option.form}
                      variant="ghost"
                      size="sm"
                      title={option.title}
                      onClick={close}
                      className={cn(
                        optionButtonClass,
                        activeRing,
                        "text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)]/60",
                      )}
                    >
                      {inner}
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={option.disabled}
                      title={option.title}
                      onClick={() => {
                        if (!option.disabled) {
                          close()
                          option.onClick?.()
                        }
                      }}
                      className={cn(optionButtonClass, activeRing)}
                    >
                      {inner}
                    </Button>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default FloatingActionMenu

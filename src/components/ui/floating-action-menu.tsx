"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import Link from "next/link"
import { motion, AnimatePresence } from "framer-motion"
import { CaretLeft, X } from "@phosphor-icons/react"
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
  /** When true, opens `subMenuOptions` in the same panel animation (no navigation). */
  opensSubMenu?: boolean
}

export type FloatingActionMenuProps = {
  options: FloatingActionMenuOption[]
  /** Second-level items (e.g. full app routes). Shown when an option has `opensSubMenu`. */
  subMenuOptions?: FloatingActionMenuOption[]
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
  "flex h-9 min-w-0 items-center gap-2 rounded-xl border-0 bg-white px-3 text-sm font-medium text-[var(--yu3-ink-strong)] shadow-[0_2px_12px_rgba(0,0,0,0.1)] transition-colors",
  "hover:bg-[var(--yu3-bg-surface-sunken)]",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/30 focus-visible:ring-offset-2 focus-visible:ring-offset-white",
  "disabled:pointer-events-none disabled:bg-white disabled:text-[var(--yu3-ink-faint)]",
)

type MenuPanel = "main" | "sub"

export function FloatingActionMenu({
  options,
  subMenuOptions,
  className,
  triggerIcon,
  triggerLabelClosed = "Open menu",
  triggerLabelOpen = "Close menu",
  align = "left",
  zIndexClass = "z-[var(--yu3-z-sidebar)]",
}: FloatingActionMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [panel, setPanel] = React.useState<MenuPanel>("main")
  const [mounted, setMounted] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setMounted(true)
  }, [])

  React.useEffect(() => {
    if (!isOpen) setPanel("main")
  }, [isOpen])

  const hasSub = Boolean(subMenuOptions && subMenuOptions.length > 0)
  const backOption = React.useMemo((): FloatingActionMenuOption => {
    return {
      label: "Back",
      onClick: () => setPanel("main"),
      Icon: <CaretLeft size={16} weight="bold" aria-hidden />,
    }
  }, [])

  const currentOptions = React.useMemo((): FloatingActionMenuOption[] => {
    if (panel === "sub" && hasSub) {
      return [backOption, ...subMenuOptions!]
    }
    return options
  }, [panel, hasSub, backOption, options, subMenuOptions])

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

  const close = () => {
    setIsOpen(false)
    setPanel("main")
  }

  const positionClass =
    align === "right"
      ? "right-[max(1rem,env(safe-area-inset-right,0px))]"
      : "left-[max(1rem,env(safe-area-inset-left,0px))]"

  const panelSlideX = align === "right" ? 10 : -10
  const itemSlideX = align === "right" ? 20 : -20

  return (
    <>
      {mounted &&
        isOpen &&
        createPortal(
          <div
            role="presentation"
            className="fixed inset-0 z-[var(--yu3-z-modal-scrim,45)] bg-black/40 backdrop-blur-sm touch-manipulation"
            onClick={close}
            aria-hidden
          />,
          document.body,
        )}
      <div
        ref={ref}
        className={cn(
          "pointer-events-auto fixed bottom-[max(2rem,env(safe-area-inset-bottom,0px)+0.5rem)]",
          positionClass,
          zIndexClass,
          className,
        )}
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

      <AnimatePresence mode="wait">
        {isOpen ? (
          <motion.div
            key={panel}
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
              "absolute bottom-[calc(3.5rem+0.125rem)] mb-0 flex max-h-[min(52dvh,420px)] flex-col gap-2 overflow-y-auto overflow-x-hidden pr-0.5",
              align === "right" ? "right-0 items-end" : "left-0 items-start",
            )}
          >
            {currentOptions.map((option, index) => {
              const activeRing = option.active
                ? "ring-2 ring-[var(--yu3-wine)]/35 ring-offset-2 ring-offset-white"
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

              if (
                option.opensSubMenu &&
                hasSub &&
                panel === "main"
              ) {
                return (
                  <motion.div
                    key="opens-sub"
                    initial={{ opacity: 0, x: itemSlideX }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: itemSlideX }}
                    transition={{ duration: 0.3, delay: index * 0.05 }}
                    className={align === "left" ? "self-start" : "self-end"}
                  >
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      title={option.title}
                      onClick={() => setPanel("sub")}
                      className={cn(optionButtonClass, activeRing)}
                    >
                      {inner}
                    </Button>
                  </motion.div>
                )
              }

              return (
                <motion.div
                  key={`${option.label}-${index}-${option.href ?? ""}`}
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
                        "text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)]",
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
                        if (option.disabled) return
                        if (option.label === "Back") {
                          option.onClick?.()
                          return
                        }
                        close()
                        option.onClick?.()
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
    </>
  )
}

export default FloatingActionMenu

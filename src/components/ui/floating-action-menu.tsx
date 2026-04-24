"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Plus } from "@phosphor-icons/react"
import { cn } from "@/design-system/admin/lib/cn"

type FloatingActionOption = {
  label: string
  description?: string
  onClick: () => void
}

type FloatingActionMenuProps = {
  options: FloatingActionOption[]
  className?: string
}

const FloatingActionMenu = ({ options, className }: FloatingActionMenuProps) => {
  const [isOpen, setIsOpen] = React.useState(false)
  const ref = React.useRef<HTMLDivElement>(null)

  // Close on outside click
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

  // Close on Escape
  React.useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false)
    }
    document.addEventListener("keydown", handleKey)
    return () => document.removeEventListener("keydown", handleKey)
  }, [isOpen])

  return (
    <div ref={ref} className={cn("fixed bottom-8 right-8 z-[var(--yu3-z-modal)]", className)}>
      {/* Floating trigger */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
        aria-expanded={isOpen}
        className={cn(
          "w-12 h-12 rounded-full",
          "bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)]",
          "shadow-[0_4px_24px_rgba(92,26,51,0.35)]",
          "hover:bg-[var(--yu3-wine-hover)]",
          "active:scale-95",
          "transition-[background-color,transform] duration-150 ease-out",
          "flex items-center justify-center",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]",
        )}
      >
        <motion.div
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 22, duration: 0.25 }}
        >
          <Plus size={20} weight="bold" />
        </motion.div>
      </button>

      {/* Action items */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 340, damping: 24, duration: 0.2 }}
            className="absolute bottom-14 right-0 mb-2"
          >
            <div
              className={cn(
                "flex flex-col items-end gap-1.5",
                "rounded-[var(--yu3-r-lg)]",
              )}
            >
              {options.map((option, index) => (
                <motion.div
                  key={option.label}
                  initial={{ opacity: 0, x: 16, y: 4 }}
                  animate={{ opacity: 1, x: 0, y: 0 }}
                  exit={{ opacity: 0, x: 16, y: 4 }}
                  transition={{
                    type: "spring",
                    stiffness: 340,
                    damping: 24,
                    delay: index * 0.04,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false)
                      option.onClick()
                    }}
                    className={cn(
                      "flex items-center gap-3 h-10 pl-3 pr-4",
                      "rounded-[var(--yu3-r-md)]",
                      "bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)]",
                      "shadow-[0_2px_12px_rgba(0,0,0,0.12)]",
                      "text-left whitespace-nowrap",
                      "hover:bg-[var(--yu3-bg-surface-sunken)] hover:border-[var(--yu3-line-strong)]",
                      "active:scale-[0.98]",
                      "transition-[background-color,border-color,transform] duration-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]",
        )}
      >
                    <span
                      className={cn(
                        "flex items-center justify-center w-5 h-5 rounded-full shrink-0",
                        "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)]",
                      )}
                    >
                      <Plus size={10} weight="bold" />
                    </span>
                    <span className="flex flex-col min-w-0">
                      <span className="text-[13px] font-semibold text-[var(--yu3-ink-strong)] leading-tight">
                        {option.label}
                      </span>
                      {option.description ? (
                        <span className="text-[11px] text-[var(--yu3-ink-faint)] leading-tight">
                          {option.description}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default FloatingActionMenu

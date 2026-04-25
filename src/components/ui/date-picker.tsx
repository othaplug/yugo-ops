"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { AnimatePresence, motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const getStartOfWeek = (date: Date): Date => {
  const newDate = new Date(date)
  const day = newDate.getDay()
  const diff = newDate.getDate() - day
  return new Date(newDate.setDate(diff))
}

const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  )
}

interface WeeklyDatePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  date: Date
  setDate: (date: Date) => void
}

export const WeeklyDatePicker = React.forwardRef<HTMLDivElement, WeeklyDatePickerProps>(
  ({ className, date, setDate, ...props }, ref) => {
    const [displayDate, setDisplayDate] = useState(getStartOfWeek(date))
    const [direction, setDirection] = useState<"next" | "prev">("next")

    const weekDays = useMemo(() => {
      const start = getStartOfWeek(displayDate)
      return Array.from({ length: 7 }, (_, i) => {
        const day = new Date(start)
        day.setDate(start.getDate() + i)
        return day
      })
    }, [displayDate])

    const handlePrevWeek = () => {
      setDirection("prev")
      setDisplayDate((prev) => {
        const newDate = new Date(prev)
        newDate.setDate(prev.getDate() - 7)
        return newDate
      })
    }

    const handleNextWeek = () => {
      setDirection("next")
      setDisplayDate((prev) => {
        const newDate = new Date(prev)
        newDate.setDate(prev.getDate() + 7)
        return newDate
      })
    }

    const animationVariants = {
      initial: (dir: "next" | "prev") => ({
        opacity: 0,
        x: dir === "next" ? 20 : -20,
      }),
      animate: {
        opacity: 1,
        x: 0,
        transition: { duration: 0.3, ease: "easeInOut" as const },
      },
      exit: (dir: "next" | "prev") => ({
        opacity: 0,
        x: dir === "next" ? -20 : 20,
        transition: { duration: 0.3, ease: "easeInOut" as const },
      }),
    } as const

    return (
      <div
        ref={ref}
        className={cn(
          "w-full max-w-sm rounded-xl border bg-card p-4 text-card-foreground shadow-sm",
          className,
        )}
        {...props}
      >
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <p className="text-lg font-semibold">
            {displayDate.toLocaleString("default", { month: "long", year: "numeric" })}
          </p>
          <div className="flex items-center space-x-1">
            <Button variant="ghost" size="icon" onClick={handlePrevWeek} aria-label="Previous week">
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="ghost" size="icon" onClick={handleNextWeek} aria-label="Next week">
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Animated week days */}
        <div className="relative h-[76px] overflow-hidden">
          <AnimatePresence initial={false} custom={direction}>
            <motion.div
              key={displayDate.toISOString()}
              className="absolute grid w-full grid-cols-7 gap-2"
              custom={direction}
              variants={animationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              {/* Day initials */}
              {weekDays.map((day) => (
                <div
                  key={`initial-${day.toISOString()}`}
                  className="text-center text-sm text-muted-foreground"
                >
                  {day.toLocaleString("default", { weekday: "narrow" })}
                </div>
              ))}

              {/* Date buttons */}
              {weekDays.map((day) => {
                const isSelected = isSameDay(day, date)
                return (
                  <button
                    key={`day-${day.toISOString()}`}
                    onClick={() => setDate(day)}
                    className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-full text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                      "hover:bg-accent hover:text-accent-foreground",
                      isSelected && "bg-primary text-primary-foreground hover:bg-primary/90",
                    )}
                    aria-pressed={isSelected}
                  >
                    {String(day.getDate()).padStart(2, "0")}
                  </button>
                )
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    )
  },
)

WeeklyDatePicker.displayName = "WeeklyDatePicker"

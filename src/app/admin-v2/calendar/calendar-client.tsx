"use client"

import * as React from "react"
import Link from "next/link"
import { PageHeader } from "@/components/admin-v2/composites/PageHeader"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@/components/admin-v2/primitives/ToggleGroup"
import { MoveDrawer } from "@/components/admin-v2/modules/move-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { MOVE_STATUS_LABEL, TIER_LABEL } from "@/lib/admin-v2/labels"
import { formatTimeOfDay } from "@/lib/admin-v2/format"
import type { Move } from "@/lib/admin-v2/mock/types"
import { cn } from "@/components/admin-v2/lib/cn"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"

type CalendarView = "month" | "week" | "day"

const tierTone: Record<Move["tier"], string> = {
  essential: "border-l-fg-subtle bg-surface-subtle text-fg",
  signature: "border-l-info bg-info-bg text-info",
  estate: "border-l-accent bg-accent-subtle text-accent",
}

const startOfWeek = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7 // Monday-first
  d.setDate(d.getDate() - diff)
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (date: Date, days: number) => {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

const isSameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate()

const monthRange = (anchor: Date) => {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1)
  const start = startOfWeek(first)
  const days: Date[] = []
  for (let i = 0; i < 42; i += 1) {
    days.push(addDays(start, i))
  }
  return days
}

const weekRange = (anchor: Date) => {
  const start = startOfWeek(anchor)
  return Array.from({ length: 7 }).map((_, index) => addDays(start, index))
}

export type CalendarClientProps = {
  moves: Move[]
}

export const CalendarClient = ({ moves }: CalendarClientProps) => {
  const drawer = useDrawer("move")
  const activeMove = React.useMemo(
    () => moves.find((m) => m.id === drawer.id) ?? null,
    [moves, drawer.id],
  )

  const [anchor, setAnchor] = React.useState(() => {
    const first = moves[0]
    return first ? new Date(first.scheduledAt) : new Date()
  })
  const [view, setView] = React.useState<CalendarView>("week")

  const movesByDay = React.useMemo(() => {
    const map = new Map<string, Move[]>()
    for (const move of moves) {
      const key = new Date(move.scheduledAt).toDateString()
      map.set(key, [...(map.get(key) ?? []), move])
    }
    return map
  }, [moves])

  const shiftAnchor = (direction: -1 | 1) => {
    setAnchor((prev) => {
      if (view === "day") return addDays(prev, direction)
      if (view === "week") return addDays(prev, direction * 7)
      const next = new Date(prev)
      next.setMonth(next.getMonth() + direction)
      return next
    })
  }

  const headerLabel = React.useMemo(() => {
    if (view === "day") {
      return anchor.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    }
    if (view === "week") {
      const start = startOfWeek(anchor)
      const end = addDays(start, 6)
      return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
    }
    return anchor.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    })
  }, [anchor, view])

  const renderMovePill = (move: Move) => (
    <button
      key={move.id}
      type="button"
      onClick={() => drawer.open(move.id)}
      className={cn(
        "w-full rounded-sm border-l-2 px-2 py-1 text-left body-xs transition-opacity hover:opacity-80",
        tierTone[move.tier],
      )}
    >
      <span className="block truncate label-sm">{move.number}</span>
      <span className="block truncate body-xs text-fg-subtle">
        {formatTimeOfDay(move.scheduledAt)} · {TIER_LABEL[move.tier]}
      </span>
    </button>
  )

  const renderMonth = () => {
    const days = monthRange(anchor)
    return (
      <div className="grid grid-cols-7 overflow-hidden rounded-lg border border-line bg-surface">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <div
            key={d}
            className="border-b border-line bg-surface-subtle px-3 py-2 label-sm text-fg-subtle"
          >
            {d}
          </div>
        ))}
        {days.map((day, index) => {
          const inMonth = day.getMonth() === anchor.getMonth()
          const dayMoves = movesByDay.get(day.toDateString()) ?? []
          const today = isSameDay(day, new Date())
          return (
            <div
              key={index}
              className={cn(
                "min-h-[120px] space-y-1 border-l border-t border-line p-2",
                index % 7 === 0 && "border-l-0",
                !inMonth && "bg-surface-subtle",
              )}
            >
              <div className="flex items-center justify-between">
                <span
                  className={cn(
                    "label-sm tabular-nums",
                    today ? "text-accent" : inMonth ? "text-fg" : "text-fg-subtle",
                  )}
                >
                  {day.getDate()}
                </span>
                {dayMoves.length > 3 ? (
                  <span className="body-xs text-fg-subtle">
                    +{dayMoves.length - 3}
                  </span>
                ) : null}
              </div>
              <div className="space-y-1">
                {dayMoves.slice(0, 3).map(renderMovePill)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const renderWeek = () => {
    const days = weekRange(anchor)
    const hours = Array.from({ length: 12 }).map((_, i) => i + 7) // 07:00 → 18:00
    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-b border-line bg-surface-subtle">
          <div />
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="border-l border-line px-3 py-2 text-center"
            >
              <p className="label-sm text-fg-subtle">
                {day.toLocaleDateString("en-US", { weekday: "short" })}
              </p>
              <p
                className={cn(
                  "tabular-nums label-md",
                  isSameDay(day, new Date()) ? "text-accent" : "text-fg",
                )}
              >
                {day.getDate()}
              </p>
            </div>
          ))}
        </div>
        <div className="max-h-[520px] overflow-y-auto">
          {hours.map((hour) => (
            <div
              key={hour}
              className="grid grid-cols-[72px_repeat(7,minmax(0,1fr))] border-t border-line"
            >
              <div className="border-r border-line px-2 py-2 body-xs text-fg-subtle tabular-nums">
                {hour.toString().padStart(2, "0")}:00
              </div>
              {days.map((day) => {
                const dayMoves = (movesByDay.get(day.toDateString()) ?? []).filter(
                  (m) => new Date(m.scheduledAt).getHours() === hour,
                )
                return (
                  <div
                    key={day.toISOString() + hour}
                    className="min-h-[48px] border-l border-line p-1 space-y-1"
                  >
                    {dayMoves.map(renderMovePill)}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    )
  }

  const renderDay = () => {
    const dayMoves = (movesByDay.get(anchor.toDateString()) ?? []).sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    )
    const hours = Array.from({ length: 14 }).map((_, i) => i + 6) // 06 → 19

    return (
      <div className="overflow-hidden rounded-lg border border-line bg-surface">
        {hours.map((hour) => {
          const inSlot = dayMoves.filter(
            (m) => new Date(m.scheduledAt).getHours() === hour,
          )
          return (
            <div
              key={hour}
              className="grid grid-cols-[72px_1fr] border-t border-line"
            >
              <div className="border-r border-line px-3 py-3 body-xs text-fg-subtle tabular-nums">
                {hour.toString().padStart(2, "0")}:00
              </div>
              <div className="min-h-[64px] p-2 space-y-1">
                {inSlot.length === 0 ? (
                  <span className="body-xs text-fg-subtle">–</span>
                ) : (
                  inSlot.map(renderMovePill)
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Calendar"
        actions={
          <Button size="sm" variant="secondary" asChild>
            <Link href={`${ADMIN_V2_BASE}/moves/new`}>
              <Icon name="plus" size="sm" weight="bold" aria-hidden />
              New move
            </Link>
          </Button>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftAnchor(-1)}
            aria-label="Previous"
          >
            <Icon name="caretLeft" size="sm" weight="bold" />
          </Button>
          <span className="label-md text-fg tabular-nums min-w-[220px] text-center">
            {headerLabel}
          </span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => shiftAnchor(1)}
            aria-label="Next"
          >
            <Icon name="caretRight" size="sm" weight="bold" />
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setAnchor(new Date())}
          >
            Today
          </Button>
        </div>

        <ToggleGroup
          type="single"
          value={view}
          onValueChange={(v) => {
            if (v) setView(v as CalendarView)
          }}
        >
          <ToggleGroupItem value="month">Month</ToggleGroupItem>
          <ToggleGroupItem value="week">Week</ToggleGroupItem>
          <ToggleGroupItem value="day">Day</ToggleGroupItem>
        </ToggleGroup>
      </div>

      {view === "month" ? renderMonth() : null}
      {view === "week" ? renderWeek() : null}
      {view === "day" ? renderDay() : null}

      <MoveDrawer
        move={activeMove}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}

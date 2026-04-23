"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "@/components/admin-v2/primitives/Button"
import { Chip } from "@/components/admin-v2/primitives/Chip"
import { Icon } from "@/components/admin-v2/primitives/Icon"
import { AvatarStack } from "@/components/admin-v2/primitives/AvatarStack"
import { MoveDrawer } from "@/components/admin-v2/modules/move-drawer"
import { useDrawer } from "@/components/admin-v2/layout/useDrawer"
import { MOVE_STATUS_LABEL } from "@/lib/admin-v2/labels"
import {
  formatShortDate,
  formatTimeOfDay,
} from "@/lib/admin-v2/format"
import { getMockUniverse } from "@/lib/admin-v2/mock"
import { cn } from "@/components/admin-v2/lib/cn"

// Dispatch view mirrors the PRD §4.1 dispatch screen: active moves list on
// the left, live map center, selected move detail right. The map is
// deferred to the Mapbox integration phase; for now we render a canvas
// placeholder that keeps the exact layout so nothing shifts when Mapbox
// plugs in.
export const DispatchClient = () => {
  const universe = React.useMemo(() => getMockUniverse(), [])
  const active = React.useMemo(
    () =>
      universe.moves.filter((m) =>
        m.status === "in-transit" || m.status === "pre-move",
      ),
    [universe.moves],
  )
  const [selectedId, setSelectedId] = React.useState<string | null>(
    active[0]?.id ?? null,
  )
  const selected = React.useMemo(
    () => active.find((m) => m.id === selectedId) ?? null,
    [active, selectedId],
  )
  const drawer = useDrawer("dispatch-move")

  return (
    <div className="flex h-[calc(100vh-104px)] min-h-[520px] gap-4 overflow-hidden">
      <aside className="flex w-80 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <div>
            <p className="label-sm text-fg-subtle">Active</p>
            <p className="display-xs text-fg tabular-nums">{active.length}</p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => toast.info("Refreshing crew positions")}
            leadingIcon={<Icon name="arrowRight" size="sm" weight="bold" />}
          >
            Refresh
          </Button>
        </header>
        <ul className="flex-1 overflow-y-auto divide-y divide-line">
          {active.length === 0 ? (
            <li className="px-4 py-8 text-center body-sm text-fg-subtle">
              No active moves right now.
            </li>
          ) : (
            active.map((move) => {
              const isActive = move.id === selectedId
              return (
                <li key={move.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(move.id)}
                    className={cn(
                      "flex w-full flex-col gap-2 px-4 py-3 text-left transition-colors",
                      isActive
                        ? "bg-accent-subtle"
                        : "bg-surface hover:bg-surface-subtle",
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="label-md text-fg">{move.number}</span>
                      <Chip
                        label={MOVE_STATUS_LABEL[move.status]}
                        variant={
                          move.status === "in-transit" ? "info" : "warning"
                        }
                      />
                    </div>
                    <p className="body-sm text-fg truncate">
                      {move.customerName}
                    </p>
                    <p className="body-xs text-fg-subtle truncate">
                      {move.origin} → {move.destination}
                    </p>
                    <div className="flex items-center justify-between">
                      <AvatarStack
                        items={move.crew.map((c) => ({ name: c.name }))}
                        max={3}
                        size="sm"
                      />
                      <span className="body-xs text-fg-subtle tabular-nums">
                        {formatTimeOfDay(move.scheduledAt)}
                      </span>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </aside>

      <section className="relative flex-1 overflow-hidden rounded-lg border border-line bg-surface-sunken">
        <div
          aria-hidden
          className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,var(--surface-subtle)_0%,transparent_50%),radial-gradient(circle_at_70%_60%,var(--surface-subtle)_0%,transparent_45%)]"
        />
        <div
          aria-hidden
          className="absolute inset-0 [background-image:linear-gradient(var(--line)_1px,transparent_1px),linear-gradient(90deg,var(--line)_1px,transparent_1px)] [background-size:48px_48px] opacity-40"
        />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <div className="rounded-full border border-line bg-surface px-4 py-2 shadow-sm">
            <p className="label-sm text-fg-subtle">Live map placeholder</p>
          </div>
          {selected ? (
            <p className="mt-3 body-sm text-fg">
              {selected.origin} → {selected.destination}
            </p>
          ) : null}
        </div>
        <div className="absolute bottom-4 right-4 flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => toast.info("Recenter map")}
          >
            Recenter
          </Button>
          {selected ? (
            <Button
              variant="primary"
              size="sm"
              onClick={() => drawer.open(selected.id)}
            >
              Open move
            </Button>
          ) : null}
        </div>
      </section>

      <aside className="flex w-80 flex-col overflow-hidden rounded-lg border border-line bg-surface">
        {selected ? (
          <>
            <header className="border-b border-line px-4 py-3">
              <p className="label-sm text-fg-subtle">Selected</p>
              <p className="heading-sm text-fg mt-1">{selected.number}</p>
              <p className="body-sm text-fg mt-0.5">{selected.customerName}</p>
            </header>
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              <div className="space-y-1.5">
                <p className="label-sm text-fg-subtle">Origin</p>
                <p className="body-sm text-fg">{selected.origin}</p>
              </div>
              <div className="space-y-1.5">
                <p className="label-sm text-fg-subtle">Destination</p>
                <p className="body-sm text-fg">{selected.destination}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-md border border-line bg-surface-subtle p-3">
                  <p className="label-sm text-fg-subtle">Scheduled</p>
                  <p className="mt-1 body-sm text-fg tabular-nums">
                    {formatShortDate(selected.scheduledAt)} ·{" "}
                    {formatTimeOfDay(selected.scheduledAt)}
                  </p>
                </div>
                <div className="rounded-md border border-line bg-surface-subtle p-3">
                  <p className="label-sm text-fg-subtle">Truck</p>
                  <p className="mt-1 body-sm text-fg">
                    {selected.truck ?? "Unassigned"}
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="label-sm text-fg-subtle">Crew</p>
                <AvatarStack
                  items={selected.crew.map((c) => ({ name: c.name }))}
                  max={5}
                  size="md"
                />
              </div>
            </div>
            <footer className="border-t border-line px-4 py-3 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => toast.info("Messaged crew")}
              >
                Message
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => drawer.open(selected.id)}
              >
                Open move
              </Button>
            </footer>
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 py-8 text-center">
            <p className="body-sm text-fg-subtle">
              Select a move from the left to see details.
            </p>
          </div>
        )}
      </aside>

      <MoveDrawer
        move={universe.moves.find((m) => m.id === drawer.id) ?? null}
        open={drawer.isOpen}
        onOpenChange={drawer.setOpen}
      />
    </div>
  )
}

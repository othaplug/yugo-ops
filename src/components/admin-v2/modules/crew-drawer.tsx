"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip } from "../primitives/Chip"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import type { CrewMember, Move } from "@/lib/admin-v2/mock/types"
import {
  CREW_AVAILABILITY_LABEL,
  CREW_ROLE_LABEL,
  MOVE_STATUS_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatCurrency,
  formatPercent,
  formatShortDate,
} from "@/lib/admin-v2/format"
import { variantForStatus } from "../primitives/Chip"

type CrewDrawerProps = {
  crew: CrewMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
  moves?: Move[]
  onAvailabilityChange?: (crewId: string, availability: CrewMember["availability"]) => void
}

async function patchCrewActive(crewId: string, is_active: boolean): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/crew-members/${crewId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ is_active }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

const availabilityVariant = (state: CrewMember["availability"]) =>
  state === "available" ? "success" : state === "on-move" ? "info" : "neutral"

export const CrewDrawer = ({ crew, open, onOpenChange, moves = [], onAvailabilityChange }: CrewDrawerProps) => {
  const [loading, setLoading] = React.useState<string | null>(null)
  if (!crew) return null

  const crewMoves = moves
    .filter((m) => m.crew.some((c) => c.id === crew.id))
    .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime())
    .slice(0, 15)

  const profile = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Role", value: CREW_ROLE_LABEL[crew.role] },
          {
            label: "Availability",
            value: (
              <Chip
                label={CREW_AVAILABILITY_LABEL[crew.availability]}
                variant={availabilityVariant(crew.availability)}
              />
            ),
          },
          { label: "Rating", value: `${crew.rating.toFixed(1)} / 5` },
          { label: "Moves completed", value: crew.movesCompleted.toString() },
          {
            label: "Damage rate",
            value: formatPercent(crew.damageRate, 2),
          },
          {
            label: "Next assignment",
            value: crew.nextAssignmentAt
              ? formatShortDate(crew.nextAssignmentAt)
              : "Unscheduled",
          },
        ]}
      />

      <DrawerSection title="Contact">
        <div className="space-y-2 body-sm text-fg">
          <div className="flex items-center gap-2">
            <Icon name="email" size="sm" className="text-fg-subtle" />
            <span>{crew.email}</span>
          </div>
          <div className="flex items-center gap-2">
            <Icon name="phone" size="sm" className="text-fg-subtle" />
            <span>{crew.phone}</span>
          </div>
        </div>
      </DrawerSection>
    </div>
  )

  const performance = (
    <div className="grid grid-cols-3 gap-3">
      {[
        { label: "Rating", value: `${crew.rating.toFixed(1)}` },
        { label: "Moves", value: crew.movesCompleted.toString() },
        { label: "Damage", value: `${crew.damageRate.toFixed(2)}%` },
      ].map((stat) => (
        <div
          key={stat.label}
          className="rounded-md border border-line bg-surface-subtle px-3 py-4"
        >
          <p className="label-sm text-fg-subtle">{stat.label}</p>
          <p className="mt-2 display-sm text-fg tabular-nums">{stat.value}</p>
        </div>
      ))}
    </div>
  )

  const availability = (
    <div className="overflow-hidden rounded-md border border-line">
      <div className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] divide-x divide-line text-center">
        <span />
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="label-sm text-fg-subtle py-2">
            {d}
          </span>
        ))}
      </div>
      {[
        "08:00",
        "10:00",
        "12:00",
        "14:00",
        "16:00",
        "18:00",
      ].map((slot) => (
        <div
          key={slot}
          className="grid grid-cols-[80px_repeat(7,minmax(0,1fr))] divide-x divide-line border-t border-line text-center"
        >
          <span className="label-sm text-fg-subtle py-3">{slot}</span>
          {Array.from({ length: 7 }).map((_, index) => {
            const busy = (slot.charCodeAt(1) + index) % 3 === 0
            return (
              <span
                key={index}
                className={
                  busy
                    ? "bg-accent/80 py-3 body-xs text-white"
                    : "bg-surface py-3 body-xs text-fg-subtle"
                }
              >
                {busy ? "Booked" : "Open"}
              </span>
            )
          })}
        </div>
      ))}
    </div>
  )

  const movesTab = crewMoves.length ? (
    <div className="overflow-hidden rounded-md border border-line">
      <table className="w-full body-sm">
        <thead className="bg-surface-subtle">
          <tr>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Move</th>
            <th className="px-3 py-2 text-left label-sm text-fg-subtle">Status</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Value</th>
            <th className="px-3 py-2 text-right label-sm text-fg-subtle">Date</th>
          </tr>
        </thead>
        <tbody>
          {crewMoves.map((move) => (
            <tr key={move.id} className="border-t border-line hover:bg-surface-subtle transition-colors">
              <td className="px-3 py-2">
                <Link
                  href={`${ADMIN_V2_BASE}/moves?drawer=move:${move.id}`}
                  className="text-fg font-medium hover:underline"
                  onClick={() => onOpenChange(false)}
                >
                  {move.number}
                </Link>
              </td>
              <td className="px-3 py-2">
                <Chip
                  label={MOVE_STATUS_LABEL[move.status]}
                  variant={variantForStatus(move.status)}
                />
              </td>
              <td className="px-3 py-2 text-right text-fg tabular-nums">
                {formatCurrency(move.total)}
              </td>
              <td className="px-3 py-2 text-right text-fg-subtle">
                {formatShortDate(move.scheduledAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <div className="flex h-full min-h-[160px] flex-col items-center justify-center rounded-md border border-dashed border-line bg-surface-subtle text-center">
      <p className="body-sm font-medium text-fg">No moves on record</p>
      <p className="mt-1 body-xs text-fg-subtle">Moves assigned to this crew member will appear here.</p>
    </div>
  )

  const isOffDuty = crew.availability === "off-duty"

  const footer = (
    <div className="flex w-full items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={loading !== null}
        onClick={async () => {
          const newActive = isOffDuty
          setLoading("duty")
          const result = await patchCrewActive(crew.id, newActive)
          setLoading(null)
          if (result.ok) {
            const newAvailability = newActive ? "available" : "off-duty"
            toast.success(newActive ? `${crew.name} set active` : `${crew.name} set off duty`)
            onAvailabilityChange?.(crew.id, newAvailability)
          } else {
            toast.error(result.error ?? "Failed to update crew")
          }
        }}
      >
        {loading === "duty" ? "Saving…" : isOffDuty ? "Set active" : "Set off duty"}
      </Button>
      <Button
        variant="primary"
        size="sm"
        onClick={() => toast.success(`${crew.name} assigned`)}
      >
        Assign to move
      </Button>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={crew.name}
      subtitle={`${CREW_ROLE_LABEL[crew.role]} · ${crew.email}`}
      status={{
        label: CREW_AVAILABILITY_LABEL[crew.availability],
        variant: availabilityVariant(crew.availability),
      }}
      tabs={[
        { id: "profile", label: "Profile", content: profile },
        { id: "performance", label: "Performance", content: performance },
        { id: "availability", label: "Availability", content: availability },
        { id: "moves", label: `Moves (${crewMoves.length})`, content: movesTab },
      ]}
      footer={footer}
    />
  )
}

"use client"

import * as React from "react"
import { toast } from "sonner"
import { Button } from "../primitives/Button"
import { Icon } from "../primitives/Icon"
import { Chip } from "../primitives/Chip"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import type { CrewMember } from "@/lib/admin-v2/mock/types"
import {
  CREW_AVAILABILITY_LABEL,
  CREW_ROLE_LABEL,
} from "@/lib/admin-v2/labels"
import {
  formatPercent,
  formatShortDate,
} from "@/lib/admin-v2/format"

type CrewDrawerProps = {
  crew: CrewMember | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const availabilityVariant = (state: CrewMember["availability"]) =>
  state === "available" ? "success" : state === "on-move" ? "info" : "neutral"

export const CrewDrawer = ({ crew, open, onOpenChange }: CrewDrawerProps) => {
  if (!crew) return null

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

  const footer = (
    <div className="flex w-full items-center justify-end gap-2">
      <Button
        variant="secondary"
        size="sm"
        onClick={() => toast.info(`${crew.name} set off duty`)}
      >
        Set off duty
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
      ]}
      footer={footer}
    />
  )
}

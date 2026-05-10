"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ADMIN_V2_BASE } from "@/components/admin-v2/config/nav"
import { Button } from "../primitives/Button"
import {
  DrawerSection,
  DrawerStatGrid,
  ModuleDrawer,
} from "./module-drawer"
import { cn } from "../lib/cn"
import type { Building } from "@/lib/admin-v2/mock/types"
import { BUILDING_CONFIG_LABEL } from "@/lib/admin-v2/labels"
import { formatShortDate } from "@/lib/admin-v2/format"

type BuildingDrawerProps = {
  building: Building | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onComplexityChange?: (id: string, complexity: number) => void
}

async function patchBuildingComplexity(buildingId: string, complexityRating: number): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`/api/admin/buildings/${buildingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ complexity_rating: complexityRating }),
    })
    const data = await res.json()
    if (!res.ok) return { ok: false, error: data.error ?? "Failed" }
    return { ok: true }
  } catch {
    return { ok: false, error: "Network error" }
  }
}

const complexityTone = (complexity: number) => {
  if (complexity >= 4) return "danger"
  if (complexity === 3) return "warning"
  return "neutral"
}

export const BuildingDrawer = ({
  building,
  open,
  onOpenChange,
  onComplexityChange,
}: BuildingDrawerProps) => {
  const [localComplexity, setLocalComplexity] = React.useState<number>(building?.complexity ?? 1)
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (building) setLocalComplexity(building.complexity)
  }, [building?.id])

  if (!building) return null

  const complexityDirty = localComplexity !== building.complexity

  const overview = (
    <div className="flex flex-col gap-6">
      <DrawerStatGrid
        items={[
          { label: "Address", value: building.address },
          {
            label: "PM account",
            value: building.pmAccountName ?? "Independent",
          },
          {
            label: "Elevator config",
            value: BUILDING_CONFIG_LABEL[building.elevatorConfig],
          },
          {
            label: "Complexity",
            value: (
              <span className="inline-flex items-center gap-1.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <button
                    key={index}
                    type="button"
                    aria-label={`Set complexity ${index + 1}`}
                    onClick={() => setLocalComplexity(index + 1)}
                    className={cn(
                      "h-1.5 w-3 rounded-full transition-colors hover:opacity-80",
                      index < localComplexity
                        ? "bg-accent"
                        : "bg-line-strong",
                    )}
                  />
                ))}
                <span className="body-sm text-fg tabular-nums">
                  {localComplexity}/5{complexityDirty ? " *" : ""}
                </span>
              </span>
            ),
          },
          {
            label: "Moves completed",
            value: building.movesCompleted.toString(),
          },
          {
            label: "Last move",
            value: building.lastMoveAt
              ? formatShortDate(building.lastMoveAt)
              : "–",
          },
        ]}
      />

      {localComplexity >= 3 ? (
        <div className="rounded-md border border-warning-bg bg-warning-bg/40 px-3 py-2">
          <p className="label-md text-warning">Complexity surcharge active</p>
          <p className="mt-1 body-sm text-fg">
            Moves at this building pick up a {(localComplexity - 2) * 8}%
            building intelligence surcharge on labour.
          </p>
        </div>
      ) : null}
    </div>
  )

  const crewNotes = (
    <DrawerSection title="Crew notes">
      <ol className="space-y-3">
        {[
          {
            id: "1",
            note: "Service elevator off Parker Street. Loading dock opens 7–11.",
            author: "Crew lead · J. Ramirez",
          },
          {
            id: "2",
            note: "Hallways tight on 4–6, plan for piece-by-piece staging.",
            author: "Crew lead · A. Patel",
          },
        ].map((entry) => (
          <li
            key={entry.id}
            className="rounded-md border border-line bg-surface-subtle px-3 py-3"
          >
            <p className="body-sm text-fg">{entry.note}</p>
            <p className="body-xs text-fg-subtle mt-1">{entry.author}</p>
          </li>
        ))}
      </ol>
    </DrawerSection>
  )

  const footer = (
    <div className="flex w-full items-center justify-end gap-2">
      {complexityDirty && (
        <Button
          variant="secondary"
          size="sm"
          disabled={saving}
          onClick={async () => {
            setSaving(true)
            const result = await patchBuildingComplexity(building.id, localComplexity)
            setSaving(false)
            if (result.ok) {
              toast.success(`Complexity updated to ${localComplexity}/5`)
              onComplexityChange?.(building.id, localComplexity)
            } else {
              toast.error(result.error ?? "Failed to update complexity")
            }
          }}
        >
          {saving ? "Saving…" : "Save surcharge"}
        </Button>
      )}
      <Button variant="primary" size="sm" asChild>
        <Link href={`${ADMIN_V2_BASE}/moves/new`}>New move</Link>
      </Button>
    </div>
  )

  return (
    <ModuleDrawer
      open={open}
      onOpenChange={onOpenChange}
      title={building.name}
      subtitle={building.address}
      status={{
        label: `Complexity ${localComplexity}`,
        variant: complexityTone(localComplexity),
      }}
      tabs={[
        { id: "overview", label: "Profile", content: overview },
        { id: "notes", label: "Crew notes", content: crewNotes },
      ]}
      footer={footer}
    />
  )
}

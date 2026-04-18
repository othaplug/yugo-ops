import type { MoveProjectPhaseInput, MoveProjectPayload } from "./schema"

function addDaysIso(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + deltaDays)
  return d.toISOString().slice(0, 10)
}

function estimatePackHours(moveSize: string | undefined): number {
  const hours: Record<string, number> = {
    studio: 2,
    "1br": 3,
    "2br": 5,
    "3br": 7,
    "4br": 10,
    "5br_plus": 14,
    partial: 2,
  }
  const k = (moveSize ?? "2br").trim()
  return hours[k] ?? 4
}

function estimateCrewForMoveSize(moveSize: string | undefined): number {
  const m = (moveSize ?? "2br").trim()
  if (m === "5br_plus" || m === "4br") return 5
  if (m === "3br") return 4
  return 3
}

function recommendTruck(moveSize: string | undefined): string {
  const m = (moveSize ?? "2br").trim()
  if (m === "5br_plus" || m === "4br") return "26ft"
  if (m === "3br") return "20ft"
  if (m === "2br") return "16ft"
  return "16ft"
}

/**
 * Builds default pack / move / unpack phases for residential multi-stop projects.
 * Coordinator can edit the result in the planner.
 */
export function autoGenerateResidentialProjectPhases(args: {
  payload: MoveProjectPayload
  primaryMoveSize: string
  /** Sum of inventory line scores per origin (for buffer day heuristic) */
  inventoryScoresByOrigin?: number[]
}): MoveProjectPhaseInput[] {
  const { payload, primaryMoveSize } = args
  const moveDate = payload.start_date?.trim() || new Date().toISOString().slice(0, 10)
  const origins = payload.origins.length > 0 ? payload.origins : [{ address: "" }]
  const destinations = payload.destinations.length > 0 ? payload.destinations : [{ address: "" }]
  const tier = payload.project_type.startsWith("office") ? "office" : "residential"
  const isEstateLike =
    payload.project_type === "residential_estate" ||
    payload.project_type === "residential_large" ||
    payload.project_type === "residential_multi_home"

  const dest0 = destinations[0]?.address?.trim() || ""

  const phases: MoveProjectPhaseInput[] = []

  const packTier =
    tier === "office"
      ? false
      : payload.project_type.includes("estate") ||
        payload.project_type.includes("signature") ||
        isEstateLike

  if (packTier) {
    const packPhase: MoveProjectPhaseInput = {
      phase_number: 1,
      phase_name: "Packing",
      phase_type: "pack",
      days: [],
    }

    origins.forEach((origin, idx) => {
      const label = origin.label?.trim() || `Origin ${idx + 1}`
      const ms = origin.move_size?.trim() || primaryMoveSize
      const partial = origin.is_partial === true
      if (partial) {
        packPhase.days.push({
          day_number: 1,
          date: addDaysIso(moveDate, -(origins.length - idx)),
          day_type: "pack",
          label: `Pack ${label} (partial)`,
          crew_size: 2,
          truck_count: 1,
          truck_type: "sprinter",
          estimated_hours: 3,
          origin_address: origin.address || undefined,
          destination_address: null,
        })
        return
      }

      const packHours = estimatePackHours(ms)
      const packDays = Math.max(1, Math.ceil(packHours / 7))
      for (let d = 0; d < packDays; d++) {
        const hrs = Math.min(7, Math.max(0, packHours - d * 7))
        packPhase.days.push({
          day_number: 1,
          date: addDaysIso(
            moveDate,
            -(packDays - d + (origins.length > 1 ? 1 : 0) + (origins.length - 1 - idx)),
          ),
          day_type: "pack",
          label:
            packDays > 1
              ? `Pack ${label} (day ${d + 1} of ${packDays})`
              : `Pack ${label}`,
          crew_size: packDays > 1 ? 3 : 2,
          truck_count: 1,
          truck_type: "sprinter",
          estimated_hours: hrs || 7,
          origin_address: origin.address || undefined,
          destination_address: null,
        })
      }
    })

    if (packPhase.days.length > 0) {
      phases.push(packPhase)
    }
  }

  const movePhase: MoveProjectPhaseInput = {
    phase_number: phases.length + 1,
    phase_name: "Move",
    phase_type: "move",
    days: [],
  }

  if (origins.length > 1) {
    movePhase.days.push({
      day_number: 1,
      date: moveDate,
      day_type: "move",
      label: `Load all pickups, transport to destination`,
      crew_size: Math.min(8, Math.max(3, origins.length * 2)),
      truck_count: 1,
      truck_type: "26ft",
      estimated_hours: 8,
      origin_address: origins[0]?.address || undefined,
      destination_address: dest0 || destinations[0]?.address || undefined,
    })
  } else {
    const ms0 = origins[0]?.move_size?.trim() || primaryMoveSize
    movePhase.days.push({
      day_number: 1,
      date: moveDate,
      day_type: "move",
      label: "Load, transport, unload",
      crew_size: estimateCrewForMoveSize(ms0),
      truck_count: 1,
      truck_type: recommendTruck(ms0),
      estimated_hours: 8,
      origin_address: origins[0]?.address || undefined,
      destination_address: dest0 || undefined,
    })
  }

  phases.push(movePhase)

  if (payload.project_type === "residential_estate" && tier !== "office") {
    phases.push({
      phase_number: phases.length + 1,
      phase_name: "Unpack and setup",
      phase_type: "unpack",
      days: [
        {
          day_number: 1,
          date: addDaysIso(moveDate, 1),
          day_type: "unpack",
          label: "Unpack, placement, setup, debris removal",
          crew_size: 3,
          truck_count: 1,
          truck_type: "sprinter",
          estimated_hours: 6,
          origin_address: null,
          destination_address: dest0 || undefined,
        },
      ],
    })
  }

  const scoreSum = (args.inventoryScoresByOrigin ?? []).reduce((a, b) => a + b, 0)
  if (scoreSum > 100) {
    phases.push({
      phase_number: phases.length + 1,
      phase_name: "Buffer day",
      phase_type: "custom",
      days: [
        {
          day_number: 1,
          date: addDaysIso(moveDate, 2),
          day_type: "custom",
          label: "Buffer day for remaining items, touch-ups, adjustments",
          crew_size: 2,
          truck_count: 1,
          truck_type: "sprinter",
          estimated_hours: 4,
          origin_address: null,
          destination_address: dest0 || undefined,
        },
      ],
    })
  }

  const numbered = phases.map((ph, pi) => ({ ...ph, phase_number: pi + 1 }))
  let dn = 0
  for (const ph of numbered) {
    ph.days = ph.days.map((d) => {
      dn += 1
      return { ...d, day_number: dn }
    })
  }
  return numbered
}

import { PHOTO_ROOM_DEFS, type RoomDef } from "./rooms"

const ROOM_BY_ID: Record<string, RoomDef> = Object.fromEntries(
  PHOTO_ROOM_DEFS.map((r) => [r.id, r]),
)

/** Bedroom photo slots, front-loaded for move size (primary first). */
export const BEDROOM_PHOTO_ROOM_IDS = ["bedroom_1", "bedroom_2", "bedroom_3"] as const

/**
 * How many bedroom blocks to show for the move.
 * Ties to admin lead `move_size` (studio, 1br, 2br, 3br, …).
 * Unknown or empty defaults to 2 bedrooms to match a typical request.
 */
export const bedroomCountForMoveSize = (moveSize: string | null | undefined): number => {
  const m = (moveSize || "").toLowerCase().trim()
  if (m === "studio" || m === "partial" || m === "1br") return 1
  if (m === "2br") return 2
  if (m === "3br" || m === "4br" || m === "4br_plus" || m === "5br_plus") return 3
  return 2
}

/**
 * Core rooms for this move: living, N bedroom(s) by size, then kitchen.
 */
export const getCorePhotoRoomIds = (moveSize: string | null | undefined): string[] => {
  const n = bedroomCountForMoveSize(moveSize)
  const beds = BEDROOM_PHOTO_ROOM_IDS.slice(0, n)
  return ["living_room", ...beds, "kitchen"]
}

/**
 * Extras the client can add one at a time: remaining bedroom slots, then other areas.
 */
export const getAdditionalPhotoRoomPool = (moveSize: string | null | undefined): string[] => {
  const n = bedroomCountForMoveSize(moveSize)
  const extraBeds = BEDROOM_PHOTO_ROOM_IDS.slice(n)
  const other = ["dining", "office", "storage", "garage", "outdoor", "other"] as const
  return [...extraBeds, ...other]
}

export const roomDefsForIds = (ids: string[]): RoomDef[] => {
  const out: RoomDef[] = []
  for (const id of ids) {
    const r = ROOM_BY_ID[id]
    if (r) out.push(r)
  }
  return out
}

export type RoomDef = {
  id: string
  label: string
  required: boolean
  tip: string
}

export const PHOTO_ROOM_DEFS: RoomDef[] = [
  {
    id: "living_room",
    label: "Living room",
    required: true,
    tip: "Capture sofas, TV, shelves, and any large items.",
  },
  {
    id: "bedroom_1",
    label: "Primary bedroom",
    required: true,
    tip: "Show the bed, dressers, and closet contents.",
  },
  {
    id: "bedroom_2",
    label: "Second bedroom",
    required: false,
    tip: "Show the bed, dressers, and closet contents.",
  },
  {
    id: "bedroom_3",
    label: "Third bedroom",
    required: false,
    tip: "Show the bed, dressers, and closet contents.",
  },
  {
    id: "kitchen",
    label: "Kitchen",
    required: true,
    tip: "Focus on appliances and any items on counters or shelves.",
  },
  {
    id: "dining",
    label: "Dining area",
    required: false,
    tip: "Table, chairs, and any side pieces.",
  },
  {
    id: "office",
    label: "Home office",
    required: false,
    tip: "Show desk, chair, monitors, and bookshelves.",
  },
  {
    id: "storage",
    label: "Storage and closets",
    required: false,
    tip: "Open closets and storage areas so we can see contents.",
  },
  {
    id: "garage",
    label: "Garage or basement",
    required: false,
    tip: "Show any large items, tools, or equipment.",
  },
  {
    id: "outdoor",
    label: "Balcony or patio",
    required: false,
    tip: "Outdoor storage and larger pieces.",
  },
  {
    id: "other",
    label: "Other areas",
    required: false,
    tip: "Any area not listed above.",
  },
]

export const PHOTO_ROOM_LABELS: Record<string, string> = Object.fromEntries(
  PHOTO_ROOM_DEFS.map((r) => [r.id, r.label]),
);

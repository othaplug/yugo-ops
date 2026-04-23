import type { ColumnConfig } from "@/components/admin-v2/datatable"

export type LeadStatus =
  | "new"
  | "pre-sale"
  | "closing"
  | "closed"
  | "lost"
export type LeadSource =
  | "ORGANIC"
  | "SUMMER2"
  | "DTJ25"
  | "SB2024"
  | "AFF20"
  | "REFERRAL"
export type LeadProbability = "low" | "mid" | "high"

export type Lead = {
  id: string
  name: string
  email: string
  source: LeadSource
  sourceExternal: boolean
  status: LeadStatus
  size: number
  interest: number[]
  probability: LeadProbability
  lastAction: string // ISO
}

const FIRST = [
  "Andy", "Emily", "Michael", "David", "Lily", "Christopher", "Isabella",
  "Sophia", "John", "Olivia", "Daniel", "Ava", "Matthew", "Charlotte",
  "Joshua", "Mia", "Andrew", "Harper", "Ryan", "Evelyn", "Benjamin",
  "Abigail", "Samuel", "Emily", "Jacob",
]

const LAST = [
  "Shepard", "Thompson", "Carter", "Anderson", "Hernandez", "Wilson",
  "Lopez", "Morgan", "Davis", "Parker", "Brooks", "Bennett", "Reed",
  "Cooper", "Foster", "Ward", "Rivera", "Gray", "Watson", "Price",
]

const SOURCES: { label: LeadSource; external: boolean }[] = [
  { label: "ORGANIC", external: false },
  { label: "SUMMER2", external: true },
  { label: "DTJ25", external: true },
  { label: "SB2024", external: true },
  { label: "AFF20", external: true },
  { label: "REFERRAL", external: false },
]

const STATUSES: LeadStatus[] = [
  "new",
  "pre-sale",
  "closing",
  "closed",
  "lost",
]

const PROB: LeadProbability[] = ["low", "mid", "high"]

const rand = (seed: number) => {
  let s = seed
  return () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
}

const pick = <T,>(arr: T[], r: () => number) =>
  arr[Math.floor(r() * arr.length)]!

export const generateLeads = (count = 500, seed = 42): Lead[] => {
  const r = rand(seed)
  const now = Date.now()
  const DAY = 24 * 60 * 60 * 1000
  return Array.from({ length: count }, (_, index) => {
    const first = pick(FIRST, r)
    const last = pick(LAST, r)
    const source = pick(SOURCES, r)
    const status = pick(STATUSES, r)
    const probability = pick(PROB, r)
    const size = Math.floor(r() * 2_500_000) + 15_000
    const lastAction = new Date(now - r() * 90 * DAY).toISOString()
    const start = Math.floor(r() * 80) + 20
    const interest: number[] = Array.from({ length: 7 }, () => {
      const swing = (r() - 0.5) * 30
      return Math.max(5, Math.min(100, start + swing * r() * 3))
    })
    return {
      id: `lead-${index + 1}`,
      name: `${first} ${last}`,
      email: `${first.toLowerCase()}.${last.toLowerCase()}${index}@gmail.com`,
      source: source.label,
      sourceExternal: source.external,
      status,
      size,
      interest,
      probability,
      lastAction,
    }
  })
}

// Column config is built inline inside the page to keep imports clean
// and avoid circular dependencies.
export type LeadColumn = ColumnConfig<Lead>

import { getAdminUniverse } from "@/lib/admin-v2/data/server"
import { AnalyticsClient } from "./analytics-client"
import type { AnalyticsClientProps } from "./analytics-client"

export const dynamic = "force-dynamic"
export const revalidate = 0

const monthLabel = (date: Date) =>
  date.toLocaleString("en-US", { month: "short", year: "2-digit" })

const weekLabel = (date: Date) => {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day + 6) % 7 // snap to Monday
  d.setDate(d.getDate() - diff)
  return `${d.toLocaleString("en-US", { month: "short" })} ${d.getDate()}`
}

const AnalyticsPage = async () => {
  const { moves, leads, quotes } = await getAdminUniverse()

  // ── 12-month revenue + job buckets ─────────────────────────────────────
  const now = new Date()
  const monthBuckets = new Map<string, { revenue: number; jobs: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    monthBuckets.set(monthLabel(d), { revenue: 0, jobs: 0 })
  }

  for (const move of moves) {
    if (move.status !== "completed") continue
    const key = monthLabel(new Date(move.scheduledAt))
    const bucket = monthBuckets.get(key)
    if (!bucket) continue
    bucket.revenue += move.total
    bucket.jobs += 1
  }

  const monthPoints = Array.from(monthBuckets.entries()).map(([label, b]) => ({
    label,
    revenue: Math.round(b.revenue),
    jobs: b.jobs,
    avgValue: b.jobs > 0 ? Math.round(b.revenue / b.jobs) : 0,
  }))

  // ── 12-week lead + quote buckets ───────────────────────────────────────
  const weekBuckets = new Map<string, { leads: number; quotes: number; accepted: number }>()
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setDate(d.getDate() - i * 7)
    weekBuckets.set(weekLabel(d), { leads: 0, quotes: 0, accepted: 0 })
  }

  for (const lead of leads) {
    const key = weekLabel(new Date(lead.lastAction))
    const bucket = weekBuckets.get(key)
    if (!bucket) continue
    bucket.leads += 1
  }
  for (const q of quotes) {
    const key = weekLabel(new Date(q.createdAt))
    const bucket = weekBuckets.get(key)
    if (!bucket) continue
    bucket.quotes += 1
    if (q.status === "accepted") bucket.accepted += 1
  }

  const weekPoints = Array.from(weekBuckets.entries()).map(([label, b]) => ({
    label,
    leads: b.leads,
    quotes: b.quotes,
    accepted: b.accepted,
  }))

  // ── Summary stats ──────────────────────────────────────────────────────
  const thisMonthKey = monthLabel(now)
  const lastMonthKey = monthLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1))
  const threeMonthsKey = monthLabel(new Date(now.getFullYear(), now.getMonth() - 3, 1))
  const sixMonthsKey = monthLabel(new Date(now.getFullYear(), now.getMonth() - 6, 1))

  const thisMonthRevenue = monthBuckets.get(thisMonthKey)?.revenue ?? 0
  const lastMonthRevenue = monthBuckets.get(lastMonthKey)?.revenue ?? 0
  const threeMonthRevenue = monthBuckets.get(threeMonthsKey)?.revenue ?? 0
  const sixMonthRevenue = monthBuckets.get(sixMonthsKey)?.revenue ?? 0

  const completedMoves = moves.filter((m) => m.status === "completed")
  const completedJobs = completedMoves.length
  const totalRevenue = completedMoves.reduce((s, m) => s + m.total, 0)
  const avgJobValue = completedJobs > 0 ? Math.round(totalRevenue / completedJobs) : 0
  const openQuotes = quotes.filter((q) => q.status === "sent" || q.status === "viewed").length
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length
  const conversionRate =
    quotes.length > 0 ? Math.round((acceptedCount / quotes.length) * 100) : 0

  const data: AnalyticsClientProps = {
    monthPoints,
    weekPoints,
    summary: {
      thisMonthRevenue: Math.round(thisMonthRevenue),
      lastMonthRevenue: Math.round(lastMonthRevenue),
      threeMonthRevenue: Math.round(threeMonthRevenue),
      sixMonthRevenue: Math.round(sixMonthRevenue),
      completedJobs,
      avgJobValue,
      openQuotes,
      conversionRate,
    },
  }

  return <AnalyticsClient {...data} />
}

export default AnalyticsPage

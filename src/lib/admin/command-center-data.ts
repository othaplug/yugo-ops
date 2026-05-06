import "server-only"

import { loadRevenueForecastData } from "@/lib/admin/revenue-forecast-data"
import { createAdminClient } from "@/lib/supabase/admin"
import { formatJobId, getMoveCode } from "@/lib/move-code"
import { serviceTypeDisplayLabel } from "@/lib/displayLabels"
import {
  addCalendarDaysYmd,
  getAppTimezone,
  getTodayString,
  utcInstantForCalendarDateInTz,
} from "@/lib/business-timezone"
import { formatCompactCurrency } from "@/lib/format-currency"
import { toTitleCase } from "@/lib/format-text"
import {
  pickLatestTrackingSession,
  resolveAdminMoveListDisplayStatus,
} from "@/lib/move-status"
import { isMoveWeatherBrief, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief"
import {
  deliveryPreTaxForAdminList,
  invoicePreTaxForDisplay,
} from "@/lib/delivery-pricing"
import {
  partnerRevenueTotalForMonth,
  deliveryIdsCoveredByAnyInvoice,
  isPartnerChannelInvoice,
  getInvoiceRevenueDate,
  type PartnerRevenueInvoice,
} from "@/lib/partner-revenue"

const DATA_WINDOW_DAYS = 730
const PAID_DLV_FOR_DAY = new Set(["delivered", "completed"])

/** Normalize DB `date` / timestamptz to YYYY-MM-DD for calendar comparisons. */
function scheduleDateYmd(row: { scheduled_date?: unknown }): string {
  const v = row.scheduled_date
  if (v == null || v === "") return ""
  return String(v).trim().slice(0, 10)
}

/** Time label for Command Center job rows (matches detail page when slot is empty but window exists). */
function commandCenterDeliveryTime(d: Record<string, unknown>): string {
  const slot =
    d.time_slot != null && String(d.time_slot).trim() !== ""
      ? String(d.time_slot).trim()
      : ""
  if (slot) return slot
  const win =
    d.delivery_window != null && String(d.delivery_window).trim() !== ""
      ? String(d.delivery_window).trim()
      : ""
  if (win) return win
  const startRaw = d.scheduled_start
  const endRaw = d.scheduled_end
  const fmtT = (t: unknown) => {
    if (t == null || String(t).trim() === "") return ""
    const s = String(t).trim()
    const m = s.match(/^(\d{1,2}):(\d{2})/)
    if (m) {
      let h = parseInt(m[1], 10)
      const min = m[2]
      const ap = h >= 12 ? "PM" : "AM"
      if (h > 12) h -= 12
      if (h === 0) h = 12
      return `${h}:${min} ${ap}`
    }
    return s
  }
  const a = fmtT(startRaw)
  const b = fmtT(endRaw)
  if (a && b && a !== b) return `${a} to ${b}`
  if (a) return a
  if (b) return b
  return "TBD"
}

function mergeRowsById(
  primary: Record<string, unknown>[],
  extra: Record<string, unknown>[],
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>()
  for (const row of primary) {
    const id = String((row as { id?: string }).id ?? "")
    if (id) map.set(id, row)
  }
  for (const row of extra) {
    const id = String((row as { id?: string }).id ?? "")
    if (id && !map.has(id)) map.set(id, row)
  }
  return Array.from(map.values())
}

export type CommandCenterJob = {
  id: string
  type: "delivery" | "move"
  name: string
  subtitle: string
  time: string
  status: string
  date: string
  tag: string
  /** Residential tier when present (Essential / Signature / Estate). */
  tier_selected?: string | null
  delivery_number?: string | null
  move_code?: string | null
  fromAddress?: string | null
  toAddress?: string | null
  weatherAlert?: string | null
  weatherBrief?: MoveWeatherBrief | null
}

export type CommandCenterData = Awaited<ReturnType<typeof loadCommandCenterData>>

type MonthRevenue = { m: string; moves: number; partner: number }

export type RevenueBarPoint = { label: string; moves: number; partner: number }

function partnerRevenueOnLocalDay(
  allInvoices: PartnerRevenueInvoice[],
  paidInvoices: PartnerRevenueInvoice[],
  paidDeliveries: Record<string, unknown>[],
  orgIdToType: Record<string, string>,
  clientTypeMap: Record<string, string>,
  y: number,
  month: number,
  day: number,
): number {
  const covered = deliveryIdsCoveredByAnyInvoice(
    allInvoices as PartnerRevenueInvoice[],
  )
  const paidPartner = (paidInvoices as PartnerRevenueInvoice[]).filter((i) =>
    isPartnerChannelInvoice(i, orgIdToType, clientTypeMap),
  )
  let inv = 0
  for (const p of paidPartner) {
    const d = getInvoiceRevenueDate(p)
    if (d.getFullYear() === y && d.getMonth() === month && d.getDate() === day) {
      inv += invoicePreTaxForDisplay(p)
    }
  }
  let dlv = 0
  for (const row of paidDeliveries) {
    if (!PAID_DLV_FOR_DAY.has(String((row as { status?: string }).status || "").toLowerCase())) continue
    if (covered.has(String((row as { id: string }).id))) continue
    const ts = String(
      (row as { scheduled_date?: string; created_at?: string }).scheduled_date ||
        (row as { created_at?: string }).created_at ||
        "",
    )
    const dt = ts ? new Date(ts) : new Date(0)
    if (dt.getFullYear() === y && dt.getMonth() === month && dt.getDate() === day) {
      dlv += deliveryPreTaxForAdminList(
        row as Parameters<typeof deliveryPreTaxForAdminList>[0],
      )
    }
  }
  return inv + dlv
}

function moveRevenueOnLocalDay(
  paidMoves: Record<string, unknown>[],
  movRev: (m: Record<string, unknown>) => number,
  getMoveDate: (m: Record<string, unknown>) => Date,
  y: number,
  month: number,
  day: number,
) {
  return paidMoves
    .filter((m) => {
      const d = getMoveDate(m)
      return d.getFullYear() === y && d.getMonth() === month && d.getDate() === day
    })
    .reduce((s, m) => s + movRev(m), 0)
}

/**
 * Data for Command Center (`/admin`).
 * Pulls 730d of moves/deliveries for accurate MRR- and year-style series.
 * All aggregates come from the live Supabase (Ops+) service client when configured.
 */
export const loadCommandCenterData = async () => {
  const admin = createAdminClient()
  const today = getTodayString()
  const cutoff = new Date(Date.now() - DATA_WINDOW_DAYS * 24 * 3600_000)
    .toISOString()
    .slice(0, 10)

  const [
    { data: deliveries },
    { data: moves },
    { data: invoices },
    { data: orgs },
    activityResult,
    { count: openQuoteHeadCount },
    pendingChangesResult,
    { data: crews },
    { data: quotesExpanded },
    { data: reviewRequests },
    leadPulseResult,
    revenueForecastResult,
  ] = await Promise.all([
    admin
      .from("deliveries")
      .select("*")
      .gte("created_at", `${cutoff}T00:00:00.000Z`)
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("moves")
      .select("*")
      .gte("created_at", `${cutoff}T00:00:00.000Z`)
      .order("created_at", { ascending: false })
      .limit(2000),
    admin
      .from("invoices")
      .select(
        "id, client_name, organization_id, delivery_id, move_id, amount, status, created_at, updated_at, invoice_number, paid_at, deliveries!delivery_id(delivery_number, final_price, calculated_price, override_price, admin_adjusted_price, total_price, quoted_price)",
      ),
    admin.from("organizations").select("id, name, type"),
    (async () => {
      try {
        return await admin
          .from("status_events")
          .select(
            "id, entity_type, entity_id, event_type, description, icon, created_at",
          )
          .order("created_at", { ascending: false })
          .limit(12)
      } catch {
        return { data: [] }
      }
    })(),
    admin
      .from("quotes")
      .select("id", { count: "exact", head: true })
      .in("status", ["sent", "viewed"]),
    (async () => {
      try {
        return await admin
          .from("move_change_requests")
          .select(
            "id, type, description, urgency, status, created_at, moves(client_name, move_code)",
          )
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10)
      } catch {
        return { data: [] }
      }
    })(),
    admin.from("crews").select("id, name, is_active").eq("is_active", true),
    admin
      .from("quotes")
      .select(
        "id, quote_id, status, custom_price, tiers, client_name, viewed_at, accepted_at, created_at, expires_at",
      )
      .in("status", ["sent", "viewed", "accepted", "confirmed", "booked", "paid", "expired", "declined", "lost", "cold"])
      .order("created_at", { ascending: false })
      .limit(500),
    (async () => {
      try {
        return await admin
          .from("review_requests")
          .select(
            "id, move_id, client_rating, client_feedback, status, created_at",
          )
          .not("client_rating", "is", null)
          .order("created_at", { ascending: false })
          .limit(30)
      } catch {
        return { data: [] }
      }
    })(),
    (async () => {
      try {
        const now = new Date()
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
          .toISOString()
          .slice(0, 10)
        const attentionStatuses = [
          "new",
          "assigned",
          "follow_up_sent",
          "awaiting_reply",
        ] as const

        const [attentionCountRes, monthCountRes, avgRes, previewRes] =
          await Promise.all([
            admin
              .from("leads")
              .select("id", { count: "exact", head: true })
              .in("status", attentionStatuses)
              .is("quote_uuid", null),
            admin
              .from("leads")
              .select("id", { count: "exact", head: true })
              .gte("created_at", `${monthStart}T00:00:00.000Z`),
            admin
              .from("leads")
              .select("response_time_seconds")
              .gte("created_at", `${monthStart}T00:00:00.000Z`)
              .not("first_response_at", "is", null),
            admin
              .from("leads")
              .select(
                "id, lead_number, first_name, last_name, created_at, completeness_path, status, service_type, follow_up_sent_at",
              )
              .in("status", attentionStatuses)
              .is("quote_uuid", null)
              .order("created_at", { ascending: true })
              .limit(8),
          ])

        if (
          attentionCountRes.error ||
          monthCountRes.error ||
          avgRes.error ||
          previewRes.error
        ) {
          return { data: null }
        }

        const avgRows = avgRes.data ?? []
        const avgSec =
          avgRows.length > 0
            ? avgRows.reduce(
                (s, l) => s + (Number((l as { response_time_seconds?: number }).response_time_seconds) || 0),
                0,
              ) / avgRows.length
            : null

        const previewRows = previewRes.data ?? []

        return {
          data: {
            needsAttention: attentionCountRes.count ?? 0,
            monthReceived: monthCountRes.count ?? 0,
            avgResponseMin: avgSec != null ? Math.round(avgSec / 60) : null,
            attentionPreview: previewRows.map((row) => ({
              id: String((row as { id: string }).id),
              lead_number: String((row as { lead_number?: string }).lead_number ?? ""),
              first_name: (row as { first_name?: string | null }).first_name ?? null,
              last_name: (row as { last_name?: string | null }).last_name ?? null,
              created_at: String((row as { created_at: string }).created_at ?? ""),
              completeness_path: (row as { completeness_path?: string | null }).completeness_path ?? null,
              status: String((row as { status?: string }).status ?? "new"),
              service_type: (row as { service_type?: string | null }).service_type ?? null,
              follow_up_sent_at: (row as { follow_up_sent_at?: string | null }).follow_up_sent_at ?? null,
            })),
          },
        }
      } catch {
        return { data: null }
      }
    })(),
    (async () => {
      try {
        return await loadRevenueForecastData()
      } catch (e) {
        console.error("[command-center] revenue forecast", e)
        return null
      }
    })(),
  ])

  const leadPulse = leadPulseResult.data
  const revenueForecast = revenueForecastResult

  const scheduleHorizon = addCalendarDaysYmd(today, 120)
  const [{ data: movesScheduledExtra }, { data: deliveriesScheduledExtra }] =
    await Promise.all([
      admin
        .from("moves")
        .select("*")
        .gte("scheduled_date", today)
        .lte("scheduled_date", scheduleHorizon)
        .limit(5000),
      admin
        .from("deliveries")
        .select("*")
        .gte("scheduled_date", today)
        .lte("scheduled_date", scheduleHorizon)
        .limit(5000),
    ])

  const allDeliveries = mergeRowsById(
    (deliveries || []) as Record<string, unknown>[],
    (deliveriesScheduledExtra || []) as Record<string, unknown>[],
  )
  const allMoves = mergeRowsById(
    (moves || []) as Record<string, unknown>[],
    (movesScheduledExtra || []) as Record<string, unknown>[],
  )
  const allInvoices = (invoices || []) as Record<string, unknown>[]

  const moveIdList = allMoves
    .map((m) => String((m as { id?: string }).id || ""))
    .filter(Boolean)
  const latestSessionByMoveId: Record<string, { status: string }> = {}
  if (moveIdList.length > 0) {
    type SessionRow = {
      job_id?: string
      status?: string
      created_at?: string
      updated_at?: string
    }
    const byJob = new Map<string, SessionRow[]>()
    try {
      const CHUNK = 500
      for (let i = 0; i < moveIdList.length; i += CHUNK) {
        const { data: sessionRows } = await admin
          .from("tracking_sessions")
          .select("job_id, status, created_at, updated_at")
          .eq("job_type", "move")
          .in("job_id", moveIdList.slice(i, i + CHUNK))
        for (const row of (sessionRows || []) as SessionRow[]) {
          const jid = String(row.job_id || "")
          if (!jid) continue
          const list = byJob.get(jid) || []
          list.push(row)
          byJob.set(jid, list)
        }
      }
      for (const [jid, rows] of byJob) {
        const best = pickLatestTrackingSession(rows)
        if (best) {
          latestSessionByMoveId[jid] = {
            status: String((best as SessionRow).status || ""),
          }
        }
      }
    } catch {
      // tracking_sessions may be missing in some envs; fall back to move row only
    }
  }

  const effectiveMoveListStatus = (m: Record<string, unknown>) =>
    resolveAdminMoveListDisplayStatus(
      String(m.status ?? ""),
      latestSessionByMoveId[String(m.id)]?.status ?? null,
    )
      .toLowerCase()
      .trim()

  const clientTypeMap: Record<string, string> = {}
  const orgIdToType: Record<string, string> = {}
  ;(orgs || []).forEach((o: { id: string; name: string; type?: string | null }) => {
    clientTypeMap[o.name] = o.type || "retail"
    orgIdToType[o.id] = o.type || "retail"
  })
  const activity = activityResult?.data ?? []
  const activeQuotesCount = openQuoteHeadCount ?? 0

  type ActionTask = {
    id: string
    taskType: "delivery_request" | "change_request"
    title: string
    subtitle: string
    createdAt: string
    href: string
  }

  const pendingDeliveries = allDeliveries.filter(
    (d) => d.status === "pending_approval" || d.status === "pending",
  )
  const deliveryTasks: ActionTask[] = pendingDeliveries.map((d) => ({
    id: String(d.id),
    taskType: "delivery_request" as const,
    title: `Delivery request from ${d.client_name || "partner"}`,
    subtitle: [d.customer_name, d.delivery_number]
      .filter(Boolean)
      .map(String)
      .join(" · "),
    createdAt: String(d.created_at || ""),
    href: `/admin/deliveries/${d.delivery_number || d.id}`,
  }))

  const changeTasks: ActionTask[] = (pendingChangesResult?.data || []).map(
    (r: Record<string, unknown>) => {
      const moveRaw = r.moves as unknown
      const move = Array.isArray(moveRaw)
        ? (moveRaw[0] as { client_name?: string; move_code?: string } | undefined) ?? null
        : (moveRaw as { client_name?: string; move_code?: string } | null)
      const typeLabel = toTitleCase(String(r.type || "change"))
      return {
        id: String(r.id),
        taskType: "change_request" as const,
        title: `${typeLabel} Request`,
        subtitle: [move?.client_name, move?.move_code].filter(Boolean).join(" · "),
        createdAt: String(r.created_at || ""),
        href: "/admin/change-requests",
      }
    },
  )

  const actionTasks = [...deliveryTasks, ...changeTasks].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const DONE_DELIVERY = new Set(["delivered", "cancelled", "rejected"])
  /** Terminal job states only. Omit "paid": it is a payment flag; the move can still be on today's board (matches dispatch). */
  const DONE_MOVE = new Set([
    "completed",
    "cancelled",
    "delivered",
    "done",
  ])

  const mapDelivery = (d: Record<string, unknown>): CommandCenterJob => {
    const num = d.delivery_number ? String(d.delivery_number) : ""
    const subtitle = num
      ? formatJobId(num, "delivery")
      : `Delivery ${String(d.id).slice(0, 8)}`
    return {
      id: String(d.id),
      type: "delivery",
      name: String(d.customer_name || d.client_name || "Delivery"),
      subtitle,
      time: commandCenterDeliveryTime(d),
      status: String(d.status || "pending").toLowerCase(),
      date: scheduleDateYmd(d),
      tag: String(d.category || "Delivery"),
      tier_selected: null,
      delivery_number: d.delivery_number ? String(d.delivery_number) : null,
      fromAddress: d.pickup_address != null ? String(d.pickup_address) : null,
      toAddress: d.delivery_address != null ? String(d.delivery_address) : null,
      weatherAlert: null,
      weatherBrief: null,
    }
  }

  const mapMove = (m: Record<string, unknown>): CommandCenterJob => {
    const codeRaw = m.move_code
      ? String(m.move_code).replace(/^#/, "").trim()
      : ""
    const codeSlug =
      codeRaw ||
      getMoveCode(m as { move_code?: string | null; id?: string | null })
    const subtitle = formatJobId(codeSlug, "move")
    const alert =
      m.weather_alert != null && String(m.weather_alert).trim() !== ""
        ? String(m.weather_alert)
        : null
    const wb = m.weather_brief
    const weatherBrief = isMoveWeatherBrief(wb) ? wb : null
    const moveTimeRaw =
      m.scheduled_time ||
      m.time_slot ||
      m.preferred_time ||
      m.arrival_window
    const moveTime =
      moveTimeRaw != null && String(moveTimeRaw).trim() !== ""
        ? String(moveTimeRaw).trim()
        : "TBD"
    return {
      id: String(m.id),
      type: "move",
      name: String(m.client_name || "Move"),
      subtitle,
      time: moveTime,
      status: effectiveMoveListStatus(m) || String(m.status || "confirmed").toLowerCase(),
      date: scheduleDateYmd(m),
      tag: (() => {
        const stRaw =
          m.service_type != null ? String(m.service_type).trim() : ""
        if (!stRaw) return "Move"
        const lbl = serviceTypeDisplayLabel(stRaw)
        return lbl === "—" ? "Move" : lbl
      })(),
      tier_selected:
        m.tier_selected != null && String(m.tier_selected).trim() !== ""
          ? String(m.tier_selected)
          : null,
      move_code: m.move_code ? String(m.move_code) : null,
      fromAddress: m.from_address != null ? String(m.from_address) : null,
      toAddress:
        (m.to_address != null ? String(m.to_address) : null) ??
        (m.delivery_address != null ? String(m.delivery_address) : null),
      weatherAlert: alert,
      weatherBrief,
    }
  }

  const activeDeliveries = allDeliveries.filter(
    (d) => !DONE_DELIVERY.has(String(d.status)),
  )
  const activeMoves = allMoves.filter(
    (m) => !DONE_MOVE.has(effectiveMoveListStatus(m)),
  )

  const todayJobs: CommandCenterJob[] = [
    ...activeDeliveries
      .filter((d) => scheduleDateYmd(d) === today)
      .map(mapDelivery),
    ...activeMoves
      .filter((m) => scheduleDateYmd(m) === today)
      .map(mapMove),
  ].sort((a, b) => {
    const ta = a.time.replace(/[^0-9:]/g, "")
    const tb = b.time.replace(/[^0-9:]/g, "")
    return ta.localeCompare(tb)
  })

  const upcomingJobs: CommandCenterJob[] = [
    ...activeDeliveries
      .filter((d) => {
        const sd = scheduleDateYmd(d)
        return sd > today || !d.scheduled_date
      })
      .map(mapDelivery),
    ...activeMoves
      .filter((m) => {
        const sd = scheduleDateYmd(m)
        return sd > today || !m.scheduled_date
      })
      .map(mapMove),
  ]
    .sort((a, b) => {
      if (!a.date) return 1
      if (!b.date) return -1
      return a.date.localeCompare(b.date)
    })
    .slice(0, 15)

  const overdueInvoices = allInvoices.filter((i) => i.status === "overdue")
  const overdueAmount = overdueInvoices.reduce(
    (s, i) => s + Number(i.amount || 0),
    0,
  )

  const now = new Date()
  const thisYear = now.getFullYear()
  const thisMonth = now.getMonth()

  const movRev = (m: Record<string, unknown>) =>
    Number(m.estimate || m.amount || 0)

  const PAID_MOVE_STATUSES = new Set([
    "completed",
    "delivered",
    "done",
    "paid",
  ])
  const PAID_DLV_STATUSES = new Set(["delivered", "completed"])

  const paidMoves = allMoves.filter(
    (m) =>
      PAID_MOVE_STATUSES.has(effectiveMoveListStatus(m)) ||
      m.payment_marked_paid === true,
  )
  const paidInvoices = allInvoices.filter((i) => i.status === "paid")
  const allDeliveriesForPartner = allDeliveries as Parameters<
    typeof partnerRevenueTotalForMonth
  >[2]

  const deliveryRow = (d: Record<string, unknown>) =>
    d as Parameters<typeof deliveryPreTaxForAdminList>[0] & {
      id: string
      status?: string | null
      scheduled_date?: string | null
      created_at?: string | null
    }

  const getMoveDate = (m: Record<string, unknown>) => {
    const ts = String(
      m.payment_marked_paid_at || m.scheduled_date || m.created_at || "",
    )
    return ts ? new Date(ts) : new Date(0)
  }
  const inMonth = (d: Date, y: number, mo: number) =>
    d.getFullYear() === y && d.getMonth() === mo

  const invRows = allInvoices as PartnerRevenueInvoice[]

  const curMoveRev = paidMoves
    .filter((m) => inMonth(getMoveDate(m), thisYear, thisMonth))
    .reduce((s, m) => s + movRev(m), 0)
  const curPartnerRev = partnerRevenueTotalForMonth(
    invRows,
    paidInvoices as PartnerRevenueInvoice[],
    allDeliveriesForPartner,
    orgIdToType,
    clientTypeMap,
    thisYear,
    thisMonth,
  )

  const currentMonthRevenue = curMoveRev + curPartnerRev

  const pm = thisMonth === 0 ? 11 : thisMonth - 1
  const py = thisMonth === 0 ? thisYear - 1 : thisYear
  const prevMoveRev = paidMoves
    .filter((m) => inMonth(getMoveDate(m), py, pm))
    .reduce((s, m) => s + movRev(m), 0)
  const prevPartnerRev = partnerRevenueTotalForMonth(
    invRows,
    paidInvoices as PartnerRevenueInvoice[],
    allDeliveriesForPartner,
    orgIdToType,
    clientTypeMap,
    py,
    pm,
  )
  const prevMonthRevenue = prevMoveRev + prevPartnerRev

  const revenuePctChange =
    prevMonthRevenue > 0
      ? Math.round(
          ((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100,
        )
      : currentMonthRevenue > 0
        ? 100
        : 0

  const monthLabels = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const monthlyRevenue: MonthRevenue[] = []
  for (let i = 5; i >= 0; i--) {
    const mo = thisMonth - i
    const yr = mo < 0 ? thisYear - 1 : thisYear
    const monthIdx = ((mo % 12) + 12) % 12
    const movSum = paidMoves
      .filter((m) => inMonth(getMoveDate(m), yr, monthIdx))
      .reduce((s, m) => s + movRev(m), 0)
    const partnerSum = partnerRevenueTotalForMonth(
      invRows,
      paidInvoices as PartnerRevenueInvoice[],
      allDeliveriesForPartner,
      orgIdToType,
      clientTypeMap,
      yr,
      monthIdx,
    )
    monthlyRevenue.push({
      m: monthLabels[monthIdx],
      moves: movSum / 1000,
      partner: partnerSum / 1000,
    })
  }

  const moveOnDay = (y: number, mon: number, d: number) =>
    moveRevenueOnLocalDay(paidMoves, movRev, getMoveDate, y, mon, d)
  const partnerOnDay = (y: number, mon: number, d: number) =>
    partnerRevenueOnLocalDay(
      invRows,
      paidInvoices as PartnerRevenueInvoice[],
      allDeliveries as Record<string, unknown>[],
      orgIdToType,
      clientTypeMap,
      y,
      mon,
      d,
    )

  const revenueByDay: RevenueBarPoint[] = []
  for (let i = 29; i >= 0; i--) {
    const t = new Date()
    t.setDate(t.getDate() - i)
    const y = t.getFullYear()
    const mon = t.getMonth()
    const d = t.getDate()
    revenueByDay.push({
      label: `${mon + 1}/${d}`,
      moves: moveOnDay(y, mon, d),
      partner: partnerOnDay(y, mon, d),
    })
  }

  const revenueByWeek: RevenueBarPoint[] = []
  for (let w = 0; w < 8; w++) {
    let mSum = 0
    let pSum = 0
    for (let dd = 0; dd < 7; dd++) {
      const dayOffset = w * 7 + dd
      const t = new Date()
      t.setDate(t.getDate() - dayOffset)
      mSum += moveOnDay(t.getFullYear(), t.getMonth(), t.getDate())
      pSum += partnerOnDay(t.getFullYear(), t.getMonth(), t.getDate())
    }
    const label = w === 0 ? "This week" : `W${w + 1}`
    revenueByWeek.push({ label, moves: mSum, partner: pSum })
  }
  revenueByWeek.reverse()

  const revenueByMonth: RevenueBarPoint[] = []
  for (let i = 11; i >= 0; i--) {
    const t = new Date(thisYear, thisMonth, 1)
    t.setMonth(t.getMonth() - i)
    const yr = t.getFullYear()
    const monthIdx = t.getMonth()
    const mrv = paidMoves
      .filter((m) => inMonth(getMoveDate(m), yr, monthIdx))
      .reduce((s, m) => s + movRev(m), 0)
    const prv = partnerRevenueTotalForMonth(
      invRows,
      paidInvoices as PartnerRevenueInvoice[],
      allDeliveriesForPartner,
      orgIdToType,
      clientTypeMap,
      yr,
      monthIdx,
    )
    const short = monthLabels[monthIdx]
    const showYear = yr !== thisYear || i === 0
    const label = showYear ? `${short} ${String(yr).slice(-2)}` : short
    revenueByMonth.push({ label, moves: mrv, partner: prv })
  }

  const revenueByYear: RevenueBarPoint[] = []
  for (let yOff = 3; yOff >= 0; yOff--) {
    const y = thisYear - yOff
    let mSum = 0
    let pSum = 0
    for (let mon = 0; mon < 12; mon++) {
      mSum += paidMoves
        .filter((m) => inMonth(getMoveDate(m), y, mon))
        .reduce((s, m) => s + movRev(m), 0)
      pSum += partnerRevenueTotalForMonth(
        invRows,
        paidInvoices as PartnerRevenueInvoice[],
        allDeliveriesForPartner,
        orgIdToType,
        clientTypeMap,
        y,
        mon,
      )
    }
    revenueByYear.push({ label: String(y), moves: mSum, partner: pSum })
  }

  const cutoff72h = addCalendarDaysYmd(today, 3)

  type UnassignedJob = {
    id: string
    name: string
    date: string
    type: "move" | "delivery"
    code: string
    href: string
  }
  const unassignedJobs: UnassignedJob[] = []

  for (const m of activeMoves) {
    const sd = scheduleDateYmd(m)
    if (!m.crew_id && sd >= today && sd <= cutoff72h) {
      const raw = m.move_code
        ? String(m.move_code).replace(/^#/, "").trim()
        : ""
      const slug = raw || getMoveCode(m as { move_code?: string | null; id?: string | null })
      const hrefSlug = raw ? raw.toUpperCase() : String(m.id)
      unassignedJobs.push({
        id: String(m.id),
        name: String(m.client_name || "Move"),
        date: sd,
        type: "move",
        code: formatJobId(slug, "move"),
        href: `/admin/moves/${hrefSlug}`,
      })
    }
  }
  for (const d of activeDeliveries) {
    const sd = scheduleDateYmd(d)
    if (!d.crew_id && sd >= today && sd <= cutoff72h) {
      const num = d.delivery_number ? String(d.delivery_number) : ""
      unassignedJobs.push({
        id: String(d.id),
        name: String(d.customer_name || d.client_name || "Delivery"),
        date: sd,
        type: "delivery",
        code: num ? formatJobId(num, "delivery") : "Delivery",
        href: `/admin/deliveries/${d.delivery_number || d.id}`,
      })
    }
  }
  unassignedJobs.sort((a, b) => a.date.localeCompare(b.date))

  type CrewCapacityDay = {
    date: string
    label: string
    total: number
    booked: number
  }
  const totalCrews = (crews ?? []).length
  const crewCapacity: CrewCapacityDay[] = []
  const dayLabels = ["Today", "Tomorrow"]
  for (let offset = 0; offset < 3; offset++) {
    const ds = addCalendarDaysYmd(today, offset)
    const tz = getAppTimezone()
    const label =
      offset < 2
        ? dayLabels[offset]
        : new Intl.DateTimeFormat("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            timeZone: tz,
          }).format(utcInstantForCalendarDateInTz(ds, tz))

    const bookedCrewIds = new Set<string>()
    for (const m of activeMoves) {
      if (scheduleDateYmd(m) === ds && m.crew_id)
        bookedCrewIds.add(String(m.crew_id))
    }
    for (const dl of activeDeliveries) {
      if (scheduleDateYmd(dl) === ds && dl.crew_id)
        bookedCrewIds.add(String(dl.crew_id))
    }
    crewCapacity.push({
      date: ds,
      label,
      total: totalCrews,
      booked: bookedCrewIds.size,
    })
  }

  const allQuotesExpanded = (quotesExpanded ?? []) as Record<string, unknown>[]
  const openQuotes = allQuotesExpanded.filter(
    (q) => q.status === "sent" || q.status === "viewed",
  )
  const viewedQuotes = allQuotesExpanded.filter((q) => q.status === "viewed")

  const getQuoteValue = (q: Record<string, unknown>): number => {
    if (q.custom_price) return Number(q.custom_price) || 0
    const tiers = q.tiers as Record<string, { total?: number }> | null
    if (tiers) {
      const first = Object.values(tiers)[0]
      return Number(first?.total) || 0
    }
    return 0
  }

  const openValue = openQuotes.reduce((s, q) => s + getQuoteValue(q), 0)
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const acceptedThisWeek = allQuotesExpanded.filter(
    (q) =>
      (q.status === "accepted" || q.status === "booked" || q.status === "confirmed" || q.status === "paid") &&
      q.accepted_at &&
      new Date(String(q.accepted_at)) >= sevenDaysAgo,
  ).length

  // Conversion rate from all quotes that have reached a terminal state (no time window —
  // avoids 0% when the only accepted quote was created >30 days ago).
  const acceptedAll = allQuotesExpanded.filter((q) =>
    ["accepted", "confirmed", "booked", "paid"].includes(String(q.status)),
  ).length
  const decidedAll = allQuotesExpanded.filter((q) =>
    ["accepted", "confirmed", "booked", "paid", "expired", "declined", "lost", "cold"].includes(String(q.status)),
  ).length
  const conversionRate =
    decidedAll > 0 ? Math.round((acceptedAll / decidedAll) * 100) : 0

  const expiringToday = openQuotes.filter((q) => {
    const exp = String(q.expires_at || "").slice(0, 10)
    return exp === today
  }).length

  const quotePipeline = {
    openCount: openQuotes.length,
    openValue,
    viewedCount: viewedQuotes.length,
    acceptedThisWeek,
    conversionRate,
    expiringToday,
  }

  const todayMovesList = allMoves.filter(
    (m) => scheduleDateYmd(m) === today,
  )
  const todayDeliveriesAll = allDeliveries.filter(
    (d) => scheduleDateYmd(d) === today,
  )

  let potentialEarnings = 0
  let collectedEarnings = 0
  for (const m of todayMovesList) {
    const val = movRev(m)
    potentialEarnings += val
    if (
      PAID_MOVE_STATUSES.has(effectiveMoveListStatus(m)) ||
      m.payment_marked_paid === true
    )
      collectedEarnings += val
  }
  for (const d of todayDeliveriesAll) {
    const val = deliveryPreTaxForAdminList(deliveryRow(d))
    potentialEarnings += val
    if (PAID_DLV_STATUSES.has(String(d.status))) collectedEarnings += val
  }

  const todayEarnings = {
    potential: potentialEarnings,
    collected: collectedEarnings,
    pending: potentialEarnings - collectedEarnings,
    jobCount: todayMovesList.length + todayDeliveriesAll.length,
  }

  const ratings = (reviewRequests ?? []) as {
    client_rating?: number
    status?: string
  }[]
  const ratedReviews = ratings.filter(
    (r) => r.client_rating != null && Number(r.client_rating) > 0,
  )
  const avgRating =
    ratedReviews.length > 0
      ? Math.round(
          (ratedReviews.reduce((s, r) => s + Number(r.client_rating), 0) /
            ratedReviews.length) *
            10,
        ) / 10
      : 0
  const pendingReviewCount = ratings.filter(
    (r) => r.status === "sent" || r.status === "reminded",
  ).length

  const satisfaction = {
    avgRating,
    count: ratedReviews.length,
    pendingReviews: pendingReviewCount,
  }

  const briefParts: string[] = []
  const todayTotal = todayJobs.length
  if (todayTotal > 0) {
    const moveCount = todayJobs.filter((j) => j.type === "move").length
    const dlvCount = todayJobs.filter((j) => j.type === "delivery").length
    const parts = []
    if (moveCount > 0) parts.push(`${moveCount} move${moveCount > 1 ? "s" : ""}`)
    if (dlvCount > 0) parts.push(`${dlvCount} deliver${dlvCount > 1 ? "ies" : "y"}`)
    briefParts.push(
      `${todayTotal} job${todayTotal > 1 ? "s" : ""} today (${parts.join(", ")})`,
    )
  } else {
    briefParts.push("No jobs scheduled today")
  }

  if (unassignedJobs.length > 0) {
    const todayUnassigned = unassignedJobs.filter((j) => j.date === today).length
    if (todayUnassigned > 0) {
      briefParts.push(`${todayUnassigned} unassigned today, needs crew`)
    } else {
      briefParts.push(
        `${unassignedJobs.length} upcoming job${unassignedJobs.length > 1 ? "s" : ""} still need crew assignment`,
      )
    }
  }

  if (potentialEarnings > 0) {
    briefParts.push(
      `$${potentialEarnings.toLocaleString()} potential revenue on the board today`,
    )
  }

  const availableToday = crewCapacity[0]
  if (availableToday && availableToday.total > 0) {
    const free = availableToday.total - availableToday.booked
    if (free > 0) {
      briefParts.push(
        `${free} crew${free > 1 ? "s" : ""} available for same-day dispatch`,
      )
    } else {
      briefParts.push("All crews booked today")
    }
  }

  if (quotePipeline.expiringToday > 0) {
    briefParts.push(
      `${quotePipeline.expiringToday} quote${quotePipeline.expiringToday > 1 ? "s" : ""} expiring today, follow up`,
    )
  }

  if (overdueAmount > 0) {
    briefParts.push(
      `${formatCompactCurrency(overdueAmount)} overdue across ${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""}`,
    )
  }

  const currentRevTrack =
    currentMonthRevenue > 0 && revenuePctChange !== 0
      ? `Revenue tracking ${revenuePctChange >= 0 ? `${revenuePctChange}% ahead of` : `${Math.abs(revenuePctChange)}% behind`} last month`
      : null
  if (currentRevTrack) briefParts.push(currentRevTrack)

  const dailyBrief = briefParts.join(". ") + "."

  return {
    todayJobs,
    upcomingJobs,
    todayJobCount: todayJobs.length,
    overdueAmount,
    overdueCount: overdueInvoices.length,
    currentMonthRevenue,
    revenuePctChange,
    revenueBreakdown: { moves: curMoveRev, partner: curPartnerRev },
    monthlyRevenue,
    revenueV2: {
      byDay: revenueByDay,
      byWeek: revenueByWeek,
      byMonth: revenueByMonth,
      byYear: revenueByYear,
    },
    activityEvents: activity,
    activeQuotesCount,
    actionTasks,
    unassignedJobs,
    crewCapacity,
    quotePipeline,
    todayEarnings,
    satisfaction,
    dailyBrief,
    leadPulse,
    revenueForecast,
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata = { title: "Command Center" };

import { createAdminClient } from "@/lib/supabase/admin";
import { getMoveCode } from "@/lib/move-code";
import { getTodayString } from "@/lib/business-timezone";
import { formatCompactCurrency } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";
import { isMoveWeatherBrief, type MoveWeatherBrief } from "@/lib/weather/move-weather-brief";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const admin = createAdminClient();
  const today = getTodayString();

  const [
    { data: deliveries },
    { data: moves },
    { data: invoices },
    activityResult,
    { data: quotes },
    pendingChangesResult,
    { data: crews },
    { data: quotesExpanded },
    { data: reviewRequests },
  ] = await Promise.all([
    admin.from("deliveries").select("*").order("created_at", { ascending: false }),
    admin.from("moves").select("*").order("created_at", { ascending: false }),
    admin.from("invoices").select("id, status, amount, updated_at, created_at"),
    (async () => {
      try {
        return await admin
          .from("status_events")
          .select("id, entity_type, entity_id, event_type, description, icon, created_at")
          .order("created_at", { ascending: false })
          .limit(12);
      } catch {
        return { data: [] };
      }
    })(),
    admin.from("quotes").select("id", { count: "exact", head: true }).in("status", ["sent", "viewed"]),
    (async () => {
      try {
        return await admin
          .from("move_change_requests")
          .select("id, type, description, urgency, status, created_at, moves(client_name, move_code)")
          .eq("status", "pending")
          .order("created_at", { ascending: false })
          .limit(10);
      } catch {
        return { data: [] };
      }
    })(),
    admin.from("crews").select("id, name, is_active").eq("is_active", true),
    admin.from("quotes")
      .select("id, quote_number, status, custom_price, tiers, client_name, viewed_at, accepted_at, created_at, expires_at")
      .in("status", ["sent", "viewed", "accepted", "expired", "declined"])
      .order("created_at", { ascending: false })
      .limit(200),
    (async () => {
      try {
        return await admin
          .from("review_requests")
          .select("id, move_id, client_rating, client_feedback, status, created_at")
          .not("client_rating", "is", null)
          .order("created_at", { ascending: false })
          .limit(30);
      } catch {
        return { data: [] };
      }
    })(),
  ]);

  const allDeliveries = (deliveries || []) as Record<string, unknown>[];
  const allMoves = (moves || []) as Record<string, unknown>[];
  const allInvoices = invoices || [];
  const activity = activityResult?.data ?? [];
  const activeQuotesCount = quotes?.length ?? 0;

  // ── Tasks: pending delivery requests + change requests ──

  type ActionTask = {
    id: string;
    taskType: "delivery_request" | "change_request";
    title: string;
    subtitle: string;
    createdAt: string;
    href: string;
  };

  const pendingDeliveries = allDeliveries.filter(
    (d) => d.status === "pending_approval" || d.status === "pending"
  );
  const deliveryTasks: ActionTask[] = pendingDeliveries.map((d) => ({
    id: String(d.id),
    taskType: "delivery_request" as const,
    title: `Delivery request from ${d.client_name || "partner"}`,
    subtitle: [d.customer_name, d.delivery_number].filter(Boolean).map(String).join(" · "),
    createdAt: String(d.created_at || ""),
    href: `/admin/deliveries/${d.delivery_number || d.id}`,
  }));

  const changeTasks: ActionTask[] = (pendingChangesResult?.data || []).map((r: Record<string, unknown>) => {
    const moveRaw = r.moves as unknown;
    const move = Array.isArray(moveRaw) ? (moveRaw[0] as { client_name?: string; move_code?: string } | undefined) ?? null : (moveRaw as { client_name?: string; move_code?: string } | null);
    const typeLabel = toTitleCase(String(r.type || "change"));
    return {
      id: String(r.id),
      taskType: "change_request" as const,
      title: `${typeLabel} Request`,
      subtitle: [move?.client_name, move?.move_code].filter(Boolean).join(" · "),
      createdAt: String(r.created_at || ""),
      href: "/admin/change-requests",
    };
  });

  const actionTasks = [...deliveryTasks, ...changeTasks]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // ── Jobs: today + upcoming ──

  const DONE_DELIVERY = new Set(["delivered", "cancelled", "rejected"]);
  const DONE_MOVE = new Set(["completed", "cancelled", "delivered", "done", "paid"]);

  type Job = {
    id: string;
    type: "delivery" | "move";
    name: string;
    subtitle: string;
    time: string;
    status: string;
    date: string;
    tag: string;
    delivery_number?: string | null;
    move_code?: string | null;
    /** For Mapbox route / traffic briefs (Command Center) */
    fromAddress?: string | null;
    toAddress?: string | null;
    /** Set by daily weather cron (`/api/cron/weather-alerts`) on `moves.weather_alert` */
    weatherAlert?: string | null;
    /** Rich daytime forecast at pickup (cron → `moves.weather_brief`) */
    weatherBrief?: MoveWeatherBrief | null;
  };

  const mapDelivery = (d: Record<string, unknown>): Job => {
    const num = d.delivery_number ? String(d.delivery_number) : "";
    const subtitle = num || `Delivery ${String(d.id).slice(0, 8)}`;
    return {
      id: String(d.id),
      type: "delivery",
      name: String(d.customer_name || d.client_name || "Delivery"),
      subtitle,
      time: String(d.time_slot || "TBD"),
      status: String(d.status || "pending").toLowerCase(),
      date: String(d.scheduled_date || ""),
      tag: String(d.category || "Delivery"),
      delivery_number: d.delivery_number ? String(d.delivery_number) : null,
      fromAddress: d.pickup_address != null ? String(d.pickup_address) : null,
      toAddress: d.delivery_address != null ? String(d.delivery_address) : null,
      weatherAlert: null,
      weatherBrief: null,
    };
  };

  const mapMove = (m: Record<string, unknown>): Job => {
    const codeRaw = m.move_code ? String(m.move_code).replace(/^#/, "").trim() : "";
    const subtitle = codeRaw ? codeRaw.toUpperCase() : getMoveCode(m as { move_code?: string | null; id?: string | null });
    const alert = m.weather_alert != null && String(m.weather_alert).trim() !== "" ? String(m.weather_alert) : null;
    const wb = m.weather_brief;
    const weatherBrief = isMoveWeatherBrief(wb) ? wb : null;
    return {
      id: String(m.id),
      type: "move",
      name: String(m.client_name || "Move"),
      subtitle,
      time: String(m.scheduled_time || m.time_slot || "TBD"),
      status: String(m.status || "confirmed").toLowerCase(),
      date: String(m.scheduled_date || ""),
      tag: m.service_type === "office_move" ? "Office" : m.service_type === "single_item" ? "Single Item" : "Move",
      move_code: m.move_code ? String(m.move_code) : null,
      fromAddress: m.from_address != null ? String(m.from_address) : null,
      toAddress: (m.to_address != null ? String(m.to_address) : null) ?? (m.delivery_address != null ? String(m.delivery_address) : null),
      weatherAlert: alert,
      weatherBrief,
    };
  };

  const activeDeliveries = allDeliveries.filter((d) => !DONE_DELIVERY.has(String(d.status)));
  const activeMoves = allMoves.filter((m) => !DONE_MOVE.has(String(m.status)));

  const todayJobs: Job[] = [
    ...activeDeliveries.filter((d) => String(d.scheduled_date || "") === today).map(mapDelivery),
    ...activeMoves.filter((m) => String(m.scheduled_date || "") === today).map(mapMove),
  ].sort((a, b) => {
    const ta = a.time.replace(/[^0-9:]/g, "");
    const tb = b.time.replace(/[^0-9:]/g, "");
    return ta.localeCompare(tb);
  });

  const upcomingJobs: Job[] = [
    ...activeDeliveries
      .filter((d) => {
        const sd = String(d.scheduled_date || "");
        return sd > today || !d.scheduled_date;
      })
      .map(mapDelivery),
    ...activeMoves
      .filter((m) => {
        const sd = String(m.scheduled_date || "");
        return sd > today || !m.scheduled_date;
      })
      .map(mapMove),
  ]
    .sort((a, b) => {
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date.localeCompare(b.date);
    })
    .slice(0, 15);

  // ── Revenue (multi-source) ──

  const overdueInvoices = allInvoices.filter((i) => i.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const movRev = (m: Record<string, unknown>) => Number(m.estimate || m.amount || 0);
  const dlvRev = (d: Record<string, unknown>) => Number(d.admin_adjusted_price || d.total_price || d.quoted_price || 0);

  const PAID_MOVE_STATUSES = new Set(["completed", "delivered", "done", "paid"]);
  const PAID_DLV_STATUSES = new Set(["delivered", "completed"]);

  const paidMoves = allMoves.filter(
    (m) => PAID_MOVE_STATUSES.has(String(m.status)) || m.payment_marked_paid === true
  );
  const paidDeliveries = allDeliveries.filter(
    (d) => PAID_DLV_STATUSES.has(String(d.status))
  );
  const paidInvoices = allInvoices.filter((i) => i.status === "paid");

  const getMoveDate = (m: Record<string, unknown>) => {
    const ts = String(m.payment_marked_paid_at || m.scheduled_date || m.created_at || "");
    return ts ? new Date(ts) : new Date(0);
  };
  const getDlvDate = (d: Record<string, unknown>) => {
    const ts = String(d.scheduled_date || d.created_at || "");
    return ts ? new Date(ts) : new Date(0);
  };
  const getInvDate = (inv: { updated_at?: string; created_at?: string }) => {
    const ts = inv.updated_at || inv.created_at;
    return ts ? new Date(ts) : new Date(0);
  };
  const inMonth = (d: Date, y: number, mo: number) => d.getFullYear() === y && d.getMonth() === mo;

  const curMoveRev = paidMoves
    .filter((m) => inMonth(getMoveDate(m), thisYear, thisMonth))
    .reduce((s, m) => s + movRev(m), 0);
  const curDlvRev = paidDeliveries
    .filter((d) => inMonth(getDlvDate(d), thisYear, thisMonth))
    .reduce((s, d) => s + dlvRev(d), 0);
  const curInvRev = paidInvoices
    .filter((i) => inMonth(getInvDate(i), thisYear, thisMonth))
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const currentMonthRevenue = curMoveRev + curDlvRev + curInvRev;

  const pm = thisMonth === 0 ? 11 : thisMonth - 1;
  const py = thisMonth === 0 ? thisYear - 1 : thisYear;
  const prevMoveRev = paidMoves.filter((m) => inMonth(getMoveDate(m), py, pm)).reduce((s, m) => s + movRev(m), 0);
  const prevDlvRev = paidDeliveries.filter((d) => inMonth(getDlvDate(d), py, pm)).reduce((s, d) => s + dlvRev(d), 0);
  const prevInvRev = paidInvoices.filter((i) => inMonth(getInvDate(i), py, pm)).reduce((s, i) => s + Number(i.amount || 0), 0);
  const prevMonthRevenue = prevMoveRev + prevDlvRev + prevInvRev;

  const revenuePctChange =
    prevMonthRevenue > 0 ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : (currentMonthRevenue > 0 ? 100 : 0);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  type MonthRevenue = { m: string; moves: number; deliveries: number; invoices: number };
  const monthlyRevenue: MonthRevenue[] = [];
  for (let i = 5; i >= 0; i--) {
    const mo = thisMonth - i;
    const yr = mo < 0 ? thisYear - 1 : thisYear;
    const monthIdx = ((mo % 12) + 12) % 12;
    const movSum = paidMoves.filter((m) => inMonth(getMoveDate(m), yr, monthIdx)).reduce((s, m) => s + movRev(m), 0);
    const dlvSum = paidDeliveries.filter((d) => inMonth(getDlvDate(d), yr, monthIdx)).reduce((s, d) => s + dlvRev(d), 0);
    const invSum = paidInvoices.filter((inv) => inMonth(getInvDate(inv), yr, monthIdx)).reduce((s, inv) => s + Number(inv.amount || 0), 0);
    monthlyRevenue.push({ m: monthLabels[monthIdx], moves: movSum / 1000, deliveries: dlvSum / 1000, invoices: invSum / 1000 });
  }

  // ── Unassigned Jobs (next 72h) ──

  const d72h = new Date();
  d72h.setDate(d72h.getDate() + 3);
  const cutoff72h = d72h.toISOString().slice(0, 10);

  type UnassignedJob = { id: string; name: string; date: string; type: "move" | "delivery"; code: string; href: string };
  const unassignedJobs: UnassignedJob[] = [];

  for (const m of activeMoves) {
    const sd = String(m.scheduled_date || "");
    if (!m.crew_id && sd >= today && sd <= cutoff72h) {
      const code = m.move_code ? String(m.move_code).replace(/^#/, "").trim().toUpperCase() : String(m.id).slice(0, 8);
      unassignedJobs.push({
        id: String(m.id),
        name: String(m.client_name || "Move"),
        date: sd,
        type: "move",
        code,
        href: `/admin/moves/${m.move_code ? code : m.id}`,
      });
    }
  }
  for (const d of activeDeliveries) {
    const sd = String(d.scheduled_date || "");
    if (!d.crew_id && sd >= today && sd <= cutoff72h) {
      const code = d.delivery_number ? String(d.delivery_number) : "Delivery";
      unassignedJobs.push({
        id: String(d.id),
        name: String(d.customer_name || d.client_name || "Delivery"),
        date: sd,
        type: "delivery",
        code,
        href: `/admin/deliveries/${d.delivery_number || d.id}`,
      });
    }
  }
  unassignedJobs.sort((a, b) => a.date.localeCompare(b.date));

  // ── Crew Capacity (today + next 2 days) ──

  type CrewCapacityDay = { date: string; label: string; total: number; booked: number };
  const totalCrews = (crews ?? []).length;
  const crewCapacity: CrewCapacityDay[] = [];
  const dayLabels = ["Today", "Tomorrow"];
  for (let offset = 0; offset < 3; offset++) {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    const ds = d.toISOString().slice(0, 10);
    const label = offset < 2 ? dayLabels[offset] : d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

    const bookedCrewIds = new Set<string>();
    for (const m of activeMoves) {
      if (String(m.scheduled_date || "") === ds && m.crew_id) bookedCrewIds.add(String(m.crew_id));
    }
    for (const dl of activeDeliveries) {
      if (String(dl.scheduled_date || "") === ds && dl.crew_id) bookedCrewIds.add(String(dl.crew_id));
    }
    crewCapacity.push({ date: ds, label, total: totalCrews, booked: bookedCrewIds.size });
  }

  // ── Quote Pipeline ──

  const allQuotesExpanded = (quotesExpanded ?? []) as Record<string, unknown>[];
  const openQuotes = allQuotesExpanded.filter((q) => q.status === "sent" || q.status === "viewed");
  const viewedQuotes = allQuotesExpanded.filter((q) => q.status === "viewed");

  const getQuoteValue = (q: Record<string, unknown>): number => {
    if (q.custom_price) return Number(q.custom_price) || 0;
    const tiers = q.tiers as Record<string, { total?: number }> | null;
    if (tiers) {
      const first = Object.values(tiers)[0];
      return Number(first?.total) || 0;
    }
    return 0;
  };

  const openValue = openQuotes.reduce((s, q) => s + getQuoteValue(q), 0);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const acceptedThisWeek = allQuotesExpanded.filter(
    (q) => q.status === "accepted" && q.accepted_at && new Date(String(q.accepted_at)) >= sevenDaysAgo
  ).length;

  const last30 = allQuotesExpanded.filter((q) => new Date(String(q.created_at)) >= thirtyDaysAgo);
  const acceptedLast30 = last30.filter((q) => q.status === "accepted").length;
  const decidedLast30 = last30.filter((q) => ["accepted", "expired", "declined"].includes(String(q.status))).length;
  const conversionRate = decidedLast30 > 0 ? Math.round((acceptedLast30 / decidedLast30) * 100) : 0;

  const expiringToday = openQuotes.filter((q) => {
    const exp = String(q.expires_at || "").slice(0, 10);
    return exp === today;
  }).length;

  type QuotePipeline = {
    openCount: number;
    openValue: number;
    viewedCount: number;
    acceptedThisWeek: number;
    conversionRate: number;
    expiringToday: number;
  };
  const quotePipeline: QuotePipeline = {
    openCount: openQuotes.length,
    openValue,
    viewedCount: viewedQuotes.length,
    acceptedThisWeek,
    conversionRate,
    expiringToday,
  };

  // ── Today's Earnings ──

  type TodayEarnings = { potential: number; collected: number; pending: number; jobCount: number };
  const todayMoves = allMoves.filter((m) => String(m.scheduled_date || "") === today);
  const todayDeliveriesAll = allDeliveries.filter((d) => String(d.scheduled_date || "") === today);

  let potentialEarnings = 0;
  let collectedEarnings = 0;
  for (const m of todayMoves) {
    const val = movRev(m);
    potentialEarnings += val;
    if (PAID_MOVE_STATUSES.has(String(m.status)) || m.payment_marked_paid === true) collectedEarnings += val;
  }
  for (const d of todayDeliveriesAll) {
    const val = dlvRev(d);
    potentialEarnings += val;
    if (PAID_DLV_STATUSES.has(String(d.status))) collectedEarnings += val;
  }

  const todayEarnings: TodayEarnings = {
    potential: potentialEarnings,
    collected: collectedEarnings,
    pending: potentialEarnings - collectedEarnings,
    jobCount: todayMoves.length + todayDeliveriesAll.length,
  };

  // ── Customer Satisfaction ──

  type SatisfactionData = { avgRating: number; count: number; pendingReviews: number };
  const ratings = (reviewRequests ?? []) as { client_rating?: number; status?: string }[];
  const ratedReviews = ratings.filter((r) => r.client_rating != null && Number(r.client_rating) > 0);
  const avgRating = ratedReviews.length > 0
    ? Math.round((ratedReviews.reduce((s, r) => s + Number(r.client_rating), 0) / ratedReviews.length) * 10) / 10
    : 0;
  const pendingReviewCount = ratings.filter((r) => r.status === "sent" || r.status === "reminded").length;

  const satisfaction: SatisfactionData = {
    avgRating,
    count: ratedReviews.length,
    pendingReviews: pendingReviewCount,
  };

  // ── Daily Brief (natural-language summary) ──

  const briefParts: string[] = [];
  const todayTotal = todayJobs.length;
  if (todayTotal > 0) {
    const moveCount = todayJobs.filter((j) => j.type === "move").length;
    const dlvCount = todayJobs.filter((j) => j.type === "delivery").length;
    const parts = [];
    if (moveCount > 0) parts.push(`${moveCount} move${moveCount > 1 ? "s" : ""}`);
    if (dlvCount > 0) parts.push(`${dlvCount} deliver${dlvCount > 1 ? "ies" : "y"}`);
    briefParts.push(`${todayTotal} job${todayTotal > 1 ? "s" : ""} today (${parts.join(", ")})`);
  } else {
    briefParts.push("No jobs scheduled today");
  }

  if (unassignedJobs.length > 0) {
    const todayUnassigned = unassignedJobs.filter((j) => j.date === today).length;
    if (todayUnassigned > 0) {
      briefParts.push(`${todayUnassigned} unassigned today, needs crew`);
    } else {
      briefParts.push(`${unassignedJobs.length} upcoming job${unassignedJobs.length > 1 ? "s" : ""} still need crew assignment`);
    }
  }

  if (potentialEarnings > 0) {
    briefParts.push(`$${potentialEarnings.toLocaleString()} potential revenue on the board today`);
  }

  const availableToday = crewCapacity[0];
  if (availableToday && availableToday.total > 0) {
    const free = availableToday.total - availableToday.booked;
    if (free > 0) {
      briefParts.push(`${free} crew${free > 1 ? "s" : ""} available for same-day dispatch`);
    } else {
      briefParts.push("All crews booked today");
    }
  }

  if (quotePipeline.expiringToday > 0) {
    briefParts.push(`${quotePipeline.expiringToday} quote${quotePipeline.expiringToday > 1 ? "s" : ""} expiring today, follow up`);
  }

  if (overdueAmount > 0) {
    briefParts.push(`${formatCompactCurrency(overdueAmount)} overdue across ${overdueInvoices.length} invoice${overdueInvoices.length > 1 ? "s" : ""}`);
  }

  const currentRevTrack = currentMonthRevenue > 0 && revenuePctChange !== 0
    ? `Revenue tracking ${revenuePctChange >= 0 ? `${revenuePctChange}% ahead of` : `${Math.abs(revenuePctChange)}% behind`} last month`
    : null;
  if (currentRevTrack) briefParts.push(currentRevTrack);

  const dailyBrief = briefParts.join(". ") + ".";

  return (
    <AdminPageClient
      todayJobs={todayJobs}
      upcomingJobs={upcomingJobs}
      todayJobCount={todayJobs.length}
      overdueAmount={overdueAmount}
      overdueCount={overdueInvoices.length}
      currentMonthRevenue={currentMonthRevenue}
      revenuePctChange={revenuePctChange}
      revenueBreakdown={{ moves: curMoveRev, deliveries: curDlvRev, invoices: curInvRev }}
      monthlyRevenue={monthlyRevenue}
      activityEvents={activity}
      activeQuotesCount={activeQuotesCount}
      actionTasks={actionTasks}
      unassignedJobs={unassignedJobs}
      crewCapacity={crewCapacity}
      quotePipeline={quotePipeline}
      todayEarnings={todayEarnings}
      satisfaction={satisfaction}
      dailyBrief={dailyBrief}
    />
  );
}

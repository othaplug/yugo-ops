export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
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
  ] = await Promise.all([
    admin.from("deliveries").select("*").order("scheduled_date"),
    admin.from("moves").select("*"),
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
    const typeLabel = String(r.type || "change").replace(/_/g, " ");
    return {
      id: String(r.id),
      taskType: "change_request" as const,
      title: `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} request`,
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
  };

  const mapDelivery = (d: Record<string, unknown>): Job => ({
    id: String(d.id),
    type: "delivery",
    name: String(d.customer_name || d.client_name || "Delivery"),
    subtitle: d.from_address ? String(d.from_address) : String(d.category || "Delivery"),
    time: String(d.time_slot || "TBD"),
    status: String(d.status || "pending").toLowerCase(),
    date: String(d.scheduled_date || ""),
    tag: String(d.category || "Delivery"),
    delivery_number: d.delivery_number ? String(d.delivery_number) : null,
  });

  const mapMove = (m: Record<string, unknown>): Job => ({
    id: String(m.id),
    type: "move",
    name: String(m.client_name || "Move"),
    subtitle: m.from_address && m.to_address ? `${m.from_address} → ${m.to_address}` : String(m.from_address || ""),
    time: String(m.time_slot || "TBD"),
    status: String(m.status || "confirmed").toLowerCase(),
    date: String(m.scheduled_date || ""),
    tag: m.service_type === "office_move" ? "Office" : m.service_type === "single_item" ? "Single Item" : "Move",
    move_code: m.move_code ? String(m.move_code) : null,
  });

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
    />
  );
}

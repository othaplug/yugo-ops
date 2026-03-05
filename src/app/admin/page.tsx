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
  ] = await Promise.all([
    admin.from("deliveries").select("id, customer_name, client_name, items, time_slot, status, category, scheduled_date, delivery_number, from_address, to_address").order("scheduled_date", { ascending: true }),
    admin.from("moves").select("id, client_name, from_address, to_address, scheduled_date, status, move_type, service_type, move_code, time_slot").order("scheduled_date", { ascending: true }),
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
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const allInvoices = invoices || [];
  const activity = activityResult?.data ?? [];
  const activeQuotesCount = quotes?.length ?? 0;

  const todayDeliveries = allDeliveries.filter((d) => d.scheduled_date === today);
  const todayMoves = allMoves.filter((m) => m.scheduled_date === today);

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

  const todayJobs: Job[] = [
    ...todayDeliveries.map((d) => ({
      id: d.id,
      type: "delivery" as const,
      name: d.customer_name || d.client_name || "Delivery",
      subtitle: d.from_address ? `${d.from_address}` : (d.category || "Delivery"),
      time: d.time_slot || "TBD",
      status: (d.status || "pending").toLowerCase(),
      date: d.scheduled_date || today,
      tag: d.category || "Delivery",
      delivery_number: d.delivery_number,
    })),
    ...todayMoves.map((m) => ({
      id: m.id,
      type: "move" as const,
      name: m.client_name || "Move",
      subtitle: m.from_address && m.to_address ? `${m.from_address} → ${m.to_address}` : (m.from_address || ""),
      time: m.time_slot || "TBD",
      status: (m.status || "confirmed").toLowerCase(),
      date: m.scheduled_date || today,
      tag: m.service_type === "office_move" ? "Office" : m.service_type === "single_item" ? "Single Item" : "Move",
      move_code: m.move_code,
    })),
  ].sort((a, b) => {
    const ta = a.time.replace(/[^0-9:]/g, "");
    const tb = b.time.replace(/[^0-9:]/g, "");
    return ta.localeCompare(tb);
  });

  const upcomingJobs: Job[] = [
    ...allDeliveries
      .filter((d) => d.scheduled_date && d.scheduled_date > today && d.status !== "delivered" && d.status !== "cancelled")
      .slice(0, 10)
      .map((d) => ({
        id: d.id,
        type: "delivery" as const,
        name: d.customer_name || d.client_name || "Delivery",
        subtitle: d.category || "Delivery",
        time: d.time_slot || "",
        status: (d.status || "pending").toLowerCase(),
        date: d.scheduled_date || "",
        tag: d.category || "Delivery",
        delivery_number: d.delivery_number,
      })),
    ...allMoves
      .filter((m) => m.scheduled_date && m.scheduled_date > today && m.status !== "completed" && m.status !== "cancelled")
      .slice(0, 10)
      .map((m) => ({
        id: m.id,
        type: "move" as const,
        name: m.client_name || "Move",
        subtitle: m.from_address && m.to_address ? `${m.from_address} → ${m.to_address}` : "",
        time: m.time_slot || "",
        status: (m.status || "confirmed").toLowerCase(),
        date: m.scheduled_date || "",
        tag: m.service_type === "office_move" ? "Office" : m.service_type === "single_item" ? "Single Item" : "Move",
        move_code: m.move_code,
      })),
  ]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  const overdueInvoices = allInvoices.filter((i) => i.status === "overdue");
  const overdueAmount = overdueInvoices.reduce((s, i) => s + Number(i.amount || 0), 0);

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const getRevenueDate = (inv: { updated_at?: string; created_at?: string }) => {
    const ts = inv.updated_at || inv.created_at;
    return ts ? new Date(ts) : new Date(0);
  };
  const currentMonthRevenue = paidInvoices
    .filter((i) => { const d = getRevenueDate(i); return d.getFullYear() === thisYear && d.getMonth() === thisMonth; })
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const prevMonthRevenue = paidInvoices
    .filter((i) => {
      const d = getRevenueDate(i);
      const pm = thisMonth === 0 ? 11 : thisMonth - 1;
      const py = thisMonth === 0 ? thisYear - 1 : thisYear;
      return d.getFullYear() === py && d.getMonth() === pm;
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const revenuePctChange =
    prevMonthRevenue > 0 ? Math.round(((currentMonthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100) : (currentMonthRevenue > 0 ? 100 : 0);

  const monthLabels = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthlyRevenue: { m: string; v: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const m = thisMonth - i;
    const y = m < 0 ? thisYear - 1 : thisYear;
    const monthIdx = ((m % 12) + 12) % 12;
    const sum = paidInvoices
      .filter((inv) => { const d = getRevenueDate(inv); return d.getFullYear() === y && d.getMonth() === monthIdx; })
      .reduce((s, inv) => s + Number(inv.amount || 0), 0);
    monthlyRevenue.push({ m: monthLabels[monthIdx], v: sum / 1000 });
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
      monthlyRevenue={monthlyRevenue}
      activityEvents={activity}
      activeQuotesCount={activeQuotesCount}
    />
  );
}

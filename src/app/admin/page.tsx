import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import AdminPageClient from "./AdminPageClient";

export default async function AdminPage() {
  const supabase = await createClient();
  const admin = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: deliveries },
    { data: moves },
    { data: invoices },
    activityResult,
    { data: eodReports },
    { data: crews },
  ] = await Promise.all([
    supabase.from("deliveries").select("*").order("scheduled_date", { ascending: true }),
    supabase.from("moves").select("*"),
    supabase.from("invoices").select("*"),
    (async () => {
      try {
        const r = await supabase
          .from("status_events")
          .select("id, entity_type, entity_id, event_type, description, icon, created_at")
          .order("created_at", { ascending: false })
          .limit(15);
        return r;
      } catch {
        return { data: [] };
      }
    })(),
    admin.from("end_of_day_reports").select("team_id, summary, generated_at").eq("report_date", today),
    admin.from("crews").select("id, name").order("name"),
  ]);

  const allDeliveries = deliveries || [];
  const allMoves = moves || [];
  const allInvoices = invoices || [];
  const activity = activityResult?.data ?? [];
  const eodSubmitted = new Set((eodReports || []).map((r: { team_id: string }) => r.team_id));
  const eodSummary = {
    submitted: (eodReports || []).map((r: { team_id: string; summary?: Record<string, unknown>; generated_at?: string }) => ({
      teamId: r.team_id,
      teamName: (crews || []).find((c: { id: string }) => c.id === r.team_id)?.name || "Team",
      summary: r.summary,
      generatedAt: r.generated_at,
    })),
    pending: (crews || []).filter((c: { id: string }) => !eodSubmitted.has(c.id)).map((c: { id: string; name?: string }) => ({ teamId: c.id, teamName: c.name ?? "Team" })),
    totalTeams: (crews || []).length,
    submittedCount: (eodReports || []).length,
  };

  const todayDeliveries = allDeliveries.filter((d) => d.scheduled_date === today);
  const overdueAmount = allInvoices
    .filter((i) => i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.amount || 0), 0);
  const b2cUpcoming = allMoves.filter((m) => m.status === "confirmed" || m.status === "scheduled");

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const paidInvoices = allInvoices.filter((i) => i.status === "paid");
  const getRevenueDate = (inv: { updated_at?: string; created_at?: string }) => {
    const ts = inv.updated_at || inv.created_at;
    return ts ? new Date(ts) : new Date(0);
  };
  const currentMonthRevenue = paidInvoices
    .filter((i) => {
      const d = getRevenueDate(i);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    })
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
      .filter((inv) => {
        const d = getRevenueDate(inv);
        return d.getFullYear() === y && d.getMonth() === monthIdx;
      })
      .reduce((s, inv) => s + Number(inv.amount || 0), 0);
    monthlyRevenue.push({ m: monthLabels[monthIdx], v: sum / 1000 });
  }

  const categoryIcons: Record<string, string> = {
    retail: "sofa",
    designer: "palette",
    hospitality: "hotel",
    gallery: "image",
  };
  const categoryBgs: Record<string, string> = {
    retail: "var(--gdim)",
    designer: "var(--prdim)",
    hospitality: "var(--ordim)",
    gallery: "var(--bldim)",
  };

  return (
    <AdminPageClient
      todayDeliveries={todayDeliveries}
      allDeliveries={allDeliveries}
      b2cUpcoming={b2cUpcoming}
      overdueAmount={overdueAmount}
      currentMonthRevenue={currentMonthRevenue}
      revenuePctChange={revenuePctChange}
      monthlyRevenue={monthlyRevenue}
      categoryBgs={categoryBgs}
      categoryIcons={categoryIcons}
      activityEvents={activity}
      eodSummary={eodSummary}
    />
  );
}

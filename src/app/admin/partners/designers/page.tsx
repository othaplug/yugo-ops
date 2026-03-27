import { createAdminClient } from "@/lib/supabase/admin";
import DesignerDashboard from "./DesignerDashboard";
import BackButton from "../../components/BackButton";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import { formatCompactCurrency } from "@/lib/format-currency";

export const metadata = { title: "Designers" };

const DESIGNER_ORG_TYPES = ["designer", "interior_designer"];

export default async function DesignersPage() {
  const db = createAdminClient();
  const [{ data: orgs }, { data: deliveries }, { data: invoices }] = await Promise.all([
    db.from("organizations").select("*, created_at").in("type", DESIGNER_ORG_TYPES).order("name"),
    db.from("deliveries").select("*").eq("category", "designer").order("created_at", { ascending: false }),
    db.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const designerOrgIds = (orgs || []).map((o) => o.id);
  const { data: projects } =
    designerOrgIds.length > 0
      ? await db
          .from("projects")
          .select("*, organizations:partner_id(name, type)")
          .in("partner_id", designerOrgIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const clients = orgs || [];
  const dels = deliveries || [];
  const allProjects = projects || [];
  const designerNames = new Set(clients.map((c) => c.name).filter(Boolean));
  const designerInvoices = (invoices || []).filter((i) => i.client_name && designerNames.has(i.client_name));
  const paid = designerInvoices.filter((i) => i.status === "paid");
  const outstanding = designerInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const revenueTotal = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount || 0), 0);

  const now = new Date();
  const monthLabel = now.toLocaleString("en-US", { month: "short" });
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const deliveriesThisMonth = dels.filter((d) => {
    const sd = d.scheduled_date ? new Date(d.scheduled_date) : null;
    return sd && sd >= thisMonthStart && sd <= now;
  }).length;
  const revenueThisMonth = paid
    .filter((i) => {
      const d = i.created_at ? new Date(i.created_at) : null;
      return d && d >= thisMonthStart && d <= now;
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  const activeProjects = allProjects.filter((p) =>
    ["draft", "proposed", "active", "on_hold"].includes(p.status || "")
  ).length;
  const completedProjects = allProjects.filter((p) =>
    ["completed", "invoiced"].includes(p.status || "")
  ).length;

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Partners" href="/admin/platform?tab=partners" /></div>

      <div className="mb-8">
        <p className="text-[10px] font-bold tracking-[0.18em] capitalize text-[var(--tx3)]/60 mb-1.5">Partners</p>
        <h1 className="font-hero text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Designers</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Partners" value={String(clients.length)} sub="active accounts" />
        <KpiCard label="Deliveries" value={String(dels.length)} sub={`${deliveriesThisMonth} this month`} />
        <KpiCard label={`Revenue (${monthLabel})`} value={formatCompactCurrency(revenueThisMonth)} sub="paid invoices" accent />
        <KpiCard label="Outstanding" value={formatCompactCurrency(outstandingTotal)} sub="awaiting payment" warn={outstandingTotal > 0} />
      </div>

      <SectionDivider label="Activity" />
      <DesignerDashboard
        orgs={clients}
        deliveries={dels}
        projects={allProjects}
      />
    </div>
  );
}

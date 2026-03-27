import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";

export const metadata = { title: "Gallery" };

import GalleryClient from "./GalleryClient";
import { formatCompactCurrency } from "@/lib/format-currency";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";

export default async function GalleryPage() {
  const db = createAdminClient();
  const [
    { data: orgs },
    { data: projects },
    { data: invoices },
  ] = await Promise.all([
    db.from("organizations").select("id, name, contact_name, email, created_at").eq("type", "gallery").order("name"),
    db.from("gallery_projects").select("id, created_at"),
    db.from("invoices").select("client_name, amount, status, created_at"),
  ]);

  const galleryPartners = orgs || [];
  const projectCount = projects?.length ?? 0;
  const galleryNames = new Set(galleryPartners.map((o) => o.name).filter(Boolean));
  const galleryInvoices = (invoices || []).filter((i) => i.client_name && galleryNames.has(i.client_name));
  const paid = galleryInvoices.filter((i) => i.status === "paid");
  const outstanding = galleryInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const revenueTotal = paid.reduce((s, i) => s + Number(i.amount || 0), 0);
  const outstandingTotal = outstanding.reduce((s, i) => s + Number(i.amount || 0), 0);

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  const partnersPrev = galleryPartners.filter((o) => {
    const d = o.created_at ? new Date(o.created_at) : null;
    return d && d < thisMonthStart;
  }).length;
  const projectsThisMonth = (projects || []).filter((p) => {
    const d = p.created_at ? new Date(p.created_at) : null;
    return d && d >= thisMonthStart && d <= now;
  }).length;
  const projectsLastMonth = (projects || []).filter((p) => {
    const d = p.created_at ? new Date(p.created_at) : null;
    return d && d >= lastMonthStart && d <= lastMonthEnd;
  }).length;
  const revenueThisMonth = paid
    .filter((i) => {
      const d = i.created_at ? new Date(i.created_at) : null;
      return d && d >= thisMonthStart && d <= now;
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);
  const revenueLastMonth = paid
    .filter((i) => {
      const d = i.created_at ? new Date(i.created_at) : null;
      return d && d >= lastMonthStart && d <= lastMonthEnd;
    })
    .reduce((s, i) => s + Number(i.amount || 0), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Partners" href="/admin/platform?tab=partners" /></div>

      <div className="mb-8">
        <p className="text-[10px] font-bold tracking-[0.18em] capitalize text-[var(--tx3)]/60 mb-1.5">Partners</p>
        <h1 className="font-hero text-[26px] sm:text-[32px] font-bold text-[var(--tx)] tracking-tight leading-none">Gallery</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Partners" value={String(galleryPartners.length)} sub="active accounts" />
        <KpiCard label="Projects" value={String(projectCount)} sub={`${projectsThisMonth} this month`} />
        <KpiCard label="Revenue" value={formatCompactCurrency(revenueTotal)} sub="paid invoices" accent />
        <KpiCard label="Outstanding" value={formatCompactCurrency(outstandingTotal)} sub="awaiting payment" warn={outstandingTotal > 0} />
      </div>

      <SectionDivider label="Projects & Partners" />
      <GalleryClient galleryPartners={galleryPartners} />
    </div>
  );
}

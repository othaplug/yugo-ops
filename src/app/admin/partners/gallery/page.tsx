import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";

export const metadata = { title: "Gallery Partners" };

import { StatPctChange } from "../../components/StatPctChange";
import GalleryClient from "./GalleryClient";
import { formatCompactCurrency } from "@/lib/format-currency";

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
      <div className="mb-4"><BackButton label="B2B Partners" href="/admin/platform?tab=partners" /></div>

      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-heading text-[22px] font-bold text-[var(--tx)]">Gallery Partners</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">{galleryPartners.length} active partner{galleryPartners.length !== 1 ? "s" : ""} · {projectCount} projects</p>
        </div>
      </div>

      {/* Stats — bare, no cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8 pt-6 border-t border-[var(--brd)]/30">
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Partners</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--tx)]">{galleryPartners.length}</span>
            <StatPctChange current={galleryPartners.length} previous={partnersPrev} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Projects</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--tx)]">{projectCount}</span>
            <StatPctChange current={projectsThisMonth} previous={projectsLastMonth} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Revenue</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(revenueTotal)}</span>
            <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
          </div>
        </div>
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">Outstanding</div>
          <div className={`text-[24px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
            {formatCompactCurrency(outstandingTotal)}
          </div>
        </div>
      </div>

      <GalleryClient galleryPartners={galleryPartners} />
    </div>
  );
}

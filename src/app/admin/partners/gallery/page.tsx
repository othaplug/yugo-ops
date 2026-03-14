import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";
import { StatPctChange } from "../../components/StatPctChange";
import GalleryClient from "./GalleryClient";
import { formatCurrency, formatCompactCurrency } from "@/lib/format-currency";

export default async function GalleryPage() {
  const db = createAdminClient();
  const [
    { data: orgs },
    { data: projects },
    { data: invoices },
    { data: deliveries },
  ] = await Promise.all([
    db.from("organizations").select("id, name, contact_name, email, created_at").eq("type", "gallery").order("name"),
    db.from("gallery_projects").select("id, created_at"),
    db.from("invoices").select("client_name, amount, status, created_at"),
    db.from("deliveries").select("*").eq("category", "gallery").order("scheduled_date", { ascending: false }),
  ]);

  const galleryPartners = orgs || [];
  const dels = deliveries || [];
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

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--tx)]">{galleryPartners.length}</span>
            <StatPctChange current={galleryPartners.length} previous={partnersPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Projects</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--tx)]">{projectCount}</span>
            <StatPctChange current={projectsThisMonth} previous={projectsLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-bold font-heading text-[var(--grn)]">{formatCompactCurrency(revenueTotal)}</span>
            <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className={`text-[24px] font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCompactCurrency(outstandingTotal)}</div>
        </div>
      </div>

      {/* Actions above content */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-heading text-[14px] font-bold text-[var(--tx)]">Projects & Partners</h3>
        <Link href="/admin/clients/new?type=partner&partnerType=gallery" className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Add Partner
        </Link>
      </div>

      <GalleryClient galleryPartners={galleryPartners} />

      {/* Partners list */}
      <div className="mt-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Partners</h3>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden divide-y divide-[var(--brd)]/50">
          {galleryPartners.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)]">
              No gallery partners yet. <Link href="/admin/clients/new?type=partner&partnerType=gallery" className="text-[var(--gold)] hover:underline">Add one</Link>
            </div>
          ) : galleryPartners.map((p) => (
            <Link key={p.id} href={`/admin/clients/${p.id}?from=gallery`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-[var(--bg)]/50 transition-colors">
              <div className="w-9 h-9 rounded-lg bg-[#4A7CE5]/10 flex items-center justify-center text-[12px] font-bold text-[#4A7CE5]">
                {(p.name || "?").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[var(--tx)]">{p.name}</div>
                <div className="text-[11px] text-[var(--tx3)]">{p.contact_name || p.email || "—"}</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

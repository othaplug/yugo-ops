import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import BackButton from "../../components/BackButton";
import { StatPctChange } from "../../components/StatPctChange";
import GalleryClient from "./GalleryClient";
import { formatCurrency } from "@/lib/format-currency";

export default async function GalleryPage() {
  const supabase = await createClient();
  const [
    { data: orgs },
    { data: projects },
    { data: invoices },
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, contact_name, email, created_at").eq("type", "gallery").order("name"),
    supabase.from("gallery_projects").select("id, created_at"),
    supabase.from("invoices").select("client_name, amount, status, created_at"),
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

      {/* 4 Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Partners</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{galleryPartners.length}</span>
            <StatPctChange current={galleryPartners.length} previous={partnersPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Projects</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{projectCount}</span>
            <StatPctChange current={projectsThisMonth} previous={projectsLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Revenue</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">{formatCurrency(revenueTotal)}</span>
            <StatPctChange current={revenueThisMonth} previous={revenueLastMonth} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-3">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Outstanding</div>
          <div className={`text-xl font-bold font-heading ${outstandingTotal > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>{formatCurrency(outstandingTotal)}</div>
        </div>
      </div>

      {/* Projects section - header with Create & Add Partner at same level */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h3 className="font-heading text-[14px] font-bold text-[var(--tx)]">Projects</h3>
        <div className="flex gap-2">
          <Link href="/admin/deliveries/new?type=gallery" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all whitespace-nowrap">
            Create Project
          </Link>
          <Link href="/admin/clients/new?type=partner&partnerType=gallery" className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all whitespace-nowrap">
            Add Partner
          </Link>
        </div>
      </div>

      <GalleryClient galleryPartners={galleryPartners} />

      {/* Gallery Partners */}
      <div className="mt-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Gallery Partners</h3>
        <div className="space-y-2">
          {galleryPartners.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12px] text-[var(--tx3)] bg-[var(--card)] border border-[var(--brd)] rounded-xl">
              No gallery partners yet. <Link href="/admin/clients/new?type=partner&partnerType=gallery" className="text-[var(--gold)] hover:underline">Add one</Link>
            </div>
          ) : galleryPartners.map((p) => (
            <Link key={p.id} href={`/admin/clients/${p.id}?from=gallery`} className="flex items-center gap-3 px-4 py-3 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-bold text-[var(--tx)]">{p.name}</div>
                <div className="text-[10px] text-[var(--tx3)]">{p.contact_name || p.email || "—"}</div>
              </div>
              <span className="text-[10px] font-semibold text-[var(--tx2)]">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

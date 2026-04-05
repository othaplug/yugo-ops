export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../components/BackButton";
import { formatCompactCurrency } from "@/lib/format-currency";
import KpiCard from "@/components/ui/KpiCard";
import SectionDivider from "@/components/ui/SectionDivider";
import InvoicesPageClient from "./InvoicesPageClient";

export default async function InvoicesPage() {
  const db = createAdminClient();

  // Disambiguate embed: PostgREST errors if multiple FKs exist between invoices and organizations.
  const withOrg = await db
    .from("invoices")
    .select("*, organizations!organization_id(vertical, type)")
    .order("created_at", { ascending: false });

  let invoices = withOrg.data;
  let loadError: string | null = null;
  let orgEmbedWarning: string | null = null;

  if (withOrg.error) {
    console.error("[admin/invoices] query with organizations embed failed:", withOrg.error);
    const plain = await db.from("invoices").select("*").order("created_at", { ascending: false });
    if (plain.error) {
      console.error("[admin/invoices] fallback query failed:", plain.error);
      loadError = plain.error.message || "Failed to load invoices";
      invoices = [];
    } else {
      invoices = plain.data;
      if ((plain.data?.length ?? 0) > 0) {
        orgEmbedWarning =
          withOrg.error.message ||
          "Could not load organization details; invoices are shown without partner vertical/type.";
      }
    }
  }

  const all = (invoices ?? []).map((row) => {
    const inv = row as Record<string, unknown>;
    const orgRel = inv.organizations;
    const { organizations: _drop, ...rest } = inv;
    const org =
      orgRel && typeof orgRel === "object" && !Array.isArray(orgRel)
        ? (orgRel as { vertical?: string | null; type?: string | null })
        : null;
    return { ...rest, organization: org } as typeof row & {
      organization: { vertical?: string | null; type?: string | null } | null;
    };
  });
  const paid = all.filter((i) => i.status === "paid");
  const sent = all.filter((i) => i.status === "sent");
  const overdue = all.filter((i) => i.status === "overdue");
  const draft = all.filter((i) => i.status === "draft");
  const paidTotal = paid.reduce((s, i) => s + Number(i.amount), 0);
  const sentTotal = sent.reduce((s, i) => s + Number(i.amount), 0);
  const overdueTotal = overdue.reduce((s, i) => s + Number(i.amount), 0);

  return (
    <div className="max-w-[1200px] mx-auto px-5 md:px-6 py-5 md:py-6 animate-fade-up">
      <div className="mb-6"><BackButton label="Back" /></div>

      {loadError && (
        <div
          className="mb-4 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/25 text-red-400 text-[12px]"
          role="alert"
        >
          Unable to load invoices. {loadError}
        </div>
      )}
      {orgEmbedWarning && (
        <div
          className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-400 text-[12px]"
          role="status"
        >
          {orgEmbedWarning}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Finance</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Invoices</h1>
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)]">
        <KpiCard label="Total" value={String(all.length)} sub={`${paid.length} paid · ${draft.length} draft`} href="/admin/revenue" />
        <KpiCard label="Paid" value={formatCompactCurrency(paidTotal)} sub={`${paid.length} invoices`} accent href="/admin/revenue" />
        <KpiCard label="Pending / Sent" value={formatCompactCurrency(sentTotal)} sub={`${sent.length} awaiting`} href="/admin/revenue" />
        <KpiCard label="Overdue" value={formatCompactCurrency(overdueTotal)} sub={`${overdue.length} past due`} warn={overdueTotal > 0} href="/admin/revenue" />
        <KpiCard label="Draft" value={String(draft.length)} sub="not yet sent" />
      </div>

      <SectionDivider label="All Invoices" />
      <InvoicesPageClient invoices={all} />
    </div>
  );
}
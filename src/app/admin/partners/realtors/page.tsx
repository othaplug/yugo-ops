import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "../../components/BackButton";
import { formatCurrency } from "@/lib/format-currency";
import { REFERRAL_HUB_ORG_TYPES } from "@/lib/partner-type";
import { PageHeader } from "@/design-system/admin/layout";
import { KpiStrip } from "@/design-system/admin/dashboard";
import { ReferralPartnersOverviewHint } from "@/components/admin/ReferralPartnersOverviewHint";
import RealtorPartnersSection from "./RealtorPartnersSection";
import RealtorsTable from "./RealtorsTable";

export const metadata = { title: "Referral Partners" };

export default async function RealtorsPage() {
  const db = createAdminClient();
  const [refRes, orgRes, realtorsRes, movesRes, referralOrgRes] =
    await Promise.all([
      db
        .from("referrals")
        .select("*")
        .order("created_at", { ascending: false }),
      db.from("organizations").select("id, name"),
      db
        .from("realtors")
        .select("id, agent_name, email, brokerage, created_at")
        .order("agent_name"),
      db.from("moves").select("id, client_name"),
      db
        .from("organizations")
        .select("id, name, contact_name, email, type")
        .in("type", [...REFERRAL_HUB_ORG_TYPES])
        .order("name"),
    ]);
  const referrals = refRes.data ?? [];
  const orgs = orgRes.data ?? [];
  const realtors = realtorsRes.data ?? [];
  const moves = movesRes.data ?? [];

  const all = referrals || [];
  const clientNameToId: Record<string, string> = {};
  (orgs || []).forEach((o) => {
    if (o.name) clientNameToId[o.name] = o.id;
  });
  const clientNameToMoveId: Record<string, string> = {};
  moves.forEach((m: { id: string; client_name?: string }) => {
    if (m.client_name) clientNameToMoveId[m.client_name] = m.id;
  });
  const booked = all.filter(
    (r) => r.status === "booked" || r.status === "completed",
  ).length;
  const totalCommission = all.reduce(
    (s, r) => s + Number(r.commission || 0),
    0,
  );

  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const referralsThisMonth = all.filter((r) => {
    const d = r.created_at ? new Date(r.created_at) : null;
    return d && d >= thisMonthStart && d <= now;
  }).length;

  const bookedThisMonth = all.filter((r) => {
    if (r.status !== "booked" && r.status !== "completed") return false;
    const raw = (r as { updated_at?: string }).updated_at || r.created_at;
    const d = raw ? new Date(raw) : null;
    return (
      d != null && !Number.isNaN(d.getTime()) && d >= thisMonthStart && d <= now
    );
  }).length;

  const kpiTiles = [
    {
      id: "total",
      label: "Total referrals",
      value: String(all.length),
      hint: `${referralsThisMonth} this month`,
    },
    {
      id: "booked",
      label: "Booked",
      value: String(booked),
      hint: `${bookedThisMonth} this month`,
      valueClassName:
        booked > 0 ? "text-[var(--yu3-success)]" : "text-[var(--yu3-ink-muted)]",
    },
    {
      id: "commission",
      label: "Commission",
      value: formatCurrency(totalCommission),
      hint: "All time",
    },
    {
      id: "realtors",
      label: "Realtors",
      value: String(realtors.length),
      hint: "Partner agents",
    },
  ];

  return (
    <div className="w-full min-w-0 flex flex-col gap-6 py-1 animate-fade-up">
      <div>
        <BackButton
          label="Partners"
          href="/admin/partners"
          variant="v2"
          className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
        />
      </div>

      <PageHeader
        eyebrow="Partners"
        title={
          <span className="inline-flex items-center gap-2 flex-wrap">
            <span className="text-[var(--yu3-wine)]">Referral Partners</span>
            <ReferralPartnersOverviewHint
              ariaLabel="About referral partners vs service partners"
              iconSize={16}
              className="shrink-0"
            />
          </span>
        }
        description="Realtors, organizations, and partner agents sending leads into the pipeline."
      />

      <KpiStrip tiles={kpiTiles} columns={4} variant="grid" className="gap-3" />

      <RealtorPartnersSection partners={referralOrgRes.data ?? []} />

      <RealtorsTable
        referrals={all}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
        realtors={realtors}
      />
    </div>
  );
}

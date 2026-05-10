import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "@/app/admin/components/BackButton";
import { isPropertyManagementDeliveryVertical } from "@/lib/partner-type";
import PartnerBillingAdmin from "./PartnerBillingAdmin";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ partnerId: string }> }) {
  const { partnerId } = await params;
  const supabase = createAdminClient();
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", partnerId)
    .single();
  return { title: `${org?.name ?? "Partner"}, Billing` };
}

export default async function PartnerBillingPage({
  params,
}: {
  params: Promise<{ partnerId: string }>;
}) {
  const { partnerId } = await params;
  const supabase = createAdminClient();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, type, vertical, email, billing_email, billing_enabled, billing_anchor_day, billing_terms_days, payment_terms, billing_method")
    .eq("id", partnerId)
    .single();

  if (!org) notFound();

  const isPm = isPropertyManagementDeliveryVertical(
    String(org.vertical || org.type || ""),
  );

  if (isPm) {
    // PM orgs: fetch partner_invoices + aging
    const { data: invoices } = await supabase
      .from("partner_invoices")
      .select("*")
      .eq("organization_id", partnerId)
      .order("created_at", { ascending: false })
      .limit(48);

    // Attach move counts per invoice
    const ids = (invoices ?? []).map((i) => i.id);
    let moveCounts: Record<string, number> = {};
    if (ids.length > 0) {
      const { data: mvRows } = await supabase
        .from("moves")
        .select("invoice_id")
        .in("invoice_id", ids);
      for (const m of mvRows ?? []) {
        if (m.invoice_id) moveCounts[m.invoice_id] = (moveCounts[m.invoice_id] || 0) + 1;
      }
    }

    const invoicesWithCounts = (invoices ?? []).map((inv) => ({
      ...inv,
      move_count: moveCounts[inv.id] || 0,
    }));

    const today = new Date().toISOString().slice(0, 10);
    const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
    for (const inv of invoicesWithCounts) {
      if (!["sent", "overdue"].includes(inv.status)) continue;
      const outstanding = Number(inv.total_amount);
      const daysPast = Math.floor(
        (new Date(today).getTime() - new Date(inv.period_end).getTime()) / 86_400_000,
      );
      if (daysPast <= 0) aging.current += outstanding;
      else if (daysPast <= 30) aging.days30 += outstanding;
      else if (daysPast <= 60) aging.days60 += outstanding;
      else aging.days90 += outstanding;
    }

    return (
      <div className="w-full min-w-0 max-w-[min(900px,100%)] mx-auto py-5">
        <BackButton label="Back to Partner Health" fallback="/admin/partners/health" className="mb-4" />
        <PartnerBillingAdmin
          org={org}
          isPm
          invoices={invoicesWithCounts}
          statements={[]}
          aging={aging}
        />
      </div>
    );
  }

  // Delivery orgs: fetch partner_statements (existing behaviour)
  const { data: statements } = await supabase
    .from("partner_statements")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(48);

  const today = new Date().toISOString().slice(0, 10);
  const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
  for (const s of statements ?? []) {
    if (!["sent", "viewed", "overdue", "partial"].includes(s.status)) continue;
    const outstanding = Number(s.total) - Number(s.paid_amount || 0);
    const daysPast = Math.floor(
      (new Date(today).getTime() - new Date(s.due_date).getTime()) / 86400000,
    );
    if (daysPast <= 0) aging.current += outstanding;
    else if (daysPast <= 30) aging.days30 += outstanding;
    else if (daysPast <= 60) aging.days60 += outstanding;
    else aging.days90 += outstanding;
  }

  return (
    <div className="w-full min-w-0 max-w-[min(900px,100%)] mx-auto py-5">
      <BackButton label="Back to Partner Health" fallback="/admin/partners/health" className="mb-4" />
      <PartnerBillingAdmin
        org={org}
        isPm={false}
        invoices={[]}
        statements={statements ?? []}
        aging={aging}
      />
    </div>
  );
}

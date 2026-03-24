import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "@/app/admin/components/BackButton";
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
    .select("id, name, email, billing_email, payment_terms, billing_anchor_day, billing_method")
    .eq("id", partnerId)
    .single();

  if (!org) notFound();

  const { data: statements } = await supabase
    .from("partner_statements")
    .select("*")
    .eq("partner_id", partnerId)
    .order("created_at", { ascending: false })
    .limit(48);

  // Compute aging
  const today = new Date().toISOString().slice(0, 10);
  const aging = { current: 0, days30: 0, days60: 0, days90: 0 };
  for (const s of statements ?? []) {
    if (!["sent", "viewed", "overdue", "partial"].includes(s.status)) continue;
    const outstanding = Number(s.total) - Number(s.paid_amount || 0);
    const daysPast = Math.floor(
      (new Date(today).getTime() - new Date(s.due_date).getTime()) / 86400000
    );
    if (daysPast <= 0) aging.current += outstanding;
    else if (daysPast <= 30) aging.days30 += outstanding;
    else if (daysPast <= 60) aging.days60 += outstanding;
    else aging.days90 += outstanding;
  }

  return (
    <div className="max-w-[900px] mx-auto px-5 md:px-6 py-5">
      <BackButton label="Back to Partner Health" fallback="/admin/partners/health" className="mb-4" />
      <PartnerBillingAdmin org={org} statements={statements ?? []} aging={aging} />
    </div>
  );
}

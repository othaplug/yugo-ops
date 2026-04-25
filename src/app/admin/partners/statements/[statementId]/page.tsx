import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import BackButton from "@/app/admin/components/BackButton";
import PartnerStatementView from "./PartnerStatementView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner Statement" };

export default async function PartnerStatementPage({
  params,
}: {
  params: Promise<{ statementId: string }>;
}) {
  const { statementId } = await params;
  const supabase = createAdminClient();

  const { data: stmt } = await supabase
    .from("partner_statements")
    .select("*, organizations(id, name, email, billing_email, payment_terms, billing_anchor_day)")
    .eq("id", statementId)
    .single();

  if (!stmt) notFound();

  return (
    <div className="w-full min-w-0 max-w-[min(700px,100%)] mx-auto py-5">
      <BackButton label="Back" fallback="/admin/partners/health" className="mb-3" />
      <PartnerStatementView statement={stmt} />
    </div>
  );
}

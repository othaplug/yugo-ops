import { redirect, notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import PartnerStatementPayClient from "./PartnerStatementPayClient";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ statementId: string }>;
}) {
  const { statementId } = await params;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("partner_statements")
    .select("statement_number")
    .eq("id", statementId)
    .single();
  return { title: data?.statement_number ? `Pay ${data.statement_number}` : "Statement Payment" };
}

export default async function PartnerStatementPayPage({
  params,
}: {
  params: Promise<{ statementId: string }>;
}) {
  const { statementId } = await params;

  // Require partner login
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/partner/login?next=/partner/statements/${statementId}/pay`);
  }

  const { data: partnerRows } = await supabase
    .from("partner_users")
    .select("org_id")
    .eq("user_id", user.id);

  const orgIds = (partnerRows ?? []).map((r) => r.org_id).filter(Boolean);
  if (!orgIds.length) redirect("/partner/login?error=no_org");

  // Fetch statement — only if it belongs to this partner
  const admin = createAdminClient();
  const { data: statement } = await admin
    .from("partner_statements")
    .select("*, organizations(id, name, email, billing_email)")
    .eq("id", statementId)
    .in("partner_id", orgIds)
    .single();

  if (!statement) notFound();

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#FAF8F5" }}>
      <PartnerStatementPayClient statement={statement} />
    </div>
  );
}

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import PartnerInvoiceView from "./PartnerInvoiceView";

export const dynamic = "force-dynamic";
export const metadata = { title: "Partner Invoice" };

export default async function PartnerInvoicePage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  const supabase = createAdminClient();

  const { data: invoice } = await supabase
    .from("partner_invoices")
    .select("*")
    .eq("id", invoiceId)
    .maybeSingle();

  if (!invoice) notFound();

  const { data: org } = await supabase
    .from("organizations")
    .select("id, name, email, billing_email")
    .eq("id", invoice.organization_id)
    .maybeSingle();

  if (!org) notFound();

  const { data: moves } = await supabase
    .from("moves")
    .select("id, move_code, client_name, from_address, to_address, scheduled_date, completed_at, total_price, amount, estimate, move_size")
    .eq("invoice_id", invoiceId)
    .order("scheduled_date", { ascending: true });

  return (
    <div className="w-full min-w-0 max-w-[min(800px,100%)] mx-auto py-5">
      <PartnerInvoiceView
        invoice={invoice}
        org={org}
        moves={moves ?? []}
      />
    </div>
  );
}

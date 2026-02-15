import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ClientDetailClient from "./ClientDetailClient";

export default async function ClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = from === "retail" ? "/admin/partners/retail" : from === "designers" ? "/admin/partners/designers" : from === "hospitality" ? "/admin/partners/hospitality" : from === "gallery" ? "/admin/partners/gallery" : from === "realtors" ? "/admin/partners/realtors" : "/admin/clients";
  const supabase = await createClient();

  const { data: client } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", id)
    .single();

  if (!client) notFound();

  const { data: deliveries } = await supabase
    .from("deliveries")
    .select("*")
    .eq("client_name", client.name)
    .order("scheduled_date", { ascending: false })
    .limit(10);

  const { data: invoices } = await supabase
    .from("invoices")
    .select("*")
    .eq("client_name", client.name)
    .order("created_at", { ascending: false })
    .limit(10);

  const allInvoices = invoices || [];
  const outstandingInvoices = allInvoices.filter((i) => i.status === "sent" || i.status === "overdue");
  const outstandingTotal = outstandingInvoices.reduce((s, i) => s + Number(i.amount), 0);

  const partnerSince = client.created_at ? new Date(client.created_at) : null;
  const partnerDuration = partnerSince
    ? (() => {
        const now = new Date();
        const months = (now.getFullYear() - partnerSince.getFullYear()) * 12 + (now.getMonth() - partnerSince.getMonth());
        if (months < 1) return "Less than 1 month";
        if (months < 12) return `${months} month${months > 1 ? "s" : ""}`;
        const years = Math.floor(months / 12);
        return `${years} year${years > 1 ? "s" : ""}`;
      })()
    : null;

  return (
    <ClientDetailClient
      client={client}
      deliveries={deliveries || []}
      allInvoices={allInvoices}
      outstandingTotal={outstandingTotal}
      partnerSince={partnerSince}
      partnerDuration={partnerDuration}
      backHref={backHref}
    />
  );
}

import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Topbar from "../../components/Topbar";
import Badge from "../../components/Badge";
import Link from "next/link";

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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
    .limit(5);

  return (
    <>
      <Topbar title="Client Detail" subtitle={client.name} />
      <div className="max-w-[1200px] px-6 py-5">
        <Link href="/admin/clients" className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3">
          ← Back
        </Link>

        {/* Header */}
        <div className="mb-4">
          <div className="font-serif text-xl">{client.name}</div>
          <div className="text-[10px] text-[var(--tx3)]">{client.type} • {client.contact_name} • {client.email}</div>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Deliveries/Mo</div>
            <div className="text-lg font-bold font-serif">{client.deliveries_per_month}</div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Outstanding</div>
            <div className={`text-lg font-bold font-serif ${client.outstanding_balance > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
              {client.outstanding_balance > 0 ? `$${Number(client.outstanding_balance).toLocaleString()}` : "$0"}
            </div>
          </div>
          <div className="bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5">
            <div className="text-[8px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Health</div>
            <div className={`w-2.5 h-2.5 rounded-full mt-1 ${client.health === "good" ? "bg-[var(--grn)]" : "bg-[var(--org)]"}`} />
          </div>
        </div>

        {/* Recent Deliveries */}
        <h3 className="text-[13px] font-bold mb-2">Recent Deliveries</h3>
        <div className="flex flex-col gap-1 mb-4">
          {(deliveries || []).map((d) => (
            <Link
              key={d.id}
              href={`/admin/deliveries/${d.id}`}
              className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg hover:border-[var(--gold)] transition-all"
            >
              <div className="flex-1 min-w-0">
                <div className="text-[11px] font-semibold truncate">{d.customer_name}</div>
                <div className="text-[9px] text-[var(--tx3)]">{d.delivery_number} • {d.items?.length || 0} items</div>
              </div>
              <div className="text-[10px] text-[var(--tx3)]">{d.scheduled_date}</div>
              <Badge status={d.status} />
            </Link>
          ))}
          {(deliveries || []).length === 0 && (
            <div className="text-[10px] text-[var(--tx3)] py-4 text-center">No deliveries yet</div>
          )}
        </div>

        {/* Invoices */}
        <h3 className="text-[13px] font-bold mb-2">Invoices</h3>
        <div className="flex flex-col gap-1">
          {(invoices || []).map((inv) => (
            <div key={inv.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-[var(--card)] border border-[var(--brd)] rounded-lg">
              <div className="flex-1">
                <div className="text-[11px] font-semibold">{inv.invoice_number}</div>
                <div className="text-[9px] text-[var(--tx3)]">Due: {inv.due_date}</div>
              </div>
              <div className="text-[10px] font-bold">${Number(inv.amount).toLocaleString()}</div>
              <Badge status={inv.status} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
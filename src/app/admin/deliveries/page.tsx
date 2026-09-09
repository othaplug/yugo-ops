export const metadata = { title: "Jobs" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayString } from "@/lib/business-timezone";
import AllDeliveriesView from "./AllProjectsView";

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; schedule?: string }>;
}) {
  const db = createAdminClient();
  const today = getTodayString();
  const params = await searchParams;

  const [
    { data: deliveries },
    { data: projects },
    { data: partners },
    { data: invoiceRows },
  ] = await Promise.all([
    db.from("deliveries").select("*").order("created_at", { ascending: false }),
    db.from("projects").select("*, organizations:partner_id(name, type)").order("created_at", { ascending: false }),
    db.from("organizations").select("id, name, type").not("type", "eq", "b2c").order("name"),
    db.from("invoices").select("delivery_id, status").not("delivery_id", "is", null),
  ]);

  // Stamp invoice coverage onto each delivery so the Jobs list can gate the
  // bulk "Send invoices" action client-side (it can't join the invoices table
  // itself). One invoices row per delivery_id.
  const invoiceByDelivery = new Map<string, string | null>();
  for (const inv of invoiceRows || []) {
    if (inv.delivery_id) invoiceByDelivery.set(inv.delivery_id as string, (inv.status as string) ?? null);
  }
  const deliveriesWithInvoice = (deliveries || []).map((d) => ({
    ...d,
    has_invoice: invoiceByDelivery.has(d.id),
    invoice_status: invoiceByDelivery.get(d.id) ?? null,
  }));

  const initialView = params.view === "recurring" ? "recurring" : params.view === "projects" ? "projects" : undefined;

  return (
    <div className="w-full min-w-0 py-5 md:py-6 animate-fade-up">
      <AllDeliveriesView
        deliveries={deliveriesWithInvoice}
        projects={projects || []}
        partners={partners || []}
        today={today}
        initialView={initialView}
        initialScheduleId={params.schedule || undefined}
      />
    </div>
  );
}
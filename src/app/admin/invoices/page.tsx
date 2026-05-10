export const metadata = { title: "Invoices" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { createAdminClient } from "@/lib/supabase/admin";
import { formatCompactCurrency } from "@/lib/format-currency";
import { invoiceGrossForDisplay } from "@/lib/delivery-pricing";
import InvoicesV3Client from "./InvoicesV3Client";

export default async function InvoicesPage() {
  const db = createAdminClient();

  const withOrg = await db
    .from("invoices")
    .select(
      "*, organizations!organization_id(vertical, type), deliveries!delivery_id(delivery_number, final_price, calculated_price, override_price, admin_adjusted_price, total_price, quoted_price), moves!move_id(move_code)",
    )
    .order("created_at", { ascending: false });

  let invoices = withOrg.data;
  let loadError: string | null = null;
  let orgEmbedWarning: string | null = null;

  if (withOrg.error) {
    console.error(
      "[admin/invoices] query with organizations embed failed:",
      withOrg.error,
    );
    const plain = await db
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false });
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

  // Also surface partner_invoices (PM batched billing) — merged into the same list
  // so coordinators see every invoice in one place. Shape is normalized to match
  // the existing invoice row contract that InvoicesPageClient consumes.
  const partnerInvoicesRes = await db
    .from("partner_invoices")
    .select(
      "id, invoice_number, status, period_start, period_end, due_date, total_amount, notes, created_at, sent_at, paid_at, square_invoice_id, square_invoice_url, organization_id, organizations!organization_id(name, vertical, type)",
    )
    .order("created_at", { ascending: false });
  if (partnerInvoicesRes.error) {
    console.error(
      "[admin/invoices] partner_invoices query failed:",
      partnerInvoicesRes.error.message,
    );
  }
  for (const row of partnerInvoicesRes.data ?? []) {
    const orgEmbed = row.organizations as
      | { name?: string | null; vertical?: string | null; type?: string | null }
      | null
      | undefined;
    all.push({
      // Identity / display
      id: row.id,
      invoice_number: row.invoice_number,
      client_name: orgEmbed?.name ?? "Partner",
      organization_id: row.organization_id,
      organization: orgEmbed
        ? { vertical: orgEmbed.vertical ?? null, type: orgEmbed.type ?? null }
        : null,
      // Money + lifecycle (match the `invoices` table's contract: amount = subtotal)
      amount: row.total_amount,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.sent_at ?? row.created_at,
      paid_at: row.paid_at ?? null,
      sent_at: row.sent_at ?? null,
      due_date: row.due_date ?? null,
      // Discriminator + Square fields so the modal can deep-link properly
      kind: "partner_invoice",
      period_start: row.period_start,
      period_end: row.period_end,
      square_invoice_id: row.square_invoice_id ?? null,
      square_invoice_url: row.square_invoice_url ?? null,
      notes: row.notes ?? null,
      // Fields that don't apply to PM batches
      delivery_id: null,
      move_id: null,
      deliveries: null,
      moves: null,
    } as unknown as (typeof all)[number]);
  }
  all.sort((a, b) => {
    const av = String((a as { created_at?: string }).created_at ?? "");
    const bv = String((b as { created_at?: string }).created_at ?? "");
    return bv.localeCompare(av);
  });

  const paid = all.filter((i) => i.status === "paid");
  const sent = all.filter((i) => i.status === "sent");
  const overdue = all.filter((i) => i.status === "overdue");
  const draft = all.filter((i) => i.status === "draft");
  const sumGross = (rows: typeof all) =>
    rows.reduce((s, i) => s + invoiceGrossForDisplay(i), 0);
  const paidTotal = sumGross(paid);
  const sentTotal = sumGross(sent);
  const overdueTotal = sumGross(overdue);

  const kpis = [
    {
      id: "total",
      label: "Total",
      value: String(all.length),
      hint:
        draft.length > 0
          ? `${paid.length} paid · ${draft.length} ${draft.length === 1 ? "draft" : "drafts"}`
          : `${paid.length} paid`,
    },
    {
      id: "paid",
      label: "Paid",
      value: formatCompactCurrency(paidTotal),
      hint: `${paid.length} ${paid.length === 1 ? "invoice" : "invoices"} · incl. HST`,
    },
    {
      id: "sent",
      label: "Pending / Sent",
      value: formatCompactCurrency(sentTotal),
      hint: `${sent.length} awaiting · incl. HST`,
    },
    {
      id: "overdue",
      label: "Overdue",
      value: formatCompactCurrency(overdueTotal),
      hint: `${overdue.length} past due · incl. HST`,
    },
    {
      id: "draft",
      label: "Draft",
      value: String(draft.length),
      hint: "not yet sent",
    },
  ];

  return (
    <InvoicesV3Client
      invoices={all}
      kpis={kpis}
      loadError={loadError}
      orgEmbedWarning={orgEmbedWarning}
    />
  );
}

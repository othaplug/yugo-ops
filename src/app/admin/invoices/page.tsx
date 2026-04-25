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

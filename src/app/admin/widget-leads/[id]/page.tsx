export const metadata = { title: "Widget lead" };
export const dynamic = "force-dynamic";
export const revalidate = 0;

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import WidgetLeadDetailClient from "./WidgetLeadDetailClient";

export default async function WidgetLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = (await params).id?.trim();
  if (!id) notFound();

  const db = createAdminClient();
  const { data: row, error } = await db
    .from("quote_requests")
    .select(
      "id, lead_number, name, email, phone, move_size, from_postal, to_postal, move_date, flexible_date, widget_estimate_low, widget_estimate_high, status, created_at, estimate_factors, other_items, special_handling, quote_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (error || !row) notFound();

  let linkedQuoteSlug: string | null = null;
  if (row.quote_id) {
    const { data: qrow } = await db
      .from("quotes")
      .select("quote_id")
      .eq("id", row.quote_id)
      .maybeSingle();
    linkedQuoteSlug = qrow?.quote_id ?? null;
  }

  return (
    <WidgetLeadDetailClient lead={row} linkedQuoteSlug={linkedQuoteSlug} />
  );
}

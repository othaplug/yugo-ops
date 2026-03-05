import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import QuoteDetailClient from "./QuoteDetailClient";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export default async function QuoteDetailPage({ params }: Props) {
  const { quoteId } = await params;
  const db = createAdminClient();

  const { data: quote } = await db
    .from("quotes")
    .select("*, contacts:contact_id(id, name, email, phone)")
    .eq("quote_id", quoteId)
    .single();

  if (!quote) redirect("/admin/quotes");

  const { data: engagementRows } = await db
    .from("quote_engagement")
    .select("*")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true });

  const { data: legacyEvents } = await db
    .from("quote_events")
    .select("*")
    .eq("quote_id", quote.quote_id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-[1400px] mx-auto px-5 md:px-6 py-5 md:py-6">
      <QuoteDetailClient
        quote={quote}
        engagement={engagementRows ?? []}
        legacyEvents={legacyEvents ?? []}
      />
    </div>
  );
}

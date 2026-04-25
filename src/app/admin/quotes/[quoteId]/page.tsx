import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSuperAdminEmail } from "@/lib/super-admin";
import { redirect } from "next/navigation";
import QuoteDetailClient from "./QuoteDetailClient";
import { computeQuoteEngagementMetrics } from "@/lib/quotes/comparison-intelligence";
import { getQuotePaymentPipelineMode } from "@/lib/quotes/payment-pipeline-mode";
import {
  getOfflineDepositInclusiveFromQuote,
  getQuoteTotalWithTaxFromRow,
} from "@/app/quote/[quoteId]/quote-shared";
import { quoteRowEligibleForHubSpotDeal } from "@/lib/quotes/hubspot-quote-eligibility";

interface Props {
  params: Promise<{ quoteId: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { quoteId } = await params;
  return { title: `Quote ${quoteId}` };
}

export default async function QuoteDetailPage({ params }: Props) {
  const { quoteId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isSuperAdmin = isSuperAdminEmail(user?.email);

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

  const { count: followupsSentCount } = await db
    .from("quote_followups")
    .select("id", { count: "exact", head: true })
    .eq("quote_id", quote.id);

  const { data: maxFuRow } = await db
    .from("platform_config")
    .select("value")
    .eq("key", "followup_max_attempts")
    .maybeSingle();

  const followupMaxAttempts = Math.max(
    0,
    parseInt(maxFuRow?.value || "3", 10) || 3,
  );

  const engagementMetrics = await computeQuoteEngagementMetrics(
    db,
    quote.id,
    (quote as { sent_at?: string | null }).sent_at ?? null,
  );

  const paymentPipelineMode = await getQuotePaymentPipelineMode(
    quote.service_type as string | null,
  );
  const { totalWithTax } = getQuoteTotalWithTaxFromRow(quote);
  const offlineDepositAmount = getOfflineDepositInclusiveFromQuote(quote);

  const { data: linkedMoveRow } = await db
    .from("moves")
    .select("move_code")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: linkedDelRow } = await db
    .from("deliveries")
    .select("delivery_number")
    .eq("source_quote_id", quote.id)
    .maybeSingle();

  const hubspotDealId =
    typeof (quote as { hubspot_deal_id?: string | null }).hubspot_deal_id === "string"
      ? (quote as { hubspot_deal_id: string }).hubspot_deal_id.trim() || null
      : null;

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <QuoteDetailClient
        quote={quote}
        engagement={engagementRows ?? []}
        legacyEvents={legacyEvents ?? []}
        isSuperAdmin={isSuperAdmin}
        followupsSentCount={followupsSentCount ?? 0}
        followupMaxAttempts={followupMaxAttempts}
        engagementMetrics={engagementMetrics}
        paymentPipelineMode={paymentPipelineMode}
        offlineTotalWithTax={totalWithTax}
        offlineDepositAmount={offlineDepositAmount}
        linkedMoveCode={linkedMoveRow?.move_code ?? null}
        linkedDeliveryNumber={linkedDelRow?.delivery_number ?? null}
        hubspotDealId={hubspotDealId}
        hubspotEligible={quoteRowEligibleForHubSpotDeal(quote as Record<string, unknown>)}
      />
    </div>
  );
}

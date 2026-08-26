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

  // True when the quote stores tier-range pricing but no single tier has been confirmed.
  // This triggers the external booking flow instead of the standard offline payment modal.
  const tiers = quote.tiers as Record<string, { price: number }> | null;
  // A single-tier presentation (Estate only) showed the client just one tier,
  // so there is no range to "confirm" — don't fire the tier-not-confirmed
  // banner even though a full tiers object still exists on the row.
  const isSingleTierRender =
    String((quote as { presentation_mode?: string }).presentation_mode ?? "")
      .toLowerCase() === "estate_only";
  const hasTierRange =
    !!tiers &&
    Object.values(tiers).some((t) => t?.price > 0) &&
    !quote.selected_tier &&
    !quote.custom_price &&
    !isSingleTierRender;

  const { data: linkedMoveRow } = await db
    .from("moves")
    .select("move_code")
    .eq("quote_id", quote.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: scenariosData } = await db
    .from("quote_scenarios")
    .select("id, scenario_number, label, description, is_recommended, scenario_date, scenario_time, price, hst, total_price, deposit_amount, conditions_note, status, selected_at, created_at")
    .eq("quote_id", quote.id)
    .order("scenario_number");

  const { data: linkedDelRow } = await db
    .from("deliveries")
    .select("delivery_number")
    .eq("source_quote_id", quote.id)
    .maybeSingle();

  const hubspotDealId =
    typeof (quote as { hubspot_deal_id?: string | null }).hubspot_deal_id === "string"
      ? (quote as { hubspot_deal_id: string }).hubspot_deal_id.trim() || null
      : null;

  // Client history — makes the contact a real person on the quote page:
  // lifetime value + completed moves + other open quotes. Moves link to quotes
  // via quote_id, so we walk quotes(contact_id) -> moves(quote_id).
  let clientHistory = { lifetimeValue: 0, pastMoves: 0, openQuotes: 0 };
  const contactId = (quote as { contact_id?: string | null }).contact_id ?? null;
  if (contactId) {
    const { data: contactQuotes } = await db
      .from("quotes")
      .select("id, status")
      .eq("contact_id", contactId);
    const rows = contactQuotes ?? [];
    const openQuotes = rows.filter((q) =>
      ["draft", "sent", "viewed", "reactivated"].includes(String(q.status)),
    ).length;
    let lifetimeValue = 0;
    let pastMoves = 0;
    const quoteIds = rows.map((q) => q.id).filter(Boolean);
    if (quoteIds.length > 0) {
      const { data: contactMoves } = await db
        .from("moves")
        .select("total_price, amount, status")
        .in("quote_id", quoteIds);
      for (const m of contactMoves ?? []) {
        const done = [
          "completed",
          "job_complete",
          "paid",
          "delivered",
        ].includes(String((m as { status?: string }).status));
        if (done) {
          pastMoves += 1;
          lifetimeValue +=
            Number(
              (m as { total_price?: number; amount?: number }).total_price ??
                (m as { amount?: number }).amount ??
                0,
            ) || 0;
        }
      }
    }
    clientHistory = { lifetimeValue, pastMoves, openQuotes };
  }

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
        hasTierRange={hasTierRange}
        scenarios={scenariosData ?? []}
        acceptedScenarioId={(quote as { accepted_scenario_id?: string | null }).accepted_scenario_id ?? null}
        clientHistory={clientHistory}
      />
    </div>
  );
}

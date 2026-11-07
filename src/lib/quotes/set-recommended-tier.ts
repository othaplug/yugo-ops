import { SupabaseClient } from "@supabase/supabase-js";
import { quoteDealFinancials } from "@/lib/quotes/quote-headline-amount";
import {
  residentialTierDeposit,
  LONG_DISTANCE_DEPOSIT_PCT,
} from "@/lib/quotes/residential-deposit";
import { buildHubSpotDealName } from "@/lib/hubspot/deal-name";
import { buildAllDealProperties } from "@/lib/hubspot/deal-properties-builder";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";
import { getEmailBaseUrl } from "@/lib/email-base-url";

export type RecommendableTier = "essential" | "signature" | "estate" | "priority";

export type ApplyRecommendedTierResult =
  | { ok: true; recommended_tier: RecommendableTier; deposit_amount: number | null }
  | { ok: false; error: string; status: number };

const VALID_TIERS: RecommendableTier[] = ["essential", "signature", "estate", "priority"];

/**
 * Change which tier a tiered quote recommends, as a lightweight post-generate
 * edit (no reprice). The admin quote card had no control for this, so a
 * recommendation could only be set at generate time.
 *
 * Flipping `recommended_tier` already moves every surface that reads it live
 * (the Ops quotes-list figure, the client RECOMMENDED badge, quoteHeadlineAmount
 * / the hourly HubSpot self-heal). We additionally:
 *   - move the stored `deposit_amount` to the new tier (LD = 30%, residential =
 *     tier-aware policy) so the booking deposit matches the recommendation, and
 *   - patch the linked HubSpot deal's amount + name NOW rather than waiting on
 *     the hourly cron.
 *
 * Long-distance suppresses Essential, so Essential can never be recommended on
 * an LD quote.
 */
export async function applyRecommendedTier(
  sb: SupabaseClient,
  quoteId: string,
  tier: string,
): Promise<ApplyRecommendedTierResult> {
  const tk = String(tier || "").toLowerCase().trim() as RecommendableTier;
  if (!VALID_TIERS.includes(tk)) {
    return { ok: false, error: `Invalid tier "${tier}".`, status: 400 };
  }

  const { data: quote } = await sb
    .from("quotes")
    .select(
      "id, quote_id, service_type, tiers, custom_price, recommended_tier, deposit_amount, hubspot_deal_id, move_size, move_date, from_address, to_address, from_access, to_access, factors_applied, contacts:contact_id(name)",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (!quote) return { ok: false, error: `Quote ${quoteId} not found.`, status: 404 };

  const svc = String(quote.service_type ?? "");
  const tiers = (quote.tiers ?? {}) as Record<string, { price?: number } | undefined>;
  const tierPrice = Number(tiers[tk]?.price ?? NaN);
  if (!Number.isFinite(tierPrice) || tierPrice <= 0) {
    return {
      ok: false,
      error: `This quote has no ${tk} tier, so it cannot be recommended.`,
      status: 400,
    };
  }
  if (svc === "long_distance" && tk === "essential") {
    return {
      ok: false,
      error: "Long-distance quotes do not offer the Essential tier.",
      status: 400,
    };
  }

  // Deposit tracks the recommended tier. Only recompute for the tiered
  // residential engines whose deposit policy we know; leave others untouched.
  let depositAmount: number | null =
    typeof quote.deposit_amount === "number" ? quote.deposit_amount : null;
  if (svc === "long_distance") {
    depositAmount = Math.round(tierPrice * LONG_DISTANCE_DEPOSIT_PCT);
  } else if (svc === "local_move") {
    depositAmount = residentialTierDeposit(tk, tierPrice);
  }

  const update: Record<string, unknown> = { recommended_tier: tk };
  if (depositAmount != null) update.deposit_amount = depositAmount;

  const { error: upErr } = await sb.from("quotes").update(update).eq("quote_id", quoteId);
  if (upErr) return { ok: false, error: upErr.message, status: 500 };

  // Re-sync the linked HubSpot deal immediately (amount mirrors the Ops list
  // figure for the new recommended tier; name encodes the tier label).
  const dealId = quote.hubspot_deal_id as string | null;
  const hsToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (dealId && hsToken) {
    try {
      const contactRow = quote.contacts as { name?: string | null } | { name?: string | null }[] | null;
      const contactName = (Array.isArray(contactRow) ? contactRow[0]?.name : contactRow?.name) || "";
      const parts = String(contactName).trim().split(/\s+/);
      const firstName = parts[0] ?? "";
      const lastName = parts.slice(1).join(" ");
      const fac = (quote.factors_applied as { b2b_business_name?: string; business_name?: string } | null) ?? null;
      const businessName = fac?.b2b_business_name ?? fac?.business_name ?? undefined;

      // Recompute the deal amount from the UPDATED quote (recommended_tier = tk).
      const { amount } = quoteDealFinancials({
        ...(quote as Record<string, unknown>),
        recommended_tier: tk,
      } as Parameters<typeof quoteDealFinancials>[0]);

      const dealName = buildHubSpotDealName({
        serviceType: svc || undefined,
        isPmMove: false,
        firstName,
        lastName,
        businessName,
        tierLabel: tk,
        moveSize: quote.move_size ?? undefined,
        fromAddress: quote.from_address ?? undefined,
        fallbackCode: `Quote ${quoteId}`,
      });

      const props: Record<string, string> = {
        dealname: dealName,
        quote_url: `${getEmailBaseUrl()}/quote/${quoteId}`,
        ...buildAllDealProperties({
          jobId: quoteId,
          firstName,
          lastName,
          fromAddress: quote.from_address ?? undefined,
          toAddress: quote.to_address ?? undefined,
          fromAccess: quote.from_access ?? undefined,
          toAccess: quote.to_access ?? undefined,
          serviceType: svc || undefined,
          moveDate: quote.move_date ?? undefined,
          moveSize: quote.move_size ?? undefined,
          subtotal: typeof amount === "number" ? amount : null,
          tierSelected: tk,
          isPmMove: false,
          businessName,
        }),
      };
      if (typeof amount === "number") props.amount = String(amount);
      await safePatchDeal(hsToken, dealId, props);
    } catch {
      /* HubSpot resync is best-effort; the hourly cron self-heals the amount. */
    }
  }

  return { ok: true, recommended_tier: tk, deposit_amount: depositAmount };
}

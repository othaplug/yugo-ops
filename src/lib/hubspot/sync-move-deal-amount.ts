import { createAdminClient } from "@/lib/supabase/admin";
import { safePatchDeal } from "@/lib/hubspot/safe-deal-write";
import { movePreTaxAmount } from "@/lib/quotes/quote-headline-amount";

/**
 * Immediately push a booked move's CURRENT pre-tax amount to its HubSpot deal
 * so a re-price or extra charge shows up on the deal right away (not only on the
 * next hourly reconcile). Sets the main `amount` plus the secondary
 * sub_total/taxes/total_price props, all consistent (HST 13%).
 *
 * Re-reads the move from the DB, so call it AFTER the price update has
 * committed. Fire-and-forget: HubSpot outages must never block the charge.
 */
export async function syncMoveDealAmountNow(moveId: string): Promise<void> {
  const token = process.env.HUBSPOT_ACCESS_TOKEN;
  if (!token || !moveId) return;
  try {
    const sb = createAdminClient();
    const { data: m } = await sb
      .from("moves")
      .select("hubspot_deal_id, final_amount, total_price, estimate")
      .eq("id", moveId)
      .maybeSingle();
    const dealId = (m?.hubspot_deal_id as string | null | undefined)?.trim();
    if (!dealId) return;
    const preTax = movePreTaxAmount(m);
    if (preTax == null) return;
    const hst = Math.round(preTax * 0.13 * 100) / 100;
    await safePatchDeal(token, dealId, {
      amount: String(preTax),
      sub_total: String(preTax),
      taxes: String(hst),
      total_price: String(Math.round((preTax + hst) * 100) / 100),
    });
  } catch (e) {
    console.warn("[hubspot] syncMoveDealAmountNow failed:", e);
  }
}

import { getConfig } from "@/lib/config";

export type QuotePaymentPipelineMode = "deposit_then_balance" | "full_upfront";

type RuleBlock = { deposit_type?: string };

/**
 * Aligns with client quote page: `payment_rules_by_type` in platform_config.
 * `local_move` quotes use the `residential` block.
 */
export async function getQuotePaymentPipelineMode(
  serviceType: string | null | undefined,
): Promise<QuotePaymentPipelineMode> {
  const st = String(serviceType || "residential").toLowerCase();
  if (st === "bin_rental") return "full_upfront";

  const raw = await getConfig("payment_rules_by_type", "{}");
  try {
    const rules = JSON.parse(raw) as Record<string, RuleBlock>;
    const key = st === "local_move" ? "residential" : st;
    const block = rules[key];
    if (block?.deposit_type === "full_payment") return "full_upfront";
  } catch {
    /* ignore */
  }
  return "deposit_then_balance";
}

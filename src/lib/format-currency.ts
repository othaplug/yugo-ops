/**
 * Display money (old format): $1,234 or $1,234.50
 * - Comma thousands, decimals only when needed
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return "$0";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** HTML emails and receipts — always two decimals for alignment and trust. */
export function formatCurrencyEmail(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return "$0.00";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Compact format for dashboards: $1.8K, $25K, or full amount if under $1K
 */
export function formatCompactCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return "$0";
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}K`;
  return formatCurrency(n);
}

/**
 * Format for estimate/quote text inputs only: 1,234.00
 * - Comma thousands, always two decimals, no $
 */
export function formatNumberInput(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(String(value).replace(/,/g, "")) : Number(value);
  if (Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Parse "1,234.00" back to number */
export function parseNumberInput(s: string | null | undefined): number {
  if (!s || !String(s).trim()) return 0;
  const n = parseFloat(String(s).replace(/,/g, ""));
  return Number.isNaN(n) ? 0 : n;
}

/** Ontario HST (13%) — single source for receipts, invoices, and Square-facing totals */
export const ONTARIO_HST_RATE = 0.13;

/** Calculate HST amount from a pre-tax value */
export function calcHST(preTax: number | string | null | undefined): number {
  const n = typeof preTax === "string" ? parseFloat(preTax) : Number(preTax);
  if (Number.isNaN(n) || n <= 0) return 0;
  return Math.round(n * ONTARIO_HST_RATE * 100) / 100;
}

/**
 * Split a tax-inclusive total into pre-tax + HST components (Ontario 13%).
 * Use for job deposit/balance amounts: `moves.deposit_amount` and `moves.balance_amount` are stored tax-inclusive.
 */
export function splitOntarioTaxInclusive(inclusive: number | string | null | undefined): {
  preTax: number;
  hst: number;
  inclusive: number;
} {
  const raw = typeof inclusive === "string" ? parseFloat(inclusive) : Number(inclusive);
  const inc = Math.round(raw * 100) / 100;
  if (Number.isNaN(inc) || inc <= 0) {
    return { preTax: 0, hst: 0, inclusive: 0 };
  }
  const preTax = Math.round((inc / (1 + ONTARIO_HST_RATE)) * 100) / 100;
  const hst = Math.round((inc - preTax) * 100) / 100;
  return { preTax, hst, inclusive: inc };
}

/** Format price + HST line: "$1,234 + $160 HST" */
export function formatWithHST(preTax: number | string | null | undefined): string {
  const n = typeof preTax === "string" ? parseFloat(preTax) : Number(preTax);
  if (Number.isNaN(n) || n <= 0) return "$0";
  return `${formatCurrency(n)} + ${formatCurrency(calcHST(n))} HST`;
}

/** Format just the total with HST included: "$1,394" */
export function formatTotalWithHST(preTax: number | string | null | undefined): string {
  const n = typeof preTax === "string" ? parseFloat(preTax) : Number(preTax);
  if (Number.isNaN(n) || n <= 0) return "$0";
  return formatCurrency(n + calcHST(n));
}

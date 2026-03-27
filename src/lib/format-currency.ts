/**
 * Display money (old format): $1,234 or $1,234.50
 * - Comma thousands, decimals only when needed
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return "$0";
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
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

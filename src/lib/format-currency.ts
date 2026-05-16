/**
 * Display money: $1,234 — always rounds to nearest dollar.
 * Use formatCurrencyEmail for receipts/invoices that need exact cents.
 */
export function formatCurrency(value: number | string | null | undefined): string {
  const n = typeof value === "string" ? parseFloat(value) : Number(value);
  if (Number.isNaN(n)) return "$0";
  return `$${Math.round(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
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
 * Split a tax-inclusive **charge total** (e.g. a card receipt) into pre-tax + HST.
 * Quote and job subtotals use `ontarioHstBreakdownFromPreTax` / `contractTaxLines`
 * instead, do not use this to interpret a quoted subtotal.
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

const round2 = (n: number) => Math.round(n * 100) / 100

/**
 * Pre-tax + HST = total to collect (Ontario 13% on top of the subtotal).
 * Quote and move `estimate` is always the pre-tax subtotal; this is the correct
 * breakdown for job financials and ledger lines (not “backing HST out” of a total).
 */
export function ontarioHstBreakdownFromPreTax(
  preTax: number,
): { preTax: number; hst: number; inclusive: number } {
  const p = round2(
    typeof preTax === "string" ? parseFloat(preTax) : Number(preTax),
  )
  if (Number.isNaN(p) || p <= 0) {
    return { preTax: 0, hst: 0, inclusive: 0 }
  }
  const hst = calcHST(p)
  return { preTax: p, hst, inclusive: round2(p + hst) }
}

/**
 * Job contract display: `estimate` is pre-tax. `amount` is the full contract
 * total (subtotal + HST) when the row is well-formed. When `estimate` and
 * `amount` match (legacy duplicate), treat that number as pre-tax, not
 * tax-inclusive, and add HST on top.
 */
export function contractTaxLines(estimate: number, amount: number): {
  preTax: number
  hst: number
  inclusive: number
} {
  const est = round2(estimate)
  const amt = round2(amount)
  if (est > 0 && amt > est + 0.5) {
    return { preTax: est, hst: round2(amt - est), inclusive: amt }
  }
  if (est > 0 && (amt < 0.01 || Math.abs(amt - est) < 0.02)) {
    return ontarioHstBreakdownFromPreTax(est)
  }
  if (est > 0) {
    const hst = calcHST(est)
    return { preTax: est, hst, inclusive: round2(est + hst) }
  }
  if (amt > 0) {
    return splitOntarioTaxInclusive(amt)
  }
  return { preTax: 0, hst: 0, inclusive: 0 }
}

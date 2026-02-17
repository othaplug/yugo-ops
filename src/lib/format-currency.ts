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

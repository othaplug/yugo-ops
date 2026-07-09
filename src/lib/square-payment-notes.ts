import { serviceTypeDisplayLabel } from "@/lib/displayLabels";

/**
 * Square payment `note` becomes the visible line-item description on the
 * customer receipt (the "Custom Amount" row). Never put internal audit
 * language there — Erika's balance-recovery receipt was tagged
 * "Full-payment WG balance recovery (deposit-only leak fixed 2026-07-06)"
 * which was accurate for us and baffling for her. Route every
 * `payments.create` through this helper so client receipts always read
 * as informative service-context lines.
 */

export type PaymentNoteKind =
  | "deposit"
  | "balance"
  | "balance_auto"
  | "balance_manual"
  | "full_payment"
  | "tip"
  | "extras"
  | "recovery";

/** Short Jan 6 / Jul 10 style label; safe on any locale runtime. */
function formatDateShort(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const raw = String(dateStr).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  try {
    const d = new Date(`${raw}T12:00:00`);
    return d.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  } catch {
    return raw;
  }
}

function kindHeadline(kind: PaymentNoteKind): string {
  switch (kind) {
    case "deposit":
      return "Deposit payment";
    case "balance":
    case "balance_auto":
    case "balance_manual":
      return "Balance payment";
    case "full_payment":
      return "Payment";
    case "tip":
      return "Tip";
    case "extras":
      return "Additional items";
    case "recovery":
      return "Outstanding balance";
    default:
      return "Payment";
  }
}

/**
 * Build a customer-friendly Square payment note.
 *
 * Format: `<Kind> · <Service label> · <Date> · <Code>`
 * — sections that are missing collapse cleanly.
 *
 * Examples:
 *   "Balance payment · White Glove Delivery · Jul 10 · MV-30356"
 *   "Deposit payment · Local Move · Aug 3 · MV-30412"
 *   "Additional items · MV-30292"
 *
 * Square truncates at ~500 chars on the receipt — we stay well under.
 */
export function buildSquarePaymentNote(opts: {
  kind: PaymentNoteKind;
  code?: string | null;
  serviceType?: string | null;
  scheduledDate?: string | null;
  extra?: string | null;
}): string {
  const headline = kindHeadline(opts.kind);
  const svc = opts.serviceType
    ? serviceTypeDisplayLabel(opts.serviceType) || null
    : null;
  const date = formatDateShort(opts.scheduledDate);
  const code = (opts.code || "").trim();

  const parts: string[] = [headline];
  if (svc) parts.push(svc);
  if (date) parts.push(date);
  if (code) parts.push(code);
  if (opts.extra && opts.extra.trim()) parts.push(opts.extra.trim());
  return parts.join(" · ");
}

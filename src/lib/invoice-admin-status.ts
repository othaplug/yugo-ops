import { toTitleCase } from "@/lib/format-text";

/**
 * Finance invoice row status (not move timeline). Never use move getStatusLabel here:
 * it maps `paid` → "Scheduled" on purpose for moves.
 */
export function getInvoiceStatusLabel(status: string | null | undefined): string {
  if (!status) return "—";
  const k = status.toLowerCase().trim().replace(/\s+/g, "_");
  const map: Record<string, string> = {
    draft: "Draft",
    sent: "Sent",
    paid: "Paid",
    overdue: "Overdue",
    cancelled: "Cancelled",
    archived: "Archived",
    scheduled: "Sent",
    unpaid: "Sent",
    partially_paid: "Partially paid",
    payment_pending: "Pending",
  };
  if (map[k]) return map[k];
  return toTitleCase(status.replace(/_/g, " "));
}

/**
 * True when the invoice still represents receivable / open balance for finance KPIs.
 * Includes Square-style `scheduled` and `unpaid`, not only `sent` and `overdue`.
 * Excludes paid, cancelled, archived. Excludes `draft` (not yet issued).
 */
export function invoiceStatusIsOutstanding(
  status: string | null | undefined,
): boolean {
  const s = (status || "").toLowerCase().trim().replace(/\s+/g, "_");
  if (!s) return false;
  if (s === "paid" || s === "cancelled" || s === "archived") return false;
  if (s === "draft") return false;
  return true;
}

export function invoiceStatusBadgeClass(status: string | null | undefined): string {
  const k = (status || "").toLowerCase().trim();
  const colors: Record<string, string> = {
    draft: "text-[var(--tx3)]",
    sent: "text-blue-700 dark:text-sky-300",
    paid: "text-[var(--grn)]",
    overdue: "text-[var(--red)]",
    cancelled: "text-[var(--tx3)]",
    archived: "text-[var(--tx3)]",
    scheduled: "text-blue-700 dark:text-sky-300",
    unpaid: "text-blue-700 dark:text-sky-300",
    partially_paid: "text-[var(--accent-text)]",
    payment_pending: "text-[var(--accent-text)]",
  };
  return colors[k] ?? "text-[var(--tx)]";
}

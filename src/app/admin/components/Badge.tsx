import { getStatusLabel, MOVE_STATUS_COLORS_ADMIN } from "@/lib/move-status";
import { toTitleCase } from "@/lib/format-text";

/** Semantic text colors only — no fills or pill chrome */
const BADGE_COLORS: Record<string, string> = {
  done: "text-[var(--grn)]",
  transit: "text-[var(--org)]",
  wait: "text-[var(--gold)]",
  late: "text-[var(--red)]",
  installing: "text-[var(--org)]",
  staging: "text-blue-700 dark:text-sky-300",
  new: "text-[var(--gold)]",
  in_transit: "text-[var(--org)]",
  pending: "text-[var(--gold)]",
  scheduled: "text-blue-700 dark:text-sky-300",
  confirmed: "text-blue-700 dark:text-sky-300",
  dispatched: "text-[var(--org)]",
  "in-transit": "text-[var(--org)]",
  delivered: "text-[var(--grn)]",
  completed: "text-[var(--grn)]",
  paid: "text-[var(--grn)]",
  sent: "text-blue-700 dark:text-sky-300",
  overdue: "text-[var(--red)]",
  draft: "text-[var(--tx3)]",
  cancelled: "text-[var(--tx3)]",
  archived: "text-[var(--tx3)]",
  booked: "text-blue-700 dark:text-sky-300",
  lead: "text-[var(--gold)]",
  quoted: "text-[var(--org)]",
};

export default function Badge({ status }: { status: string }) {
  const key = status?.toLowerCase() || "";
  const moveStyle = MOVE_STATUS_COLORS_ADMIN[key];
  const colors = moveStyle ?? BADGE_COLORS[key] ?? BADGE_COLORS.pending;
  const moveLabel = getStatusLabel(status || null);
  const label =
    moveLabel !== "-" ? moveLabel : status ? toTitleCase(status) : "-";
  return (
    <span className={`inline-flex items-center dt-badge tracking-[0.04em] ${colors}`}>
      {label}
    </span>
  );
}

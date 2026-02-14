const BADGE_COLORS: Record<string, string> = {
  pending: "bg-[var(--gdim)] text-[var(--gold)]",
  scheduled: "bg-[var(--bldim)] text-[var(--blue)]",
  confirmed: "bg-[var(--bldim)] text-[var(--blue)]",
  dispatched: "bg-[var(--ordim)] text-[var(--org)]",
  "in-transit": "bg-[var(--ordim)] text-[var(--org)]",
  delivered: "bg-[var(--grdim)] text-[var(--grn)]",
  completed: "bg-[var(--grdim)] text-[var(--grn)]",
  paid: "bg-[var(--grdim)] text-[var(--grn)]",
  sent: "bg-[var(--bldim)] text-[var(--blue)]",
  overdue: "bg-[var(--rdim)] text-[var(--red)]",
  booked: "bg-[var(--bldim)] text-[var(--blue)]",
  lead: "bg-[var(--gdim)] text-[var(--gold)]",
  quoted: "bg-[var(--ordim)] text-[var(--org)]",
};

export default function Badge({ status }: { status: string }) {
  const colors = BADGE_COLORS[status] || BADGE_COLORS.pending;
  const label = status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ");
  return (
    <span className={`inline-flex items-center px-2 py-[3px] rounded-full text-[9px] font-bold ${colors}`}>
      {label}
    </span>
  );
}
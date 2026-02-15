const BADGE_COLORS: Record<string, string> = {
  // Project/vendor status (designer dashboard)
  done: "bg-[rgba(45,159,90,0.15)] text-[var(--grn)] border border-[var(--grn)]/30",
  transit: "bg-[rgba(212,138,41,0.12)] text-[var(--org)] border border-[var(--org)]/30",
  wait: "bg-[rgba(201,169,98,0.12)] text-[var(--gold)] border border-[var(--gold)]/30",
  late: "bg-[rgba(209,67,67,0.12)] text-[var(--red)] border border-[var(--red)]/30",
  // Exhibition status
  installing: "bg-[var(--ordim)] text-[var(--org)]",
  staging: "bg-[var(--bldim)] text-[var(--blue)]",
  // Standard statuses
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
  const colors = BADGE_COLORS[status?.toLowerCase()] || BADGE_COLORS.pending;
  const label = status ? status.charAt(0).toUpperCase() + status.slice(1).replace("-", " ") : "—";
  return (
    <span className={`inline-flex items-center px-2.5 py-[3px] rounded-full text-[9px] font-bold ${colors}`}>
      {label}
    </span>
  );
}
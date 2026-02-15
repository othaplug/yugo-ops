"use client";

import { useToast } from "../components/Toast";

export default function IntegrationButtons({
  status,
  label,
}: {
  status: string;
  label: string;
}) {
  const { toast } = useToast();
  return (
    <button
      onClick={() => toast(status === "connected" ? "Configure integration coming soon" : "Connect integration coming soon", "plug")}
      className="px-3 py-1.5 text-[11px] font-semibold rounded-lg border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all"
    >
      {label}
    </button>
  );
}

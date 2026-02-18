"use client";

import { useState } from "react";
import AddReferralModal from "./AddReferralModal";

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

export function AddReferralButton({ realtors = [], label = "Add Referral" }: { realtors?: Realtor[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all whitespace-nowrap"
      >
        {label}
      </button>
      <AddReferralModal open={open} onClose={() => setOpen(false)} realtors={realtors} />
    </>
  );
}

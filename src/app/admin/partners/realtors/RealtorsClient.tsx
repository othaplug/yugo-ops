"use client";

import { useState } from "react";
import AddReferralModal from "./AddReferralModal";

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

export function AddReferralButton({ realtors = [] }: { realtors?: Realtor[] }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all"
      >
        Add Referral
      </button>
      <AddReferralModal open={open} onClose={() => setOpen(false)} realtors={realtors} />
    </>
  );
}

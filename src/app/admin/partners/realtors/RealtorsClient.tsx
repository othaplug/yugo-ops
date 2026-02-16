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
        className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
      >
        + Add referral
      </button>
      <AddReferralModal open={open} onClose={() => setOpen(false)} realtors={realtors} />
    </>
  );
}

"use client";

import { useState } from "react";
import AddReferralModal from "./AddReferralModal";

export function AddReferralButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
      >
        + Add referral
      </button>
      <AddReferralModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

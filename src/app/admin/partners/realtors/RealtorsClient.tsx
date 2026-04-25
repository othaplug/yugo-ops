"use client";

import { useState } from "react";
import { Button } from "@/design-system/admin/primitives";
import AddReferralModal from "./AddReferralModal";
import AddRealtorModal from "./AddRealtorModal";

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

export function AddReferralButton({ realtors = [], label = "Add Referral" }: { realtors?: Realtor[]; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap"
      >
        {label}
      </Button>
      <AddReferralModal open={open} onClose={() => setOpen(false)} realtors={realtors} />
    </>
  );
}

export function AddRealtorButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() => setOpen(true)}
        className="whitespace-nowrap"
      >
        Add Realtor
      </Button>
      <AddRealtorModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

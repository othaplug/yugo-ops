"use client";

import { useState } from "react";
import Link from "next/link";
import AddRealtorModal from "./AddRealtorModal";
import { formatCurrency } from "@/lib/format-currency";

interface RealtorsMetricsProps {
  referralsCount: number;
  booked: number;
  totalCommission: number;
}

export default function RealtorsMetrics({ referralsCount, booked, totalCommission }: RealtorsMetricsProps) {
  const [addRealtorOpen, setAddRealtorOpen] = useState(false);

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Referrals</div>
          <div className="text-xl font-bold font-heading">{referralsCount}</div>
        </Link>
        <Link href="/admin/clients" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Booked</div>
          <div className="text-xl font-bold font-heading text-[var(--grn)]">{booked}</div>
        </Link>
        <Link href="/admin/revenue" className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all block">
          <div className="text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Commission</div>
          <div className="text-xl font-bold font-heading text-[var(--gold)]">{formatCurrency(totalCommission)}</div>
        </Link>
        <button
          type="button"
          onClick={() => setAddRealtorOpen(true)}
          className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4 hover:border-[var(--gold)] transition-all flex items-center justify-center"
        >
          <span className="text-[10px] font-semibold text-[var(--gold)]">+ Add Realtor</span>
        </button>
      </div>
      <AddRealtorModal open={addRealtorOpen} onClose={() => setAddRealtorOpen(false)} />
    </>
  );
}

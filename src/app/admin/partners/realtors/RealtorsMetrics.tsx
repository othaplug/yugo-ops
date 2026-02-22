"use client";

import { useState } from "react";
import AddRealtorModal from "./AddRealtorModal";
import { StatPctChange } from "../../components/StatPctChange";
import { formatCurrency } from "@/lib/format-currency";

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

interface RealtorsMetricsProps {
  referralsCount: number;
  booked: number;
  totalCommission: number;
  realtorsCount?: number;
  realtors?: Realtor[];
  referralsThisMonth?: number;
  referralsPrev?: number;
  bookedThisMonth?: number;
  bookedPrev?: number;
  commissionThisMonth?: number;
  commissionPrev?: number;
  realtorsPrev?: number;
}

export default function RealtorsMetrics({
  referralsCount,
  booked,
  totalCommission,
  realtorsCount = 0,
  referralsThisMonth,
  referralsPrev = 0,
  bookedThisMonth,
  bookedPrev = 0,
  commissionThisMonth,
  commissionPrev = 0,
  realtorsPrev = 0,
}: RealtorsMetricsProps) {
  const refCur = referralsThisMonth ?? referralsCount;
  const bookedCur = bookedThisMonth ?? booked;
  const commissionCur = commissionThisMonth ?? totalCommission;
  const [addRealtorOpen, setAddRealtorOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between gap-2 mb-4">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Referrals</h3>
        <button
          type="button"
          onClick={() => setAddRealtorOpen(true)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all whitespace-nowrap"
        >
          Add Realtor
        </button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6">
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Realtors</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{realtorsCount}</span>
            <StatPctChange current={realtorsCount} previous={realtorsPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Referrals</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--tx)]">{referralsCount}</span>
            <StatPctChange current={refCur} previous={referralsPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Booked</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--grn)]">{booked}</span>
            <StatPctChange current={bookedCur} previous={bookedPrev} />
          </div>
        </div>
        <div className="bg-[var(--card)] border border-[var(--brd)] rounded-lg p-4">
          <div className="text-[10px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">Commission</div>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-bold font-heading text-[var(--gold)]">{formatCurrency(totalCommission)}</span>
            <StatPctChange current={commissionCur} previous={commissionPrev} />
          </div>
        </div>
      </div>
      <AddRealtorModal open={addRealtorOpen} onClose={() => setAddRealtorOpen(false)} />
    </>
  );
}

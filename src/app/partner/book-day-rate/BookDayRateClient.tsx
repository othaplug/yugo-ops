"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import DeliveryDayForm from "@/components/delivery-day/DeliveryDayForm";

interface Props {
  orgId: string;
  orgType: string;
  defaultPickupAddress: string;
}

export default function BookDayRateClient({ orgId, orgType, defaultPickupAddress }: Props) {
  const router = useRouter();

  return (
    <div className="max-w-[640px] mx-auto px-4 sm:px-6 py-6 animate-fade-up">
      <div className="mb-6 flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
      </div>
      <h1 className="font-heading text-[22px] sm:text-[24px] font-bold text-[var(--tx)] mb-1">
        Book Day Rate
      </h1>
      <p className="text-[13px] text-[var(--tx3)] mb-6">
        Dedicated truck and crew for the day. Best for 4+ stops.
      </p>
      <DeliveryDayForm
        orgId={orgId}
        orgType={orgType}
        initialPickupAddress={defaultPickupAddress}
        onSuccess={() => router.push("/partner")}
        onBackToConfig={() => router.push("/partner")}
      />
    </div>
  );
}

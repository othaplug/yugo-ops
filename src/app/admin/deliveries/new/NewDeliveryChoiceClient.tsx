"use client";

import { useState } from "react";
import Link from "next/link";
import NewDeliveryForm from "./NewDeliveryForm";
import AdminDayRateForm from "./AdminDayRateForm";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
  phone?: string;
  default_pickup_address?: string | null;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

export default function NewDeliveryChoiceClient({
  organizations,
  crews,
}: {
  organizations: Org[];
  crews: Crew[];
}) {
  const [choice, setChoice] = useState<"single" | "day_rate" | null>(null);

  if (choice === "single") {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setChoice(null)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div className="mb-4" />
        <NewDeliveryForm organizations={organizations} crews={crews} />
      </div>
    );
  }

  if (choice === "day_rate") {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setChoice(null)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          Back
        </button>
        <div className="mb-4" />
        <AdminDayRateForm organizations={organizations} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/deliveries" className="text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          ← Deliveries
        </Link>
      </div>
      <p className="text-[13px] text-[var(--tx3)]">Choose how to create this delivery.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => setChoice("single")}
          className="text-left p-5 rounded-xl border-2 border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all bg-[var(--card)]"
        >
          <span className="text-[24px] mb-3 block" aria-hidden>📦</span>
          <h3 className="text-[15px] font-bold text-[var(--tx)] mb-1">Single Delivery</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-2">Per-delivery pricing from partner rate card</p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)]">Create →</span>
        </button>
        <button
          type="button"
          onClick={() => setChoice("day_rate")}
          className="text-left p-5 rounded-xl border-2 border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all bg-[var(--card)]"
        >
          <span className="text-[24px] mb-3 block" aria-hidden>📅</span>
          <h3 className="text-[15px] font-bold text-[var(--tx)] mb-1">Day Rate</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-2">Multi-stop day rate pricing</p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)]">Create →</span>
        </button>
      </div>
    </div>
  );
}

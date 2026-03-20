"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarBlank, Truck, Handshake } from "@phosphor-icons/react";
import NewDeliveryForm from "./NewDeliveryForm";
import AdminDayRateForm from "./AdminDayRateForm";
import B2BOneOffDeliveryForm from "./B2BOneOffDeliveryForm";

interface Org {
  id: string;
  name: string;
  type: string;
  vertical?: string | null;
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
  initialChoice,
}: {
  organizations: Org[];
  crews: Crew[];
  initialChoice?: string;
}) {
  const router = useRouter();
  const [choice, setChoice] = useState<"single" | "day_rate" | "b2b_oneoff" | null>(() => {
    if (initialChoice === "single" || initialChoice === "delivery") return "single";
    if (initialChoice === "day_rate") return "day_rate";
    if (initialChoice === "b2b_oneoff") return "b2b_oneoff";
    return null;
  });

  if (choice === "single") {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setChoice(null)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          <ArrowLeft size={14} weight="regular" className="text-current" />
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
          <ArrowLeft size={14} weight="regular" className="text-current" />
          Back
        </button>
        <div className="mb-4" />
        <AdminDayRateForm organizations={organizations} />
      </div>
    );
  }

  if (choice === "b2b_oneoff") {
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => setChoice(null)} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          <ArrowLeft size={14} weight="regular" className="text-current" />
          Back
        </button>
        <div className="mb-4" />
        <B2BOneOffDeliveryForm crews={crews} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button type="button" onClick={() => router.back()} className="text-[12px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors">
          ← Back
        </button>
      </div>
      <p className="text-[13px] text-[var(--tx3)]">Choose how to create this delivery.</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <button
          type="button"
          onClick={() => setChoice("single")}
          className="text-left p-5 rounded-xl border-2 border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all bg-[var(--card)]"
        >
          <span className="w-10 h-10 mb-3 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]" aria-hidden><Truck size={20} className="text-[var(--gold)]" /></span>
          <h3 className="text-[15px] font-bold text-[var(--tx)] mb-1">Single Delivery</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-2">Per-delivery pricing from partner rate card</p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)]">Create →</span>
        </button>
        <button
          type="button"
          onClick={() => setChoice("day_rate")}
          className="text-left p-5 rounded-xl border-2 border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all bg-[var(--card)]"
        >
          <span className="w-10 h-10 mb-3 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]" aria-hidden><CalendarBlank size={20} className="text-[var(--gold)]" /></span>
          <h3 className="text-[15px] font-bold text-[var(--tx)] mb-1">Day Rate</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-2">Multi-stop day rate pricing</p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)]">Create →</span>
        </button>
        <button
          type="button"
          onClick={() => setChoice("b2b_oneoff")}
          className="text-left p-5 rounded-xl border-2 border-[var(--brd)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all bg-[var(--card)]"
        >
          <span className="w-10 h-10 mb-3 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[var(--gold)]" aria-hidden><Handshake size={20} className="text-[var(--gold)]" /></span>
          <h3 className="text-[15px] font-bold text-[var(--tx)] mb-1">B2B One-Off</h3>
          <p className="text-[12px] text-[var(--tx3)] mb-2">One-time delivery from a business (no partner account)</p>
          <span className="inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--gold)]">Create →</span>
        </button>
      </div>
    </div>
  );
}

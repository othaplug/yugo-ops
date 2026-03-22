"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
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

  const backButton = (
    <button
      type="button"
      onClick={() => router.push("/admin/deliveries")}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--gold)] transition-colors"
    >
      <ArrowLeft size={14} weight="regular" className="text-current" />
      Back
    </button>
  );

  if (initialChoice === "day_rate") {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="mb-4" />
        <AdminDayRateForm organizations={organizations} />
      </div>
    );
  }

  if (initialChoice === "b2b_oneoff") {
    return (
      <div className="space-y-4">
        {backButton}
        <div className="mb-4" />
        <B2BOneOffDeliveryForm crews={crews} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {backButton}
      <div className="mb-4" />
      <NewDeliveryForm organizations={organizations} crews={crews} />
    </div>
  );
}

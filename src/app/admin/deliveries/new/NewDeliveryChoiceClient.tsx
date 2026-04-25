"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "@phosphor-icons/react";
import NewDeliveryForm from "./NewDeliveryForm";
import AdminDayRateForm from "./AdminDayRateForm";
import B2BOneOffDeliveryForm from "./B2BOneOffDeliveryForm";
import type { B2BVerticalOption } from "@/components/admin/b2b/B2BJobsDeliveryForm";

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
  verticals = [],
  initialChoice,
}: {
  organizations: Org[];
  crews: Crew[];
  verticals?: B2BVerticalOption[];
  initialChoice?: string;
}) {
  const router = useRouter();

  const backButton = (
    <button
      type="button"
      onClick={() => router.push("/admin/deliveries")}
      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--accent-text)] transition-colors"
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
        <B2BOneOffDeliveryForm organizations={organizations} crews={crews} verticals={verticals} />
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

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import BackButton from "../../components/BackButton";
import DeliveryDayForm from "@/components/delivery-day/DeliveryDayForm";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
  phone?: string;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

export default function NewDeliveryForm({ organizations, crews = [] }: { organizations: Org[]; crews?: Crew[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date") || "";
  const orgFromUrl = searchParams.get("org") || "";

  return (
    <>
      <div className="mb-4"><BackButton label="Back" /></div>
      <DeliveryDayForm
        mode="admin"
        orgId={orgFromUrl || undefined}
        organizations={organizations}
        crews={crews}
        initialDate={dateFromUrl}
        onSuccess={() => { router.push("/admin/deliveries"); router.refresh(); }}
      />
    </>
  );
}

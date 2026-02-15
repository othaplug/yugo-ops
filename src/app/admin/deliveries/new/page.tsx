import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import NewDeliveryForm from "./NewDeliveryForm";
export default async function NewDeliveryPage() {
  const supabase = await createClient();
  const { data: orgs } = await supabase
    .from("organizations")
    .select("id, name, type")
    .order("name");

  return (
    <>
      <Topbar title="New Delivery" subtitle="Create a delivery" />
      <div className="max-w-[600px] mx-auto px-4 md:px-6 py-5">
        <Link
          href="/admin/deliveries"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] mb-3"
        >
          ← Back
        </Link>
        <NewDeliveryForm organizations={orgs || []} />
    </div>
  );
}
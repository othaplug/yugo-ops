"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = ["pending", "scheduled", "confirmed", "dispatched", "in-transit", "delivered"];

export default function StatusUpdater({
  deliveryId,
  currentStatus,
}: {
  deliveryId: string;
  currentStatus: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const handleUpdate = async () => {
    const currentIndex = STATUSES.indexOf(currentStatus);
    const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];

    await supabase
      .from("deliveries")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", deliveryId);

    await supabase.from("status_events").insert({
      entity_type: "delivery",
      entity_id: deliveryId,
      event_type: "status_change",
      description: `Delivery updated to ${nextStatus}`,
      icon: nextStatus === "delivered" ? "✅" : "📦",
    });

    router.refresh();
  };

  return (
    <button
      onClick={handleUpdate}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all active:scale-[.97]"
    >
      {currentStatus === "delivered" ? "Reset" : "Update Status"}
    </button>
  );
}
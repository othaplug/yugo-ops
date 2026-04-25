"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const STATUSES = [
  "pending",
  "scheduled",
  "confirmed",
  "dispatched",
  "in-transit",
  "delivered",
];

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
      icon: nextStatus === "delivered" ? "check" : "truck",
    });

    router.refresh();
  };

  return (
    <button
      onClick={handleUpdate}
      className="admin-btn admin-btn-sm admin-btn-primary"
    >
      {currentStatus === "delivered" ? "Reset" : "Update Status"}
    </button>
  );
}

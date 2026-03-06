"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../../components/Toast";

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
  const { toast } = useToast();

  const handleUpdate = async () => {
    const currentIndex = STATUSES.indexOf(currentStatus);
    const nextStatus = STATUSES[(currentIndex + 1) % STATUSES.length];

    await supabase
      .from("deliveries")
      .update({ status: nextStatus, updated_at: new Date().toISOString() })
      .eq("id", deliveryId);

    // Log event
    await supabase.from("status_events").insert({
      entity_type: "delivery",
      entity_id: deliveryId,
      event_type: "status_change",
      description: `Delivery updated to ${nextStatus}`,
      icon: nextStatus === "delivered" ? "check" : "package",
    });

    // Auto-invoice on delivery
    if (nextStatus === "delivered") {
      const { data: del } = await supabase
        .from("deliveries")
        .select("client_name, customer_name, items")
        .eq("id", deliveryId)
        .single();

      if (del) {
        const amount = (del.items?.length || 1) * 250; // $250 per item estimate
        await supabase.from("invoices").insert({
          invoice_number: `INV-${Math.floor(Math.random() * 9000) + 1000}`,
          client_name: del.client_name,
          amount,
          status: "sent",
          due_date: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          line_items: JSON.stringify([
            { d: "White-glove delivery", q: del.items?.length || 1, r: 250 },
          ]),
        });

        toast(`Auto-invoice generated: $${amount}`, "dollar");
      }
    }

    toast(`Status: ${nextStatus}`, nextStatus === "delivered" ? "check" : "package");
    router.refresh();
  };

  return (
    <button
      onClick={handleUpdate}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all active:scale-[.97]"
    >
      {currentStatus === "delivered" ? "Reset" : "Update Status"}
    </button>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvoiceActions({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: string;
}) {
  const router = useRouter();
  const supabase = createClient();

  const markPaid = async () => {
    await supabase
      .from("invoices")
      .update({ status: "paid", updated_at: new Date().toISOString() })
      .eq("id", invoiceId);

    router.refresh();
  };

  if (status === "paid") return null;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        markPaid();
      }}
      className="admin-btn admin-btn-sm admin-btn-secondary"
    >
      Mark Paid
    </button>
  );
}
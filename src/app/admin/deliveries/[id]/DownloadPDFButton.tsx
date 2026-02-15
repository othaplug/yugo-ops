"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function DownloadPDFButton({ delivery }: { delivery: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setLoading(true);
    const text = [
      `YUGO DELIVERY CONFIRMATION`,
      ``,
      `Delivery: ${delivery.delivery_number}`,
      `Customer: ${delivery.customer_name}`,
      `Status: ${delivery.status}`,
      `Date: ${delivery.scheduled_date}`,
      `Pickup: ${delivery.pickup_address}`,
      `Delivery: ${delivery.delivery_address}`,
      `Items: ${(delivery.items || []).join(", ")}`,
      `Instructions: ${delivery.instructions || "None"}`,
      ``,
      `--- Yugo Luxury Transport & Logistics ---`,
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${delivery.delivery_number || "delivery"}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast("Delivery summary downloaded", "file");
    setLoading(false);
  };

  return (
    <button 
      onClick={handleDownload} 
      disabled={loading}
      className="px-4 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-all disabled:opacity-50"
    >
      {loading ? "Generating..." : "Download"}
    </button>
  );
}
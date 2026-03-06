"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function GenerateInvoiceButton({ delivery }: { delivery: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: delivery.client_name || delivery.customer_name,
          amount: delivery.quoted_price || 500,
          items: (delivery.items || []).map((item: string) => ({ 
            d: item, 
            q: 1, 
            r: (delivery.quoted_price || 500) / (delivery.items?.length || 1) 
          })),
          dueDate: new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0],
          deliveryId: delivery.id,
        }),
      });
      const data = await res.json();
      if (data.ok) toast(`Invoice ${data.invoice.invoice_number} created`, "dollar");
      else toast("Error: " + data.error, "x");
    } catch { 
      toast("Failed to create invoice", "x"); 
    }
    setLoading(false);
  };

  return (
    <button 
      onClick={handleGenerate} 
      disabled={loading}
      className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
    >
      {loading ? "Creating..." : "Generate Invoice"}
    </button>
  );
}
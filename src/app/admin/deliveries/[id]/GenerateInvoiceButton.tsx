"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";

export default function GenerateInvoiceButton({
  delivery,
  onGenerated,
}: {
  delivery: any;
  onGenerated?: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/invoices/auto-delivery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliveryId: delivery.id }),
      });
      const data = await res.json();
      if (data.id || data.invoiceNumber) {
        toast(
          `Invoice ${data.invoiceNumber || "created"} generated via Square`,
          "dollar",
        );
        onGenerated?.();
      } else if (data.message === "Invoice already exists") {
        toast("Invoice already exists for this delivery", "x");
        onGenerated?.();
      } else {
        toast("Error: " + (data.error || "Failed to create"), "x");
      }
    } catch {
      toast("Failed to create invoice", "x");
    }
    setLoading(false);
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading}
      className="admin-btn admin-btn-primary"
    >
      {loading ? "Creating…" : "Generate Invoice"}
    </button>
  );
}

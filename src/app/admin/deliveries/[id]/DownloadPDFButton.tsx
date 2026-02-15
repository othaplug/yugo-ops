"use client";

import { useState } from "react";
import { useToast } from "../../components/Toast";
import { generateDeliveryPDF } from "@/lib/pdf";

export default function DownloadPDFButton({ delivery }: { delivery: any }) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDownload = () => {
    setLoading(true);
    const doc = generateDeliveryPDF(delivery);
    doc.save(`${delivery.delivery_number || "project"}.pdf`);
    toast("Project PDF downloaded", "file");
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
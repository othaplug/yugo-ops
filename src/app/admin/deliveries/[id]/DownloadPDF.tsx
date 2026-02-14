"use client";

import { generateDeliveryPDF } from "@/lib/pdf";

export default function DownloadPDF({ delivery }: { delivery: any }) {
  const handleDownload = () => {
    const doc = generateDeliveryPDF(delivery);
    doc.save(`${delivery.delivery_number}.pdf`);
  };

  return (
    <button
      onClick={handleDownload}
      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all"
    >
      Download PDF
    </button>
  );
}
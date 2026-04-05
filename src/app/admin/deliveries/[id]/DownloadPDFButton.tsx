"use client";

import { useState } from "react";
import { DownloadSimple } from "@phosphor-icons/react";
import { useToast } from "../../components/Toast";
import { generateDeliveryPDF } from "@/lib/pdf";

export default function DownloadPDFButton({
  delivery,
  className,
}: {
  delivery: any;
  /** Must match sibling header actions (Edit, Delete) for one toolbar row. */
  className: string;
}) {
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
    <button type="button" onClick={handleDownload} disabled={loading} className={className}>
      <DownloadSimple weight="regular" className="w-3 h-3 shrink-0" aria-hidden />
      {loading ? "Generating…" : "Download"}
    </button>
  );
}
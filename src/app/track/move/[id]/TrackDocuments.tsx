"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { SafeText } from "@/components/SafeText";

type DocItem = {
  id: string;
  type: string;
  title: string;
  amount?: number;
  status?: string;
  due_date?: string;
  view_url?: string | null;
  external_url?: string | null;
  created_at?: string;
};

export default function TrackDocuments({
  moveId,
  token,
  refreshTrigger,
}: {
  moveId: string;
  token: string;
  refreshTrigger?: boolean;
}) {
  const [invoices, setInvoices] = useState<DocItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [squareReceiptUrl, setSquareReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/track/moves/${moveId}/documents?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setInvoices(data.invoices ?? []);
        setDocuments(data.documents ?? []);
        setSquareReceiptUrl(data.square_receipt_url ?? null);
      })
      .catch(() => {
        if (!cancelled) { setInvoices([]); setDocuments([]); setSquareReceiptUrl(null); }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId, token, refreshTrigger]);

  // Client view: exclude invoices — client sees only Move Summary + Payment Receipt
  const allDocs = [
    ...invoices.map((d) => ({ ...d, isInvoice: true })),
    ...documents.map((d) => ({
      ...d,
      isInvoice: d.type === "invoice",
      status: d.title?.startsWith("Payment Receipt") ? "paid" : d.status,
    })),
  ].filter(
    (doc) =>
      doc.type !== "invoice" &&
      !doc.title?.includes("Invoice -") &&
      !doc.title?.toLowerCase().includes("invoice ")
  );

  if (loading) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[var(--text-base)] font-bold text-[#1A1A1A] mb-4">Documents</h3>
        <p className="text-[12px] text-[#454545]">Loading...</p>
      </div>
    );
  }

  if (allDocs.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5">
        <h3 className="text-[var(--text-base)] font-bold text-[#1A1A1A] mb-4">Documents</h3>
        <p className="text-[12px] text-[#454545]">No documents yet. Contracts, invoices, and other documents will appear here as your move progresses.</p>
      </div>
    );
  }

  const hasAutoPdfs = allDocs.some(
    (d) =>
      d.title?.includes("Move Summary") ||
      d.title?.includes("Payment Receipt")
  );

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E7E5E4]">
        <h3 className="text-[var(--text-base)] font-bold text-[#1A1A1A]">Your documents</h3>
        {hasAutoPdfs && (
          <p className="text-[12px] text-[#454545] mt-1">
            Your move summary and receipt are ready to download below.
          </p>
        )}
      </div>
      <div className="p-5 space-y-2">
        {squareReceiptUrl && (
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-4 py-3 hover:border-[#C9A962]/50 transition-colors">
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-medium text-[#1A1A1A]">Payment Receipt (Square)</div>
              <div className="text-[11px] text-[#454545] flex items-center gap-2 mt-0.5">
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold capitalize bg-[#22C55E]/15 text-[#22C55E]">PAID</span>
                Official payment processor receipt
              </div>
            </div>
            <a
              href={squareReceiptUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-[#C9A962] text-[var(--btn-text-on-accent)] hover:bg-[#B89A52] transition-colors"
            >
              View Receipt
            </a>
          </div>
        )}
        {allDocs.map((doc) => {
          const url = doc.view_url ?? doc.external_url;
          const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : doc.due_date || "";
          const isPaid = doc.status === "paid" || doc.title?.startsWith("Payment Receipt");
          const isSent = doc.status === "sent" || (doc.status === "paid" && !doc.title?.startsWith("Payment Receipt"));
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-4 py-3 hover:border-[#C9A962]/50 transition-colors"
            >
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-medium text-[#1A1A1A] truncate">
                  <SafeText fallback="Document">{doc.title}</SafeText>
                </div>
                <div className="text-[11px] text-[#454545] flex items-center gap-2 mt-0.5">
                  {dateStr}
                  {doc.amount != null && ` • ${formatCurrency(doc.amount)}`}
                  {isPaid && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold capitalize bg-[#22C55E]/15 text-[#22C55E]">
                      PAID
                    </span>
                  )}
                  {isSent && !isPaid && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold capitalize bg-[#4A7CE5]/15 text-[#4A7CE5]">
                      SENT
                    </span>
                  )}
                </div>
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-[#C9A962] text-[var(--btn-text-on-accent)] hover:bg-[#B89A52] transition-colors"
                >
                  Download
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

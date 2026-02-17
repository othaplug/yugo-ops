"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/AppIcons";

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

export default function TrackDocuments({ moveId, token }: { moveId: string; token: string }) {
  const [invoices, setInvoices] = useState<DocItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
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
      })
      .catch(() => {
        if (!cancelled) setInvoices([]); setDocuments([]);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [moveId, token]);

  const allDocs = [
    ...invoices.map((d) => ({ ...d, isInvoice: true })),
    ...documents.map((d) => ({ ...d, isInvoice: false })),
  ];

  if (loading) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
        <p className="text-[12px] text-[#666]">Loading...</p>
      </div>
    );
  }

  if (allDocs.length === 0) {
    return (
      <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2 mb-4">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
        <p className="text-[12px] text-[#666]">No documents yet. Contracts, invoices, and other documents will appear here as your move progresses.</p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
      <div className="px-5 py-4 border-b border-[#E7E5E4]">
        <h3 className="text-[14px] font-bold text-[#1A1A1A] flex items-center gap-2">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
      </div>
      <div className="p-5 space-y-2">
        {allDocs.map((doc) => {
          const url = doc.view_url ?? doc.external_url;
          const dateStr = doc.created_at ? new Date(doc.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : doc.due_date || "";
          const isSent = doc.status === "sent" || doc.status === "paid";
          return (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-4 py-3 hover:border-[#C9A962]/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-lg bg-[#E7E5E4] flex items-center justify-center shrink-0">
                  <Icon name="fileText" className="w-5 h-5 text-[#999]" />
                </div>
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#1A1A1A] truncate">{doc.title}</div>
                  <div className="text-[11px] text-[#666] flex items-center gap-2">
                    {dateStr}
                    {doc.amount != null && ` • $${Number(doc.amount).toLocaleString()}`}
                    {isSent && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-[#4A7CE5]/15 text-[#4A7CE5]">
                        SENT
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {url && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold bg-[#C9A962] text-white hover:bg-[#B89A52] transition-colors"
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

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

  const hasAny = invoices.length > 0 || documents.length > 0;

  if (loading) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">Loading...</p>
      </div>
    );
  }

  if (!hasAny) {
    return (
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] flex items-center gap-2 mb-4">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
        <p className="text-[12px] text-[var(--tx2)]">No documents yet. Contracts, invoices, and other documents will appear here as your move progresses.</p>
      </div>
    );
  }

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--brd)]">
        <h3 className="text-[14px] font-bold text-[var(--tx)] flex items-center gap-2">
          <Icon name="fileText" className="w-[12px] h-[12px]" />
          Documents
        </h3>
      </div>
      <div className="p-5 space-y-3">
        {invoices.length > 0 && (
          <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] overflow-hidden">
            <div className="border-b border-[var(--brd)] bg-[var(--gdim)] px-4 py-2.5">
              <h4 className="text-[12px] font-bold text-[var(--gold)]">Invoices</h4>
            </div>
            <ul className="divide-y divide-[var(--brd)]">
              {invoices.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-[12px] font-medium text-[var(--tx)]">{doc.title}</div>
                    <div className="text-[10px] text-[var(--tx3)]">
                      {doc.amount != null && `$${Number(doc.amount).toLocaleString()}`}
                      {doc.due_date && ` • Due ${doc.due_date}`}
                      {doc.status && ` • ${doc.status}`}
                    </div>
                  </div>
                  <span className="text-[10px] text-[var(--tx3)] shrink-0">
                    {doc.status === "paid" ? "Paid" : "Pending"}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {documents.length > 0 && (
          <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] overflow-hidden">
            <div className="border-b border-[var(--brd)] bg-[var(--gdim)] px-4 py-2.5">
              <h4 className="text-[12px] font-bold text-[var(--gold)]">Other Documents</h4>
            </div>
            <ul className="divide-y divide-[var(--brd)]">
              {documents.map((doc) => (
                <li key={doc.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <div className="text-[12px] font-medium text-[var(--tx)]">{doc.title}</div>
                    <div className="text-[10px] text-[var(--tx3)] capitalize">{doc.type}</div>
                  </div>
                  {(doc.view_url ?? doc.external_url) ? (
                    <a
                      href={doc.view_url ?? doc.external_url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
                    >
                      Download
                    </a>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

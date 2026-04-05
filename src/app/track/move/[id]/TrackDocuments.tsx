"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/format-currency";
import { SafeText } from "@/components/SafeText";
import { WINE, FOREST, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";
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

function Shell({
  embedded,
  header,
  children,
  bodyClassName = "px-5 py-5",
}: {
  embedded?: boolean;
  header: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
}) {
  const inner = (
    <>
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: `${FOREST}10` }}
      >
        {header}
      </div>
      <div className={bodyClassName}>{children}</div>
    </>
  );
  if (embedded) return inner;
  return (
    <div
      className="bg-white overflow-hidden border"
      style={{ borderColor: `${FOREST}14` }}
    >
      {inner}
    </div>
  );
}

export default function TrackDocuments({
  moveId,
  token,
  refreshTrigger,
  embedded = false,
}: {
  moveId: string;
  token: string;
  refreshTrigger?: boolean;
  embedded?: boolean;
}) {
  const [invoices, setInvoices] = useState<DocItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [squareReceiptUrl, setSquareReceiptUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(
      `/api/track/moves/${moveId}/documents?token=${encodeURIComponent(token)}`,
    )
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setInvoices(data.invoices ?? []);
        setDocuments(data.documents ?? []);
        setSquareReceiptUrl(data.square_receipt_url ?? null);
      })
      .catch(() => {
        if (!cancelled) {
          setInvoices([]);
          setDocuments([]);
          setSquareReceiptUrl(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [moveId, token, refreshTrigger]);

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
      !doc.title?.toLowerCase().includes("invoice "),
  );

  const headerDocuments = (
    <h2
      className="font-hero text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight"
      style={{ color: WINE }}
    >
      Documents
    </h2>
  );

  if (loading) {
    return (
      <Shell embedded={embedded} header={headerDocuments}>
        <p
          className="text-[13px] text-center"
          style={{ color: TEXT_MUTED_ON_LIGHT }}
        >
          Loading…
        </p>
      </Shell>
    );
  }

  if (allDocs.length === 0) {
    return (
      <Shell embedded={embedded} header={headerDocuments}>
        <p
          className="text-[13px] leading-relaxed text-center max-w-[320px] mx-auto"
          style={{ color: TEXT_MUTED_ON_LIGHT }}
        >
          No documents yet. Contracts, invoices, and other documents will
          appear here as your move progresses.
        </p>
      </Shell>
    );
  }

  const hasAutoPdfs = allDocs.some(
    (d) =>
      d.title?.includes("Move Summary") ||
      d.title?.includes("Payment Receipt"),
  );

  const headerYourDocs = (
    <>
      <h2
        className="font-hero text-[22px] sm:text-[24px] font-semibold leading-tight tracking-tight"
        style={{ color: WINE }}
      >
        Documents
      </h2>
      {hasAutoPdfs && (
        <p
          className="text-[12px] mt-1.5"
          style={{ color: TEXT_MUTED_ON_LIGHT }}
        >
          Your move summary and receipt are ready to download below.
        </p>
      )}
    </>
  );

  const listBody = (
    <>
      {squareReceiptUrl && (
        <div
          className="flex items-center justify-between gap-4 border border-solid px-4 py-3 transition-opacity hover:opacity-90"
          style={{
            borderColor: `${FOREST}16`,
            backgroundColor: `${FOREST}04`,
          }}
        >
          <div className="min-w-0 flex-1">
            <div
              className="text-[14px] font-medium truncate"
              style={{ color: FOREST }}
            >
              Payment Receipt (Square)
            </div>
            <div
              className="text-[12px] flex items-center gap-2 mt-0.5 flex-wrap"
              style={{ color: TEXT_MUTED_ON_LIGHT }}
            >
              <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#22C55E]/15 text-[#16A34A]">
                Paid
              </span>
              Official payment processor receipt
            </div>
          </div>
          <a
            href={squareReceiptUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90"
            style={{
              backgroundColor: FOREST,
              color: "#F9EDE4",
            }}
          >
            View receipt
          </a>
        </div>
      )}
      {allDocs.map((doc) => {
        const url = doc.view_url ?? doc.external_url;
        const dateStr = doc.created_at
          ? new Date(doc.created_at).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })
          : doc.due_date || "";
        const isPaid =
          doc.status === "paid" || doc.title?.startsWith("Payment Receipt");
        const isSent =
          doc.status === "sent" ||
          (doc.status === "paid" &&
            !doc.title?.startsWith("Payment Receipt"));
        return (
          <div
            key={doc.id}
            className="flex items-center justify-between gap-4 border border-solid px-4 py-3 transition-opacity hover:opacity-90"
            style={{
              borderColor: `${FOREST}16`,
              backgroundColor: `${FOREST}04`,
            }}
          >
            <div className="min-w-0 flex-1">
              <div
                className="text-[14px] font-medium truncate"
                style={{ color: FOREST }}
              >
                <SafeText fallback="Document">{doc.title}</SafeText>
              </div>
              <div
                className="text-[12px] flex items-center gap-2 mt-0.5 flex-wrap"
                style={{ color: TEXT_MUTED_ON_LIGHT }}
              >
                {dateStr}
                {doc.amount != null && ` · ${formatCurrency(doc.amount)}`}
                {isPaid && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#22C55E]/15 text-[#16A34A]">
                    Paid
                  </span>
                )}
                {isSent && !isPaid && (
                  <span className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide bg-[#4A7CE5]/15 text-[#2563EB]">
                    Sent
                  </span>
                )}
              </div>
            </div>
            {url && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 px-3 py-1.5 text-[11px] font-bold uppercase tracking-widest transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: FOREST,
                  color: "#F9EDE4",
                }}
              >
                Download
              </a>
            )}
          </div>
        );
      })}
    </>
  );

  return (
    <Shell
      embedded={embedded}
      header={headerYourDocs}
      bodyClassName="p-5 space-y-2"
    >
      {listBody}
    </Shell>
  );
}

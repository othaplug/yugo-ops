"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { getInvoiceStatusLabel, invoiceStatusBadgeClass } from "@/lib/invoice-admin-status";
import ModalOverlay from "../components/ModalOverlay";
import { useToast } from "../components/Toast";
import { getDeliveryDetailPath } from "@/lib/move-code";
import { ArrowSquareOut, FileText } from "@phosphor-icons/react";

const STATUS_OPTIONS = ["sent", "overdue", "paid", "cancelled"];

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  overdue: "Overdue",
  paid: "Paid",
  cancelled: "Cancelled",
  archived: "Archived",
};

interface LineItem {
  d?: string;
  description?: string;
  q?: number;
  quantity?: number;
  r?: number;
  rate?: number;
}

interface AdminInvoiceDetailModalProps {
  open: boolean;
  onClose: () => void;
  invoice: {
    id: string;
    invoice_number?: string;
    client_name?: string;
    amount?: number;
    due_date?: string;
    status: string;
    file_path?: string | null;
    delivery_id?: string | null;
    square_invoice_url?: string | null;
    square_receipt_url?: string | null;
  } | null;
  onSaved: () => void;
}

export default function AdminInvoiceDetailModal({
  open,
  onClose,
  invoice,
  onSaved,
}: AdminInvoiceDetailModalProps) {
  const { toast } = useToast();
  const [detail, setDetail] = useState<{
    invoice: Record<string, unknown>;
    delivery: Record<string, unknown> | null;
    organization: Record<string, unknown> | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  useEffect(() => {
    if (open && invoice) {
      setLoading(true);
      setDetail(null);
      setAmount(String(invoice.amount ?? ""));
      setDueDate(invoice.due_date ?? "");
      setStatus(invoice.status ?? "sent");
      setFile(null);
      Promise.all([
        fetch(`/api/admin/invoices/${invoice.id}`).then((r) => r.json()),
        invoice.file_path
          ? fetch(`/api/admin/invoices/${invoice.id}/file`).then((r) => r.json()).then((d) => d.url).catch(() => null)
          : Promise.resolve(null),
      ])
        .then(([res, url]) => {
          if (res.invoice) setDetail(res);
          setFileUrl(url);
        })
        .catch(() => toast("Failed to load invoice details", "x"))
        .finally(() => setLoading(false));
    }
  }, [open, invoice?.id, invoice?.amount, invoice?.due_date, invoice?.status, invoice?.file_path, toast]);

  const handleSave = async () => {
    if (!invoice) return;
    setSaving(true);
    try {
      const formData = new FormData();
      formData.append("amount", amount);
      formData.append("due_date", dueDate);
      formData.append("status", status);
      if (file) formData.append("file", file);

      const res = await fetch(`/api/admin/invoices/${invoice.id}`, {
        method: "PATCH",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast("Invoice updated", "check");
      onSaved();
      setShowEdit(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "x");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !invoice) return null;

  const inv = (detail?.invoice ?? invoice) as Record<string, unknown>;
  const displayNum = String(
    inv.display_invoice_number ?? inv.invoice_number ?? invoice.invoice_number ?? ""
  );
  const delivery = detail?.delivery as Record<string, unknown> | null | undefined;
  const lineItemsRaw = inv.line_items;
  const lineItems: LineItem[] = Array.isArray(lineItemsRaw)
    ? lineItemsRaw
    : typeof lineItemsRaw === "string"
      ? (() => {
          try {
            return JSON.parse(lineItemsRaw) || [];
          } catch {
            return [];
          }
        })()
      : [];

  const subtotal = Number(inv.amount ?? amount ?? 0);
  const hst = calcHST(subtotal);
  const total = subtotal + hst;

  return (
    <ModalOverlay open={open} onClose={onClose} title={`Invoice ${displayNum || invoice.invoice_number}`} maxWidth="lg">
      <div className="p-5 space-y-5">
        {loading ? (
          <div className="py-12 text-center text-[var(--tx3)] text-[13px]">Loading invoice details…</div>
        ) : (
          <>
            {/* Header: Invoice #, Client, Status, Amount, Due Date */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/30">
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Client</div>
                <div className="text-[var(--tx)] font-semibold">{String(inv.client_name ?? invoice.client_name ?? "-")}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Status</div>
                <span
                  className={`text-[11px] font-bold uppercase tracking-wide ${invoiceStatusBadgeClass(String(inv.status ?? status))}`}
                >
                  {getInvoiceStatusLabel(String(inv.status ?? status))}
                </span>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Amount</div>
                <div className="text-[var(--tx)] font-bold">{formatCurrency(subtotal)}</div>
                <div className="text-[10px] text-[var(--tx3)]">+{formatCurrency(hst)} HST · Total {formatCurrency(total)}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Due Date</div>
                <div className="text-[var(--tx)]">{String(inv.due_date ?? dueDate) || "-"}</div>
              </div>
            </div>

            {/* Delivery info (if delivery invoice) */}
            {delivery && (
              <div className="p-4 rounded-lg bg-[var(--bg)]/30 border border-[var(--brd)]/20">
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Delivery</div>
                <div className="space-y-1 text-[12px]">
                  {!!delivery.delivery_number && (
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-[var(--gold)]">#{String(delivery.delivery_number)}</span>
                      <Link
                        href={getDeliveryDetailPath({ delivery_number: String(delivery.delivery_number), id: String(delivery.id) })}
                        className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        View delivery →
                      </Link>
                    </div>
                  )}
                  {!!delivery.delivery_address && (
                    <div className="text-[var(--tx2)]">
                      <span className="text-[var(--tx3)]">Address:</span> {String(delivery.delivery_address)}
                    </div>
                  )}
                  {!!delivery.scheduled_date && (
                    <div className="text-[var(--tx2)]">
                      <span className="text-[var(--tx3)]">Scheduled:</span> {String(delivery.scheduled_date)}
                      {!!delivery.time_slot && ` · ${String(delivery.time_slot)}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Line items */}
            {lineItems.length > 0 && (
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Line items</div>
                <div className="overflow-x-auto rounded-lg border border-[var(--brd)]/30">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-[var(--bg)]/50 border-b border-[var(--brd)]/30">
                        <th className="text-left py-2 px-3 font-semibold text-[var(--tx3)]">Description</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--tx3)]">Qty</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--tx3)]">Rate</th>
                        <th className="text-right py-2 px-3 font-semibold text-[var(--tx3)]">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lineItems.map((item, i) => {
                        const q = item.q ?? item.quantity ?? 1;
                        const r = item.r ?? item.rate ?? 0;
                        const rowTotal = q * r;
                        return (
                          <tr key={i} className="border-b border-[var(--brd)]/20 last:border-0">
                            <td className="py-2 px-3 text-[var(--tx)]">{item.d ?? item.description ?? "-"}</td>
                            <td className="py-2 px-3 text-right text-[var(--tx2)]">{q}</td>
                            <td className="py-2 px-3 text-right text-[var(--tx2)]">{formatCurrency(r)}</td>
                            <td className="py-2 px-3 text-right font-semibold">{formatCurrency(rowTotal)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Square link & payment */}
            <div className="flex flex-wrap items-center gap-3">
              {!!inv.square_invoice_url && (
                <a
                  href={String(inv.square_invoice_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--gold)]/15 border border-[var(--gold)]/30 text-[var(--gold)] font-semibold text-[12px] hover:bg-[var(--gold)]/25 transition-colors"
                >
                  <ArrowSquareOut size={14} weight="regular" className="text-current" />
                  View in Square
                </a>
              )}
              {inv.status === "paid" && !!inv.square_receipt_url && (
                <a
                  href={String(inv.square_receipt_url)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#22C55E]/15 border border-[#22C55E]/30 text-[#22C55E] font-semibold text-[12px] hover:bg-[#22C55E]/25 transition-colors"
                >
                  <FileText size={14} weight="regular" className="text-current" />
                  View Payment Receipt (Square)
                </a>
              )}
              {fileUrl && (
                <a
                  href={fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[var(--brd)] text-[var(--tx2)] font-semibold text-[12px] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
                >
                  View PDF
                </a>
              )}
            </div>

            {/* Edit section (collapsible) */}
            <div className="border-t border-[var(--brd)]/30 pt-4">
              <button
                type="button"
                onClick={() => setShowEdit((v) => !v)}
                className="text-[11px] font-semibold text-[var(--gold)] hover:underline"
              >
                {showEdit ? "Hide edit" : "Edit invoice"}
              </button>
              {showEdit && (
                <div className="mt-4 space-y-4 p-4 rounded-lg bg-[var(--bg)]/30 border border-[var(--brd)]/20">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Subtotal ($)</label>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        min="0"
                        step="0.01"
                        className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                      />
                      <div className="mt-1 text-[10px] text-[var(--tx3)]">
                        +{formatCurrency(calcHST(amount || 0))} HST (13%) · Total {formatCurrency(Number(amount || 0) + calcHST(amount || 0))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Due Date</label>
                      <input
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</label>
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">
                      {fileUrl ? "Replace PDF" : "Upload PDF"}
                    </label>
                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      className="w-full text-[11px] text-[var(--tx2)] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-[var(--admin-primary-fill)] file:text-white"
                    />
                    {file && <p className="mt-1 text-[10px] text-[var(--tx3)]">{file.name}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      className="px-4 py-2 rounded-lg text-[11px] font-bold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-50"
                    >
                      {saving ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Close
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

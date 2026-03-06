"use client";

import { useState, useEffect } from "react";
import Badge from "../components/Badge";
import ModalOverlay from "../components/ModalOverlay";
import { useToast } from "../components/Toast";

const STATUS_OPTIONS = ["sent", "overdue", "paid", "cancelled"];

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
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [status, setStatus] = useState("");
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (invoice) {
      setAmount(String(invoice.amount ?? ""));
      setDueDate(invoice.due_date ?? "");
      setStatus(invoice.status ?? "sent");
      setFile(null);
      if (invoice.file_path) {
        fetch(`/api/admin/invoices/${invoice.id}/file`)
          .then((r) => r.json())
          .then((d) => d.url && setFileUrl(d.url))
          .catch(() => setFileUrl(null));
      } else {
        setFileUrl(null);
      }
    }
  }, [invoice]);

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
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update", "x");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !invoice) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} title={`Invoice ${invoice.invoice_number}`} maxWidth="md">
      <div className="p-5 space-y-4">
        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Client</div>
          <div className="text-[var(--tx)] font-semibold">{invoice.client_name || "—"}</div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Amount ($)</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              min="0"
              step="0.01"
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Due Date</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace("-", " ")}</option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Invoice File</div>
          {fileUrl ? (
            <div className="flex items-center gap-2 mb-2">
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[11px] font-semibold text-[var(--gold)] hover:underline"
              >
                View current PDF
              </a>
            </div>
          ) : (
            <p className="text-[10px] text-[var(--tx3)] mb-2">No file uploaded</p>
          )}
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">
              {fileUrl ? "Replace PDF" : "Upload PDF"}
            </label>
            <input
              type="file"
              accept=".pdf,application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-[11px] text-[var(--tx2)] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-[var(--gold)] file:text-white"
            />
            {file && <p className="mt-1 text-[10px] text-[var(--tx3)]">{file.name} (will replace existing)</p>}
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

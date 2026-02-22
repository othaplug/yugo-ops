"use client";

import { useState, useEffect } from "react";
import ModalOverlay from "../components/ModalOverlay";
import { useToast } from "../components/Toast";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
}

interface CreateInvoiceModalProps {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

export default function CreateInvoiceModal({ open, onClose, onCreated }: CreateInvoiceModalProps) {
  const { toast } = useToast();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [organizationId, setOrganizationId] = useState("");
  const [clientName, setClientName] = useState("");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/admin/organizations/list")
        .then((r) => r.json())
        .then((data) => setOrgs(data.organizations ?? []))
        .catch(() => setOrgs([]));
    }
  }, [open]);

  useEffect(() => {
    if (organizationId) {
      const org = orgs.find((o) => o.id === organizationId);
      if (org) setClientName(org.name);
    }
  }, [organizationId, orgs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amt = Number(amount);
    if (!clientName.trim()) {
      toast("Client/partner name is required", "x");
      return;
    }
    if (amt <= 0) {
      toast("Amount must be greater than 0", "x");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("organization_id", organizationId || "");
      formData.append("client_name", clientName.trim());
      formData.append("amount", String(amt));
      formData.append("due_date", dueDate || new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]);
      if (file) formData.append("file", file);

      const res = await fetch("/api/admin/invoices/create", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");
      toast("Invoice created", "check");
      setOrganizationId("");
      setClientName("");
      setAmount("");
      setDueDate("");
      setFile(null);
      onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to create", "x");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Create Invoice" maxWidth="md">
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Client or Partner
          </label>
          <select
            value={organizationId}
            onChange={(e) => setOrganizationId(e.target.value)}
            className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            <option value="">Select client or partner…</option>
            {orgs.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name} ({o.type === "b2c" ? "Client" : o.type})
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Name
          </label>
          <input
            type="text"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Client or partner name"
            required
            className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
              Amount ($)
            </label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              min="1"
              step="0.01"
              required
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Invoice PDF (optional)
          </label>
          <input
            type="file"
            accept=".pdf,application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-[11px] text-[var(--tx2)] file:mr-2 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-[10px] file:font-semibold file:bg-[var(--gold)] file:text-white"
          />
          {file && <p className="mt-1 text-[10px] text-[var(--tx3)]">{file.name}</p>}
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
            type="submit"
            disabled={submitting}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-bold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] disabled:opacity-50"
          >
            {submitting ? "Creating…" : "Create Invoice"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

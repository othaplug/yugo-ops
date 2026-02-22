"use client";

import { useState, useEffect } from "react";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { useToast } from "../../components/Toast";
import ModalOverlay from "../../components/ModalOverlay";

const TYPES = [
  { value: "retail", label: "Retail" },
  { value: "designer", label: "Designer" },
  { value: "hospitality", label: "Hospitality" },
  { value: "gallery", label: "Gallery" },
  { value: "realtor", label: "Realtor" },
];

interface EditPartnerModalProps {
  open: boolean;
  onClose: () => void;
  client: { id: string; name: string; type: string; contact_name?: string; email: string; phone?: string };
  onSaved?: () => void;
}

export default function EditPartnerModal({ open, onClose, client, onSaved }: EditPartnerModalProps) {
  const isClient = client.type === "b2c";
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(client.name);
  const [type, setType] = useState(client.type);
  const [contactName, setContactName] = useState(client.contact_name || "");
  const [email, setEmail] = useState(client.email || "");
  const [phone, setPhone] = useState(client.phone ? formatPhone(client.phone) : "");

  useEffect(() => {
    if (open) {
      setName(client.name);
      setType(client.type);
      setContactName(client.contact_name || "");
      setEmail(client.email || "");
      setPhone(client.phone ? formatPhone(client.phone) : "");
    }
  }, [open, client]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) {
      toast(isClient ? "Name and email are required" : "Company name and email are required", "x");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/organizations/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          type: isClient ? "b2c" : type,
          contact_name: isClient ? name.trim() : contactName.trim(),
          email: email.trim(),
          phone: normalizePhone(phone).trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      toast(isClient ? "Client updated" : "Partner updated", "check");
      onSaved?.();
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title={isClient ? "Edit Client" : "Edit Partner"}>
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">{isClient ? "Name *" : "Company Name *"}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={isClient ? "e.g. John Smith" : "e.g. Roche Bobois"}
            required
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        {!isClient && (
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Partner Type *</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        )}
        {!isClient && (
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Contact Name</label>
          <input
            type="text"
            value={contactName}
            onChange={(e) => setContactName(e.target.value)}
            placeholder="e.g. Marie Dubois"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        )}
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email *</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="contact@company.com"
            required
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Phone</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setPhone(formatPhone(phone))}
            placeholder="(123) 456-7890"
            className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-all"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-white hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {loading ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

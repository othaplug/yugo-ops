"use client";

import { useState } from "react";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";

interface InvitePartnerModalProps {
  open: boolean;
  onClose: () => void;
}

export default function InvitePartnerModal({ open, onClose }: InvitePartnerModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState("retail");
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !name.trim()) {
      toast("Company name and email are required", "x");
      return;
    }
    setLoading(true);

    try {
      const res = await fetch("/api/invite/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, name: name.trim(), contact_name: contactName.trim(), email: email.trim(), phone: phone.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to send invitation");

      toast("Partner invitation sent to " + email, "mail");
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setType("retail");
      onClose();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to send invitation", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay open={open} onClose={onClose} title="Invite Partner">
      <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Partner Type *</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            >
              <option value="retail">Retail</option>
              <option value="designer">Designer</option>
              <option value="hospitality">Hospitality</option>
              <option value="gallery">Gallery</option>
              <option value="realtor">Realtor</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Company / Partner Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Roche Bobois"
              required
              className="w-full px-4 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
            />
          </div>
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
              placeholder="416-555-0100"
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
              className="flex-1 px-4 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
            >
              {loading ? "Sending…" : "Send Invitation"}
            </button>
          </div>
        </form>
    </ModalOverlay>
  );
}

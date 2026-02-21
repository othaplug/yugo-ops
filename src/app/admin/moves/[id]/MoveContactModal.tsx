"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPhone, normalizePhone } from "@/lib/phone";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";

const PREFERRED_OPTIONS = [
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "both", label: "Both" },
];

interface MoveContactModalProps {
  open: boolean;
  onClose: () => void;
  moveId: string;
  initial: {
    client_name: string;
    client_email: string;
    client_phone?: string | null;
    preferred_contact?: string | null;
  };
  onSaved?: (updates: { client_name: string; client_email: string | null; client_phone: string | null; preferred_contact: string | null; updated_at: string }) => void;
}

export default function MoveContactModal({ open, onClose, moveId, initial, onSaved }: MoveContactModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [name, setName] = useState(initial.client_name || "");
  const [email, setEmail] = useState(initial.client_email || "");
  const [phone, setPhone] = useState(initial.client_phone ? formatPhone(initial.client_phone) : "");
  const [preferred, setPreferred] = useState(initial.preferred_contact || "email");
  const [sendTrackingLink, setSendTrackingLink] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial.client_name || "");
      setEmail(initial.client_email || "");
      setPhone(initial.client_phone ? formatPhone(initial.client_phone) : "");
      setPreferred(initial.preferred_contact || "email");
    }
  }, [open, initial.client_name, initial.client_email, initial.client_phone, initial.preferred_contact]);

  const handleSave = async () => {
    setSaving(true);
    const updated_at = new Date().toISOString();
    const emailTrimmed = email.trim() || null;
    const { data } = await supabase
      .from("moves")
      .update({
        client_name: name.trim(),
        client_email: emailTrimmed,
        client_phone: normalizePhone(phone) || null,
        preferred_contact: preferred || null,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    if (data) onSaved?.({ client_name: data.client_name || "", client_email: data.client_email ?? null, client_phone: data.client_phone ?? null, preferred_contact: data.preferred_contact ?? null, updated_at });

    if (sendTrackingLink && emailTrimmed) {
      try {
        const res = await fetch(`/api/moves/${moveId}/send-tracking-link`, { method: "POST" });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Failed to send tracking link");
        toast("Tracking link email sent", "mail");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Failed to send tracking link", "x");
      }
    }
    setSaving(false);
    onClose();
    router.refresh();
  };

  if (!open) return null;

  return (
    <ModalOverlay open={open} onClose={onClose} title="Client contact details" maxWidth="md">
      <div className="p-5 space-y-3">
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]" />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]" />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Phone</label>
          <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => setPhone(formatPhone(phone))} placeholder="(123) 456-7890" className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]" />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Preferred contact</label>
          <select value={preferred} onChange={(e) => setPreferred(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]">
            {PREFERRED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendTrackingLink}
            onChange={(e) => setSendTrackingLink(e.target.checked)}
            className="accent-[var(--gold)] rounded"
          />
          <span className="text-[12px] text-[var(--tx2)]">Send tracking link (magic-link email, no account needed)</span>
        </label>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

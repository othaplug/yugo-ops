"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

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
  const supabase = createClient();
  const [name, setName] = useState(initial.client_name || "");
  const [email, setEmail] = useState(initial.client_email || "");
  const [phone, setPhone] = useState(initial.client_phone || "");
  const [preferred, setPreferred] = useState(initial.preferred_contact || "email");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial.client_name || "");
      setEmail(initial.client_email || "");
      setPhone(initial.client_phone || "");
      setPreferred(initial.preferred_contact || "email");
    }
  }, [open, initial.client_name, initial.client_email, initial.client_phone, initial.preferred_contact]);

  if (!open) return null;

  const handleSave = async () => {
    setSaving(true);
    const updated_at = new Date().toISOString();
    const { data } = await supabase
      .from("moves")
      .update({
        client_name: name.trim(),
        client_email: email.trim() || null,
        client_phone: phone.trim() || null,
        preferred_contact: preferred || null,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    setSaving(false);
    onClose();
    if (data) onSaved?.({ client_name: data.client_name || "", client_email: data.client_email ?? null, client_phone: data.client_phone ?? null, preferred_contact: data.preferred_contact ?? null, updated_at });
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-4">Client contact details</h3>
        <div className="space-y-3">
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
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]" />
          </div>
          <div>
            <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Preferred contact</label>
            <select value={preferred} onChange={(e) => setPreferred(e.target.value)} className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px]">
              {PREFERRED_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 mt-4">
          <button type="button" onClick={onClose} className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50">
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

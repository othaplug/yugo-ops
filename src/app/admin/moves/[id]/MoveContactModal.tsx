"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import type { AdditionalContact } from "@/lib/moves/move-recipients";

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
    additional_contacts?: AdditionalContact[] | null;
  };
  onSaved?: (updates: {
    client_name: string;
    client_email: string | null;
    client_phone: string | null;
    preferred_contact: string | null;
    additional_contacts: AdditionalContact[];
    updated_at: string;
  }) => void;
}

export default function MoveContactModal({
  open,
  onClose,
  moveId,
  initial,
  onSaved,
}: MoveContactModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [name, setName] = useState(initial.client_name || "");
  const [email, setEmail] = useState(initial.client_email || "");
  const [phone, setPhone] = useState(
    initial.client_phone ? formatPhone(initial.client_phone) : "",
  );
  const phoneInput = usePhoneInput(phone, setPhone);
  const [preferred, setPreferred] = useState(
    initial.preferred_contact || "email",
  );
  const [sendTrackingLink, setSendTrackingLink] = useState(false);
  const [additional, setAdditional] = useState<AdditionalContact[]>(
    Array.isArray(initial.additional_contacts) ? initial.additional_contacts : [],
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (open) {
      setName(initial.client_name || "");
      setEmail(initial.client_email || "");
      setPhone(initial.client_phone ? formatPhone(initial.client_phone) : "");
      setPreferred(initial.preferred_contact || "email");
      setAdditional(
        Array.isArray(initial.additional_contacts)
          ? initial.additional_contacts.map((c) => ({
              ...c,
              phone: c.phone ? formatPhone(c.phone) : c.phone ?? "",
            }))
          : [],
      );
    }
  }, [
    open,
    initial.client_name,
    initial.client_email,
    initial.client_phone,
    initial.preferred_contact,
    initial.additional_contacts,
  ]);

  const updateContact = (i: number, patch: Partial<AdditionalContact>) =>
    setAdditional((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));
  const addContact = () =>
    setAdditional((prev) => [
      ...prev,
      { name: "", phone: "", email: "", tracking: true, reminders: true },
    ]);
  const removeContact = (i: number) =>
    setAdditional((prev) => prev.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaving(true);
    const updated_at = new Date().toISOString();
    const emailTrimmed = email.trim() || null;
    const cleanedAdditional: AdditionalContact[] = additional
      .map((c) => ({
        name: (c.name || "").trim(),
        phone: normalizePhone(c.phone || "") || null,
        email: (c.email || "").trim().toLowerCase() || null,
        tracking: c.tracking !== false,
        reminders: c.reminders !== false,
      }))
      .filter((c) => c.name || c.phone || c.email);
    const { data } = await supabase
      .from("moves")
      .update({
        client_name: name.trim(),
        client_email: emailTrimmed,
        client_phone: normalizePhone(phone) || null,
        preferred_contact: preferred || null,
        additional_contacts: cleanedAdditional,
        updated_at,
      })
      .eq("id", moveId)
      .select()
      .single();
    if (data)
      onSaved?.({
        client_name: data.client_name || "",
        client_email: data.client_email ?? null,
        client_phone: data.client_phone ?? null,
        preferred_contact: data.preferred_contact ?? null,
        additional_contacts: Array.isArray(data.additional_contacts)
          ? (data.additional_contacts as AdditionalContact[])
          : cleanedAdditional,
        updated_at,
      });

    if (sendTrackingLink && (emailTrimmed || normalizePhone(phone))) {
      try {
        const res = await fetch(`/api/moves/${moveId}/send-tracking-link`, {
          method: "POST",
        });
        const json = await res.json();
        if (!res.ok)
          throw new Error(json.error || "Failed to send tracking link");
        toast("Tracking link sent", "mail");
      } catch (e) {
        toast(
          e instanceof Error ? e.message : "Failed to send tracking link",
          "x",
        );
      }
    }
    setSaving(false);
    onClose();
    router.refresh();
  };

  if (!open) return null;

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title="Client contact details"
      maxWidth="md"
    >
      <div className="p-5 space-y-3">
        <div>
          <label className="admin-premium-label admin-premium-label--tight mb-1">
            Name
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="admin-premium-input w-full text-[var(--tx)]"
          />
        </div>
        <div>
          <label className="admin-premium-label admin-premium-label--tight mb-1">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="admin-premium-input w-full text-[var(--tx)]"
          />
        </div>
        <div>
          <label className="admin-premium-label admin-premium-label--tight mb-1">
            Phone
          </label>
          <input
            ref={phoneInput.ref}
            type="tel"
            value={phone}
            onChange={phoneInput.onChange}
            placeholder={PHONE_PLACEHOLDER}
            className="admin-premium-input w-full text-[var(--tx)]"
          />
        </div>
        <div>
          <label className="admin-premium-label admin-premium-label--tight mb-1">
            Preferred contact
          </label>
          <select
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            className="admin-premium-input w-full text-[var(--tx)]"
          >
            {PREFERRED_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="border-t border-[var(--brd)] pt-3">
          <div className="flex items-center justify-between mb-1.5">
            <label className="admin-premium-label admin-premium-label--tight">
              Additional contacts
            </label>
            <button
              type="button"
              onClick={addContact}
              className="text-[11px] font-semibold text-[var(--admin-primary-fill)] hover:underline"
            >
              + Add contact
            </button>
          </div>
          <p className="text-[11px] text-[var(--tx3)] mb-2">
            Extra people who also get tracking and/or reminder texts and emails for
            this move. Deduped, so a shared number is never texted twice.
          </p>
          {additional.length === 0 ? (
            <p className="text-[12px] text-[var(--tx3)] italic">No additional contacts.</p>
          ) : (
            <div className="space-y-3">
              {additional.map((c, i) => (
                <div
                  key={i}
                  className="rounded-lg border border-[var(--brd)] bg-[var(--bg2)] p-3 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={c.name ?? ""}
                      onChange={(e) => updateContact(i, { name: e.target.value })}
                      placeholder="Name (e.g. Gary, husband)"
                      className="admin-premium-input flex-1 text-[var(--tx)]"
                    />
                    <button
                      type="button"
                      onClick={() => removeContact(i)}
                      className="text-[var(--tx3)] hover:text-red-500 text-[16px] px-1 shrink-0"
                      aria-label="Remove contact"
                    >
                      ×
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="tel"
                      value={c.phone ?? ""}
                      onChange={(e) => updateContact(i, { phone: e.target.value })}
                      placeholder={PHONE_PLACEHOLDER}
                      className="admin-premium-input w-full text-[var(--tx)]"
                    />
                    <input
                      type="email"
                      value={c.email ?? ""}
                      onChange={(e) => updateContact(i, { email: e.target.value })}
                      placeholder="email (optional)"
                      className="admin-premium-input w-full text-[var(--tx)]"
                    />
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.tracking !== false}
                        onChange={(e) => updateContact(i, { tracking: e.target.checked })}
                        className="accent-[var(--gold)] rounded"
                      />
                      <span className="text-[12px] text-[var(--tx2)]">Move-day tracking</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={c.reminders !== false}
                        onChange={(e) => updateContact(i, { reminders: e.target.checked })}
                        className="accent-[var(--gold)] rounded"
                      />
                      <span className="text-[12px] text-[var(--tx2)]">Reminders &amp; updates</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendTrackingLink}
            onChange={(e) => setSendTrackingLink(e.target.checked)}
            className="accent-[var(--gold)] rounded"
          />
          <span className="text-[12px] text-[var(--tx2)]">
            Send tracking link (magic-link email, no account needed)
          </span>
        </label>
        <div className="flex gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-secondary flex-1"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="admin-btn admin-btn-primary flex-1"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

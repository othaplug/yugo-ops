"use client";

import { useState, useEffect } from "react";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { useToast } from "../components/Toast";
import { Icon } from "@/components/AppIcons";

const TYPE_LABELS: Record<string, string> = {
  retail: "Retail",
  designer: "Designer",
  hospitality: "Hospitality",
  gallery: "Gallery",
  realtor: "Realtor",
};

interface PartnerProfile {
  id: string;
  name: string;
  type: string;
  contact_name: string;
  email: string;
  phone: string;
}

export default function PartnerProfileSettings() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<PartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    fetch("/api/partner/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data.id) {
          setProfile(data);
          setContactName(data.contact_name || "");
          setEmail(data.email || "");
          setPhone(data.phone ? formatPhone(data.phone) : "");
        }
      })
      .catch(() => toast("Failed to load profile", "x"))
      .finally(() => setLoading(false));
  }, [toast]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSaving(true);
    try {
      const res = await fetch("/api/partner/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_name: contactName.trim(),
          email: email.trim(),
          phone: normalizePhone(phone).trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      setProfile((p) => (p ? { ...p, contact_name: contactName.trim(), email: email.trim(), phone: normalizePhone(phone).trim() } : null));
      toast("Profile updated", "check");
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to update", "x");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) return null;

  return (
    <div id="partner-profile" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden scroll-mt-4">
      <div className="px-5 py-5 border-b border-[var(--brd)] bg-[var(--bg2)]">
        <h2 className="font-heading text-[18px] font-bold text-[var(--tx)] flex items-center gap-2">
          <Icon name="handshake" className="w-[18px] h-[18px]" /> Partner Profile
        </h2>
        <p className="text-[12px] text-[var(--tx3)] mt-1.5">Update your contact details. Company name and partner type can only be changed by an administrator.</p>
      </div>
      <form onSubmit={handleSave} className="px-5 py-5 space-y-4">
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Company Name</label>
          <div className="text-[13px] text-[var(--tx2)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5">
            {profile.name}
          </div>
          <p className="text-[10px] text-[var(--tx3)] mt-1">Only administrators can change this</p>
        </div>
        <div>
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Partner Type</label>
          <div className="text-[13px] text-[var(--tx2)] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-4 py-2.5">
            {TYPE_LABELS[profile.type] || profile.type}
          </div>
          <p className="text-[10px] text-[var(--tx3)] mt-1">Only administrators can change this</p>
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
          <label className="block text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Email</label>
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
        <button
          type="submit"
          disabled={saving}
          className="px-4 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </form>
    </div>
  );
}

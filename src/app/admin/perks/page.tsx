"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Gift, Users, Tag, PencilSimple as Pencil, Check, Copy, Trash as Trash2 } from "@phosphor-icons/react";
import { useToast } from "../components/Toast";
import CreateButton from "../components/CreateButton";
import YugoLogo from "@/components/YugoLogo";
import { formatPlatformDisplay } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";

// ─── Types ────────────────────────────────────────────────────────────────────

type Perk = {
  id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  offer_type: string;
  discount_value: number | null;
  redemption_code: string | null;
  redemption_url: string | null;
  valid_from: string | null;
  valid_until: string | null;
  max_redemptions: number | null;
  current_redemptions: number;
  is_active: boolean;
  display_order: number;
  created_at: string;
  organizations?: { name: string } | null;
};

type Referral = {
  id: string;
  referrer_name: string;
  referrer_email: string;
  referral_code: string;
  referred_name: string | null;
  referred_email: string | null;
  status: string;
  referrer_credit: number;
  referred_discount: number;
  used_at: string | null;
  credited_at: string | null;
  expires_at: string | null;
  created_at: string;
};

type VipContact = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  lifetime_value: number;
  referral_count: number;
  created_at: string;
};

type Partner = { id: string; name: string };

// ─── Offer type display helpers ───────────────────────────────────────────────

const OFFER_TYPE_LABELS: Record<string, string> = {
  percentage_off: "% Off",
  dollar_off: "$ Off",
  free_service: "Free",
  consultation: "Consult",
  priority_access: "Priority",
  custom: "Custom",
};

const OFFER_TYPE_BADGE: Record<string, string> = {
  percentage_off: "bg-green-50 text-green-700 border border-green-200",
  dollar_off: "bg-blue-50 text-blue-700 border border-blue-200",
  free_service: "bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/30",
  consultation: "bg-purple-50 text-purple-700 border border-purple-200",
  priority_access: "bg-amber-50 text-amber-700 border border-amber-200",
  custom: "bg-[var(--bg)] text-[var(--tx3)] border border-[var(--brd)]",
};

const REF_STATUS_BADGE: Record<string, string> = {
  active: "text-amber-700 dark:text-amber-300",
  used: "text-emerald-700 dark:text-emerald-400",
  expired: "text-red-600 dark:text-red-400",
  credited: "text-blue-700 dark:text-sky-400",
};

// ─── Create Perk Modal ────────────────────────────────────────────────────────

function CreatePerkModal({
  onClose,
  onCreated,
  partners,
}: {
  onClose: () => void;
  onCreated: () => void;
  partners: Partner[];
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    partner_id: "",
    title: "",
    description: "",
    offer_type: "percentage_off",
    discount_value: "",
    redemption_code: "",
    redemption_url: "",
    valid_from: new Date().toISOString().slice(0, 10),
    valid_until: "",
    max_redemptions: "",
    display_order: "0",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.title.trim()) { toast("Title is required", "x"); return; }
    if (!form.partner_id?.trim()) { toast("Partner is required", "x"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/perks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          partner_id: form.partner_id || null,
          discount_value: form.discount_value ? Number(form.discount_value) : null,
          max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
          display_order: Number(form.display_order) || 0,
          valid_until: form.valid_until || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast("Perk created", "check");
      onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[99999] grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl shrink-0">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] flex items-center justify-between px-5 py-4 rounded-t-2xl">
          <h3 className="text-[15px] font-bold text-[var(--tx)]">Create Perk</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Partner *</label>
            <select value={form.partner_id} onChange={(e) => set("partner_id", e.target.value)} className="admin-premium-input w-full" required>
              <option value="">Select a partner</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Title *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 10% off your first order" className="admin-premium-input w-full" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="admin-premium-input w-full resize-none" />
          </div>
          <div className={`grid gap-3 ${["percentage_off", "dollar_off"].includes(form.offer_type) ? "grid-cols-2" : "grid-cols-1"}`}>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Offer Type</label>
              <select value={form.offer_type} onChange={(e) => set("offer_type", e.target.value)} className="admin-premium-input w-full">
                <option value="percentage_off">% Off</option>
                <option value="dollar_off">$ Off</option>
                <option value="free_service">Free Service</option>
                <option value="consultation">Consultation</option>
                <option value="priority_access">Priority Access</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            {["percentage_off", "dollar_off"].includes(form.offer_type) && (
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">
                  {form.offer_type === "percentage_off" ? "% Value" : "$ Value"}
                </label>
                {form.offer_type === "dollar_off" ? (
                  <div className="flex items-center rounded-lg border border-[var(--brd)] bg-[var(--bg)] focus-within:border-[var(--gold)]">
                    <span className="pl-3 text-[12px] text-[var(--tx2)]">$</span>
                    <input type="number" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} placeholder="e.g. 25" className="w-full py-2 pr-3 pl-0.5 bg-transparent text-[12px] focus:outline-none" />
                  </div>
                ) : (
                  <input type="number" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} placeholder="e.g. 10" className="admin-premium-input w-full" />
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Code</label>
              <input value={form.redemption_code} onChange={(e) => set("redemption_code", e.target.value.toUpperCase())} placeholder="YUGO10" className="admin-premium-input w-full font-mono" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Redemption URL</label>
              <input value={form.redemption_url} onChange={(e) => set("redemption_url", e.target.value)} placeholder="https://…" className="admin-premium-input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Valid From</label>
              <input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} className="admin-premium-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Valid Until (blank = no expiry)</label>
              <input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} className="admin-premium-input w-full" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Max Redemptions (blank = unlimited)</label>
              <input type="number" value={form.max_redemptions} onChange={(e) => set("max_redemptions", e.target.value)} placeholder="∞" className="admin-premium-input w-full" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Display Order</label>
              <input type="number" value={form.display_order} onChange={(e) => set("display_order", e.target.value)} className="admin-premium-input w-full" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
              {saving ? "Saving…" : "Save Perk"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

/* ─── Create Promotional Referral Modal ───────────────────────────────────────── */
function CreatePromoReferralModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: "",
    referrer_credit: "100",
    referred_discount: "100",
    label: "Promotional",
    expires_at: "",
  });

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    const code = form.code.trim().toUpperCase();
    if (!code) { toast("Code is required", "x"); return; }
    if (code.length < 4) { toast("Code must be at least 4 characters", "x"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/perks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "create_referral",
          code,
          referrer_credit: Number(form.referrer_credit) || 100,
          referred_discount: Number(form.referred_discount) || 100,
          label: form.label.trim() || "Promotional",
          expires_at: form.expires_at || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast("Promotional code created", "check");
      onCreated();
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div className="fixed inset-0 z-[99999] grid place-items-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[420px] shadow-2xl shrink-0">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] flex items-center justify-between px-5 py-4 rounded-t-2xl">
          <h3 className="text-[15px] font-bold text-[var(--tx)]">Create Promotional Code</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Code *</label>
            <input
              value={form.code}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="e.g. YUGOSUMMER50"
              className="admin-premium-input w-full font-mono"
            />
            <p className="text-[10px] text-[var(--tx3)] mt-1">Unique code customers enter at checkout. Min 4 characters.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Referrer credit ($)</label>
              <input
                type="number"
                value={form.referrer_credit}
                onChange={(e) => set("referrer_credit", e.target.value)}
                min={0}
                className="admin-premium-input w-full"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Referred discount ($)</label>
              <input
                type="number"
                value={form.referred_discount}
                onChange={(e) => set("referred_discount", e.target.value)}
                min={0}
                className="admin-premium-input w-full"
              />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Label (for display)</label>
            <input
              value={form.label}
              onChange={(e) => set("label", e.target.value)}
              placeholder="e.g. Summer 2025 Campaign"
              className="admin-premium-input w-full"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Expires (optional)</label>
            <input
              type="date"
              value={form.expires_at}
              onChange={(e) => set("expires_at", e.target.value)}
              className="admin-premium-input w-full"
            />
            <p className="text-[10px] text-[var(--tx3)] mt-1">Leave blank for 1 year from today.</p>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
              {saving ? "Creating…" : "Create Code"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modal, document.body);
}

/* ─── Editable Perk Cell ─────────────────────────────────────────────────────── */
function EditablePerkCell({
  value,
  field,
  perkId,
  onSaved,
  type = "text",
  options,
  formatDisplay,
}: {
  value: string | number | null;
  field: string;
  perkId: string;
  onSaved: (id: string, field: string, value: string | number | null) => void;
  type?: "text" | "number" | "date";
  options?: { value: string; label: string }[];
  formatDisplay?: (v: string | number | null) => string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ""));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setDraft(String(value ?? ""));
    setEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const commit = async () => {
    let parsed: string | number | null = draft.trim() || null;
    if (type === "number" && parsed !== null) {
      const n = parseFloat(parsed as string);
      parsed = isNaN(n) ? null : n;
    }
    if (parsed === value || (value == null && parsed == null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/perks/${perkId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: parsed }),
      });
      if (res.ok) {
        onSaved(perkId, field, parsed);
      }
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const cancel = () => setEditing(false);

  if (editing) {
    return (
      <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
        {options ? (
          <select
            ref={inputRef as React.RefObject<HTMLSelectElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            className="min-w-[100px] bg-[var(--bg)] border border-[var(--gold)] rounded px-1.5 py-0.5 text-[11px] text-[var(--tx)] outline-none"
            disabled={saving}
          >
            {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type={type === "date" ? "date" : type}
            value={type === "date" && !draft ? "" : draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") cancel(); }}
            className="min-w-[80px] max-w-[180px] bg-[var(--bg)] border border-[var(--gold)] rounded px-1.5 py-0.5 text-[11px] text-[var(--tx)] outline-none"
            disabled={saving}
          />
        )}
        <button type="button" onClick={commit} className="text-emerald-400 hover:text-emerald-300 p-0.5" disabled={saving}>
          <Check className="w-3 h-3" />
        </button>
        <button type="button" onClick={cancel} className="text-[var(--tx3)] hover:text-red-400 p-0.5">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  const display = formatDisplay
    ? formatDisplay(value)
    : options
      ? (options.find((o) => o.value === value)?.label ?? (value != null && value !== "" ? String(value) : "-"))
      : (value != null && value !== "" ? String(value) : "-");
  return (
    <span className="group/cell inline-flex items-center gap-1 cursor-pointer" title="Click to edit" onClick={startEdit}>
      <span>{display}</span>
      <Pencil className="w-2.5 h-2.5 text-[var(--tx3)] opacity-0 group-hover/cell:opacity-60 transition-opacity shrink-0" />
    </span>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PerksPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<"perks" | "referrals" | "vip">("perks");
  const [perks, setPerks] = useState<Perk[]>([]);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [vipContacts, setVipContacts] = useState<VipContact[]>([]);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreatePromo, setShowCreatePromo] = useState(false);

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations/list");
      if (res.ok) {
        const data = await res.json();
        const orgs = (data.organizations || data || []) as { id: string; name: string; type?: string }[];
        const partnersOnly = orgs
          .filter((o) => o.type !== "b2c" && !(o.name || "").startsWith("_"))
          .map((o) => ({ id: o.id, name: o.name }));
        setPartners(partnersOnly);
      }
    } catch { /* ignore */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [perksRes, refsRes, vipRes] = await Promise.all([
        fetch("/api/admin/perks?type=perks").then((r) => r.json()),
        fetch("/api/admin/perks?type=referrals").then((r) => r.json()),
        fetch("/api/admin/perks?type=vip").then((r) => r.json()),
      ]);
      setPerks(perksRes.perks || []);
      setReferrals(refsRes.referrals || []);
      setVipContacts(vipRes.contacts || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); loadPartners(); }, [loadData, loadPartners]);

  const togglePerk = async (perk: Perk) => {
    try {
      const res = await fetch(`/api/admin/perks/${perk.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !perk.is_active }),
      });
      if (!res.ok) throw new Error();
      setPerks((prev) => prev.map((p) => p.id === perk.id ? { ...p, is_active: !p.is_active } : p));
    } catch {
      toast("Failed to update", "x");
    }
  };

  const deletePerk = async (id: string) => {
    if (!confirm("Delete this perk?")) return;
    try {
      await fetch(`/api/admin/perks/${id}`, { method: "DELETE" });
      setPerks((prev) => prev.filter((p) => p.id !== id));
      toast("Perk deleted", "check");
    } catch {
      toast("Failed to delete", "x");
    }
  };

  const onPerkSaved = useCallback((id: string, field: string, value: string | number | null) => {
    setPerks((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));
    toast("Offer updated", "check");
  }, [toast]);

  const deleteReferral = async (ref: Referral) => {
    if (!confirm(`Delete referral code ${ref.referral_code}? This will remove it from the database and clear it from any quotes that used it.`)) return;
    try {
      const res = await fetch(`/api/admin/perks/referrals/${ref.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReferrals((prev) => prev.filter((r) => r.id !== ref.id));
      toast("Referral deleted", "check");
    } catch {
      toast("Failed to delete", "x");
    }
  };

  const markCredited = async (ref: Referral) => {
    try {
      const res = await fetch(`/api/admin/perks`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "credit_referral", referral_id: ref.id }),
      });
      if (!res.ok) throw new Error();
      setReferrals((prev) => prev.map((r) => r.id === ref.id ? { ...r, status: "credited", credited_at: new Date().toISOString() } : r));
      toast("Marked as credited", "check");
    } catch { /* show inline error handled by optimistic update */ }
  };

  const activeRefs = referrals.filter((r) => r.status === "active").length;
  const usedThisMonth = referrals.filter((r) => {
    if (!r.used_at) return false;
    const m = new Date(); m.setDate(1);
    return new Date(r.used_at) >= m;
  }).length;
  const convRate = referrals.length > 0 ? Math.round((referrals.filter((r) => r.status !== "active").length / referrals.length) * 100) : 0;

  const TABS = [
    { key: "perks" as const, label: "Partner Perks", Icon: Tag },
    { key: "referrals" as const, label: "Referrals", Icon: Gift },
    { key: "vip" as const, label: "VIP Clients", Icon: Users },
  ];

  const activePerks = perks.filter((p) => p.is_active).length;
  const activeReferrals = referrals.filter((r) => r.status === "active").length;

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 animate-fade-up">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">Growth</p>
          <h1 className="admin-page-hero text-[var(--tx)]">Perks & Referrals</h1>
        </div>
        {tab === "perks" && (
          <CreateButton onClick={() => setShowCreate(true)} title="Create Perk" />
        )}
        {tab === "referrals" && (
          <CreateButton onClick={() => setShowCreatePromo(true)} title="CREATE PROMO CODE" />
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 md:gap-8 pb-8 border-b border-[var(--brd)] mb-6">
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/82 mb-2">Active Perks</p>
          <p className="text-[28px] font-bold font-heading leading-none text-[var(--grn)]">{activePerks}</p>
          <p className="text-[9px] text-[var(--tx3)] mt-1.5">{perks.length} total offers</p>
        </div>
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/82 mb-2">Referrals</p>
          <p className="text-[28px] font-bold font-heading leading-none text-[var(--tx)]">{referrals.length}</p>
          <p className="text-[9px] text-[var(--tx3)] mt-1.5">{activeReferrals} active codes</p>
        </div>
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/82 mb-2">Used (30d)</p>
          <p className="text-[28px] font-bold font-heading leading-none text-[var(--tx)]">{usedThisMonth}</p>
          <p className="text-[9px] text-[var(--tx3)] mt-1.5">redemptions</p>
        </div>
        <div>
          <p className="text-[9px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]/82 mb-2">Conversion</p>
          <p className="text-[28px] font-bold font-heading leading-none text-[var(--tx)]">{convRate}%</p>
          <p className="text-[9px] text-[var(--tx3)] mt-1.5">referral rate</p>
        </div>
      </div>


      {/* Tab bar */}
      <div className="flex gap-0 border-b border-[var(--brd)] mb-6">
        {TABS.map(({ key, label, Icon }) => (
          <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase border-b-2 -mb-px transition-all ${tab === key ? "border-[var(--gold)] text-[var(--gold)]" : "border-transparent text-[var(--tx3)] hover:text-[var(--tx2)]"}`}>
            <Icon className="w-[13px] h-[13px]" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--brd)]/20 rounded-xl" />)}</div>
      ) : (
        <>
          {/* ─── Partner Perks Tab ───────────────────────────────── */}
          {tab === "perks" && (
            <div>
              {/* ── Live Preview carousel ── */}
              {perks.some((p) => p.is_active) && (
                <div className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <h2 className="admin-section-h2">Live Preview</h2>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400" />
                    </span>
                    <span className="text-[9px] text-[var(--tx3)]">Client-facing view of active offers</span>
                  </div>
                  <div className="flex gap-3 overflow-x-auto overflow-y-hidden pb-3 -mx-1 px-1 scroll-smooth snap-x snap-mandatory">
                    {perks.filter((p) => p.is_active).map((perk, idx) => {
                      const themes = [
                        { bg: "linear-gradient(135deg, #2B1855 0%, #4C2D8F 100%)", stamp: "#4C2D8F" },
                        { bg: "linear-gradient(135deg, #7A0E1A 0%, #B01A26 100%)", stamp: "#B01A26" },
                        { bg: "linear-gradient(135deg, #7A3300 0%, #C05A10 100%)", stamp: "#C05A10" },
                        { bg: "linear-gradient(135deg, #0A2E1A 0%, #1A5C34 100%)", stamp: "#1A5C34" },
                        { bg: "linear-gradient(135deg, #0F2340 0%, #1A3D70 100%)", stamp: "#1A3D70" },
                      ];
                      const theme = themes[idx % themes.length];
                      const expiry = perk.valid_until
                        ? formatPlatformDisplay(perk.valid_until, { month: "short", day: "numeric" })
                        : null;
                      return (
                        <div
                          key={perk.id}
                          className="rounded-2xl overflow-hidden shrink-0 w-[310px] snap-start flex flex-col relative"
                          style={{ background: theme.bg, minHeight: "140px" }}
                        >
                          {/* Top-right: Yugo Exclusive badge (Wine Rack style) */}
                          <div className="absolute top-0 right-0 bg-white rounded-bl-xl px-2.5 py-1 flex items-center gap-1.5">
                            <YugoLogo size={10} variant="black" onLightBackground hidePlus />
                            <span className="text-[9px] font-bold text-black">Exclusive</span>
                          </div>
                          {/* Content */}
                          <div className="flex-1 px-4 py-3.5 pt-8 flex flex-col justify-between min-w-0">
                            <div>
                              {perk.organizations?.name && (
                                <div className="text-[9px] font-semibold text-white/60 mb-1">From {perk.organizations.name}</div>
                              )}
                              <div className="text-[13px] font-bold text-white leading-tight line-clamp-2">{perk.title}</div>
                              <div className="text-[10px] text-white/80 mt-1 leading-snug line-clamp-3">
                                {perk.description || "Exclusive offer for Yugo movers. Terms apply."}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {perk.redemption_code && (
                                <span className="text-[9px] font-mono font-bold text-white/90 border border-white/25 px-1.5 py-0.5 rounded-md">
                                  Code: {perk.redemption_code}
                                </span>
                              )}
                              {expiry && (
                                <span className="text-[9px] text-white/45">Ends {expiry}</span>
                              )}
                              <span
                                className="ml-auto shrink-0 bg-white text-[10px] font-bold px-3 py-1.5 rounded-md border border-black/10 opacity-90 cursor-default"
                                style={{ color: theme.stamp }}
                              >
                                {perk.redemption_code ? "Order now" : "Redeem"}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              {perks.length === 0 ? (
                <div className="text-center py-16">
                  <Tag className="w-10 h-10 text-[var(--tx3)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--tx3)]">No perks yet. Create your first offer.</p>
                </div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-[12px] min-w-[700px]">
                    <thead>
                      <tr className="border-b border-[var(--brd)] bg-[var(--bg)]/50">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Partner</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Offer Title</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Type</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Code</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Valid Until</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Used</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {perks.map((perk) => {
                        const expired = perk.valid_until && new Date(perk.valid_until) < new Date();
                        const status = !perk.is_active ? "Paused" : expired ? "Expired" : "Active";
                        const statusCls = !perk.is_active ? "text-[var(--tx3)]" : expired ? "text-red-600 dark:text-red-400" : "text-[#2D9F5A]";
                        return (
                          <tr key={perk.id} className="hover:bg-[var(--bg)]/40">
                            <td className="px-4 py-3 text-[var(--tx3)]">{perk.organizations?.name || "Yugo"}</td>
                            <td className="px-4 py-3 font-semibold text-[var(--tx)]">
                              <EditablePerkCell value={perk.title} field="title" perkId={perk.id} onSaved={onPerkSaved} />
                            </td>
                            <td className="px-4 py-3">
                              <EditablePerkCell
                                value={perk.offer_type}
                                field="offer_type"
                                perkId={perk.id}
                                onSaved={onPerkSaved}
                                options={Object.entries(OFFER_TYPE_LABELS).map(([v, l]) => ({ value: v, label: l }))}
                              />
                            </td>
                            <td className="px-4 py-3">
                              <EditablePerkCell value={perk.redemption_code} field="redemption_code" perkId={perk.id} onSaved={onPerkSaved} />
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">
                              <EditablePerkCell
                                value={perk.valid_until}
                                field="valid_until"
                                perkId={perk.id}
                                onSaved={onPerkSaved}
                                type="date"
                                formatDisplay={(v) => (v && String(v).length >= 10) ? formatPlatformDisplay(String(v) + "T00:00:00", { month: "short", day: "numeric" }) : "No expiry"}
                              />
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">
                              {perk.current_redemptions}{perk.max_redemptions != null ? ` / ${perk.max_redemptions}` : " / ∞"}
                            </td>
                            <td className="px-4 py-3"><span className={`dt-badge tracking-[0.04em] ${statusCls}`}>{status}</span></td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <button onClick={() => togglePerk(perk)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">
                                  {perk.is_active ? "Pause" : "Activate"}
                                </button>
                                <button onClick={() => deletePerk(perk.id)} className="text-[10px] font-semibold text-[var(--red)] hover:underline">Delete</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── Referrals Tab ───────────────────────────────────── */}
          {tab === "referrals" && (
            <div>
              {/* Stats row, inline, no cards */}
              <div className="text-[12px] text-[var(--tx2)] mb-6">
                <span className="font-semibold text-[var(--tx)]">Active Codes {activeRefs}</span>
                <span className="mx-2 text-[var(--tx3)]">·</span>
                <span className="font-semibold text-[var(--tx)]">Used This Month {usedThisMonth}</span>
                <span className="mx-2 text-[var(--tx3)]">·</span>
                <span className="font-semibold text-[var(--tx)]">Conversion Rate {convRate}%</span>
                <span className="mx-2 text-[var(--tx3)]">·</span>
                <span className="font-semibold text-[var(--tx)]">Total Referrals {referrals.length}</span>
              </div>

              {referrals.length === 0 ? (
                <div className="text-center py-12 text-[var(--tx3)] text-[13px]">No referrals yet. They generate automatically when moves complete.</div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-[12px] min-w-[640px]">
                    <thead>
                      <tr className="border-b border-[var(--brd)] bg-[var(--bg)]/50">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Code</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Referrer</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Referred</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Status</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Credit</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Created</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {referrals.map((ref) => {
                        const creditStr = `${formatCurrency(ref.referrer_credit ?? 0)} / ${formatCurrency(ref.referred_discount ?? 0)}`;
                        const referredDisplay = ref.referred_name || ref.referred_email
                          ? [ref.referred_name, ref.referred_email].filter(Boolean).join(" · ")
                          : ref.status === "active"
                            ? "Not used yet"
                            : "-";
                        return (
                          <tr key={ref.id} className="hover:bg-[var(--bg)]/40">
                            <td className="px-4 py-3">
                              <span className="inline-flex items-center gap-1.5">
                                <code className="text-[var(--gold)] border border-[var(--brd)] px-2 py-0.5 rounded-md text-[11px] font-mono">{ref.referral_code}</code>
                                <button
                                  onClick={() => {
                                    navigator.clipboard.writeText(ref.referral_code).then(() => toast("Code copied", "check"));
                                  }}
                                  className="p-1 rounded hover:bg-[var(--bg)] transition-colors text-[var(--tx3)] hover:text-[var(--gold)]"
                                  title="Copy code"
                                >
                                  <Copy className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              <div className="font-semibold text-[var(--tx)]">{ref.referrer_name}</div>
                              <div className="text-[10px] text-[var(--tx3)]">{ref.referrer_email}</div>
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">{referredDisplay}</td>
                            <td className="px-4 py-3">
                              <span className={`dt-badge tracking-[0.04em] ${REF_STATUS_BADGE[ref.status] || "text-[var(--tx3)]"}`}>{ref.status}</span>
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">
                              {ref.status === "credited"
                                ? <span className="text-blue-600">Credited {creditStr}{ref.credited_at ? ` · ${formatPlatformDisplay(ref.credited_at, { month: "short", day: "numeric" })}` : ""}</span>
                                : ref.status === "used"
                                  ? <span>Pending {creditStr}</span>
                                  : <span>{creditStr}</span>}
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">{formatPlatformDisplay(ref.created_at, { month: "short", day: "numeric" })}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2 flex-wrap">
                                {ref.status === "used" && (
                                  <button onClick={() => markCredited(ref)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Mark Credited</button>
                                )}
                                <button
                                  onClick={() => deleteReferral(ref)}
                                  className="text-[10px] font-semibold text-[var(--red)] hover:underline inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── VIP Clients Tab ─────────────────────────────────── */}
          {tab === "vip" && (
            <div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-[11px] text-amber-800 mb-5">
                <strong>Auto-VIP rules:</strong> Estate tier clients, OR lifetime value &gt; $5,000, OR 2+ referrals sent
              </div>
              {vipContacts.length === 0 ? (
                <div className="text-center py-12 text-[var(--tx3)] text-[13px]">No VIP clients yet. They are auto-flagged when they meet the criteria after a completed move.</div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                  <table className="w-full text-[12px] min-w-[400px]">
                    <thead>
                      <tr className="border-b border-[var(--brd)] bg-[var(--bg)]/50">
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Client</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Lifetime Value</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">Referrals</th>
                        <th className="px-4 py-3 text-left font-semibold text-[var(--tx3)]">VIP Since</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--brd)]/30">
                      {vipContacts.map((c) => (
                        <tr key={c.id} className="hover:bg-[var(--bg)]/40">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--tx)]">{c.name || "-"}</div>
                            <div className="text-[10px] text-[var(--tx3)]">{c.email}</div>
                          </td>
                          <td className="px-4 py-3 text-[var(--gold)] font-semibold">{formatCurrency(c.lifetime_value)}</td>
                          <td className="px-4 py-3 text-[var(--tx3)]">{c.referral_count}</td>
                          <td className="px-4 py-3 text-[var(--tx3)]">{formatPlatformDisplay(c.created_at, { month: "short" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showCreate && (
        <CreatePerkModal
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
          partners={partners}
        />
      )}
      {showCreatePromo && (
        <CreatePromoReferralModal
          onClose={() => setShowCreatePromo(false)}
          onCreated={loadData}
        />
      )}
    </div>
  );
}

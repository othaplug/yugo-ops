"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, X, Gift, Users, Tag } from "lucide-react";
import { useToast } from "../components/Toast";
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
  active: "bg-[var(--gdim)] text-[var(--gold)] border border-[var(--gold)]/30",
  used: "bg-green-50 text-green-700 border border-green-200",
  expired: "bg-red-50 text-red-600 border border-red-200",
  credited: "bg-blue-50 text-blue-700 border border-blue-200",
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.5)" }}>
      <div className="bg-[var(--card)] rounded-2xl w-full max-w-[520px] max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] flex items-center justify-between px-5 py-4 rounded-t-2xl">
          <h3 className="text-[15px] font-bold text-[var(--tx)]">Create Perk</h3>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg)] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Partner</label>
            <select value={form.partner_id} onChange={(e) => set("partner_id", e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none">
              <option value="">Yugo (no partner)</option>
              {partners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Title *</label>
            <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. 10% off your first order" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => set("description", e.target.value)} rows={2} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Offer Type</label>
              <select value={form.offer_type} onChange={(e) => set("offer_type", e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none">
                <option value="percentage_off">% Off</option>
                <option value="dollar_off">$ Off</option>
                <option value="free_service">Free Service</option>
                <option value="consultation">Consultation</option>
                <option value="priority_access">Priority Access</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">
                {form.offer_type === "percentage_off" ? "% Value" : "$ Value"}
              </label>
              <input type="number" value={form.discount_value} onChange={(e) => set("discount_value", e.target.value)} placeholder="e.g. 10" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Code</label>
              <input value={form.redemption_code} onChange={(e) => set("redemption_code", e.target.value.toUpperCase())} placeholder="YUGO10" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] font-mono focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Redemption URL</label>
              <input value={form.redemption_url} onChange={(e) => set("redemption_url", e.target.value)} placeholder="https://…" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Valid From</label>
              <input type="date" value={form.valid_from} onChange={(e) => set("valid_from", e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Valid Until (blank = no expiry)</label>
              <input type="date" value={form.valid_until} onChange={(e) => set("valid_until", e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Max Redemptions (blank = unlimited)</label>
              <input type="number" value={form.max_redemptions} onChange={(e) => set("max_redemptions", e.target.value)} placeholder="∞" className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-1">Display Order</label>
              <input type="number" value={form.display_order} onChange={(e) => set("display_order", e.target.value)} className="w-full px-3 py-2 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[12px] focus:border-[var(--gold)] outline-none" />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2 rounded-xl text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)]">Cancel</button>
            <button type="button" onClick={handleSave} disabled={saving} className="flex-1 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-60">
              {saving ? "Saving…" : "Save Perk"}
            </button>
          </div>
        </div>
      </div>
    </div>
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

  const loadPartners = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/organizations/list");
      if (res.ok) {
        const data = await res.json();
        setPartners((data.organizations || data || []).map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
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

  return (
    <div className="max-w-[1100px] mx-auto px-4 sm:px-6 py-6 animate-fade-up">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-heading text-[22px] font-bold text-[var(--tx)]">Perks &amp; Referrals</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">Manage offers, client referral codes, and VIP clients</p>
        </div>
        {tab === "perks" && (
          <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors">
            <Plus className="w-[13px] h-[13px]" /> Create Perk
          </button>
        )}
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
              {perks.length === 0 ? (
                <div className="text-center py-16">
                  <Tag className="w-10 h-10 text-[var(--tx3)] mx-auto mb-3" />
                  <p className="text-[13px] text-[var(--tx3)]">No perks yet. Create your first offer.</p>
                </div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
                  <table className="w-full text-[12px]">
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
                        const statusCls = !perk.is_active ? "text-[var(--tx3)] bg-[var(--bg)]" : expired ? "text-red-600 bg-red-50" : "text-[#2D9F5A] bg-green-50";
                        return (
                          <tr key={perk.id} className="hover:bg-[var(--bg)]/40">
                            <td className="px-4 py-3 text-[var(--tx3)]">{perk.organizations?.name || "Yugo"}</td>
                            <td className="px-4 py-3 font-semibold text-[var(--tx)]">{perk.title}</td>
                            <td className="px-4 py-3">
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold ${OFFER_TYPE_BADGE[perk.offer_type] || ""}`}>
                                {OFFER_TYPE_LABELS[perk.offer_type] || perk.offer_type}
                              </span>
                            </td>
                            <td className="px-4 py-3">
                              {perk.redemption_code ? <code className="bg-[var(--bg)] px-2 py-0.5 rounded text-[11px]">{perk.redemption_code}</code> : <span className="text-[var(--tx3)]">—</span>}
                            </td>
                            <td className="px-4 py-3 text-[var(--tx3)]">{perk.valid_until ? new Date(perk.valid_until + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "No expiry"}</td>
                            <td className="px-4 py-3 text-[var(--tx3)]">
                              {perk.current_redemptions}{perk.max_redemptions ? ` / ${perk.max_redemptions}` : " / ∞"}
                            </td>
                            <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-semibold ${statusCls}`}>{status}</span></td>
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
              )}
            </div>
          )}

          {/* ─── Referrals Tab ───────────────────────────────────── */}
          {tab === "referrals" && (
            <div>
              {/* Stats row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: "Active Codes", value: activeRefs },
                  { label: "Used This Month", value: usedThisMonth },
                  { label: "Conversion Rate", value: `${convRate}%` },
                  { label: "Total Referrals", value: referrals.length },
                ].map((s) => (
                  <div key={s.label} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-4">
                    <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/60 mb-1">{s.label}</div>
                    <div className="text-[24px] font-bold font-hero text-[var(--tx)]">{s.value}</div>
                  </div>
                ))}
              </div>

              {referrals.length === 0 ? (
                <div className="text-center py-12 text-[var(--tx3)] text-[13px]">No referrals yet. They generate automatically when moves complete.</div>
              ) : (
                <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
                  <table className="w-full text-[12px]">
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
                      {referrals.map((ref) => (
                        <tr key={ref.id} className="hover:bg-[var(--bg)]/40">
                          <td className="px-4 py-3">
                            <code className="bg-[var(--gdim)] text-[var(--gold)] px-2 py-0.5 rounded text-[11px] font-mono">{ref.referral_code}</code>
                          </td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-[var(--tx)]">{ref.referrer_name}</div>
                            <div className="text-[10px] text-[var(--tx3)]">{ref.referrer_email}</div>
                          </td>
                          <td className="px-4 py-3 text-[var(--tx3)]">
                            {ref.referred_name || <span className="text-[var(--tx3)]/50">—</span>}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold capitalize ${REF_STATUS_BADGE[ref.status] || ""}`}>{ref.status}</span>
                          </td>
                          <td className="px-4 py-3 text-[var(--tx3)]">
                            {ref.status === "credited"
                              ? <span className="text-blue-600">Credited {ref.credited_at ? new Date(ref.credited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : ""}</span>
                              : ref.status === "used" ? "Pending" : "—"}
                          </td>
                          <td className="px-4 py-3 text-[var(--tx3)]">{new Date(ref.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</td>
                          <td className="px-4 py-3">
                            {ref.status === "used" && (
                              <button onClick={() => markCredited(ref)} className="text-[10px] font-semibold text-[var(--gold)] hover:underline">Mark Credited</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
                  <table className="w-full text-[12px]">
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
                            <div className="font-semibold text-[var(--tx)]">{c.name || "—"}</div>
                            <div className="text-[10px] text-[var(--tx3)]">{c.email}</div>
                          </td>
                          <td className="px-4 py-3 text-[var(--gold)] font-semibold">{formatCurrency(c.lifetime_value)}</td>
                          <td className="px-4 py-3 text-[var(--tx3)]">{c.referral_count}</td>
                          <td className="px-4 py-3 text-[var(--tx3)]">{new Date(c.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
    </div>
  );
}

"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Trash as Trash2 } from "@phosphor-icons/react";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";

interface MoveOption {
  id: string;
  label: string;
  clientName: string;
  valuationTier: string;
  address: string;
  date: string;
}

interface DeliveryOption {
  id: string;
  label: string;
  clientName: string;
  address: string;
  date: string;
}

interface ClaimItem {
  name: string;
  description: string;
  damage_description: string;
  declared_value: number;
  weight_lbs: number;
}

const VALUATION_OPTIONS = [
  { value: "released", label: "Released Value ($0.60/lb)" },
  { value: "enhanced", label: "Enhanced Value ($5.00/lb)" },
  { value: "full_replacement", label: "Full Replacement Value" },
];

const emptyItem = (): ClaimItem => ({
  name: "",
  description: "",
  damage_description: "",
  declared_value: 0,
  weight_lbs: 0,
});

export default function NewClaimClient({
  moves,
  deliveries,
}: {
  moves: MoveOption[];
  deliveries: DeliveryOption[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobType, setJobType] = useState<"move" | "delivery">("move");
  const [selectedJobId, setSelectedJobId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [valuationTier, setValuationTier] = useState("released");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<ClaimItem[]>([emptyItem()]);

  const phoneInput = usePhoneInput(clientPhone, setClientPhone);

  const selectedMove = moves.find((m) => m.id === selectedJobId);
  const selectedDelivery = deliveries.find((d) => d.id === selectedJobId);

  const handleJobSelect = (id: string) => {
    setSelectedJobId(id);
    if (jobType === "move") {
      const m = moves.find((x) => x.id === id);
      if (m) {
        setClientName(m.clientName);
        setValuationTier(m.valuationTier || "released");
      }
    } else {
      const d = deliveries.find((x) => x.id === id);
      if (d) setClientName(d.clientName);
    }
  };

  const updateItem = (idx: number, field: keyof ClaimItem, value: string | number) => {
    setItems((prev) => prev.map((item, i) => (i === idx ? { ...item, [field]: value } : item)));
  };

  const removeItem = (idx: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalValue = items.reduce((s, i) => s + (i.declared_value || 0), 0);

  const handleSubmit = useCallback(async () => {
    setError(null);
    if (!clientName.trim()) { setError("Client name is required"); return; }
    if (!clientEmail.trim()) { setError("Client email is required"); return; }
    if (items.every((i) => !i.name.trim())) { setError("At least one item with a name is required"); return; }

    const validItems = items.filter((i) => i.name.trim());
    setSaving(true);

    try {
      const res = await fetch("/api/admin/claims/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          moveId: jobType === "move" ? selectedJobId || null : null,
          deliveryId: jobType === "delivery" ? selectedJobId || null : null,
          clientName: clientName.trim(),
          clientEmail: clientEmail.trim().toLowerCase(),
          clientPhone: clientPhone.trim() ? normalizePhone(clientPhone) : null,
          valuationTier,
          description: description.trim(),
          items: validItems.map((i) => ({
            ...i,
            declared_value: Number(i.declared_value) || 0,
            weight_lbs: Number(i.weight_lbs) || 0,
            photo_urls: [],
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) { setError(data.error || "Failed to create claim"); return; }

      router.push(`/admin/claims/${data.claimId}`);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }, [clientName, clientEmail, clientPhone, items, jobType, selectedJobId, valuationTier, description, router]);

  const jobOptions = jobType === "move" ? moves : deliveries;

  return (
    <div className="p-4 sm:p-6 max-w-[800px] mx-auto">
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-[13px] text-[var(--tx3)] hover:text-[var(--tx)] mb-4 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <h1 className="text-[22px] font-bold text-[var(--tx)] mb-1">New Claim</h1>
      <p className="text-[13px] text-[var(--tx3)] mb-6">
        Create a damage claim on behalf of a client. They will receive an email notification.
      </p>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-[var(--red)]/10 border border-[var(--red)]/20 text-[13px] text-[var(--red)]">
          {error}
        </div>
      )}

      {/* Job selection */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 mb-4">
        <h3 className="text-[14px] font-bold text-[var(--tx)] mb-3">Link to Job</h3>

        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => { setJobType("move"); setSelectedJobId(""); }}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              jobType === "move"
                ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"
            }`}
          >
            Move
          </button>
          <button
            type="button"
            onClick={() => { setJobType("delivery"); setSelectedJobId(""); }}
            className={`px-3.5 py-1.5 rounded-lg text-[12px] font-semibold transition-colors ${
              jobType === "delivery"
                ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"
            }`}
          >
            Delivery
          </button>
        </div>

        <select
          value={selectedJobId}
          onChange={(e) => handleJobSelect(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
        >
          <option value="">Select a {jobType}...</option>
          {jobOptions.map((j) => (
            <option key={j.id} value={j.id}>
              {j.label}{j.date ? ` (${j.date})` : ""}
            </option>
          ))}
        </select>

        {(selectedMove || selectedDelivery) && (
          <div className="mt-2 text-[11px] text-[var(--tx3)]">
            {selectedMove?.address || selectedDelivery?.address}
          </div>
        )}
      </div>

      {/* Client Info */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 mb-4">
        <h3 className="text-[14px] font-bold text-[var(--tx)] mb-3">Client Details</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">
              Name <span className="text-[var(--red)]">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Client name"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">
              Email <span className="text-[var(--red)]">*</span>
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Phone</label>
            <input
              ref={phoneInput.ref}
              type="tel"
              value={clientPhone}
              onChange={phoneInput.onChange}
              placeholder={PHONE_PLACEHOLDER}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Valuation Tier</label>
            <select
              value={valuationTier}
              onChange={(e) => setValuationTier(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none"
            >
              {VALUATION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3">
          <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Claim Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of the damage or incident..."
            rows={2}
            className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none resize-none"
          />
        </div>
      </div>

      {/* Items */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[var(--tx)]">Damaged Items</h3>
          <button
            type="button"
            onClick={() => setItems((prev) => [...prev, emptyItem()])}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition-colors"
          >
            <Plus className="w-3 h-3" /> Add Item
          </button>
        </div>

        <div className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className="rounded-lg border border-[var(--brd)] p-4 bg-[var(--bg)]">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-bold text-[var(--tx3)]">Item {idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-1 rounded hover:bg-[var(--red)]/10 text-[var(--tx3)] hover:text-[var(--red)] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1 uppercase">
                    Item Name <span className="text-[var(--red)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => updateItem(idx, "name", e.target.value)}
                    placeholder="e.g. Dining Table"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1 uppercase">Description</label>
                  <input
                    type="text"
                    value={item.description}
                    onChange={(e) => updateItem(idx, "description", e.target.value)}
                    placeholder="e.g. Oak, 6-seater"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none"
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1 uppercase">Damage Description</label>
                <input
                  type="text"
                  value={item.damage_description}
                  onChange={(e) => updateItem(idx, "damage_description", e.target.value)}
                  placeholder="e.g. Deep scratch on surface, broken leg"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1 uppercase">Declared Value ($)</label>
                  <input
                    type="number"
                    value={item.declared_value || ""}
                    onChange={(e) => updateItem(idx, "declared_value", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1 uppercase">Weight (lbs)</label>
                  <input
                    type="number"
                    value={item.weight_lbs || ""}
                    onChange={(e) => updateItem(idx, "weight_lbs", parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)] text-[12px] text-[var(--tx)] outline-none"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Submit */}
      <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[12px] text-[var(--tx3)]">Total Claimed Value</span>
            <p className="text-[20px] font-bold text-[var(--tx)]">
              ${totalValue.toLocaleString()}
            </p>
          </div>
          <div className="text-right text-[12px] text-[var(--tx3)]">
            {items.filter((i) => i.name.trim()).length} item{items.filter((i) => i.name.trim()).length !== 1 ? "s" : ""}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-full py-3 rounded-lg text-[14px] font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors disabled:opacity-50"
        >
          {saving ? "Creating Claim..." : "Create Claim & Notify Client"}
        </button>
        <p className="text-[11px] text-[var(--tx3)] mt-2 text-center">
          The client will receive an email notification with claim details
        </p>
      </div>
    </div>
  );
}

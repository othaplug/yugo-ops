"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { X, Lock } from "@phosphor-icons/react";
import { getDisplayLabel } from "@/lib/displayLabels";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";

interface Delivery {
  id: string;
  delivery_number: string;
  customer_name: string | null;
  client_name: string | null;
  status: string;
  stage: string | null;
  scheduled_date: string | null;
  time_slot: string | null;
  delivery_address: string | null;
  pickup_address: string | null;
  items: unknown[] | string[] | null;
  category: string | null;
  crew_id: string | null;
  created_at: string;
}

interface Props {
  delivery: Delivery;
  onClose: () => void;
  onSaved: () => void;
}

export default function PartnerEditDeliveryModal({ delivery: d, onClose, onSaved }: Props) {
  const existingItems = Array.isArray(d.items)
    ? normalizeDeliveryItemsForDisplay(d.items)
        .map((row) => (row.qty > 1 ? `${row.name} ×${row.qty}` : row.name))
        .filter(Boolean)
        .join("\n")
    : "";

  const [form, setForm] = useState({
    customer_name: d.customer_name || "",
    customer_email: "",
    customer_phone: "",
    pickup_address: d.pickup_address || "",
    delivery_address: d.delivery_address || "",
    scheduled_date: d.scheduled_date?.slice(0, 10) || "",
    time_slot: d.time_slot || "",
    items: existingItems,
    instructions: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
  }, [onClose]);
  useEffect(() => {
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [handleEscape]);

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fieldInput =
    "field-input-compact w-full";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError("Customer name is required"); return; }
    if (!form.delivery_address.trim()) { setError("Delivery address is required"); return; }
    if (!form.scheduled_date) { setError("Date is required"); return; }

    setSaving(true);
    setError("");

    const items = form.items
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    try {
      const res = await fetch(`/api/partner/deliveries/${d.id}/update`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          pickup_address: form.pickup_address.trim() || null,
          delivery_address: form.delivery_address.trim(),
          scheduled_date: form.scheduled_date,
          time_slot: form.time_slot.trim() || null,
          items,
          instructions: form.instructions.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const locked = ["delivered", "completed", "cancelled"].includes((d.status || "").toLowerCase());

  const modalContent = (
    <div className="fixed inset-0 z-[99999] flex min-h-0 items-center justify-center bg-black/50 backdrop-blur-sm p-4 sm:p-5 modal-overlay" onClick={onClose}>
      <div
        className="bg-[var(--card)] rounded-t-2xl sm:rounded-2xl shadow-2xl w-full max-w-[540px] overflow-y-auto mx-0 sm:mx-4 sheet-card sm:modal-card"
        style={{ maxHeight: "min(90dvh, 90vh)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-hero text-[26px] font-bold text-[var(--tx)]">Edit Delivery</h2>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">{d.delivery_number}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-[var(--bg)]" aria-label="Close">
            <X size={18} weight="regular" />
          </button>
        </div>

        {locked ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg)] flex items-center justify-center">
              <Lock size={22} color="#888" />
            </div>
            <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">
              This delivery is {getDisplayLabel(d.status, "delivery")}
            </p>
            <p className="text-[12px] text-[var(--tx3)] mt-1">Completed or cancelled deliveries cannot be edited.</p>
          </div>
        ) : (
          <form onSubmit={handleSave} className="p-5 space-y-4">
            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">{error}</div>
            )}

            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Customer name <span className="text-red-500">*</span></label>
              <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} className={fieldInput} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Pickup address</label>
                <input value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} placeholder="Pickup location" className={fieldInput} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Delivery address <span className="text-red-500">*</span></label>
                <input value={form.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} className={fieldInput} />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Date <span className="text-red-500">*</span></label>
                <input type="date" value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} className={fieldInput} />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Time slot</label>
                <input value={form.time_slot} onChange={(e) => set("time_slot", e.target.value)} placeholder="e.g. 9:00 AM" className={fieldInput} />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Items (one per line)</label>
              <textarea value={form.items} onChange={(e) => set("items", e.target.value)} rows={3} placeholder="Sofa x2&#10;Coffee Table" className={`${fieldInput} resize-y text-[13px]`} />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Instructions / notes</label>
              <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} rows={2} placeholder="Access codes, parking, special handling…" className={`${fieldInput} resize-y text-[13px]`} />
            </div>

            <div className="flex gap-3 pt-2 pb-2">
              <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx3)] hover:bg-[var(--bg)] transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-xl text-[13px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50">
                {saving ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(modalContent, document.body);
}

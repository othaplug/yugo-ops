"use client";

import { useState } from "react";

interface Props {
  orgId: string;
  orgType: string;
  onClose: () => void;
  onCreated: () => void;
}

export default function PartnerScheduleModal({ orgId, orgType, onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    pickup_address: "",
    delivery_address: "",
    scheduled_date: "",
    time_slot: "",
    items: "",
    instructions: "",
    special_handling: false,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) { setError("Customer name is required"); return; }
    if (!form.delivery_address.trim()) { setError("Delivery address is required"); return; }
    if (!form.scheduled_date) { setError("Date is required"); return; }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create delivery");
      onCreated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-[540px] max-h-[90vh] overflow-y-auto mx-4" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-[20px] font-bold text-[#1A1A1A] font-serif">Schedule Delivery</h2>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <FormField label="Customer / Recipient Name" required>
              <input value={form.customer_name} onChange={(e) => set("customer_name", e.target.value)} placeholder="Full name" className="field-input-partner" />
            </FormField>
            <FormField label="Customer Email">
              <input value={form.customer_email} onChange={(e) => set("customer_email", e.target.value)} placeholder="email@example.com" type="email" className="field-input-partner" />
            </FormField>
            <FormField label="Pickup Address">
              <input value={form.pickup_address} onChange={(e) => set("pickup_address", e.target.value)} placeholder="Warehouse or store address" className="field-input-partner" />
            </FormField>
            <FormField label="Delivery Address" required>
              <input value={form.delivery_address} onChange={(e) => set("delivery_address", e.target.value)} placeholder="Delivery destination" className="field-input-partner" />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Date" required>
                <input value={form.scheduled_date} onChange={(e) => set("scheduled_date", e.target.value)} type="date" className="field-input-partner" />
              </FormField>
              <FormField label="Time Slot">
                <input value={form.time_slot} onChange={(e) => set("time_slot", e.target.value)} placeholder="e.g. 9 AM - 12 PM" className="field-input-partner" />
              </FormField>
            </div>
            <FormField label="Items (one per line)">
              <textarea value={form.items} onChange={(e) => set("items", e.target.value)} rows={3} placeholder={"Sofa x2\nCoffee Table\nSide Table"} className="field-input-partner resize-y" />
            </FormField>
            <FormField label="Special Instructions">
              <textarea value={form.instructions} onChange={(e) => set("instructions", e.target.value)} rows={2} placeholder="Fragile items, building access codes, etc." className="field-input-partner resize-y" />
            </FormField>
            <label className="flex items-center gap-2 cursor-pointer">
              <input checked={form.special_handling} onChange={(e) => set("special_handling", e.target.checked)} type="checkbox" className="rounded border-[#D4D0CB] text-[#C9A962] focus:ring-[#C9A962]" />
              <span className="text-[12px] text-[#1A1A1A]">Requires special handling (fragile, high-value)</span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full mt-2 px-4 py-2.5 rounded-lg text-[13px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating..." : "Schedule Delivery"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#888] mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

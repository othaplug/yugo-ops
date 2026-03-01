"use client";

import { useState, useEffect } from "react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { Plus, Trash2 } from "lucide-react";

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Office", "Other"];
const COMPLEXITY_PRESETS = ["White Glove", "High Value", "Fragile", "Artwork", "Antiques", "Storage"];

interface Props {
  orgId: string;
  orgType: string;
  onClose: () => void;
  onCreated: () => void;
  /** Pre-fill date when opening from calendar click */
  initialDate?: string;
}

export default function PartnerScheduleModal({ orgId, orgType, onClose, onCreated, initialDate = "" }: Props) {
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    pickup_address: "",
    delivery_address: "",
    scheduled_date: initialDate,
    time_slot: "",
    delivery_window: "",
    items: "",
    instructions: "",
    access_notes: "",
    internal_notes: "",
    special_handling: false,
    complexityIndicators: [] as string[],
  });
  const [inventory, setInventory] = useState<{ room: string; item_name: string }[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [inventoryBulkMode, setInventoryBulkMode] = useState(false);
  const [inventoryBulkText, setInventoryBulkText] = useState("");
  const [pickupRaw, setPickupRaw] = useState("");
  const [deliveryRaw, setDeliveryRaw] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const set = (k: string, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (initialDate) setForm((f) => ({ ...f, scheduled_date: initialDate }));
  }, [initialDate]);

  const addInventoryItem = () => {
    if (!newItemName.trim() || !newRoom) return;
    const name = newItemName.trim();
    const itemName = newItemQty > 1 ? `${name} x${newItemQty}` : name;
    setInventory((prev) => [...prev, { room: newRoom, item_name: itemName }]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const removeInventoryItem = (idx: number) => {
    setInventory((prev) => prev.filter((_, i) => i !== idx));
  };

  const parseBulkInventoryLines = (text: string): string[] => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s+x(\d+)$/i);
        return m ? `${m[1].trim()} x${m[2]}` : line;
      });
  };

  const addBulkInventoryItems = () => {
    if (!newRoom || !inventoryBulkText.trim()) return;
    const itemNames = parseBulkInventoryLines(inventoryBulkText);
    if (itemNames.length === 0) return;
    const newItems = itemNames.map((item_name) => ({ room: newRoom, item_name }));
    setInventory((prev) => [...prev, ...newItems]);
    setInventoryBulkText("");
  };

  const toggleComplexity = (preset: string) => {
    setForm((f) => ({
      ...f,
      complexityIndicators: f.complexityIndicators.includes(preset)
        ? f.complexityIndicators.filter((p) => p !== preset)
        : [...f.complexityIndicators, preset],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customer_name.trim()) {
      setError("Customer / recipient name is required");
      return;
    }
    if (!form.delivery_address.trim()) {
      setError("Delivery address is required");
      return;
    }
    if (!form.scheduled_date) {
      setError("Date is required");
      return;
    }

    setSubmitting(true);
    setError("");

    const itemsList =
      inventory.length > 0
        ? inventory.map((i) => (i.item_name.includes(" x") ? i.item_name : `${i.room}: ${i.item_name}`))
        : form.items
          ? form.items.split("\n").map((l) => l.trim()).filter(Boolean)
          : [];
    const instructionsMerged = [form.instructions, form.access_notes, form.internal_notes]
      .filter(Boolean)
      .join("\n");

    try {
      const res = await fetch("/api/partner/deliveries/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.customer_name.trim(),
          customer_email: form.customer_email.trim() || null,
          customer_phone: form.customer_phone.trim() ? normalizePhone(form.customer_phone) : null,
          pickup_address: form.pickup_address.trim() || null,
          delivery_address: form.delivery_address.trim(),
          scheduled_date: form.scheduled_date,
          time_slot: form.time_slot.trim() || null,
          delivery_window: form.delivery_window || null,
          items: itemsList,
          instructions: instructionsMerged || null,
          special_handling: form.special_handling,
          complexity_indicators: form.complexityIndicators.length ? form.complexityIndicators : null,
        }),
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

  const fieldInput =
    "w-full text-[14px] bg-white border border-[#E8E4DF] rounded-lg px-3 py-2.5 text-[#1A1A1A] placeholder:text-[#999] focus:border-[#C9A962] focus:ring-1 focus:ring-[#C9A962]/30 outline-none transition-colors";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-[600px] max-h-[90vh] overflow-y-auto mx-0 sm:mx-4 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-[#E8E4DF] px-4 sm:px-6 py-4 flex items-center justify-between shrink-0">
          <h2 className="font-hero text-[20px] sm:text-[22px] font-bold text-[#1A1A1A]">Schedule Delivery</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#F5F3F0] transition-colors text-[#666]"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-5">
          {error && (
            <div className="px-3 py-2.5 rounded-lg bg-red-50 border border-red-200 text-[13px] text-red-700">
              {error}
            </div>
          )}

          {/* Client */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Client / Recipient</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <FormField label="Name" required>
                <input
                  value={form.customer_name}
                  onChange={(e) => set("customer_name", e.target.value)}
                  placeholder="Full name"
                  className={fieldInput}
                />
              </FormField>
              <FormField label="Email">
                <input
                  type="email"
                  value={form.customer_email}
                  onChange={(e) => set("customer_email", e.target.value)}
                  placeholder="email@example.com"
                  className={fieldInput}
                />
              </FormField>
              <FormField label="Phone">
                <input
                  type="tel"
                  value={form.customer_phone}
                  onChange={(e) => set("customer_phone", e.target.value)}
                  onBlur={() => form.customer_phone && set("customer_phone", formatPhone(form.customer_phone))}
                  placeholder="(123) 456-7890"
                  className={fieldInput}
                />
              </FormField>
            </div>
          </section>

          {/* Addresses */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Addresses</h3>
            <FormField label="Pickup Address">
              <AddressAutocomplete
                value={form.pickup_address || pickupRaw}
                onRawChange={setPickupRaw}
                onChange={(r) => set("pickup_address", r.fullAddress)}
                placeholder="Warehouse or store address"
                className={fieldInput}
              />
            </FormField>
            <FormField label="Delivery Address" required>
              <AddressAutocomplete
                value={form.delivery_address || deliveryRaw}
                onRawChange={setDeliveryRaw}
                onChange={(r) => set("delivery_address", r.fullAddress)}
                placeholder="Delivery destination"
                className={fieldInput}
              />
            </FormField>
          </section>

          {/* Schedule */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField label="Date" required>
                <input
                  type="date"
                  value={form.scheduled_date}
                  onChange={(e) => set("scheduled_date", e.target.value)}
                  className={fieldInput}
                />
              </FormField>
              <FormField label="Time slot">
                <input
                  value={form.time_slot}
                  onChange={(e) => set("time_slot", e.target.value)}
                  placeholder="e.g. 9:00 AM"
                  className={fieldInput}
                />
              </FormField>
              <FormField label="Delivery window" className="sm:col-span-2">
                <select
                  value={form.delivery_window}
                  onChange={(e) => set("delivery_window", e.target.value)}
                  className={fieldInput}
                >
                  <option value="">Select window…</option>
                  {TIME_WINDOW_OPTIONS.map((w) => (
                    <option key={w} value={w}>
                      {w}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </section>

          {/* Inventory */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Inventory</h3>
            {inventory.length > 0 && (
              <ul className="space-y-1.5 mb-2">
                {inventory.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[#FAF8F5] border border-[#E8E4DF]"
                  >
                    <span className="text-[12px] text-[#1A1A1A]">
                      <span className="text-[#888]">{item.room}:</span> {item.item_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInventoryItem(idx)}
                      className="p-1 rounded text-[#888] hover:text-red-600"
                      aria-label="Remove item"
                    >
                      <Trash2 className="w-[14px] h-[14px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center gap-2 mb-2">
              <button
                type="button"
                onClick={() => setInventoryBulkMode(false)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                  !inventoryBulkMode ? "bg-[#C9A962] text-white" : "bg-[#F5F3F0] text-[#666] hover:bg-[#E8E4DF]"
                }`}
              >
                Single add
              </button>
              <button
                type="button"
                onClick={() => setInventoryBulkMode(true)}
                className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${
                  inventoryBulkMode ? "bg-[#C9A962] text-white" : "bg-[#F5F3F0] text-[#666] hover:bg-[#E8E4DF]"
                }`}
              >
                Bulk add
              </button>
            </div>
            {inventoryBulkMode ? (
              <div className="space-y-2">
                <select
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className={`${fieldInput} max-w-[180px]`}
                >
                  <option value="">Room</option>
                  {DEFAULT_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <textarea
                  value={inventoryBulkText}
                  onChange={(e) => setInventoryBulkText(e.target.value)}
                  placeholder="One item per line, e.g. Couch x2"
                  rows={3}
                  className={`${fieldInput} resize-y text-[13px]`}
                />
                <button
                  type="button"
                  onClick={addBulkInventoryItems}
                  disabled={!inventoryBulkText.trim() || !newRoom}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50"
                >
                  <Plus className="w-[14px] h-[14px]" /> Add all
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2 items-end">
                <select
                  value={newRoom}
                  onChange={(e) => setNewRoom(e.target.value)}
                  className={`${fieldInput} w-full sm:w-[140px]`}
                >
                  <option value="">Room</option>
                  {DEFAULT_ROOMS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())}
                  placeholder="Item (e.g. Couch x2)"
                  className={`${fieldInput} flex-1 min-w-[120px]`}
                />
                <input
                  type="number"
                  min={1}
                  max={99}
                  value={newItemQty}
                  onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                  className={`${fieldInput} w-16`}
                />
                <button
                  type="button"
                  onClick={addInventoryItem}
                  disabled={!newItemName.trim() || !newRoom}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-[12px] font-semibold bg-[#2D6A4F] text-white hover:bg-[#245840] disabled:opacity-50"
                >
                  <Plus className="w-[14px] h-[14px]" /> Add
                </button>
              </div>
            )}
            <p className="text-[11px] text-[#888]">Or paste a simple list below (one per line).</p>
            <textarea
              value={form.items}
              onChange={(e) => set("items", e.target.value)}
              rows={2}
              placeholder="Sofa x2&#10;Coffee Table"
              className={`${fieldInput} resize-y text-[13px]`}
            />
          </section>

          {/* Complexity */}
          <section className="space-y-2">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Complexity</h3>
            <div className="flex flex-wrap gap-2">
              {COMPLEXITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => toggleComplexity(preset)}
                  className={`px-3 py-1.5 rounded-full text-[11px] font-semibold border transition-colors ${
                    form.complexityIndicators.includes(preset)
                      ? "bg-[#C9A962]/20 text-[#8B6914] border-[#C9A962]"
                      : "bg-white text-[#666] border-[#E8E4DF] hover:border-[#C9A962]/50"
                  }`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </section>

          {/* Notes */}
          <section className="space-y-3">
            <h3 className="text-[11px] font-semibold tracking-wider uppercase text-[#888]">Notes</h3>
            <FormField label="Instructions / access">
              <textarea
                value={form.instructions}
                onChange={(e) => set("instructions", e.target.value)}
                rows={2}
                placeholder="Building access, codes, parking…"
                className={`${fieldInput} resize-y text-[13px]`}
              />
            </FormField>
            <FormField label="Internal notes (optional)">
              <textarea
                value={form.internal_notes}
                onChange={(e) => set("internal_notes", e.target.value)}
                rows={2}
                placeholder="Internal notes…"
                className={`${fieldInput} resize-y text-[13px]`}
              />
            </FormField>
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.special_handling}
                onChange={(e) => set("special_handling", e.target.checked)}
                className="rounded border-[#D4D0CB] text-[#C9A962] focus:ring-[#C9A962]"
              />
              <span className="text-[13px] text-[#1A1A1A]">Requires special handling (fragile, high-value)</span>
            </label>
          </section>

          <div className="flex gap-3 pt-2 pb-4 sm:pb-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-[13px] font-semibold border border-[#E8E4DF] text-[#666] hover:bg-[#F5F3F0] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-3 rounded-xl text-[13px] font-bold bg-[#2D6A4F] text-white hover:bg-[#245840] transition-colors disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Schedule Delivery"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({
  label,
  required,
  children,
  className = "",
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-[#888] mb-1">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

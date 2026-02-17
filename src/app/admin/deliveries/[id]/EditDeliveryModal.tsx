"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import ModalOverlay from "../../components/ModalOverlay";

interface EditDeliveryModalProps {
  delivery: any;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function EditDeliveryModal({ delivery, open: controlledOpen, onOpenChange }: EditDeliveryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange?.(v); if (controlledOpen === undefined) setInternalOpen(v); };
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const itemsRaw = (form.get("items") as string) || "";
    const items = itemsRaw.split("\n").filter((i) => i.trim()).map((line) => {
      const m = line.match(/^(.+?)\s*\|\s*(\d+)$/);
      if (m) return { name: m[1].trim(), qty: parseInt(m[2], 10) };
      return { name: line.trim(), qty: 1 };
    });

    await supabase
      .from("deliveries")
      .update({
        customer_name: form.get("customer_name"),
        customer_email: form.get("customer_email") || null,
        customer_phone: form.get("customer_phone") || null,
        delivery_address: form.get("delivery_address"),
        pickup_address: form.get("pickup_address"),
        scheduled_date: form.get("scheduled_date"),
        delivery_window: form.get("delivery_window"),
        instructions: form.get("instructions"),
        items,
        quoted_price: form.get("quoted_price") ? parseFloat(form.get("quoted_price") as string) : null,
        status: form.get("status") || delivery.status,
        special_handling: !!form.get("special_handling"),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
    if (controlledOpen !== undefined) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all"
      >
        Edit
      </button>
    );
  }

  return (
    <ModalOverlay open={open} onClose={() => setOpen(false)} title={`Edit ${delivery.delivery_number}`} maxWidth="md">
      <form onSubmit={handleSave} className="p-5 space-y-3">
          <Field label="Customer">
            <input name="customer_name" defaultValue={delivery.customer_name} className="field-input" />
          </Field>
          <Field label="Email">
            <input name="customer_email" type="email" defaultValue={delivery.customer_email} className="field-input" />
          </Field>
          <Field label="Phone">
            <input name="customer_phone" defaultValue={delivery.customer_phone} className="field-input" />
          </Field>
          <Field label="Pickup Address">
            <input name="pickup_address" defaultValue={delivery.pickup_address} className="field-input" />
          </Field>
          <Field label="Delivery Address">
            <input name="delivery_address" defaultValue={delivery.delivery_address} className="field-input" />
          </Field>
          <Field label="Date">
            <input name="scheduled_date" type="date" defaultValue={delivery.scheduled_date} className="field-input" />
          </Field>
          <Field label="Window">
            <select name="delivery_window" defaultValue={delivery.delivery_window} className="field-input">
              <option value="">Select window…</option>
              {TIME_WINDOW_OPTIONS.map((w) => (
                <option key={w} value={w}>{w}</option>
              ))}
              {delivery.delivery_window && !TIME_WINDOW_OPTIONS.includes(delivery.delivery_window) && (
                <option value={delivery.delivery_window}>{delivery.delivery_window}</option>
              )}
            </select>
          </Field>
          <Field label="Items (one per line, use 'Item | Qty' for quantity)">
            <textarea name="items" rows={3} defaultValue={(delivery.items || []).map((i: any) => typeof i === "object" ? `${i.name || i} | ${i.qty ?? 1}` : i).join("\n")} className="field-input resize-y" />
          </Field>
          <Field label="Quoted Price">
            <input name="quoted_price" type="number" step="0.01" defaultValue={delivery.quoted_price} className="field-input" />
          </Field>
          <Field label="Status">
            <select name="status" defaultValue={delivery.status} className="field-input">
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </Field>
          <Field label="Special Handling">
            <label className="flex items-center gap-2 cursor-pointer">
              <input name="special_handling" type="checkbox" defaultChecked={!!delivery.special_handling} className="rounded border-[var(--brd)]" />
              <span className="text-[12px]">Requires special handling</span>
            </label>
          </Field>
          <Field label="Instructions">
            <textarea name="instructions" rows={2} defaultValue={delivery.instructions} className="field-input resize-y" />
          </Field>
          <button type="submit" disabled={loading} className="w-full px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
      </form>
    </ModalOverlay>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}
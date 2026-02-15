"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface EditDeliveryModalProps {
  delivery: any;
}

export default function EditDeliveryModal({ delivery }: EditDeliveryModalProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);

    await supabase
      .from("deliveries")
      .update({
        customer_name: form.get("customer_name"),
        delivery_address: form.get("delivery_address"),
        pickup_address: form.get("pickup_address"),
        scheduled_date: form.get("scheduled_date"),
        delivery_window: form.get("delivery_window"),
        instructions: form.get("instructions"),
        items: (form.get("items") as string).split("\n").filter((i) => i.trim()),
        updated_at: new Date().toISOString(),
      })
      .eq("id", delivery.id);

    setLoading(false);
    setOpen(false);
    router.refresh();
  };

  if (!open) {
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
    <div className="fixed inset-0 z-[100] flex items-center justify-end sm:justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setOpen(false)} aria-hidden="true" />
      <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full sm:w-[480px] max-w-[480px] max-h-[85dvh] overflow-y-auto shadow-2xl ml-auto sm:ml-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--brd)]">
          <h3 className="text-[13px] font-bold">Edit {delivery.delivery_number}</h3>
          <button onClick={() => setOpen(false)} className="text-[var(--tx3)] text-lg">&times;</button>
        </div>
        <form onSubmit={handleSave} className="p-4 space-y-3">
          <Field label="Customer">
            <input name="customer_name" defaultValue={delivery.customer_name} className="field-input" />
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
            <input name="delivery_window" defaultValue={delivery.delivery_window} className="field-input" />
          </Field>
          <Field label="Items (one per line)">
            <textarea name="items" rows={3} defaultValue={(delivery.items || []).join("\n")} className="field-input resize-y" />
          </Field>
          <Field label="Instructions">
            <textarea name="instructions" rows={2} defaultValue={delivery.instructions} className="field-input resize-y" />
          </Field>
          <button type="submit" disabled={loading} className="w-full px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] disabled:opacity-50">
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
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
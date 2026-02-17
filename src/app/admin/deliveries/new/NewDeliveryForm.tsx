"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import BackButton from "../../components/BackButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";

interface Org {
  id: string;
  name: string;
  type: string;
}

export default function NewDeliveryForm({ organizations }: { organizations: Org[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date") || "";
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const org = organizations.find((o) => o.id === form.get("org_id"));
    const itemsRaw = form.get("items") as string;

    const deliveryNumber = `DEL-${String(Math.floor(Math.random() * 9000) + 1000)}`;

    const { data: created, error } = await supabase
      .from("deliveries")
      .insert({
        delivery_number: deliveryNumber,
        org_id: form.get("org_id"),
        client_name: org?.name || "",
        customer_name: form.get("customer_name"),
        pickup_address: pickupAddress || form.get("pickup_address"),
        delivery_address: deliveryAddress || form.get("delivery_address"),
        items: itemsRaw ? itemsRaw.split("\n").filter((i) => i.trim()) : [],
        scheduled_date: form.get("scheduled_date"),
        time_slot: form.get("time_slot"),
        delivery_window: form.get("delivery_window"),
        status: "scheduled",
        category: form.get("project_type") || org?.type || "retail",
        instructions: form.get("instructions"),
        special_handling: !!form.get("special_handling"),
      })
      .select("id, delivery_number")
      .single();

    setLoading(false);
    if (!error && created) {
      const path = created.delivery_number
        ? `/admin/deliveries/${encodeURIComponent(created.delivery_number)}`
        : `/admin/deliveries/${created.id}`;
      router.push(path);
      router.refresh();
    }
  };

  return (
    <>
      <div className="mb-4"><BackButton label="Back" /></div>
      <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Project Type">
        <select name="project_type" required className="field-input">
          <option value="retail">Retail</option>
          <option value="designer">Designer</option>
          <option value="hospitality">Hospitality</option>
          <option value="gallery">Art Gallery</option>
          <option value="b2c">B2C / Residential</option>
        </select>
      </Field>
      <Field label="Client">
        <select name="org_id" required className="field-input">
          <option value="">Select client...</option>
          {organizations.map((org) => (
            <option key={org.id} value={org.id}>{org.name}</option>
          ))}
        </select>
      </Field>
      <Field label="Customer / Recipient">
        <input name="customer_name" required placeholder="Recipient name" className="field-input" />
      </Field>
      <Field label="Pickup Address">
        <AddressAutocomplete value={pickupAddress} onRawChange={setPickupAddress} onChange={(r) => setPickupAddress(r.fullAddress)} placeholder="Pickup address" required />
        <input type="hidden" name="pickup_address" value={pickupAddress} />
      </Field>
      <Field label="Delivery Address">
        <AddressAutocomplete value={deliveryAddress} onRawChange={setDeliveryAddress} onChange={(r) => setDeliveryAddress(r.fullAddress)} placeholder="Delivery address" required />
        <input type="hidden" name="delivery_address" value={deliveryAddress} />
      </Field>
      <Field label="Date">
        <input name="scheduled_date" type="date" required className="field-input" defaultValue={dateFromUrl} />
      </Field>
      <Field label="Time Slot">
        <input name="time_slot" placeholder="e.g. 9:00 AM" className="field-input" />
      </Field>
      <Field label="Delivery Window">
        <select name="delivery_window" className="field-input">
          <option value="">Select window…</option>
          {TIME_WINDOW_OPTIONS.map((w) => (
            <option key={w} value={w}>{w}</option>
          ))}
        </select>
      </Field>
      <Field label="Items (one per line)">
        <textarea name="items" rows={3} placeholder="Couch x2&#10;Coffee Table" className="field-input resize-y" />
      </Field>
      <Field label="Instructions">
        <textarea name="instructions" rows={2} placeholder="Special instructions..." className="field-input resize-y" />
      </Field>
      <Field label="Special Handling">
        <label className="flex items-center gap-2 cursor-pointer">
          <input name="special_handling" type="checkbox" className="rounded border-[var(--brd)] bg-[var(--bg)] text-[var(--gold)] focus:ring-[var(--gold)]" />
          <span className="text-[12px] text-[var(--tx)]">Requires special handling (fragile, high-value, etc.)</span>
        </label>
      </Field>
      <button
        type="submit"
        disabled={loading}
        className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
      >
        {loading ? "Creating…" : "Create Project"}
      </button>
    </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
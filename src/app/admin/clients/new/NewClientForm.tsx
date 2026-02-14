"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "../../components/Toast";

export default function NewClientForm() {
  const router = useRouter();
  const supabase = createClient();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [clientType, setClientType] = useState("retail");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    // Insert organization
    const { error } = await supabase.from("organizations").insert({
      name: form.get("name"),
      type: form.get("type"),
      contact_name: form.get("contact_name"),
      email: form.get("email"),
      phone: form.get("phone"),
      address: form.get("address"),
      health: "good",
    });

    if (error) {
      toast("Error: " + error.message, "❌");
      setLoading(false);
      return;
    }

    // Log event
    await supabase.from("status_events").insert({
      entity_type: "client",
      entity_id: form.get("name") as string,
      event_type: "new",
      description: `New client onboarded: ${form.get("name")}`,
      icon: "🎉",
    });

    toast("Client created + portal access sent", "🎉");
    setLoading(false);
    router.push("/admin/clients");
    router.refresh();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Field label="Client Type">
        <select name="type" value={clientType} onChange={(e) => setClientType(e.target.value)} className="field-input">
          <option value="retail">Retail</option>
          <option value="designer">Designer</option>
          <option value="hospitality">Hospitality</option>
          <option value="gallery">Gallery</option>
          <option value="realtor">Realtor</option>
          <option value="b2c">B2C Move</option>
        </select>
      </Field>
      <Field label="Company / Client Name">
        <input name="name" required placeholder="e.g. Roche Bobois" className="field-input" />
      </Field>
      <Field label="Contact Name">
        <input name="contact_name" required placeholder="e.g. Marie Dubois" className="field-input" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" required placeholder="email@company.com" className="field-input" />
      </Field>
      <Field label="Phone">
        <input name="phone" placeholder="416-555-0100" className="field-input" />
      </Field>
      <Field label="Address">
        <input name="address" placeholder="123 Yorkville Ave" className="field-input" />
      </Field>

      <button
        type="submit"
        disabled={loading}
        className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create + Send Portal Access"}
      </button>
    </form>
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
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";

type Persona = "client" | "partner";

export default function NewClientForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<Persona>("client");
  const [partnerType, setPartnerType] = useState("retail");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      persona,
      name: form.get("name"),
      email: form.get("email"),
      phone: form.get("phone") || "",
      address: form.get("address") || "",
    };

    if (persona === "partner") {
      payload.type = form.get("type") || partnerType;
      payload.contact_name = form.get("contact_name");
    }

    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Failed to create");

      const msg =
        persona === "partner"
          ? "Partner created + portal access sent"
          : "Client created";
      toast(msg, "party");
      router.push("/admin/clients");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create", "x");
    } finally {
      setLoading(false);
    }
  };

  const partnerButtonLabel = loading ? "Creating..." : "Create + Send Portal Access";
  const clientButtonLabel = loading ? "Creating..." : "Create";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Field label="Type">
        <div className="flex gap-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="persona"
              checked={persona === "client"}
              onChange={() => setPersona("client")}
              className="accent-[var(--gold)]"
            />
            <span className="text-sm">Client</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="persona"
              checked={persona === "partner"}
              onChange={() => setPersona("partner")}
              className="accent-[var(--gold)]"
            />
            <span className="text-sm">Partner</span>
          </label>
        </div>
      </Field>

      {persona === "partner" ? (
        <>
          <Field label="Partner Type">
            <select
              name="type"
              value={partnerType}
              onChange={(e) => setPartnerType(e.target.value)}
              className="field-input"
            >
              <option value="retail">Retail</option>
              <option value="designer">Designer</option>
              <option value="hospitality">Hospitality</option>
              <option value="gallery">Gallery</option>
              <option value="realtor">Realtor</option>
            </select>
          </Field>
          <Field label="Company Name">
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
            {partnerButtonLabel}
          </button>
        </>
      ) : (
        <>
          <Field label="Name">
            <input name="name" required placeholder="e.g. John Smith" className="field-input" />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required placeholder="email@example.com" className="field-input" />
          </Field>
          <Field label="Phone">
            <input name="phone" placeholder="416-555-0100" className="field-input" />
          </Field>
          <Field label="Address">
            <input name="address" placeholder="123 Main St" className="field-input" />
          </Field>
          <p className="text-[11px] text-[var(--tx3)]">
            Add this client to a move and use &quot;Resend tracking link&quot; on the move page to send them a magic-link to track their move (no account needed).
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
          >
            {clientButtonLabel}
          </button>
        </>
      )}
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      {label && (
        <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      )}
      {children}
    </div>
  );
}

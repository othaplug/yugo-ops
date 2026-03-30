"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  type PartnerProfile,
  PARTNER_SEGMENT_GROUPS,
  VERTICAL_TO_TEMPLATE_SLUG,
} from "@/lib/partner-type";

type Persona = "client" | "partner";

const DEFAULT_VERTICAL_BY_PROFILE: Record<PartnerProfile, string> = {
  delivery: "furniture_retailer",
  referral: "realtor",
};

export default function NewClientForm({
  defaultPersona = "client",
  defaultPartnerType = "furniture_retailer",
}: {
  defaultPersona?: Persona;
  defaultPartnerType?: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [persona, setPersona] = useState<Persona>(defaultPersona);
  const [profile, setProfile] = useState<PartnerProfile>("delivery");
  const [partnerType, setPartnerType] = useState(defaultPartnerType);
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const phoneInput = usePhoneInput(phone, setPhone);
  const [sendPortalAccess, setSendPortalAccess] = useState(true);

  const handleProfileChange = (p: PartnerProfile) => {
    setProfile(p);
    setPartnerType(DEFAULT_VERTICAL_BY_PROFILE[p]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      persona,
      name: form.get("name"),
      email: form.get("email"),
      phone: normalizePhone(phone) || "",
      address: address || form.get("address") || "",
    };

    if (persona === "partner") {
      payload.type = partnerType;
      payload.contact_name = form.get("contact_name");
      payload.send_portal_access = sendPortalAccess;
      payload.template_slug = VERTICAL_TO_TEMPLATE_SLUG[partnerType] || null;
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
          ? sendPortalAccess
            ? "Partner created + portal access sent"
            : "Partner created"
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

  const partnerButtonLabel = loading ? "Creating..." : sendPortalAccess ? "Create + Send Portal Access" : "Create Partner";
  const clientButtonLabel = loading ? "Creating..." : "Create";

  const activeSegments = PARTNER_SEGMENT_GROUPS.filter((s) => s.profile === profile);

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
          <Field label="Partner Profile">
            <div className="flex gap-2">
              {PARTNER_SEGMENT_GROUPS.map((seg) => (
                <label key={seg.profile} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="profile"
                    checked={profile === seg.profile}
                    onChange={() => handleProfileChange(seg.profile)}
                    className="accent-[var(--gold)]"
                  />
                  <span className="text-sm">{seg.label}</span>
                </label>
              ))}
            </div>
            <p className="text-[10px] text-[var(--tx3)] mt-1">
              {PARTNER_SEGMENT_GROUPS.find((s) => s.profile === profile)?.description}
            </p>
          </Field>

          <Field label="Vertical">
            <select
              name="type"
              value={partnerType}
              onChange={(e) => setPartnerType(e.target.value)}
              className="field-input"
            >
              {activeSegments.flatMap((seg) =>
                seg.groups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.verticals.map((v) => (
                      <option key={v.value} value={v.value}>
                        {v.label}
                      </option>
                    ))}
                  </optgroup>
                ))
              )}
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
            <input ref={phoneInput.ref} type="tel" value={phone} onChange={phoneInput.onChange} placeholder={PHONE_PLACEHOLDER} className="field-input" />
          </Field>
          <AddressAutocomplete value={address} onRawChange={setAddress} onChange={(r) => setAddress(r.fullAddress)} placeholder="123 Yorkville Ave" label="Address" className="field-input" />
          <input type="hidden" name="address" value={address} />
          <Field label="">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={sendPortalAccess}
                onChange={(e) => setSendPortalAccess(e.target.checked)}
                className="accent-[var(--gold)]"
              />
              <span className="text-sm">Send portal access (invite email with login details)</span>
            </label>
          </Field>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
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
            <input ref={phoneInput.ref} type="tel" value={phone} onChange={phoneInput.onChange} placeholder={PHONE_PLACEHOLDER} className="field-input" />
          </Field>
          <AddressAutocomplete value={address} onRawChange={setAddress} onChange={(r) => setAddress(r.fullAddress)} placeholder="123 Main St" label="Address" className="field-input" />
          <input type="hidden" name="address" value={address} />
          <p className="text-[11px] text-[var(--tx3)]">
            Add this client to a move and use &quot;Resend tracking link&quot; on the move page to send them a magic-link to track their move (no account needed).
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
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

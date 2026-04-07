"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  applyHubSpotSuggestRow,
  useHubSpotContactSuggest,
  type HubSpotSuggestField,
  type HubSpotSuggestRow,
} from "@/hooks/useHubSpotContactSuggest";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  type PartnerProfile,
  PARTNER_SEGMENT_GROUPS,
  REFERRAL_HUB_ORG_TYPES,
  VERTICAL_TO_TEMPLATE_SLUG,
  organizationTypeLabel,
  partnerHasSelfServePortal,
} from "@/lib/partner-type";

type Persona = "client" | "partner";

const ONBOARD_PARTNER_SEGMENTS = PARTNER_SEGMENT_GROUPS.filter((s) => s.profile !== "referral");

const DEFAULT_VERTICAL_BY_PROFILE: Record<Exclude<PartnerProfile, "referral">, string> = {
  delivery: "furniture_retailer",
  portfolio: "property_management_residential",
};

export default function NewClientForm({
  defaultPersona = "client",
  defaultPartnerType = "furniture_retailer",
  referralPartnerHub = false,
}: {
  defaultPersona?: Persona;
  defaultPartnerType?: string;
  referralPartnerHub?: boolean;
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

  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [partnerContactName, setPartnerContactName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [clientPersonName, setClientPersonName] = useState("");
  const [clientEmailField, setClientEmailField] = useState("");

  const [partnerHsActive, setPartnerHsActive] = useState<HubSpotSuggestField | null>(null);
  const partnerHsQuery = useMemo(() => {
    if (partnerHsActive === "business") return partnerCompanyName;
    if (partnerHsActive === "contact") return partnerContactName;
    if (partnerHsActive === "email") return partnerEmail;
    if (partnerHsActive === "phone") return phone;
    return "";
  }, [partnerHsActive, partnerCompanyName, partnerContactName, partnerEmail, phone]);

  const onPartnerHubSpotPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.businessName) setPartnerCompanyName(a.businessName);
    if (a.contactName) setPartnerContactName(a.contactName);
    if (a.email) setPartnerEmail(a.email);
    if (a.phoneFormatted) setPhone(a.phoneFormatted);
  }, []);

  const partnerHs = useHubSpotContactSuggest({
    query: partnerHsQuery,
    activeField: partnerHsActive,
    setActiveField: setPartnerHsActive,
    onPick: onPartnerHubSpotPick,
  });

  const [clientHsActive, setClientHsActive] = useState<HubSpotSuggestField | null>(null);
  const clientHsQuery = useMemo(() => {
    if (clientHsActive === "contact") return clientPersonName;
    if (clientHsActive === "email") return clientEmailField;
    if (clientHsActive === "phone") return phone;
    return "";
  }, [clientHsActive, clientPersonName, clientEmailField, phone]);

  const onClientHubSpotPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.contactName) setClientPersonName(a.contactName);
    if (a.email) setClientEmailField(a.email);
    if (a.phoneFormatted) setPhone(a.phoneFormatted);
  }, []);

  const clientHs = useHubSpotContactSuggest({
    query: clientHsQuery,
    activeField: clientHsActive,
    setActiveField: setClientHsActive,
    onPick: onClientHubSpotPick,
  });

  const partnerPortalSupported = useMemo(() => partnerHasSelfServePortal(partnerType), [partnerType]);

  useEffect(() => {
    if (!partnerPortalSupported) setSendPortalAccess(false);
  }, [partnerPortalSupported]);

  const handleProfileChange = (p: PartnerProfile) => {
    if (p === "referral") return;
    setProfile(p);
    setPartnerType(DEFAULT_VERTICAL_BY_PROFILE[p]);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);

    const form = new FormData(e.currentTarget);

    const payload: Record<string, unknown> = {
      persona,
      phone: normalizePhone(phone) || "",
      address: address || form.get("address") || "",
    };

    if (persona === "partner") {
      payload.name = partnerCompanyName.trim();
      payload.email = partnerEmail.trim();
      payload.type = partnerType;
      payload.contact_name = partnerContactName.trim();
      payload.send_portal_access = partnerPortalSupported && sendPortalAccess;
      payload.template_slug = VERTICAL_TO_TEMPLATE_SLUG[partnerType] || null;
    } else {
      payload.name = clientPersonName.trim();
      payload.email = clientEmailField.trim();
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
          ? partnerPortalSupported && sendPortalAccess
            ? "Partner created + portal access sent"
            : "Partner created"
          : "Client created";
      toast(msg, "party");
      router.push(persona === "partner" && referralPartnerHub ? "/admin/partners/realtors" : "/admin/clients");
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create", "x");
    } finally {
      setLoading(false);
    }
  };

  const partnerButtonLabel = loading
    ? "Creating..."
    : partnerPortalSupported && sendPortalAccess
      ? "Create + Send Portal Access"
      : "Create Partner";
  const clientButtonLabel = loading ? "Creating..." : "Create";

  const activeSegments = ONBOARD_PARTNER_SEGMENTS.filter((s) => s.profile === profile);

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
          {referralPartnerHub ? (
            <>
              <p className="text-[11px] text-[var(--tx3)] leading-relaxed mb-3">
                Creates an organization for commission-based referral partners. Pipeline tracking and individual realtor
                contacts live on the Referral Partners page.
              </p>
              <Field label="Referral partner type">
                <select
                  name="type"
                  value={partnerType}
                  onChange={(e) => setPartnerType(e.target.value)}
                  className="field-input"
                >
                  {REFERRAL_HUB_ORG_TYPES.map((v) => (
                    <option key={v} value={v}>
                      {organizationTypeLabel(v)}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <>
              <Field label="Partner Profile">
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {ONBOARD_PARTNER_SEGMENTS.map((seg) => (
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
                  {ONBOARD_PARTNER_SEGMENTS.find((s) => s.profile === profile)?.description}
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
            </>
          )}

          <div ref={partnerHs.containerRef} className="space-y-4">
            <Field label="Company Name">
              <div className="relative">
                <input
                  {...partnerHs.bindField("business")}
                  required
                  value={partnerCompanyName}
                  onChange={(e) => setPartnerCompanyName(e.target.value)}
                  placeholder="e.g. Roche Bobois"
                  className="field-input"
                  autoComplete="organization"
                />
                {partnerHs.renderDropdown("business")}
              </div>
            </Field>
            <Field label="Contact Name">
              <div className="relative">
                <input
                  {...partnerHs.bindField("contact")}
                  required
                  value={partnerContactName}
                  onChange={(e) => setPartnerContactName(e.target.value)}
                  placeholder="e.g. Marie Dubois"
                  className="field-input"
                  autoComplete="name"
                />
                {partnerHs.renderDropdown("contact")}
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <input
                  type="email"
                  {...partnerHs.bindField("email")}
                  required
                  value={partnerEmail}
                  onChange={(e) => setPartnerEmail(e.target.value)}
                  placeholder="email@company.com"
                  className="field-input"
                  autoComplete="email"
                />
                {partnerHs.renderDropdown("email")}
              </div>
            </Field>
            <Field label="Phone">
              <div className="relative">
                <input
                  ref={phoneInput.ref}
                  type="tel"
                  {...partnerHs.bindField("phone")}
                  value={phone}
                  onChange={phoneInput.onChange}
                  placeholder={PHONE_PLACEHOLDER}
                  className="field-input"
                  autoComplete="tel"
                />
                {partnerHs.renderDropdown("phone")}
              </div>
            </Field>
          </div>
          <AddressAutocomplete value={address} onRawChange={setAddress} onChange={(r) => setAddress(r.fullAddress)} placeholder="123 Yorkville Ave" label="Address" className="field-input" />
          <input type="hidden" name="address" value={address} />
          {partnerPortalSupported ? (
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
          ) : (
            <p className="text-[11px] text-[var(--tx3)]">
              This partner vertical does not use a self-serve portal; only the partner record will be created.
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50"
          >
            {partnerButtonLabel}
          </button>
        </>
      ) : (
        <>
          <div ref={clientHs.containerRef} className="space-y-4">
            <Field label="Name">
              <div className="relative">
                <input
                  {...clientHs.bindField("contact")}
                  required
                  value={clientPersonName}
                  onChange={(e) => setClientPersonName(e.target.value)}
                  placeholder="e.g. John Smith"
                  className="field-input"
                  autoComplete="name"
                />
                {clientHs.renderDropdown("contact")}
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <input
                  type="email"
                  {...clientHs.bindField("email")}
                  required
                  value={clientEmailField}
                  onChange={(e) => setClientEmailField(e.target.value)}
                  placeholder="email@example.com"
                  className="field-input"
                  autoComplete="email"
                />
                {clientHs.renderDropdown("email")}
              </div>
            </Field>
            <Field label="Phone">
              <div className="relative">
                <input
                  ref={phoneInput.ref}
                  type="tel"
                  {...clientHs.bindField("phone")}
                  value={phone}
                  onChange={phoneInput.onChange}
                  placeholder={PHONE_PLACEHOLDER}
                  className="field-input"
                  autoComplete="tel"
                />
                {clientHs.renderDropdown("phone")}
              </div>
            </Field>
          </div>
          <AddressAutocomplete value={address} onRawChange={setAddress} onChange={(r) => setAddress(r.fullAddress)} placeholder="123 Main St" label="Address" className="field-input" />
          <input type="hidden" name="address" value={address} />
          <p className="text-[11px] text-[var(--tx3)]">
            Add this client to a move and use &quot;Resend tracking link&quot; on the move page to send them a magic-link to track their move (no account needed).
          </p>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-3 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all disabled:opacity-50"
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

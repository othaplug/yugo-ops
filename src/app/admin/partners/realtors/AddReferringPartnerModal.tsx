"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "@phosphor-icons/react";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  REFERRAL_HUB_ORG_TYPES,
  VERTICAL_TO_TEMPLATE_SLUG,
  organizationTypeLabel,
  partnerHasSelfServePortal,
} from "@/lib/partner-type";

type ReferralOrgType = (typeof REFERRAL_HUB_ORG_TYPES)[number];

export default function AddReferringPartnerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [partnerType, setPartnerType] = useState<ReferralOrgType>("realtor");
  const [partnerCompanyName, setPartnerCompanyName] = useState("");
  const [partnerContactName, setPartnerContactName] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const phoneInput = usePhoneInput(phone, setPhone);
  const [sendPortalAccess, setSendPortalAccess] = useState(true);

  const partnerPortalSupported = partnerHasSelfServePortal(partnerType);

  useEffect(() => {
    if (!partnerPortalSupported) setSendPortalAccess(false);
  }, [partnerPortalSupported]);

  const reset = useCallback(() => {
    setPartnerType("realtor");
    setPartnerCompanyName("");
    setPartnerContactName("");
    setPartnerEmail("");
    setAddress("");
    setPhone("");
    setSendPortalAccess(true);
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/clients/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: "partner",
          name: partnerCompanyName.trim(),
          email: partnerEmail.trim(),
          type: partnerType,
          contact_name: partnerContactName.trim(),
          phone: normalizePhone(phone) || "",
          address: address || "",
          send_portal_access: partnerPortalSupported && sendPortalAccess,
          template_slug: VERTICAL_TO_TEMPLATE_SLUG[partnerType] || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create");

      const msg =
        partnerPortalSupported && sendPortalAccess
          ? "Referring partner created and portal invite sent"
          : "Referring partner created";
      toast(msg, "check");
      handleClose();
      router.refresh();
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalOverlay
      open={open}
      onClose={handleClose}
      title="Add referring partner"
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
          Creates a referral organization record (commission pipeline). This is
          separate from move clients and delivery partners.
        </p>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Referring partner type
          </label>
          <select
            value={partnerType}
            onChange={(e) => setPartnerType(e.target.value as ReferralOrgType)}
            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] focus:border-[var(--brd)] outline-none"
            required
          >
            {REFERRAL_HUB_ORG_TYPES.map((v) => (
              <option key={v} value={v}>
                {organizationTypeLabel(v)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Organization name
          </label>
          <input
            type="text"
            required
            value={partnerCompanyName}
            onChange={(e) => setPartnerCompanyName(e.target.value)}
            placeholder="Company or team name"
            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
            autoComplete="organization"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Primary contact
          </label>
          <input
            type="text"
            required
            value={partnerContactName}
            onChange={(e) => setPartnerContactName(e.target.value)}
            placeholder="Contact name"
            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
            autoComplete="name"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Email
          </label>
          <input
            type="email"
            required
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="email@company.com"
            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
            autoComplete="email"
          />
        </div>
        <div>
          <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">
            Phone
          </label>
          <input
            ref={phoneInput.ref}
            type="tel"
            value={phone}
            onChange={phoneInput.onChange}
            placeholder={PHONE_PLACEHOLDER}
            className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)] outline-none"
            autoComplete="tel"
          />
        </div>
        <AddressAutocomplete
          value={address}
          onRawChange={setAddress}
          onChange={(r) => setAddress(r.fullAddress)}
          placeholder="Office or billing address"
          label="Address"
          className="w-full px-3 py-2.5 bg-[var(--bg)] border border-[var(--brd)] rounded-lg text-[13px] text-[var(--tx)]"
        />
        {partnerPortalSupported ? (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={sendPortalAccess}
              onChange={(e) => setSendPortalAccess(e.target.checked)}
              className="accent-[var(--gold)] w-4 h-4 rounded border border-[var(--brd)]"
            />
            <span className="text-[12px] text-[var(--tx2)]">
              Send portal access (invite email)
            </span>
          </label>
        ) : (
          <p className="text-[11px] text-[var(--tx3)]">
            This partner type does not use a self-serve portal.
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/40 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-50 transition-colors"
          >
            {loading ? "Creating…" : "Create partner"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

export function AddReferringPartnerTriggerButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] transition-all whitespace-nowrap"
    >
      <Plus className="w-4 h-4" weight="bold" aria-hidden />
      Add referring partner
    </button>
  );
}

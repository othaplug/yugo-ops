"use client";

import { useState, useCallback, useEffect, useId } from "react";
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
import { InfoHint } from "@/components/ui/InfoHint";
import { Button, Input, Select } from "@/design-system/admin/primitives";

type ReferralOrgType = (typeof REFERRAL_HUB_ORG_TYPES)[number];

const fieldLabelClass = "mb-1.5 block yu3-t-eyebrow text-[var(--yu3-ink-muted)]";

export default function AddReferringPartnerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const baseId = useId();
  const typeId = `${baseId}-type`;
  const orgId = `${baseId}-org`;
  const contactId = `${baseId}-contact`;
  const emailId = `${baseId}-email`;
  const phoneId = `${baseId}-phone`;
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
      titleClassName="text-[var(--yu3-wine)]"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:gap-4">
          <div className="min-w-0 flex-1">
            <label htmlFor={typeId} className={fieldLabelClass}>
              Referring partner type
            </label>
            <Select
              id={typeId}
              value={partnerType}
              onChange={(e) => setPartnerType(e.target.value as ReferralOrgType)}
              required
              className="w-full"
            >
              {REFERRAL_HUB_ORG_TYPES.map((v) => (
                <option key={v} value={v}>
                  {organizationTypeLabel(v)}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex shrink-0 justify-end sm:pb-0.5">
            <InfoHint variant="admin" align="end" ariaLabel="About referring partners">
              <p className="text-[11px] leading-relaxed text-[var(--yu3-ink-muted)]">
                Creates a referral organization record (commission pipeline). This is separate from move
                clients and delivery partners.
              </p>
            </InfoHint>
          </div>
        </div>

        <div>
          <label htmlFor={orgId} className={fieldLabelClass}>
            Organization name
          </label>
          <Input
            id={orgId}
            type="text"
            required
            value={partnerCompanyName}
            onChange={(e) => setPartnerCompanyName(e.target.value)}
            placeholder="Company or team name"
            autoComplete="organization"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor={contactId} className={fieldLabelClass}>
            Primary contact
          </label>
          <Input
            id={contactId}
            type="text"
            required
            value={partnerContactName}
            onChange={(e) => setPartnerContactName(e.target.value)}
            placeholder="Contact name"
            autoComplete="name"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor={emailId} className={fieldLabelClass}>
            Email
          </label>
          <Input
            id={emailId}
            type="email"
            required
            value={partnerEmail}
            onChange={(e) => setPartnerEmail(e.target.value)}
            placeholder="email@company.com"
            autoComplete="email"
            className="w-full"
          />
        </div>
        <div>
          <label htmlFor={phoneId} className={fieldLabelClass}>
            Phone
          </label>
          <Input
            ref={phoneInput.ref}
            id={phoneId}
            type="tel"
            value={phone}
            onChange={phoneInput.onChange}
            placeholder={PHONE_PLACEHOLDER}
            autoComplete="tel"
            className="w-full"
          />
        </div>
        <AddressAutocomplete
          value={address}
          onRawChange={setAddress}
          onChange={(r) => setAddress(r.fullAddress)}
          placeholder="Office or billing address"
          label="Address"
          variant="yu3"
        />

        {partnerPortalSupported ? (
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={sendPortalAccess}
              onChange={(e) => setSendPortalAccess(e.target.checked)}
              className="h-4 w-4 rounded border border-[var(--yu3-line)] accent-[var(--yu3-wine)]"
            />
            <span className="text-[12px] text-[var(--yu3-ink)]">Send portal access (invite email)</span>
          </label>
        ) : (
          <p className="text-[12px] leading-relaxed text-[var(--yu3-ink-muted)]">
            This partner type does not use a self-serve portal.
          </p>
        )}

        <div className="flex flex-col gap-2 border-t border-[var(--yu3-line-subtle)] pt-4 sm:flex-row sm:pt-4">
          <Button
            type="button"
            variant="secondary"
            size="md"
            className="min-w-0 flex-1"
            onClick={handleClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={loading}
            className="min-w-0 flex-1"
          >
            {loading ? "Creating…" : "Create partner"}
          </Button>
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
    <Button
      type="button"
      variant="primary"
      size="md"
      onClick={onClick}
      className="whitespace-nowrap"
      leadingIcon={<Plus className="h-4 w-4" weight="bold" aria-hidden />}
    >
      Add referring partner
    </Button>
  );
}

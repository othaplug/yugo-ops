"use client";

import { useState, useCallback, useEffect } from "react";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { useToast } from "../components/Toast";
import ModalOverlay from "../components/ModalOverlay";
import { Icon } from "@/components/AppIcons";
import {
  type PartnerProfile,
  PARTNER_SEGMENT_GROUPS,
  VERTICAL_TO_TEMPLATE_SLUG,
  TEMPLATE_SLUG_LABELS,
  isPropertyManagementDeliveryVertical,
} from "@/lib/partner-type";

function generatePassword(length = 12): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%";
  let pwd = "";
  const arr = new Uint8Array(length);
  crypto.getRandomValues(arr);
  for (let i = 0; i < length; i++) pwd += chars[arr[i]! % chars.length];
  return pwd;
}

const DELIVERY_TYPE_OPTIONS = [
  { id: "single_item", label: "Single item deliveries" },
  { id: "multi_piece", label: "Multi-piece deliveries" },
  { id: "full_room", label: "Full room / project deliveries" },
  { id: "day_rate", label: "Day rate (dedicated truck + crew)" },
  { id: "white_glove", label: "White glove / premium handling" },
  { id: "assembly", label: "Assembly & installation" },
  { id: "storage", label: "Storage" },
  { id: "crating", label: "Crating" },
];

const FREQUENCY_OPTIONS = [
  { value: "1_5", label: "1–5 / month" },
  { value: "5_15", label: "5–15 / month" },
  { value: "15_30", label: "15–30 / month" },
  { value: "30_plus", label: "30+ / month" },
];

const WINDOW_OPTIONS = [
  { value: "morning", label: "Morning" },
  { value: "afternoon", label: "Afternoon" },
  { value: "full_day", label: "Full day" },
  { value: "flexible", label: "Flexible" },
];

/** B2B logistics verticals (codes match delivery_verticals). */
const B2B_DELIVERY_VERTICAL_OPTIONS: { id: string; label: string }[] = [
  { id: "furniture_retail", label: "Furniture Retail Delivery" },
  { id: "flooring", label: "Flooring / Building Materials" },
  { id: "designer", label: "Interior Designer Projects" },
  { id: "medical_equipment", label: "Medical / Lab Equipment" },
  { id: "appliance", label: "Appliance Delivery" },
  { id: "art_gallery", label: "Art & Gallery" },
  { id: "restaurant_hospitality", label: "Restaurant / Hospitality" },
  { id: "ecommerce_bulk", label: "E-Commerce / Bulk Delivery" },
  { id: "custom", label: "Custom / Other" },
];

type B2bVerticalCustomDraft = {
  base_rate?: string;
  unit_rate?: string;
  white_glove?: string;
  room_of_choice?: string;
  threshold?: string;
  stop_rate?: string;
};

const HOW_FOUND_OPTIONS = [
  { value: "referral", label: "Referral" },
  { value: "cold_outreach", label: "Cold outreach" },
  { value: "inbound", label: "Inbound" },
  { value: "trade_show", label: "Trade show" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "other", label: "Other" },
];

const BILLING_OPTIONS = [
  { value: "per_delivery", label: "Per delivery invoice" },
  { value: "monthly_statement", label: "Monthly statement" },
  { value: "prepaid_credits", label: "Pre-paid credits" },
];

const PAYMENT_TERMS_OPTIONS = [
  { value: "due_on_receipt", label: "Due on Receipt (default)" },
  { value: "net_15", label: "Net 15" },
  { value: "net_30", label: "Net 30" },
  { value: "prepay", label: "Pre-pay" },
];

const PAYMENT_TERMS_DESCRIPTIONS: Record<string, string> = {
  due_on_receipt: "Per-delivery invoice. Due immediately (3-day grace). Default for new partners until trust is established.",
  net_15: "Bi-monthly statements on the 1st and 16th. Payment due on statement date. Maximum wait: 15 days per delivery.",
  net_30: "Monthly statement on anchor day. Payment due on statement date. Maximum wait: 30 days per delivery.",
  prepay: "Partner pre-loads a credit balance. Deliveries draw down against credits.",
};

const STEPS = [
  { id: 1, label: "Business", description: "Company profile & contact info" },
  { id: 2, label: "Services", description: "Delivery types & preferences" },
  { id: 3, label: "Billing", description: "Rate card & payment terms" },
  { id: 4, label: "Portal", description: "Partner portal access" },
  { id: 5, label: "Review", description: "Confirm & activate" },
];

interface RateTemplate {
  id: string;
  name: string;
  template_slug: string;
}

interface PmPropertyDraft {
  building_name: string;
  address: string;
  postal_code: string;
  total_units: string;
  unit_types: string[];
  has_loading_dock: boolean;
  has_move_elevator: boolean;
  elevator_type: string;
  move_hours: string;
  parking_type: string;
  building_contact_name: string;
  building_contact_phone: string;
  notes: string;
}

function emptyPmProperty(): PmPropertyDraft {
  return {
    building_name: "",
    address: "",
    postal_code: "",
    total_units: "",
    unit_types: [],
    has_loading_dock: false,
    has_move_elevator: false,
    elevator_type: "",
    move_hours: "8to6",
    parking_type: "",
    building_contact_name: "",
    building_contact_phone: "",
    notes: "",
  };
}

interface WizardState {
  // Step 1
  profile: PartnerProfile;
  type: string;
  name: string;
  legalName: string;
  contactName: string;
  contactTitle: string;
  email: string;
  phone: string;
  address: string;
  website: string;
  howFound: string;
  referralSource: string;
  hubspotDealId: string;
  // External IDs (populated by dedup search on email blur)
  hubspotContactId: string;
  squareCustomerId: string;
  squareCardId: string;
  cardLastFour: string;
  cardBrand: string;
  cardOnFile: boolean;
  // Step 2
  deliveryTypes: string[];
  deliveryFrequency: string;
  typicalItems: string;
  specialRequirements: string;
  preferredWindows: string;
  pickupLocations: string[];
  /** delivery_verticals.code values enabled for B2B portal pricing */
  b2bDeliveryVerticals: string[];
  b2bVerticalUseDefaults: Record<string, boolean>;
  b2bVerticalCustom: Record<string, B2bVerticalCustomDraft>;
  // Step 3
  templateSlug: string;
  billingMethod: string;
  paymentTerms: string;
  billingAnchorDay: number;
  billingEmail: string;
  taxId: string;
  insuranceCertRequired: boolean;
  // Step 4
  createPortalLogin: boolean;
  password: string;
  showPassword: boolean;
  sendSetupSms: boolean;
  // Activation
  activationMode: "draft" | "activate" | "activate_welcome";
  // Property management (delivery verticals)
  pmProperties: PmPropertyDraft[];
  pmContractType: "per_move" | "fixed_rate" | "day_rate_retainer";
  pmContractStart: string;
  pmContractEnd: string;
  pmAutoRenew: boolean;
  pmTenantCommsBy: "partner" | "yugo";
}

const DEFAULT_STATE: WizardState = {
  profile: "delivery",
  type: "furniture_retailer",
  name: "",
  legalName: "",
  contactName: "",
  contactTitle: "",
  email: "",
  phone: "",
  address: "",
  website: "",
  howFound: "",
  referralSource: "",
  hubspotDealId: "",
  hubspotContactId: "",
  squareCustomerId: "",
  squareCardId: "",
  cardLastFour: "",
  cardBrand: "",
  cardOnFile: false,
  deliveryTypes: [],
  deliveryFrequency: "",
  typicalItems: "",
  specialRequirements: "",
  preferredWindows: "",
  pickupLocations: [""],
  b2bDeliveryVerticals: [],
  b2bVerticalUseDefaults: {},
  b2bVerticalCustom: {},
  templateSlug: "",
  billingMethod: "per_delivery",
  paymentTerms: "due_on_receipt",
  billingAnchorDay: 1,
  billingEmail: "",
  taxId: "",
  insuranceCertRequired: false,
  createPortalLogin: true,
  password: "",
  showPassword: false,
  sendSetupSms: false,
  activationMode: "activate",
  pmProperties: [emptyPmProperty()],
  pmContractType: "fixed_rate",
  pmContractStart: "",
  pmContractEnd: "",
  pmAutoRenew: false,
  pmTenantCommsBy: "partner",
};

interface PartnerOnboardingWizardProps {
  open: boolean;
  onClose: () => void;
}

const inputCls =
  "w-full px-3.5 py-3 bg-[var(--bg)] border border-[var(--brd)]/70 rounded-xl text-[var(--text-base)] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)]/60 focus:ring-2 focus:ring-[var(--gold)]/10 outline-none transition-all duration-150";
const labelCls = "block text-[11px] font-semibold tracking-widest uppercase text-[var(--tx3)] mb-2";

export default function PartnerOnboardingWizard({ open, onClose }: PartnerOnboardingWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [templates, setTemplates] = useState<RateTemplate[]>([]);
  const [state, setState] = useState<WizardState>(DEFAULT_STATE);

  const phoneInput = usePhoneInput(state.phone, (v) => setState((s) => ({ ...s, phone: v })));

  useEffect(() => {
    if (open) {
      fetch("/api/admin/rate-templates")
        .then((r) => r.json())
        .then((d) => { if (Array.isArray(d)) setTemplates(d); })
        .catch(() => {});
    }
  }, [open]);

  useEffect(() => {
    if (success) {
      const t = setTimeout(() => {
        setSuccess(false);
        setStep(1);
        setState(DEFAULT_STATE);
        onClose();
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [success, onClose]);

  const update = useCallback(<K extends keyof WizardState>(key: K, value: WizardState[K]) => {
    setState((s) => ({ ...s, [key]: value }));
  }, []);

  const handleGeneratePassword = useCallback(() => {
    setState((s) => ({ ...s, password: generatePassword(), showPassword: true }));
  }, []);

  const toggleDeliveryType = (id: string) => {
    setState((s) => ({
      ...s,
      deliveryTypes: s.deliveryTypes.includes(id)
        ? s.deliveryTypes.filter((t) => t !== id)
        : [...s.deliveryTypes, id],
    }));
  };

  const toggleB2bVertical = (code: string) => {
    setState((s) => {
      const has = s.b2bDeliveryVerticals.includes(code);
      const next = has ? s.b2bDeliveryVerticals.filter((c) => c !== code) : [...s.b2bDeliveryVerticals, code];
      const useDefaults = { ...s.b2bVerticalUseDefaults };
      const custom = { ...s.b2bVerticalCustom };
      if (!has) {
        useDefaults[code] = true;
        custom[code] = {};
      } else {
        delete useDefaults[code];
        delete custom[code];
      }
      return { ...s, b2bDeliveryVerticals: next, b2bVerticalUseDefaults: useDefaults, b2bVerticalCustom: custom };
    });
  };

  const patchB2bVerticalCustom = (code: string, patch: Partial<B2bVerticalCustomDraft>) => {
    setState((s) => ({
      ...s,
      b2bVerticalCustom: {
        ...s.b2bVerticalCustom,
        [code]: { ...(s.b2bVerticalCustom[code] || {}), ...patch },
      },
    }));
  };

  const setB2bVerticalUseDefaults = (code: string, useDefaults: boolean) => {
    setState((s) => ({
      ...s,
      b2bVerticalUseDefaults: { ...s.b2bVerticalUseDefaults, [code]: useDefaults },
    }));
  };

  const patchPmProperty = useCallback((idx: number, patch: Partial<PmPropertyDraft>) => {
    setState((s) => ({
      ...s,
      pmProperties: s.pmProperties.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    }));
  }, []);

  const togglePmUnitType = useCallback((idx: number, ut: string) => {
    setState((s) => ({
      ...s,
      pmProperties: s.pmProperties.map((p, i) =>
        i === idx
          ? {
              ...p,
              unit_types: p.unit_types.includes(ut)
                ? p.unit_types.filter((x) => x !== ut)
                : [...p.unit_types, ut],
            }
          : p
      ),
    }));
  }, []);

  const addPmProperty = useCallback(() => {
    setState((s) => ({ ...s, pmProperties: [...s.pmProperties, emptyPmProperty()] }));
  }, []);

  const handleClose = () => {
    setStep(1);
    setState(DEFAULT_STATE);
    onClose();
  };

  const canAdvance = (): boolean => {
    if (step === 1) {
      if (!state.name.trim() || !state.email.trim() || !state.contactName.trim()) return false;
      if (isPropertyManagementDeliveryVertical(state.type)) {
        const hasBuilding = state.pmProperties.some((p) => p.building_name.trim() && p.address.trim());
        if (!hasBuilding) return false;
        if (!state.pmContractStart.trim() || !state.pmContractEnd.trim()) return false;
      }
      return true;
    }
    if (step === 4) return !state.createPortalLogin || (!!state.password && state.password.length >= 8);
    return true;
  };

  const handleSubmit = async () => {
    if (!state.name.trim() || !state.email.trim()) {
      toast("Company name and email are required", "x");
      return;
    }
    if (state.createPortalLogin && (!state.password || state.password.length < 8)) {
      toast("Password must be at least 8 characters", "x");
      return;
    }

    const b2b_delivery_verticals = state.b2bDeliveryVerticals.map((code) => {
      const useDef = state.b2bVerticalUseDefaults[code] !== false;
      if (useDef) return { vertical_code: code, use_defaults: true };
      const c = state.b2bVerticalCustom[code] || {};
      const custom_rates: Record<string, unknown> = {};
      const numOrSkip = (v: string | undefined) => {
        const t = (v || "").trim();
        if (!t) return undefined;
        const n = Number(t);
        return Number.isFinite(n) ? n : undefined;
      };
      const br = numOrSkip(c.base_rate);
      const ur = numOrSkip(c.unit_rate);
      const sr = numOrSkip(c.stop_rate);
      if (br !== undefined) custom_rates.base_rate = br;
      if (ur !== undefined) custom_rates.unit_rate = ur;
      if (sr !== undefined) custom_rates.stop_rate = sr;
      const hr: Record<string, number> = {};
      const wg = numOrSkip(c.white_glove);
      const rc = numOrSkip(c.room_of_choice);
      const th = numOrSkip(c.threshold);
      if (wg !== undefined) hr.white_glove = wg;
      if (rc !== undefined) hr.room_of_choice = rc;
      if (th !== undefined) hr.threshold = th;
      if (Object.keys(hr).length) custom_rates.handling_rates = hr;
      return { vertical_code: code, use_defaults: false, custom_rates };
    });

    setLoading(true);
    try {
      const res = await fetch("/api/invite/partner", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: state.type,
          name: state.name.trim(),
          legal_name: state.legalName.trim() || undefined,
          contact_name: state.contactName.trim(),
          contact_title: state.contactTitle.trim() || undefined,
          email: state.email.trim(),
          phone: normalizePhone(state.phone).trim() || undefined,
          address: state.address.trim() || undefined,
          website: state.website.trim() || undefined,
          how_found: state.howFound || undefined,
          referral_source: state.referralSource.trim() || undefined,
          hubspot_deal_id: state.hubspotDealId.trim() || undefined,
          hubspot_contact_id: state.hubspotContactId || undefined,
          square_customer_id: state.squareCustomerId || undefined,
          square_card_id: state.squareCardId || undefined,
          card_last_four: state.cardLastFour || undefined,
          card_brand: state.cardBrand || undefined,
          card_on_file: state.cardOnFile || undefined,
          delivery_types: state.deliveryTypes.length ? state.deliveryTypes : undefined,
          delivery_frequency: state.deliveryFrequency || undefined,
          typical_items: state.typicalItems.trim() || undefined,
          special_requirements: state.specialRequirements.trim() || undefined,
          preferred_windows: state.preferredWindows || undefined,
          pickup_locations: state.pickupLocations.filter(Boolean).length
            ? state.pickupLocations.filter(Boolean)
            : undefined,
          template_slug: VERTICAL_TO_TEMPLATE_SLUG[state.type] || state.templateSlug || undefined,
          billing_method: state.billingMethod,
          payment_terms: state.paymentTerms,
          billing_anchor_day: state.billingAnchorDay,
          billing_email: state.billingEmail.trim() || undefined,
          tax_id: state.taxId.trim() || undefined,
          insurance_cert_required: state.insuranceCertRequired || undefined,
          create_portal_login: state.createPortalLogin,
          password: state.createPortalLogin ? state.password : undefined,
          activation_mode: state.activationMode,
          send_setup_sms: state.sendSetupSms && !!state.phone,
          ...(b2b_delivery_verticals.length ? { b2b_delivery_verticals } : {}),
          ...(isPropertyManagementDeliveryVertical(state.type)
            ? {
                pm_onboarding: {
                  properties: state.pmProperties
                    .filter((p) => p.building_name.trim() && p.address.trim())
                    .map((p) => ({
                      building_name: p.building_name.trim(),
                      address: p.address.trim(),
                      postal_code: p.postal_code.trim() || undefined,
                      total_units: parseInt(p.total_units, 10) || undefined,
                      unit_types: p.unit_types.length ? p.unit_types : undefined,
                      has_loading_dock: p.has_loading_dock,
                      has_move_elevator: !!p.elevator_type && p.elevator_type !== "none",
                      elevator_type: p.elevator_type.trim() || undefined,
                      move_hours: p.move_hours || undefined,
                      parking_type: p.parking_type.trim() || undefined,
                      building_contact_name: p.building_contact_name.trim() || undefined,
                      building_contact_phone: p.building_contact_phone.trim() || undefined,
                      notes: p.notes.trim() || undefined,
                    })),
                  contract_type: state.pmContractType,
                  start_date: state.pmContractStart,
                  end_date: state.pmContractEnd,
                  auto_renew: state.pmAutoRenew,
                  tenant_comms_by: state.pmTenantCommsBy,
                },
              }
            : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create partner");
      setSuccess(true);
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to create partner", "x");
    } finally {
      setLoading(false);
    }
  };

  const activeSegments = PARTNER_SEGMENT_GROUPS.filter((s) => s.profile === state.profile);

  const currentStep = STEPS.find((s) => s.id === step)!;

  if (success) {
    return (
      <ModalOverlay open={open} onClose={handleClose} title="Partner Onboarded" maxWidth="2xl" noPadding>
        <div className="py-16 px-8 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-[var(--grn)]/10 border border-[var(--grn)]/30 flex items-center justify-center mb-6">
            <Icon name="check" className="w-9 h-9 text-[var(--grn)]" />
          </div>
          <h3 className="font-heading text-[22px] font-bold text-[var(--tx)] mb-2">Partner onboarded</h3>
          <p className="text-[var(--text-base)] text-[var(--tx3)] max-w-xs leading-relaxed">
            {state.createPortalLogin
              ? "An invitation email has been sent with their portal login credentials."
              : "Partner saved as draft. Portal access can be added at any time."}
          </p>
        </div>
      </ModalOverlay>
    );
  }

  return (
    <ModalOverlay open={open} onClose={handleClose} title="" maxWidth="2xl" noHeader noPadding>
      <div className="flex flex-col flex-1 min-h-0">

        {/* Header */}
        <div className="px-7 pt-7 pb-6 border-b border-[var(--brd)]/60 shrink-0">
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[11px] font-semibold tracking-widest uppercase text-[var(--gold)] mb-1.5">
                Partner Onboarding
              </p>
              <h2 className="font-heading text-[22px] font-bold text-[var(--tx)] leading-tight">
                {currentStep.label}
              </h2>
              <p className="text-[13px] text-[var(--tx3)] mt-1">{currentStep.description}</p>
            </div>
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors shrink-0 ml-4"
              aria-label="Close"
            >
              <Icon name="x" className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Step progress */}
          <div className="flex items-center gap-0">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center flex-1">
                <button
                  type="button"
                  onClick={() => step > s.id && setStep(s.id)}
                  className="flex flex-col items-center gap-1.5 group shrink-0"
                  style={{ cursor: step > s.id ? "pointer" : "default" }}
                >
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all duration-200 ${
                      step === s.id
                        ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)] shadow-sm shadow-[var(--gold)]/30 scale-110"
                        : step > s.id
                        ? "bg-[var(--grn)]/15 text-[var(--grn)] border border-[var(--grn)]/30"
                        : "bg-[var(--brd)]/60 text-[var(--tx3)] border border-[var(--brd)]"
                    }`}
                  >
                    {step > s.id ? <Icon name="check" className="w-3.5 h-3.5" /> : s.id}
                  </div>
                  <span
                    className={`text-[10px] font-semibold tracking-wide hidden sm:block transition-colors duration-150 ${
                      step === s.id ? "text-[var(--tx)]" : "text-[var(--tx3)]"
                    }`}
                  >
                    {s.label}
                  </span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className="flex-1 mx-2 mb-4">
                    <div
                      className={`h-px transition-all duration-500 ${
                        step > s.id ? "bg-[var(--grn)]/40" : "bg-[var(--brd)]/50"
                      }`}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto px-7 py-6 min-h-0">
          {step === 1 && (
            <Step1BusinessDetails
              state={state}
              update={update}
              activeSegments={activeSegments}
              phoneInput={phoneInput}
              patchPmProperty={patchPmProperty}
              addPmProperty={addPmProperty}
              togglePmUnitType={togglePmUnitType}
            />
          )}
          {step === 2 && (
            <Step2ServicePreferences
              state={state}
              update={update}
              toggleDeliveryType={toggleDeliveryType}
              toggleB2bVertical={toggleB2bVertical}
              patchB2bVerticalCustom={patchB2bVerticalCustom}
              setB2bVerticalUseDefaults={setB2bVerticalUseDefaults}
            />
          )}
          {step === 3 && (
            <Step3RateCardBilling
              state={state}
              update={update}
              templates={templates}
            />
          )}
          {step === 4 && (
            <Step4PortalAccess
              state={state}
              update={update}
              handleGeneratePassword={handleGeneratePassword}
            />
          )}
          {step === 5 && (
            <Step5Summary state={state} />
          )}
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-[var(--brd)]/60 flex items-center gap-3 shrink-0">
          {step > 1 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s - 1)}
              className="px-5 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]/50 hover:bg-[var(--gold)]/5 transition-all duration-150"
            >
              Back
            </button>
          ) : (
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--brd)]/80 transition-all duration-150"
            >
              Cancel
            </button>
          )}

          <div className="flex-1" />

          <span className="text-[11px] text-[var(--tx3)] hidden sm:block">
            Step {step} of {STEPS.length}
          </span>

          {step < 5 ? (
            <button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              className="px-6 py-3 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all duration-150 disabled:opacity-35 shadow-sm shadow-[var(--gold)]/20"
            >
              Continue
            </button>
          ) : (
            <div className="flex gap-2.5">
              <button
                type="button"
                onClick={() => { setState((s) => ({ ...s, activationMode: "draft" })); setTimeout(handleSubmit, 0); }}
                disabled={loading}
                className="px-5 py-3 rounded-xl text-[13px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]/50 transition-all duration-150 disabled:opacity-50"
              >
                Save as Draft
              </button>
              <button
                type="button"
                onClick={() => { setState((s) => ({ ...s, activationMode: "activate" })); setTimeout(handleSubmit, 0); }}
                disabled={loading}
                className="px-6 py-3 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all duration-150 disabled:opacity-50 shadow-sm shadow-[var(--gold)]/20"
              >
                {loading ? "Activating…" : "Activate Partner"}
              </button>
            </div>
          )}
        </div>
      </div>
    </ModalOverlay>
  );
}

/* ── Dedup search result types ── */
interface HubSpotContactResult {
  hubspot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  title: string;
  lead_status: string;
  deal_ids: string[];
}
interface SquareCustomerResult {
  square_id: string;
  company: string;
  email: string;
  phone: string;
  card_on_file: boolean;
  card_last_four: string;
  card_brand: string;
  card_id: string;
}
interface DedupResults {
  hubspot: HubSpotContactResult | null;
  square: SquareCustomerResult | null;
  opsPartnerName: string | null;
  opsPartnerId: string | null;
}

/* ── Step 1: Business Details ── */
const PM_UNIT_OPTS = [
  { id: "studio", label: "Studio" },
  { id: "1br", label: "1BR" },
  { id: "2br", label: "2BR" },
  { id: "3br", label: "3BR" },
  { id: "4br_plus", label: "4BR+" },
];

function Step1BusinessDetails({
  state,
  update,
  activeSegments,
  phoneInput,
  patchPmProperty,
  addPmProperty,
  togglePmUnitType,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, val: WizardState[K]) => void;
  activeSegments: typeof PARTNER_SEGMENT_GROUPS;
  phoneInput: ReturnType<typeof usePhoneInput>;
  patchPmProperty: (idx: number, patch: Partial<PmPropertyDraft>) => void;
  addPmProperty: () => void;
  togglePmUnitType: (idx: number, ut: string) => void;
}) {
  const [searching, setSearching] = useState(false);
  const [dedupResults, setDedupResults] = useState<DedupResults | null>(null);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);

  const handleDedupBlur = async () => {
    const emailTrim = state.email.trim().toLowerCase();
    const phoneNorm = normalizePhone(state.phone);
    const hasEmail = emailTrim.includes("@");
    const hasPhone = phoneNorm.length === 10;
    const biz = state.name.trim();
    const cn = state.contactName.trim();
    const canHubSpot =
      hasEmail ||
      hasPhone ||
      (biz.length >= 2 && cn.length >= 2) ||
      biz.length >= 3;
    if (!canHubSpot) return;

    setBannerDismissed(false);
    setAutoFilled(false);
    setSearching(true);
    setDedupResults(null);
    // Clear any previously stored IDs when identity fields change
    update("hubspotContactId", "");
    update("squareCustomerId", "");
    update("squareCardId", "");
    update("cardLastFour", "");
    update("cardBrand", "");
    update("cardOnFile", false);

    try {
      const opsP = fetch("/api/admin/partners/search-by-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: hasEmail ? emailTrim : undefined,
          phone: hasPhone ? phoneNorm : undefined,
        }),
      }).then((r) => r.json());

      const hubspotP = fetch("/api/hubspot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: hasEmail ? emailTrim : undefined,
          phone: hasPhone ? state.phone : undefined,
          company: biz || undefined,
          contact_name: cn || undefined,
        }),
      }).then((r) => r.json());

      const squareP = hasEmail
        ? fetch("/api/square/search-customer", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailTrim }),
          }).then((r) => r.json())
        : Promise.resolve({ customer: null });

      const [opsRes, hubspotRes, squareRes] = await Promise.allSettled([opsP, hubspotP, squareP]);

      const ops = opsRes.status === "fulfilled" ? opsRes.value : null;
      const hubspot = hubspotRes.status === "fulfilled" ? hubspotRes.value?.contact ?? null : null;
      const square = squareRes.status === "fulfilled" ? squareRes.value?.customer ?? null : null;

      const hasAny = !!ops?.partner || !!hubspot || !!square;
      if (!hasAny) {
        setDedupResults(null);
        setSearching(false);
        return;
      }

      setDedupResults({
        hubspot,
        square,
        opsPartnerName: ops?.partner?.name ?? null,
        opsPartnerId: ops?.partner?.id ?? null,
      });
    } catch {
      // silently continue
    } finally {
      setSearching(false);
    }
  };

  const handleAutoFill = () => {
    if (!dedupResults) return;
    const { hubspot, square } = dedupResults;

    if (hubspot) {
      const fullName = [hubspot.first_name, hubspot.last_name].filter(Boolean).join(" ");
      if (fullName && !state.contactName) update("contactName", fullName);
      if (hubspot.phone && !state.phone) update("phone", hubspot.phone);
      if (hubspot.company && !state.name) update("name", hubspot.company);
      if (hubspot.title && !state.contactTitle) update("contactTitle", hubspot.title);
      update("hubspotContactId", hubspot.hubspot_id);
    }

    if (square) {
      update("squareCustomerId", square.square_id);
      if (square.card_id) update("squareCardId", square.card_id);
      if (square.card_last_four) update("cardLastFour", square.card_last_four);
      if (square.card_brand) update("cardBrand", square.card_brand);
      update("cardOnFile", square.card_on_file);
    }

    setAutoFilled(true);
  };

  const showBanner =
    !bannerDismissed &&
    !autoFilled &&
    dedupResults !== null &&
    (dedupResults.hubspot !== null ||
      dedupResults.square !== null ||
      dedupResults.opsPartnerId !== null);

  const showPm = state.profile === "delivery" && isPropertyManagementDeliveryVertical(state.type);

  return (
    <div className="space-y-6">
      {/* Profile type */}
      <div>
        <p className={labelCls}>Partner Type</p>
        <div className="grid grid-cols-2 gap-3">
          {PARTNER_SEGMENT_GROUPS.map((seg) => (
            <label
              key={seg.profile}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                state.profile === seg.profile
                  ? "border-[var(--gold)]/60 bg-[var(--gold)]/5"
                  : "border-[var(--brd)]/70 hover:border-[var(--brd)]"
              }`}
            >
              <input
                type="radio"
                name="profile"
                checked={state.profile === seg.profile}
                onChange={() => {
                  update("profile", seg.profile);
                  update("type", seg.profile === "delivery" ? "furniture_retailer" : "realtor");
                }}
                className="accent-[var(--gold)]"
              />
              <span className="text-[var(--text-base)] font-medium text-[var(--tx)]">{seg.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className={labelCls}>Vertical *</label>
          <select
            value={state.type}
            onChange={(e) => update("type", e.target.value)}
            className={inputCls}
          >
            {activeSegments.flatMap((seg) =>
              seg.groups.map((group) => (
                <optgroup key={group.label} label={group.label}>
                  {group.verticals.map((v) => (
                    <option key={v.value} value={v.value}>{v.label}</option>
                  ))}
                </optgroup>
              ))
            )}
          </select>
        </div>

        <div>
          <label className={labelCls}>Business Name *</label>
          <input
            type="text"
            value={state.name}
            onChange={(e) => update("name", e.target.value)}
            onBlur={handleDedupBlur}
            placeholder="e.g. Roche Bobois"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Legal Name (if different)</label>
          <input
            type="text"
            value={state.legalName}
            onChange={(e) => update("legalName", e.target.value)}
            placeholder="Legal entity name"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Primary Contact Name *</label>
          <input
            type="text"
            value={state.contactName}
            onChange={(e) => update("contactName", e.target.value)}
            onBlur={handleDedupBlur}
            placeholder="e.g. Marie Dubois"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Contact Title</label>
          <input
            type="text"
            value={state.contactTitle}
            onChange={(e) => update("contactTitle", e.target.value)}
            placeholder="e.g. Operations Manager"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Email *</label>
          <input
            type="email"
            value={state.email}
            onChange={(e) => {
              update("email", e.target.value);
              setDedupResults(null);
              setAutoFilled(false);
            }}
            onBlur={handleDedupBlur}
            placeholder="contact@company.com"
            className={inputCls}
          />
          {searching && (
            <p className="mt-1.5 text-[11px] text-[var(--tx3)]">Checking for existing contacts…</p>
          )}
        </div>
        <div>
          <label className={labelCls}>Phone</label>
          <input
            ref={phoneInput.ref}
            type="tel"
            value={state.phone}
            onChange={phoneInput.onChange}
            onBlur={handleDedupBlur}
            placeholder={PHONE_PLACEHOLDER}
            className={inputCls}
          />
        </div>

        {/* ── Dedup / auto-fill banner ── */}
        {showBanner && (
          <div className="col-span-2">
            {dedupResults.opsPartnerId ? (
              /* Existing OPS+ partner — block creation */
              <div className="rounded-xl border border-red-400/40 bg-red-500/5 p-4 flex items-start gap-3">
                <Icon name="alertTriangle" className="w-4 h-4 shrink-0 mt-0.5 text-red-400 stroke-[1.75]" aria-hidden />
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-red-400">
                    Partner already exists in OPS+
                  </p>
                  <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                    <strong>{dedupResults.opsPartnerName}</strong> is already registered in OPS+
                    (matching email or phone).
                  </p>
                  <a
                    href={`/admin/platform/partners/${dedupResults.opsPartnerId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block mt-2 text-[11px] font-semibold text-red-400 underline underline-offset-2"
                  >
                    View Partner →
                  </a>
                </div>
              </div>
            ) : (
              /* External contact found — offer auto-fill */
              <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Icon name="search" className="w-4 h-4 shrink-0 text-[var(--gold)] stroke-[1.75]" aria-hidden />
                  <p className="text-[12px] font-bold tracking-wide uppercase text-[var(--gold)]">
                    Existing Contact Found
                  </p>
                </div>
                <div className="space-y-0.5 mb-3">
                  {dedupResults.hubspot && (
                    <p className="text-[12px] text-[var(--tx2)]">
                      <span className="font-semibold text-[var(--tx)]">HubSpot:</span>{" "}
                      {[dedupResults.hubspot.first_name, dedupResults.hubspot.last_name]
                        .filter(Boolean)
                        .join(" ") || dedupResults.hubspot.email}
                      {dedupResults.hubspot.company && `, ${dedupResults.hubspot.company}`}
                      {dedupResults.hubspot.deal_ids.length > 0 && (
                        <span className="text-[var(--tx3)]">
                          {" "}({dedupResults.hubspot.deal_ids.length} deal
                          {dedupResults.hubspot.deal_ids.length !== 1 ? "s" : ""})
                        </span>
                      )}
                    </p>
                  )}
                  {dedupResults.square && (
                    <p className="text-[12px] text-[var(--tx2)]">
                      <span className="font-semibold text-[var(--tx)]">Square:</span>{" "}
                      {dedupResults.square.card_on_file
                        ? `Card on file, ${dedupResults.square.card_brand} ****${dedupResults.square.card_last_four}`
                        : "No card on file"}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAutoFill}
                    className="px-3.5 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-colors"
                  >
                    Auto-fill from HubSpot
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerDismissed(true)}
                    className="px-3.5 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/40 transition-colors"
                  >
                    Ignore
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Confirmation after auto-fill */}
        {autoFilled && (
          <div className="col-span-2 rounded-xl border border-[var(--grn)]/30 bg-[var(--grn)]/5 px-4 py-3 flex items-center gap-2">
            <span className="text-[var(--grn)]">✓</span>
            <p className="text-[12px] text-[var(--tx2)]">
              Fields pre-filled from HubSpot
              {dedupResults?.square?.card_on_file && " · Card on file linked from Square"}.
            </p>
          </div>
        )}

        {showPm && (
          <div className="col-span-2 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-5 space-y-5">
            <p className="text-[11px] font-bold tracking-widest uppercase text-[var(--gold)]">Property management details</p>
            {state.pmProperties.map((prop, idx) => (
              <div key={idx} className="space-y-3 pb-4 border-b border-[var(--brd)]/50 last:border-0 last:pb-0">
                <p className="text-[12px] font-semibold text-[var(--tx)]">Property {idx + 1}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Building name *</label>
                    <input
                      type="text"
                      value={prop.building_name}
                      onChange={(e) => patchPmProperty(idx, { building_name: e.target.value })}
                      className={inputCls}
                      placeholder="The Lakeshore Residences"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Address *</label>
                    <input
                      type="text"
                      value={prop.address}
                      onChange={(e) => patchPmProperty(idx, { address: e.target.value })}
                      className={inputCls}
                      placeholder="123 Lakeshore Blvd, Toronto, ON"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Postal code</label>
                    <input
                      type="text"
                      value={prop.postal_code}
                      onChange={(e) => patchPmProperty(idx, { postal_code: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Total units</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={prop.total_units}
                      onChange={(e) => patchPmProperty(idx, { total_units: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <p className={labelCls}>Unit types offered</p>
                    <div className="flex flex-wrap gap-3">
                      {PM_UNIT_OPTS.map((u) => (
                        <label key={u.id} className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                          <input
                            type="checkbox"
                            checked={prop.unit_types.includes(u.id)}
                            onChange={() => togglePmUnitType(idx, u.id)}
                            className="accent-[var(--gold)]"
                          />
                          {u.label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={prop.has_loading_dock}
                      onChange={(e) => patchPmProperty(idx, { has_loading_dock: e.target.checked })}
                      className="accent-[var(--gold)]"
                    />
                    Loading dock
                  </label>
                  <div>
                    <label className={labelCls}>Move elevator</label>
                    <select
                      value={prop.elevator_type}
                      onChange={(e) => patchPmProperty(idx, { elevator_type: e.target.value })}
                      className={inputCls}
                    >
                      <option value="">—</option>
                      <option value="dedicated">Dedicated</option>
                      <option value="shared">Shared</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Move hours</label>
                    <select
                      value={prop.move_hours}
                      onChange={(e) => patchPmProperty(idx, { move_hours: e.target.value })}
                      className={inputCls}
                    >
                      <option value="8to6">8 AM – 6 PM</option>
                      <option value="24_7">24/7</option>
                      <option value="custom">Custom (see notes)</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Parking</label>
                    <input
                      type="text"
                      value={prop.parking_type}
                      onChange={(e) => patchPmProperty(idx, { parking_type: e.target.value })}
                      className={inputCls}
                      placeholder="Dedicated loading / street / none"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Building contact</label>
                    <input
                      type="text"
                      value={prop.building_contact_name}
                      onChange={(e) => patchPmProperty(idx, { building_contact_name: e.target.value })}
                      className={inputCls}
                      placeholder="Name"
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Building contact phone</label>
                    <input
                      type="tel"
                      value={prop.building_contact_phone}
                      onChange={(e) => patchPmProperty(idx, { building_contact_phone: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelCls}>Notes</label>
                    <textarea
                      value={prop.notes}
                      onChange={(e) => patchPmProperty(idx, { notes: e.target.value })}
                      rows={2}
                      className={inputCls}
                      placeholder="Key fob, security desk, etc."
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={addPmProperty}
              className="text-[12px] font-semibold text-[var(--gold)] hover:underline"
            >
              + Add property
            </button>

            <div>
              <p className={labelCls}>Contract type</p>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { id: "per_move" as const, label: "Per-move pricing" },
                    { id: "fixed_rate" as const, label: "Fixed-rate contract" },
                    { id: "day_rate_retainer" as const, label: "Day-rate retainer" },
                  ]
                ).map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                    <input
                      type="radio"
                      name="pm_contract_type"
                      checked={state.pmContractType === c.id}
                      onChange={() => update("pmContractType", c.id)}
                      className="accent-[var(--gold)]"
                    />
                    {c.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Contract start *</label>
                <input
                  type="date"
                  value={state.pmContractStart}
                  onChange={(e) => update("pmContractStart", e.target.value)}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Contract end *</label>
                <input
                  type="date"
                  value={state.pmContractEnd}
                  onChange={(e) => update("pmContractEnd", e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
              <input
                type="checkbox"
                checked={state.pmAutoRenew}
                onChange={(e) => update("pmAutoRenew", e.target.checked)}
                className="accent-[var(--gold)]"
              />
              Auto-renew
            </label>
            <div>
              <p className={labelCls}>Tenant communication</p>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer">
                <input
                  type="radio"
                  name="pm_tenant_comms"
                  checked={state.pmTenantCommsBy === "partner"}
                  onChange={() => update("pmTenantCommsBy", "partner")}
                  className="accent-[var(--gold)]"
                />
                Property manager contacts tenant
              </label>
              <label className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer mt-1">
                <input
                  type="radio"
                  name="pm_tenant_comms"
                  checked={state.pmTenantCommsBy === "yugo"}
                  onChange={() => update("pmTenantCommsBy", "yugo")}
                  className="accent-[var(--gold)]"
                />
                Yugo contacts tenant (SMS when scheduled)
              </label>
            </div>
          </div>
        )}

        <div className="col-span-2">
          <label className={labelCls}>Business Address</label>
          <input
            type="text"
            value={state.address}
            onChange={(e) => update("address", e.target.value)}
            placeholder="123 Main St, Toronto, ON"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Website</label>
          <input
            type="url"
            value={state.website}
            onChange={(e) => update("website", e.target.value)}
            placeholder="https://..."
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>How did they find Yugo?</label>
          <select
            value={state.howFound}
            onChange={(e) => update("howFound", e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {HOW_FOUND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {state.howFound === "referral" && (
          <div className="col-span-2">
            <label className={labelCls}>Referral Source</label>
            <input
              type="text"
              value={state.referralSource}
              onChange={(e) => update("referralSource", e.target.value)}
              placeholder="Who referred them?"
              className={inputCls}
            />
          </div>
        )}

        <div className="col-span-2">
          <label className={labelCls}>HubSpot Deal ID <span className="normal-case font-normal tracking-normal text-[var(--tx3)]">- optional</span></label>
          <input
            type="text"
            value={state.hubspotDealId}
            onChange={(e) => update("hubspotDealId", e.target.value)}
            placeholder="Link deal and mark as Won on activation"
            className={inputCls}
          />
        </div>
      </div>
    </div>
  );
}

/* ── Step 2: Service Preferences ── */
function Step2ServicePreferences({
  state,
  update,
  toggleDeliveryType,
  toggleB2bVertical,
  patchB2bVerticalCustom,
  setB2bVerticalUseDefaults,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, val: WizardState[K]) => void;
  toggleDeliveryType: (id: string) => void;
  toggleB2bVertical: (code: string) => void;
  patchB2bVerticalCustom: (code: string, patch: Partial<B2bVerticalCustomDraft>) => void;
  setB2bVerticalUseDefaults: (code: string, useDefaults: boolean) => void;
}) {
  const selectedB2bLabels = state.b2bDeliveryVerticals
    .map((c) => B2B_DELIVERY_VERTICAL_OPTIONS.find((o) => o.id === c)?.label || c)
    .join(", ");

  return (
    <div className="space-y-6">
      <div>
        <label className={labelCls}>Delivery verticals (B2B pricing)</label>
        <p className="text-[11px] text-[var(--tx3)] mb-2">
          Which delivery categories should use negotiated vertical rates in the partner portal and on quotes?
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {B2B_DELIVERY_VERTICAL_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                state.b2bDeliveryVerticals.includes(opt.id)
                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/5 text-[var(--tx)]"
                  : "border-[var(--brd)]/70 text-[var(--tx2)] hover:border-[var(--brd)]"
              }`}
            >
              <input
                type="checkbox"
                checked={state.b2bDeliveryVerticals.includes(opt.id)}
                onChange={() => toggleB2bVertical(opt.id)}
                className="accent-[var(--gold)] shrink-0"
              />
              <span className="text-[13px] font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
        {selectedB2bLabels ? (
          <p className="text-[11px] text-[var(--tx2)] mt-2">
            Selected: {selectedB2bLabels}
          </p>
        ) : null}
      </div>

      {state.b2bDeliveryVerticals.map((code) => {
        const label = B2B_DELIVERY_VERTICAL_OPTIONS.find((o) => o.id === code)?.label || code;
        const useDefaults = state.b2bVerticalUseDefaults[code] !== false;
        const c = state.b2bVerticalCustom[code] || {};
        return (
          <div
            key={code}
            className="rounded-xl border border-[var(--brd)]/70 p-4 space-y-3 bg-[var(--bg)]/40"
          >
            <p className="text-[12px] font-semibold text-[var(--tx)]">{label} — rate customization</p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11px] text-[var(--tx3)]">Use default rates?</label>
              <select
                value={useDefaults ? "yes" : "custom"}
                onChange={(e) => setB2bVerticalUseDefaults(code, e.target.value === "yes")}
                className={inputCls + " max-w-[200px] py-2 text-[12px]"}
              >
                <option value="yes">Yes</option>
                <option value="custom">Customize</option>
              </select>
            </div>
            {!useDefaults && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Base rate ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.base_rate || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { base_rate: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Per piece / unit ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.unit_rate || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { unit_rate: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>White glove ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.white_glove || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { white_glove: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Room of choice ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.room_of_choice || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { room_of_choice: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Threshold ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.threshold || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { threshold: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Stop rate ($)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={c.stop_rate || ""}
                    onChange={(e) => patchB2bVerticalCustom(code, { stop_rate: e.target.value })}
                    placeholder="Leave blank for default"
                    className={inputCls}
                  />
                </div>
              </div>
            )}
          </div>
        );
      })}

      <div>
        <label className={labelCls}>Delivery Types Needed</label>
        <div className="grid grid-cols-2 gap-2.5">
          {DELIVERY_TYPE_OPTIONS.map((opt) => (
            <label
              key={opt.id}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all duration-150 ${
                state.deliveryTypes.includes(opt.id)
                  ? "border-[var(--gold)]/50 bg-[var(--gold)]/5 text-[var(--tx)]"
                  : "border-[var(--brd)]/70 text-[var(--tx2)] hover:border-[var(--brd)]"
              }`}
            >
              <input
                type="checkbox"
                checked={state.deliveryTypes.includes(opt.id)}
                onChange={() => toggleDeliveryType(opt.id)}
                className="accent-[var(--gold)] shrink-0"
              />
              <span className="text-[13px] font-medium">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Typical Delivery Frequency</label>
          <select
            value={state.deliveryFrequency}
            onChange={(e) => update("deliveryFrequency", e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {FREQUENCY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Preferred Delivery Windows</label>
          <select
            value={state.preferredWindows}
            onChange={(e) => update("preferredWindows", e.target.value)}
            className={inputCls}
          >
            <option value="">Select…</option>
            {WINDOW_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Typical Item Types</label>
          <input
            type="text"
            value={state.typicalItems}
            onChange={(e) => update("typicalItems", e.target.value)}
            placeholder="e.g. sofas, dining tables, lighting"
            className={inputCls}
          />
        </div>

        <div className="col-span-2">
          <label className={labelCls}>Special Requirements</label>
          <textarea
            value={state.specialRequirements}
            onChange={(e) => update("specialRequirements", e.target.value)}
            placeholder="e.g. all deliveries require 2-person carry, white glove"
            rows={3}
            className={`${inputCls} resize-none`}
          />
        </div>
      </div>

      <div>
        <label className={labelCls}>Pickup Location(s)</label>
        <div className="space-y-2.5">
          {state.pickupLocations.map((loc, i) => (
            <div key={i} className="flex gap-2.5">
              <input
                type="text"
                value={loc}
                onChange={(e) => {
                  const next = [...state.pickupLocations];
                  next[i] = e.target.value;
                  update("pickupLocations", next);
                }}
                placeholder={`Pickup address ${i + 1}`}
                className={`${inputCls} flex-1`}
              />
              {state.pickupLocations.length > 1 && (
                <button
                  type="button"
                  onClick={() => update("pickupLocations", state.pickupLocations.filter((_, j) => j !== i))}
                  className="px-3 rounded-xl border border-[var(--brd)] text-[var(--tx3)] hover:text-red-400 hover:border-red-400/50 transition-all"
                >
                  <Icon name="x" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button
            type="button"
            onClick={() => update("pickupLocations", [...state.pickupLocations, ""])}
            className="flex items-center gap-2 text-[12px] font-semibold text-[var(--gold)] hover:opacity-70 transition-opacity mt-1"
          >
            <Icon name="plus" className="w-3.5 h-3.5" />
            Add another location
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Step 3: Rate Card & Billing ── */
function Step3RateCardBilling({
  state,
  update,
  templates,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, val: WizardState[K]) => void;
  templates: RateTemplate[];
}) {
  const autoSlug = VERTICAL_TO_TEMPLATE_SLUG[state.type] || "";
  const effectiveSlug = state.templateSlug || autoSlug;
  const effectiveLabel = TEMPLATE_SLUG_LABELS[effectiveSlug] || effectiveSlug;
  const autoLabel = TEMPLATE_SLUG_LABELS[autoSlug] || autoSlug;

  return (
    <div className="space-y-6">
      <div>
        <label className={labelCls}>Rate Card Template</label>
        <select
          value={state.templateSlug}
          onChange={(e) => update("templateSlug", e.target.value)}
          className={inputCls}
        >
          <option value="">
            {autoSlug ? `Auto-assigned: ${autoLabel}` : "Select template…"}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.template_slug}>{t.name}</option>
          ))}
        </select>
        {effectiveSlug && (
          <p className="text-[11px] text-[var(--tx3)] mt-1.5">
            Template applied: <span className="font-semibold text-[var(--tx2)]">{effectiveLabel}</span>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelCls}>Billing Method</label>
          <select
            value={state.billingMethod}
            onChange={(e) => update("billingMethod", e.target.value)}
            className={inputCls}
          >
            {BILLING_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Payment Terms</label>
          <select
            value={state.paymentTerms}
            onChange={(e) => {
              const terms = e.target.value;
              update("paymentTerms", terms);
              // Auto-set billing method and anchor day to match
              if (terms === "due_on_receipt") update("billingMethod", "per_delivery");
              else update("billingMethod", "monthly_statement");
              // Net 15 always runs on 1st and 16th — lock anchor to 1
              if (terms === "net_15") update("billingAnchorDay", 1);
            }}
            className={inputCls}
          >
            {PAYMENT_TERMS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {PAYMENT_TERMS_DESCRIPTIONS[state.paymentTerms] && (
            <p className="text-[11px] text-[var(--tx3)] mt-1.5">
              {PAYMENT_TERMS_DESCRIPTIONS[state.paymentTerms]}
            </p>
          )}
        </div>

        {state.paymentTerms === "net_15" && (
          <div>
            <label className={labelCls}>Billing Cycle Days</label>
            <div className={`${inputCls} bg-[var(--bg)]/60 text-[var(--tx3)] cursor-default select-none`}>
              1st &amp; 16th of every month (fixed)
            </div>
            <p className="text-[11px] text-[var(--tx3)] mt-1.5">
              Net 15 always generates two statements per month. Due on statement date.
            </p>
          </div>
        )}

        {state.paymentTerms === "net_30" && (
          <div>
            <label className={labelCls}>Billing Anchor Day</label>
            <select
              value={state.billingAnchorDay}
              onChange={(e) => update("billingAnchorDay", Number(e.target.value))}
              className={inputCls}
            >
              {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d === 1 ? "1st" : d === 2 ? "2nd" : d === 3 ? "3rd" : `${d}th`} of month</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--tx3)] mt-1.5">
              Statement generated on this day each month. Payment due on statement date. Deliveries completed in the prior 30 days are included.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>Billing Contact Email</label>
          <input
            type="email"
            value={state.billingEmail}
            onChange={(e) => update("billingEmail", e.target.value)}
            placeholder="If different from primary"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Tax ID / HST Number</label>
          <input
            type="text"
            value={state.taxId}
            onChange={(e) => update("taxId", e.target.value)}
            placeholder="Optional"
            className={inputCls}
          />
        </div>

        <div>
          <label className={labelCls}>Insurance Certificate Required</label>
          <div className="flex gap-3 mt-1">
            {(["yes", "no"] as const).map((v) => (
              <label
                key={v}
                className={`flex items-center gap-2.5 px-4 py-3 rounded-xl border cursor-pointer flex-1 transition-all duration-150 ${
                  state.insuranceCertRequired === (v === "yes")
                    ? "border-[var(--gold)]/50 bg-[var(--gold)]/5"
                    : "border-[var(--brd)]/70 hover:border-[var(--brd)]"
                }`}
              >
                <input
                  type="radio"
                  name="insuranceCert"
                  checked={state.insuranceCertRequired === (v === "yes")}
                  onChange={() => update("insuranceCertRequired", v === "yes")}
                  className="accent-[var(--gold)]"
                />
                <span className="text-[13px] font-medium text-[var(--tx)] uppercase">{v}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Card on file, captured after partner is saved; shown as a reminder */}
      <div className="rounded-xl border border-[var(--brd)]/70 p-4 space-y-2 bg-[var(--bg2)]/40">
        <div className="flex items-start gap-3">
          <Icon name="creditCard" className="w-4 h-4 mt-0.5 shrink-0 text-[var(--gold)]" />
          <div>
            <p className="text-[12px] font-semibold text-[var(--tx)]">Payment Method</p>
            <p className="text-[11px] text-[var(--tx3)] mt-0.5">
              A card on file will be requested after the partner is activated. Statements are auto-charged on the billing anchor date, no manual payments needed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Step 4: Portal Access ── */
function Step4PortalAccess({
  state,
  update,
  handleGeneratePassword,
}: {
  state: WizardState;
  update: <K extends keyof WizardState>(key: K, val: WizardState[K]) => void;
  handleGeneratePassword: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <label className={labelCls}>Create Portal Login for Primary Contact?</label>
        <div className="grid grid-cols-2 gap-3 mt-1">
          {(["yes", "no"] as const).map((v) => (
            <label
              key={v}
              className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
                state.createPortalLogin === (v === "yes")
                  ? "border-[var(--gold)]/60 bg-[var(--gold)]/5"
                  : "border-[var(--brd)]/70 hover:border-[var(--brd)]"
              }`}
            >
              <input
                type="radio"
                name="createPortal"
                checked={state.createPortalLogin === (v === "yes")}
                onChange={() => update("createPortalLogin", v === "yes")}
                className="accent-[var(--gold)]"
              />
              <div>
                <p className="text-[var(--text-base)] font-medium text-[var(--tx)] uppercase">{v}</p>
                <p className="text-[11px] text-[var(--tx3)]">
                  {v === "yes" ? "Send invitation email" : "Add access later"}
                </p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {state.createPortalLogin && (
        <>
          <div>
            <label className={labelCls}>Portal Login Email</label>
            <input
              type="email"
              value={state.email}
              readOnly
              className={`${inputCls} opacity-50 cursor-not-allowed`}
            />
          </div>

          <div>
            <label className={labelCls}>Temporary Password *</label>
            <div className="flex gap-2.5">
              <div className="relative flex-1">
                <input
                  type={state.showPassword ? "text" : "password"}
                  value={state.password}
                  onChange={(e) => update("password", e.target.value)}
                  placeholder="Min 8 characters"
                  minLength={8}
                  className={`${inputCls} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => update("showPassword", !state.showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded text-[var(--tx3)] hover:text-[var(--tx)] transition-colors"
                >
                  <Icon name={state.showPassword ? "eyeOff" : "eye"} className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="px-4 py-3 rounded-xl text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)]/50 hover:text-[var(--gold)] transition-all shrink-0"
              >
                Generate
              </button>
            </div>
            <p className="text-[11px] text-[var(--tx3)] mt-1.5">
              Partner will be prompted to change their password on first login.
            </p>
          </div>
        </>
      )}

      {state.phone && (
        <div className="pt-4 border-t border-[var(--brd)]/60">
          <label className={labelCls}>Send Setup Link via SMS?</label>
          <p className="text-[12px] text-[var(--tx3)] mb-3">
            Send the portal access link to {state.phone} so they can log in immediately on any device.
          </p>
          <label
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl border cursor-pointer transition-all duration-150 ${
              state.sendSetupSms
                ? "border-[var(--gold)]/50 bg-[var(--gold)]/5"
                : "border-[var(--brd)]/70 hover:border-[var(--brd)]"
            }`}
          >
            <input
              type="checkbox"
              checked={state.sendSetupSms}
              onChange={(e) => update("sendSetupSms", e.target.checked)}
              className="accent-[var(--gold)]"
            />
            <span className="text-[13px] font-medium text-[var(--tx)]">Send setup link via SMS after activation</span>
          </label>
        </div>
      )}
    </div>
  );
}

/* ── Step 5: Summary ── */
const BILLING_LABELS: Record<string, string> = {
  per_delivery: "Per delivery invoice",
  monthly_statement: "Monthly statement",
  prepaid_credits: "Pre-paid credits",
};
const TERMS_LABELS: Record<string, string> = {
  due_on_receipt: "Due on Receipt, per-delivery, due immediately",
  net_15: "Net 15, statements 1st & 16th, due on statement date",
  net_30: "Net 30, monthly statement, due on statement date",
  prepay: "Pre-pay, credits pre-loaded",
};
const DELIVERY_LABELS: Record<string, string> = Object.fromEntries(
  DELIVERY_TYPE_OPTIONS.map((o) => [o.id, o.label])
);

function SummaryRow({ label, value }: { label: string; value: string | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-6 py-2.5 border-b border-[var(--brd)]/30 last:border-0">
      <span className="text-[12px] text-[var(--tx3)] shrink-0 w-36">{label}</span>
      <span className="text-[13px] text-[var(--tx)] text-right leading-relaxed">{value}</span>
    </div>
  );
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--brd)]/60 overflow-hidden">
      <div className="px-5 py-3 border-b border-[var(--brd)]/40 bg-[var(--bg)]/40">
        <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">{title}</p>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

function Step5Summary({ state }: { state: WizardState }) {
  return (
    <div className="space-y-4">
      <SummarySection title="Business">
        <SummaryRow label="Name" value={state.name} />
        <SummaryRow label="Legal Name" value={state.legalName} />
        <SummaryRow label="Contact" value={`${state.contactName}${state.contactTitle ? `, ${state.contactTitle}` : ""}`} />
        <SummaryRow label="Email" value={state.email} />
        <SummaryRow label="Phone" value={state.phone} />
        <SummaryRow label="Address" value={state.address} />
        <SummaryRow label="How Found" value={HOW_FOUND_OPTIONS.find((o) => o.value === state.howFound)?.label} />
        <SummaryRow label="Referral Source" value={state.referralSource} />
        <SummaryRow label="HubSpot Deal ID" value={state.hubspotDealId} />
      </SummarySection>

      <SummarySection title="Services">
        <SummaryRow
          label="Delivery Types"
          value={state.deliveryTypes.map((t) => DELIVERY_LABELS[t] || t).join(", ") || undefined}
        />
        <SummaryRow label="Frequency" value={FREQUENCY_OPTIONS.find((o) => o.value === state.deliveryFrequency)?.label} />
        <SummaryRow label="Typical Items" value={state.typicalItems} />
        <SummaryRow label="Special Requirements" value={state.specialRequirements} />
        <SummaryRow label="Pickup Locations" value={state.pickupLocations.filter(Boolean).join(", ") || undefined} />
        <SummaryRow
          label="B2B delivery verticals"
          value={
            state.b2bDeliveryVerticals.length
              ? state.b2bDeliveryVerticals
                  .map((c) => B2B_DELIVERY_VERTICAL_OPTIONS.find((o) => o.id === c)?.label || c)
                  .join(", ")
              : undefined
          }
        />
      </SummarySection>

      <SummarySection title="Billing">
        <SummaryRow label="Billing Method" value={BILLING_LABELS[state.billingMethod]} />
        <SummaryRow label="Payment Terms" value={TERMS_LABELS[state.paymentTerms]} />
        <SummaryRow label="Tax ID" value={state.taxId} />
        <SummaryRow label="Insurance Cert" value={state.insuranceCertRequired ? "Required" : undefined} />
      </SummarySection>

      <SummarySection title="Portal Access">
        <SummaryRow label="Portal Login" value={state.createPortalLogin ? "Yes. An invitation will be sent." : "No"} />
        {state.sendSetupSms && <SummaryRow label="Setup SMS" value={`Will be sent to ${state.phone}`} />}
      </SummarySection>

      <div className="flex items-start gap-3 px-4 py-3.5 rounded-xl bg-amber-500/8 border border-amber-500/15">
        <Icon name="alertTriangle" className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
        <p className="text-[12px] text-amber-200/80 leading-relaxed">
          Review everything above. If portal login is enabled, an invitation email will be sent immediately upon activation.
        </p>
      </div>
    </div>
  );
}

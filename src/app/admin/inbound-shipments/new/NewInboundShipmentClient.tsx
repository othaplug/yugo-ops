"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash, Sparkle, Warning } from "@phosphor-icons/react";
import BackButton from "@/app/admin/components/BackButton";
import SectionDivider from "@/components/ui/SectionDivider";
import AddressAutocomplete, {
  type AddressResult,
} from "@/components/ui/AddressAutocomplete";
import {
  applyHubSpotSuggestRow,
  useHubSpotContactSuggest,
  type HubSpotSuggestField,
  type HubSpotSuggestRow,
} from "@/hooks/useHubSpotContactSuggest";

/**
 * Full delivery-access list. Was previously 7 options (missing
 * ground_floor, walk-ups 2nd/3rd/4th, long_carry, narrow_stairs) so
 * coordinators picking "Elevator" for a 3rd-floor walk-up shipment
 * silently lost the carry premium downstream. Mirrors the same set the
 * residential quote form uses against access_scores.
 */
const ACCESS_OPTIONS: { value: string; label: string }[] = [
  { value: "ground_floor", label: "Ground floor" },
  { value: "elevator", label: "Elevator" },
  { value: "loading_dock", label: "Loading dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+ floor)" },
  { value: "basement", label: "Basement" },
  { value: "basement_stairs", label: "Basement (stairs)" },
  { value: "basement_walkout", label: "Basement (walk-out)" },
  { value: "stairs", label: "Stairs (other)" },
  { value: "long_carry", label: "Long carry (50m+)" },
  { value: "narrow_stairs", label: "Narrow stairs" },
  { value: "no_parking", label: "No parking nearby" },
];

const fmtMoney = (n: number) =>
  n.toLocaleString("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const labelClass =
  "block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-1.5";

const requiredMark = (
  <span className="text-[var(--red)] ml-0.5" aria-hidden>
    *
  </span>
);

type Partner = {
  id: string;
  name: string | null;
  type: string | null;
  email: string | null;
  phone: string | null;
  contact_name: string | null;
};

type ItemRow = {
  name: string;
  boxes: string;
  dimensions: string;
  weight_lbs: string;
  declared_value: string;
};

const CARRIERS = [
  "Day and Ross",
  "FedEx Freight",
  "Purolator",
  "UPS Freight",
  "Other",
];

export default function NewInboundShipmentClient({
  partners,
}: {
  partners: Partner[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [mode, setMode] = useState<"partner" | "new">("partner");
  const [organizationId, setOrganizationId] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [partnerIssuePhone, setPartnerIssuePhone] = useState("");
  const [carrierName, setCarrierName] = useState(CARRIERS[0]);
  const [carrierOther, setCarrierOther] = useState("");
  const [carrierTracking, setCarrierTracking] = useState("");
  const [carrierEta, setCarrierEta] = useState("");
  const [items, setItems] = useState<ItemRow[]>([
    {
      name: "",
      boxes: "1",
      dimensions: "",
      weight_lbs: "",
      declared_value: "",
    },
  ]);
  const [customerLater, setCustomerLater] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerPostal, setCustomerPostal] = useState("");
  const [customerAccess, setCustomerAccess] = useState("elevator");
  const [customerNotes, setCustomerNotes] = useState("");
  const [serviceLevel, setServiceLevel] = useState("white_glove");
  const [requiresMoveInside, setRequiresMoveInside] = useState(true);
  const [requiresUnboxing, setRequiresUnboxing] = useState(true);
  const [requiresAssembly, setRequiresAssembly] = useState(false);
  const [requiresDebris, setRequiresDebris] = useState(true);
  const [requiresPod, setRequiresPod] = useState(true);
  const [receivingTier, setReceivingTier] = useState<"standard" | "detailed">(
    "detailed",
  );
  const [assemblyComplexity, setAssemblyComplexity] = useState<
    "" | "simple" | "moderate" | "complex"
  >("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [billingMethod, setBillingMethod] = useState("partner");
  const [estimatedStorageDays, setEstimatedStorageDays] = useState("0");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [assemblyPrice, setAssemblyPrice] = useState("");
  const [storagePrice, setStoragePrice] = useState("");
  const [receivingFee, setReceivingFee] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);

  /**
   * Per-field error map. Replaces HTML5 `required` attributes which
   * blocked submit silently and caused the browser to scroll-jump
   * to the first invalid input — operators saw this as "Create
   * Shipment returns me to the top" with no message to explain why.
   * Keyed by a stable field id so we can also surface the error
   * inline next to the input AND scroll to it.
   */
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorBannerRef = useRef<HTMLDivElement | null>(null);

  // Live total — operators were hand-summing receiving + delivery +
  // assembly + storage into the Total field. Auto-compute it so the
  // submitted total can't drift from the line items.
  const computedTotal = useMemo(() => {
    const parse = (v: string) => {
      const n = parseFloat((v || "").replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : 0;
    };
    return (
      parse(receivingFee) +
      parse(deliveryPrice) +
      parse(assemblyPrice) +
      parse(storagePrice)
    );
  }, [receivingFee, deliveryPrice, assemblyPrice, storagePrice]);

  // Keep the bound Total field synced to the computed total unless the
  // operator has manually overridden it. Manual override is detected
  // when the typed value diverges from the sum by more than $0.50.
  const totalManualOverrideRef = useRef(false);
  useEffect(() => {
    if (totalManualOverrideRef.current) return;
    setTotalPrice(computedTotal > 0 ? String(Math.round(computedTotal)) : "");
  }, [computedTotal]);

  const [senderHsActive, setSenderHsActive] =
    useState<HubSpotSuggestField | null>(null);
  const senderHsQuery = useMemo(() => {
    if (senderHsActive === "business") return businessName;
    if (senderHsActive === "email") return businessEmail;
    if (senderHsActive === "phone") return businessPhone;
    return "";
  }, [senderHsActive, businessName, businessEmail, businessPhone]);

  const onSenderHubSpotPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.businessName) setBusinessName(a.businessName);
    else if (a.contactName) setBusinessName(a.contactName);
    if (a.email) setBusinessEmail(a.email);
    if (a.phoneFormatted) setBusinessPhone(a.phoneFormatted);
  }, []);

  const senderHs = useHubSpotContactSuggest({
    query: senderHsQuery,
    activeField: senderHsActive,
    setActiveField: setSenderHsActive,
    onPick: onSenderHubSpotPick,
  });

  const [custHsActive, setCustHsActive] = useState<HubSpotSuggestField | null>(
    null,
  );
  const custHsQuery = useMemo(() => {
    if (custHsActive === "contact") return customerName;
    if (custHsActive === "email") return customerEmail;
    if (custHsActive === "phone") return customerPhone;
    return "";
  }, [custHsActive, customerName, customerEmail, customerPhone]);

  const onCustHubSpotPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.contactName) setCustomerName(a.contactName);
    if (a.email) setCustomerEmail(a.email);
    if (a.phoneFormatted) setCustomerPhone(a.phoneFormatted);
  }, []);

  const custHs = useHubSpotContactSuggest({
    query: custHsQuery,
    activeField: custHsActive,
    setActiveField: setCustHsActive,
    onPick: onCustHubSpotPick,
  });

  const resolvedCarrier =
    carrierName === "Other" ? carrierOther.trim() || "Other" : carrierName;

  const maxWeight = useMemo(() => {
    let m = 0;
    for (const it of items) {
      const w = parseFloat(it.weight_lbs);
      if (!Number.isNaN(w)) m = Math.max(m, w);
    }
    return m || null;
  }, [items]);

  async function runSuggest() {
    const addr = customerAddress.trim();
    if (!addr) {
      setErr("Enter a delivery address to suggest pricing.");
      return;
    }
    setErr(null);
    setSuggestLoading(true);
    try {
      const res = await fetch("/api/admin/inbound-shipments/suggest-price", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          delivery_address: addr,
          delivery_access: customerAccess,
          receiving_inspection_tier: receivingTier,
          assembly_complexity: assemblyComplexity || null,
          estimated_storage_days: parseInt(estimatedStorageDays, 10) || 0,
          max_item_weight_lbs: maxWeight,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Suggest failed");
      setReceivingFee(String(j.receiving_fee));
      setDeliveryPrice(String(j.delivery_fee));
      setAssemblyPrice(String(j.assembly_fee));
      setStoragePrice(String(j.storage_fee));
      setTotalPrice(String(j.subtotal));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Suggest failed");
    } finally {
      setSuggestLoading(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    // Controlled validation BEFORE the API call. Returns the full set
    // of missing fields so the operator can fix them all at once
    // instead of fix-one-resubmit-discover-next.
    const errors: Record<string, string> = {};
    if (mode === "partner") {
      if (!organizationId) errors.organizationId = "Select a partner organization.";
    } else {
      if (!businessName.trim()) errors.businessName = "Business name required.";
      if (!businessEmail.trim()) errors.businessEmail = "Contact email required.";
    }
    const cleanedItems = items
      .filter((it) => it.name.trim())
      .map((it) => ({
        name: it.name.trim(),
        boxes: parseInt(it.boxes, 10) || 1,
        dimensions: it.dimensions.trim() || null,
        weight_lbs: it.weight_lbs ? parseFloat(it.weight_lbs) : null,
        declared_value: it.declared_value
          ? parseFloat(it.declared_value)
          : null,
      }));
    if (cleanedItems.length === 0) {
      errors.items = "Add at least one item with a description.";
    }
    if (!customerLater) {
      if (!customerName.trim()) errors.customerName = "Customer name required.";
      if (!customerEmail.trim()) errors.customerEmail = "Customer email required.";
      if (!customerPhone.trim()) errors.customerPhone = "Customer phone required.";
      if (!customerAddress.trim()) errors.customerAddress = "Delivery address required.";
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) {
      // Scroll the operator to the error banner so they can SEE the
      // list of what's missing instead of staring at a button that
      // appears to do nothing. The previous HTML5 required fallback
      // jump-focused the first invalid input and felt like the page
      // had reset to the top.
      setErr(
        `Please fix ${Object.keys(errors).length} field${
          Object.keys(errors).length === 1 ? "" : "s"
        } before creating the shipment.`,
      );
      requestAnimationFrame(() => {
        errorBannerRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      });
      return;
    }
    const parsedItems = cleanedItems;
    setSaving(true);
    try {

      const body = {
        organization_id:
          mode === "partner" && organizationId ? organizationId : null,
        business_name: mode === "new" ? businessName : null,
        business_email: mode === "new" ? businessEmail : null,
        business_phone: mode === "new" ? businessPhone : null,
        partner_issue_phone: partnerIssuePhone || null,
        carrier_name: resolvedCarrier,
        carrier_tracking_number: carrierTracking || null,
        carrier_eta: carrierEta || null,
        items: parsedItems,
        customer_later: customerLater,
        customer_name: customerLater ? null : customerName,
        customer_email: customerLater ? null : customerEmail,
        customer_phone: customerLater ? null : customerPhone,
        customer_address: customerLater ? null : customerAddress,
        customer_postal: customerLater ? null : customerPostal,
        customer_access: customerLater ? null : customerAccess,
        customer_notes: customerLater ? null : customerNotes,
        service_level: serviceLevel,
        requires_move_inside: requiresMoveInside,
        requires_unboxing: requiresUnboxing,
        requires_assembly: requiresAssembly,
        requires_debris_removal: requiresDebris,
        requires_pod: requiresPod,
        receiving_inspection_tier: receivingTier,
        assembly_complexity: assemblyComplexity || null,
        special_instructions: specialInstructions || null,
        billing_method: billingMethod,
        delivery_price: deliveryPrice ? parseFloat(deliveryPrice) : null,
        assembly_price: assemblyPrice ? parseFloat(assemblyPrice) : 0,
        storage_price: storagePrice ? parseFloat(storagePrice) : 0,
        receiving_fee: receivingFee ? parseFloat(receivingFee) : null,
        total_price: totalPrice ? parseFloat(totalPrice) : null,
      };

      const res = await fetch("/api/admin/inbound-shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Create failed");
      router.push(`/admin/inbound-shipments/${j.shipment.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full min-w-0 max-w-[min(900px,100%)] mx-auto py-5 md:py-6">
      <div className="mb-6">
        <BackButton
          label="Inbound Shipments"
          fallback="/admin/inbound-shipments"
        />
      </div>

      <div className="mb-2">
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)] mb-1">
          Partners
        </p>
        <h1 className="admin-page-hero text-[var(--tx)]">
          Create inbound shipment
        </h1>
        <p className="text-[12px] text-[var(--tx3)] mt-2 leading-relaxed max-w-2xl">
          Receive a freight shipment on behalf of a partner, hold for the
          configured storage window, then deliver to the end customer.
          Required fields are marked with{" "}
          <span className="text-[var(--red)]">*</span>.
        </p>
      </div>

      {/* Top-of-form error banner. Replaces the silent HTML5
          required jump that operators read as "the button returned me
          to the top". Lists every missing field at once with anchor
          targets so a fix-then-recheck loop is one scroll, not five. */}
      {err ? (
        <div
          ref={errorBannerRef}
          role="alert"
          aria-live="polite"
          className="mb-6 rounded-lg border border-[var(--red)]/40 bg-[var(--red)]/8 px-4 py-3 flex items-start gap-3"
        >
          <Warning
            size={18}
            className="text-[var(--red)] shrink-0 mt-0.5"
            weight="bold"
            aria-hidden
          />
          <div className="text-[12px] leading-relaxed">
            <p className="font-semibold text-[var(--red)] mb-0.5">{err}</p>
            {Object.keys(fieldErrors).length > 0 && (
              <ul className="list-disc list-inside text-[var(--tx2)] space-y-0.5">
                {Object.entries(fieldErrors).map(([k, msg]) => (
                  <li key={k}>{msg}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      <form onSubmit={onSubmit} noValidate>
        <SectionDivider label="Partner / sender" />
        <p className="text-[11px] text-[var(--tx3)] mb-3 leading-snug">
          Pick the existing partner billing relationship, or capture a
          one-off sender. The partner pays unless you set Bill to to
          Customer or Split below.
        </p>
        <div className="space-y-4">
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "partner"}
                onChange={() => setMode("partner")}
              />
              Existing partner
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                checked={mode === "new"}
                onChange={() => setMode("new")}
              />
              New sender
            </label>
          </div>
          {mode === "partner" ? (
            <div>
              <label className={labelClass}>
                Partner organization{requiredMark}
              </label>
              <select
                className={`admin-premium-input w-full text-sm ${
                  fieldErrors.organizationId
                    ? "border-[var(--red)]/60"
                    : ""
                }`}
                value={organizationId}
                onChange={(e) => setOrganizationId(e.target.value)}
              >
                <option value="">Select partner…</option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name || p.contact_name || p.email || p.id}
                  </option>
                ))}
              </select>
              {fieldErrors.organizationId && (
                <p className="text-[11px] text-[var(--red)] mt-1">
                  {fieldErrors.organizationId}
                </p>
              )}
            </div>
          ) : (
            <div
              ref={senderHs.containerRef}
              className="grid sm:grid-cols-2 gap-3"
            >
              <div className="relative sm:col-span-2">
                <label className={labelClass}>
                  Business name{requiredMark}
                </label>
                <input
                  {...senderHs.bindField("business")}
                  placeholder="e.g. Gabriel Ross Logistics"
                  className={`admin-premium-input w-full text-sm ${
                    fieldErrors.businessName ? "border-[var(--red)]/60" : ""
                  }`}
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  autoComplete="organization"
                />
                {senderHs.renderDropdown("business")}
                {fieldErrors.businessName && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.businessName}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className={labelClass}>
                  Contact email{requiredMark}
                </label>
                <input
                  type="email"
                  {...senderHs.bindField("email")}
                  placeholder="logistics@example.com"
                  className={`admin-premium-input w-full text-sm ${
                    fieldErrors.businessEmail ? "border-[var(--red)]/60" : ""
                  }`}
                  value={businessEmail}
                  onChange={(e) => setBusinessEmail(e.target.value)}
                  autoComplete="email"
                />
                {senderHs.renderDropdown("email")}
                {fieldErrors.businessEmail && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.businessEmail}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className={labelClass}>Contact phone</label>
                <input
                  {...senderHs.bindField("phone")}
                  placeholder="(604) 555-0123"
                  className="admin-premium-input w-full text-sm"
                  value={businessPhone}
                  onChange={(e) => setBusinessPhone(e.target.value)}
                  autoComplete="tel"
                />
                {senderHs.renderDropdown("phone")}
              </div>
            </div>
          )}
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">
              Issue line (call if delivery issues)
            </span>
            <input
              className="mt-1 admin-premium-input w-full text-sm"
              value={partnerIssuePhone}
              onChange={(e) => setPartnerIssuePhone(e.target.value)}
              placeholder="e.g. 1-844-403-0392, option 3"
            />
          </label>
        </div>

        <SectionDivider label="Carrier" />
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <select
              className="admin-premium-input w-full text-sm"
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
            >
              {CARRIERS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {carrierName === "Other" && (
              <input
                className="admin-premium-input w-full text-sm"
                placeholder="Carrier name"
                value={carrierOther}
                onChange={(e) => setCarrierOther(e.target.value)}
              />
            )}
            <input
              placeholder="Tracking number"
              className="admin-premium-input w-full text-sm"
              value={carrierTracking}
              onChange={(e) => setCarrierTracking(e.target.value)}
            />
            <input
              type="date"
              className="admin-premium-input w-full text-sm"
              value={carrierEta}
              onChange={(e) => setCarrierEta(e.target.value)}
            />
          </div>
        </div>

        <SectionDivider label="Items" />
        <p className="text-[11px] text-[var(--tx3)] mb-3 leading-snug">
          One row per SKU or shipment line. Boxes is the carton count
          (used for crew sizing); Dimensions and Weight are per-line
          totals (used for vehicle pick + access surcharges).
        </p>
        <div className="space-y-4">
          {fieldErrors.items && (
            <div className="rounded-md border border-[var(--red)]/40 bg-[var(--red)]/8 px-3 py-2 text-[11px] text-[var(--red)]">
              {fieldErrors.items}
            </div>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [
                  ...prev,
                  {
                    name: "",
                    boxes: "1",
                    dimensions: "",
                    weight_lbs: "",
                    declared_value: "",
                  },
                ])
              }
              className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[var(--accent-text)] hover:opacity-80 transition-opacity"
            >
              <Plus size={14} weight="bold" aria-hidden />
              Add item
            </button>
          </div>
          {items.map((it, idx) => (
            <div
              key={idx}
              className={`relative space-y-2 ${idx > 0 ? "pt-6 mt-2 border-t border-[var(--brd)]" : ""}`}
            >
              {items.length > 1 && (
                <button
                  type="button"
                  className="absolute top-2 right-2 text-[var(--tx3)] hover:text-red-500"
                  onClick={() =>
                    setItems((prev) => prev.filter((_, i) => i !== idx))
                  }
                  aria-label="Remove item"
                >
                  <Trash size={18} />
                </button>
              )}
              <input
                placeholder={`Description${idx === 0 ? " *" : " (optional add'l item)"}`}
                className="admin-premium-input w-full text-sm"
                value={it.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setItems((prev) =>
                    prev.map((row, i) =>
                      i === idx ? { ...row, name: v } : row,
                    ),
                  );
                }}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  placeholder="Boxes"
                  className="admin-premium-input w-full text-sm"
                  value={it.boxes}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, boxes: v } : row,
                      ),
                    );
                  }}
                />
                <input
                  placeholder="Dimensions"
                  className="admin-premium-input w-full text-sm"
                  value={it.dimensions}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, dimensions: v } : row,
                      ),
                    );
                  }}
                />
                <input
                  placeholder="Weight (lbs)"
                  className="admin-premium-input w-full text-sm"
                  value={it.weight_lbs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, weight_lbs: v } : row,
                      ),
                    );
                  }}
                />
                <input
                  placeholder="Declared value ($)"
                  className="admin-premium-input w-full text-sm"
                  value={it.declared_value}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) =>
                      prev.map((row, i) =>
                        i === idx ? { ...row, declared_value: v } : row,
                      ),
                    );
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        <SectionDivider label="End customer" />
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={!customerLater}
              onChange={() => setCustomerLater(false)}
            />
            Customer details available now
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={customerLater}
              onChange={() => setCustomerLater(true)}
            />
            Customer details to be provided later
          </label>
          {customerLater ? (
            <p className="text-sm text-[var(--tx3)]">
              Partner will provide customer details after the shipment is
              confirmed received.
            </p>
          ) : (
            <div
              ref={custHs.containerRef}
              className="grid sm:grid-cols-2 gap-3"
            >
              <div className="relative">
                <label className={labelClass}>
                  Customer name{requiredMark}
                </label>
                <input
                  {...custHs.bindField("contact")}
                  placeholder="Jane Smith"
                  className={`admin-premium-input w-full text-sm ${
                    fieldErrors.customerName ? "border-[var(--red)]/60" : ""
                  }`}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  autoComplete="name"
                />
                {custHs.renderDropdown("contact")}
                {fieldErrors.customerName && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.customerName}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className={labelClass}>Email{requiredMark}</label>
                <input
                  type="email"
                  {...custHs.bindField("email")}
                  placeholder="jane@example.com"
                  className={`admin-premium-input w-full text-sm ${
                    fieldErrors.customerEmail ? "border-[var(--red)]/60" : ""
                  }`}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  autoComplete="email"
                />
                {custHs.renderDropdown("email")}
                {fieldErrors.customerEmail && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.customerEmail}
                  </p>
                )}
              </div>
              <div className="relative">
                <label className={labelClass}>Phone{requiredMark}</label>
                <input
                  {...custHs.bindField("phone")}
                  placeholder="(416) 555-0123"
                  className={`admin-premium-input w-full text-sm ${
                    fieldErrors.customerPhone ? "border-[var(--red)]/60" : ""
                  }`}
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  autoComplete="tel"
                />
                {custHs.renderDropdown("phone")}
                {fieldErrors.customerPhone && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.customerPhone}
                  </p>
                )}
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>
                  Delivery address{requiredMark}
                </label>
                <AddressAutocomplete
                  placeholder="123 King St W, Toronto, ON"
                  value={customerAddress}
                  onRawChange={setCustomerAddress}
                  onChange={(r: AddressResult) => {
                    setCustomerAddress(r.fullAddress);
                    setCustomerPostal((p) =>
                      !p.trim() && r.postalCode ? r.postalCode : p,
                    );
                  }}
                  className={`admin-premium-input w-full text-sm text-[var(--tx)] ${
                    fieldErrors.customerAddress
                      ? "border-[var(--red)]/60"
                      : ""
                  }`}
                />
                {fieldErrors.customerAddress && (
                  <p className="text-[11px] text-[var(--red)] mt-1">
                    {fieldErrors.customerAddress}
                  </p>
                )}
              </div>
              <div>
                <label className={labelClass}>Postal code</label>
                <input
                  placeholder="M4S 1M7"
                  className="admin-premium-input w-full text-sm"
                  value={customerPostal}
                  onChange={(e) => setCustomerPostal(e.target.value)}
                />
              </div>
              <div>
                <label className={labelClass}>Delivery access</label>
                <select
                  className="admin-premium-input w-full text-sm"
                  value={customerAccess}
                  onChange={(e) => setCustomerAccess(e.target.value)}
                >
                  {ACCESS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label className={labelClass}>Notes</label>
                <textarea
                  placeholder="Buzzer code, COI requirements, time-of-day restrictions…"
                  rows={2}
                  className="admin-premium-input w-full text-sm"
                  value={customerNotes}
                  onChange={(e) => setCustomerNotes(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>

        <SectionDivider label="Service requirements" />
        <div className="space-y-4">
          <select
            className="admin-premium-input w-full text-sm"
            value={serviceLevel}
            onChange={(e) => setServiceLevel(e.target.value)}
          >
            <option value="white_glove">White glove</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresMoveInside}
                onChange={(e) => setRequiresMoveInside(e.target.checked)}
              />
              Move inside
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresUnboxing}
                onChange={(e) => setRequiresUnboxing(e.target.checked)}
              />
              Unboxing
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresAssembly}
                onChange={(e) => setRequiresAssembly(e.target.checked)}
              />
              Assembly
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresDebris}
                onChange={(e) => setRequiresDebris(e.target.checked)}
              />
              Debris / packaging removal
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={requiresPod}
                onChange={(e) => setRequiresPod(e.target.checked)}
              />
              Signed POD required
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Receiving inspection</span>
            <select
              className="mt-1 admin-premium-input w-full text-sm"
              value={receivingTier}
              onChange={(e) =>
                setReceivingTier(e.target.value as "standard" | "detailed")
              }
            >
              <option value="detailed">
                Detailed (unbox, photograph, document)
              </option>
              <option value="standard">Standard (quick visual)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">
              Assembly complexity (for pricing)
            </span>
            <select
              className="mt-1 admin-premium-input w-full text-sm"
              value={assemblyComplexity}
              onChange={(e) =>
                setAssemblyComplexity(
                  e.target.value as typeof assemblyComplexity,
                )
              }
            >
              <option value="">None</option>
              <option value="simple">Simple</option>
              <option value="moderate">Moderate</option>
              <option value="complex">Complex</option>
            </select>
          </label>
          <textarea
            placeholder="Special instructions"
            rows={2}
            className="admin-premium-input w-full text-sm"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
          />
        </div>

        <SectionDivider label="Pricing" />
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void runSuggest()}
              disabled={suggestLoading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--gold)] text-[var(--accent-text)] text-[11px] font-bold tracking-wide disabled:opacity-50 hover:opacity-90 transition-opacity"
            >
              <Sparkle size={16} aria-hidden />
              {suggestLoading ? "Calculating…" : "Suggest from address"}
            </button>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">
              Estimated storage days (for quote)
            </span>
            <input
              className="mt-1 admin-premium-input w-full text-sm"
              value={estimatedStorageDays}
              onChange={(e) => setEstimatedStorageDays(e.target.value)}
            />
            <span className="text-xs text-[var(--tx3)]">
              First 3 days free by default (configurable).
            </span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Receiving fee</span>
              <input
                className="mt-1 admin-premium-input w-full text-sm"
                value={receivingFee}
                onChange={(e) => setReceivingFee(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Delivery fee</span>
              <input
                className="mt-1 admin-premium-input w-full text-sm"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Assembly fee</span>
              <input
                className="mt-1 admin-premium-input w-full text-sm"
                value={assemblyPrice}
                onChange={(e) => setAssemblyPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Storage fee</span>
              <input
                className="mt-1 admin-premium-input w-full text-sm"
                value={storagePrice}
                onChange={(e) => setStoragePrice(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-[var(--tx3)]">
                Total (pre-tax){" "}
                {totalManualOverrideRef.current ? (
                  <span className="text-[var(--gold)] font-semibold">
                    · manual override
                  </span>
                ) : (
                  <span className="text-[var(--tx3)]">
                    · auto-summed from line fees ({fmtMoney(computedTotal)})
                  </span>
                )}
              </span>
              <input
                className="mt-1 admin-premium-input w-full text-sm tabular-nums"
                value={totalPrice}
                onChange={(e) => {
                  // Operator typed a value that disagrees with the auto-sum
                  // by more than $0.50 → treat as manual override. Auto-sync
                  // pauses until they Reset.
                  const typed = parseFloat(
                    (e.target.value || "").replace(/[^0-9.\-]/g, ""),
                  );
                  if (
                    Number.isFinite(typed) &&
                    Math.abs(typed - computedTotal) >= 0.5
                  ) {
                    totalManualOverrideRef.current = true;
                  }
                  setTotalPrice(e.target.value);
                }}
              />
              {totalManualOverrideRef.current && (
                <button
                  type="button"
                  onClick={() => {
                    totalManualOverrideRef.current = false;
                    setTotalPrice(
                      computedTotal > 0 ? String(Math.round(computedTotal)) : "",
                    );
                  }}
                  className="mt-1 text-[11px] text-[var(--accent-text)] font-semibold hover:underline"
                >
                  Reset to auto-sum
                </button>
              )}
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Bill to</span>
            <select
              className="mt-1 admin-premium-input w-full text-sm"
              value={billingMethod}
              onChange={(e) => setBillingMethod(e.target.value)}
            >
              <option value="partner">Partner</option>
              <option value="customer">Customer</option>
              <option value="split">Split</option>
            </select>
          </label>
        </div>

        <SectionDivider />

        {err ? <p className="text-sm text-red-400 mb-2">{err}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1f5f3f] text-white text-sm font-semibold disabled:opacity-50 hover:brightness-105 transition-[filter]"
        >
          {saving ? "Creating…" : "Create shipment"}
        </button>
      </form>
    </div>
  );
}

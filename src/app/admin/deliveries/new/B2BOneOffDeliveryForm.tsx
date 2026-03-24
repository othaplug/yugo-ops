"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import DraftBanner from "@/components/ui/DraftBanner";
import { CalendarBlank, Plus, Trash as Trash2, SpinnerGap, CheckCircle, Warning } from "@phosphor-icons/react";

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

const fieldInput =
  "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}

const WEIGHT_OPTIONS = [
  { value: "standard", label: "Standard (under 100 lbs)" },
  { value: "heavy", label: "Heavy (100–250 lbs)" },
  { value: "very_heavy", label: "Very Heavy (250–500 lbs)" },
  { value: "oversized_fragile", label: "Oversized / Fragile" },
];

const ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground Floor" },
  { value: "loading_dock", label: "Loading Dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+ floor)" },
  { value: "long_carry", label: "Long Carry" },
  { value: "narrow_stairs", label: "Narrow Stairs" },
  { value: "no_parking", label: "No Parking Nearby" },
];

const TIME_WINDOW_OPTIONS = ["Morning (7 AM – 12 PM)", "Afternoon (12 PM – 5 PM)", "Full Day (7 AM – 5 PM)"];

interface HubSpotContact {
  hubspot_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  company: string;
  deal_ids: string[];
}

export default function B2BOneOffDeliveryForm({ crews = [] }: { crews?: Crew[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [businessName, setBusinessName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const contactPhoneInput = usePhoneInput(contactPhone, setContactPhone);

  // HubSpot lookup state
  const [hsLookupState, setHsLookupState] = useState<"idle" | "loading" | "found" | "not_found">("idle");
  const [hsContact, setHsContact] = useState<HubSpotContact | null>(null);
  const [hsDuplicate, setHsDuplicate] = useState<{ type: "contact" | "company"; label: string } | null>(null);
  const [hsAutofilled, setHsAutofilled] = useState<string[]>([]);
  const hsContactIdRef = useRef<string | null>(null);

  const runHubSpotLookup = useCallback(async (email: string) => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@")) return;

    setHsLookupState("loading");
    setHsDuplicate(null);
    setHsAutofilled([]);

    try {
      const res = await fetch("/api/hubspot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const data = await res.json();
      const contact: HubSpotContact | null = data.contact ?? null;

      if (!contact) {
        setHsLookupState("not_found");
        setHsContact(null);
        return;
      }

      setHsLookupState("found");
      setHsContact(contact);
      hsContactIdRef.current = contact.hubspot_id;

      const filled: string[] = [];
      const fullName = [contact.first_name, contact.last_name].filter(Boolean).join(" ");

      setBusinessName((prev) => {
        if (!prev.trim() && contact.company) { filled.push("Business Name"); return contact.company; }
        return prev;
      });
      setContactName((prev) => {
        if (!prev.trim() && fullName) { filled.push("Contact Name"); return fullName; }
        return prev;
      });
      setContactPhone((prev) => {
        if (!prev.trim() && contact.phone) { filled.push("Contact Phone"); return formatPhone(contact.phone); }
        return prev;
      });

      setHsAutofilled(filled);

      if (contact.deal_ids.length > 0) {
        setHsDuplicate({
          type: "contact",
          label: `${fullName || trimmed} already has ${contact.deal_ids.length} deal${contact.deal_ids.length > 1 ? "s" : ""} in HubSpot — review before creating a new booking.`,
        });
      }
    } catch {
      setHsLookupState("idle");
    }
  }, []);

  const [pickupAddress, setPickupAddress] = useState("");
  const [pickupAccess, setPickupAccess] = useState("loading_dock");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryAccess, setDeliveryAccess] = useState("elevator");

  const [items, setItems] = useState<{ name: string; qty: number }[]>([]);
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [weightCategory, setWeightCategory] = useState("standard");

  const [scheduledDate, setScheduledDate] = useState("");
  const [timeWindow, setTimeWindow] = useState("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [crewId, setCrewId] = useState("");

  // Draft auto-save
  const formState = useMemo(() => ({
    businessName, contactName, contactPhone, contactEmail,
    pickupAddress, pickupAccess, deliveryAddress, deliveryAccess,
    items, weightCategory, scheduledDate, timeWindow,
    specialInstructions, quotedPrice, crewId,
  }), [businessName, contactName, contactPhone, contactEmail, pickupAddress, pickupAccess, deliveryAddress, deliveryAccess, items, weightCategory, scheduledDate, timeWindow, specialInstructions, quotedPrice, crewId]);

  const titleFn = useCallback((s: typeof formState) => s.businessName || s.contactName || "B2B Delivery", []);
  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft("delivery_b2b", formState, titleFn);

  const handleRestoreDraft = useCallback(() => {
    const data = restoreDraft();
    if (!data) return;
    if (data.businessName) setBusinessName(data.businessName as string);
    if (data.contactName) setContactName(data.contactName as string);
    if (data.contactPhone) setContactPhone(data.contactPhone as string);
    if (data.contactEmail) setContactEmail(data.contactEmail as string);
    if (data.pickupAddress) setPickupAddress(data.pickupAddress as string);
    if (data.pickupAccess) setPickupAccess(data.pickupAccess as string);
    if (data.deliveryAddress) setDeliveryAddress(data.deliveryAddress as string);
    if (data.deliveryAccess) setDeliveryAccess(data.deliveryAccess as string);
    if (Array.isArray(data.items)) setItems(data.items as { name: string; qty: number }[]);
    if (data.weightCategory) setWeightCategory(data.weightCategory as string);
    if (data.scheduledDate) setScheduledDate(data.scheduledDate as string);
    if (data.timeWindow) setTimeWindow(data.timeWindow as string);
    if (data.specialInstructions) setSpecialInstructions(data.specialInstructions as string);
    if (data.quotedPrice) setQuotedPrice(data.quotedPrice as string);
    if (data.crewId) setCrewId(data.crewId as string);
  }, [restoreDraft]);

  const addItem = () => {
    if (!newItemName.trim()) return;
    setItems((prev) => [...prev, { name: newItemName.trim(), qty: newItemQty }]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName.trim()) { setError("Business name is required"); return; }
    if (!contactName.trim()) { setError("Contact name is required"); return; }
    if (!contactPhone.trim()) { setError("Contact phone is required"); return; }
    if (!pickupAddress.trim()) { setError("Pickup address is required"); return; }
    if (!deliveryAddress.trim()) { setError("Delivery address is required"); return; }
    if (!scheduledDate) { setError("Date is required"); return; }

    setLoading(true);
    setError("");

    const itemsList = items.length > 0
      ? items.map((i) => `${i.name}${i.qty > 1 ? ` ×${i.qty}` : ""}`)
      : ["Items TBD"];

    const payload = {
      booking_type: "one_off",
      organization_id: null,
      business_name: businessName.trim(),
      contact_name: contactName.trim(),
      contact_phone: normalizePhone(contactPhone),
      contact_email: contactEmail.trim() || null,
      client_name: businessName.trim(),
      customer_name: contactName.trim(),
      customer_phone: normalizePhone(contactPhone),
      customer_email: contactEmail.trim() || null,
      pickup_address: pickupAddress.trim(),
      delivery_address: deliveryAddress.trim(),
      pickup_access: pickupAccess || null,
      delivery_access: deliveryAccess || null,
      items: itemsList,
      item_weight_category: weightCategory || "standard",
      scheduled_date: scheduledDate,
      delivery_window: timeWindow || null,
      instructions: specialInstructions.trim() || null,
      quoted_price: parseNumberInput(quotedPrice) || null,
      crew_id: crewId || null,
      category: "b2b",
    };

    const res = await fetch("/api/admin/deliveries/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    const data = await res.json();

    if (res.ok && data.delivery) {
      clearDraft();
      const created = data.delivery;
      const path = created.delivery_number
        ? `/admin/deliveries/${encodeURIComponent(created.delivery_number)}`
        : `/admin/deliveries/${created.id}`;
      router.push(path);
      router.refresh();
    } else {
      setError(data.error || "Failed to create delivery");
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasDraft && <DraftBanner onRestore={handleRestoreDraft} onDismiss={dismissDraft} />}

      {error && (
        <div className="px-3 py-2.5 rounded-lg bg-[rgba(209,67,67,0.1)] border border-[rgba(209,67,67,0.3)] text-[12px] text-[var(--red)]">{error}</div>
      )}

      <div className="px-3 py-2 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-[11px] text-[var(--gold)]">
        One-off delivery from a business with no partner account. If they book again, consider creating a partner account for rate card pricing.
      </div>

      {/* Business Details */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Business Details</h3>
          {hsLookupState === "loading" && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--tx3)]">
              <SpinnerGap size={12} className="animate-spin" />
              Checking HubSpot…
            </span>
          )}
          {hsLookupState === "found" && hsAutofilled.length > 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[#2D9F5A] font-medium">
              <CheckCircle size={12} weight="fill" />
              Autofilled from HubSpot
            </span>
          )}
          {hsLookupState === "found" && hsAutofilled.length === 0 && (
            <span className="flex items-center gap-1 text-[10px] text-[var(--tx3)]">
              <CheckCircle size={12} weight="fill" />
              Found in HubSpot
            </span>
          )}
        </div>

        {hsDuplicate && (
          <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-700 dark:text-amber-400">
            <Warning size={14} weight="fill" className="shrink-0 mt-0.5" />
            <span>{hsDuplicate.label}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Business Name *">
            <input
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g. Crate & Barrel Yorkdale"
              className={fieldInput}
            />
          </Field>
          <Field label="Contact Name *">
            <input
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="e.g. Sarah"
              className={fieldInput}
            />
          </Field>
          <Field label="Contact Phone *">
            <input
              ref={contactPhoneInput.ref}
              type="tel"
              value={contactPhone}
              onChange={contactPhoneInput.onChange}
              placeholder={PHONE_PLACEHOLDER}
              className={fieldInput}
            />
          </Field>
          <Field label="Contact Email">
            <input
              type="email"
              value={contactEmail}
              onChange={(e) => { setContactEmail(e.target.value); setHsLookupState("idle"); setHsDuplicate(null); setHsAutofilled([]); }}
              onBlur={(e) => runHubSpotLookup(e.target.value)}
              placeholder="sarah@company.com"
              className={fieldInput}
            />
          </Field>
        </div>
      </section>

      {/* Delivery Details */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Delivery Details</h3>
        <Field label="Pickup Address *">
          <AddressAutocomplete value={pickupAddress} onRawChange={setPickupAddress} onChange={(r) => setPickupAddress(r.fullAddress)} placeholder="Business address" className={fieldInput} />
        </Field>
        <Field label="Pickup Access">
          <select value={pickupAccess} onChange={(e) => setPickupAccess(e.target.value)} className={fieldInput}>
            {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="Delivery Address *">
          <AddressAutocomplete value={deliveryAddress} onRawChange={setDeliveryAddress} onChange={(r) => setDeliveryAddress(r.fullAddress)} placeholder="Customer address" className={fieldInput} />
        </Field>
        <Field label="Delivery Access">
          <select value={deliveryAccess} onChange={(e) => setDeliveryAccess(e.target.value)} className={fieldInput}>
            {ACCESS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </section>

      {/* Items */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Items</h3>
        {items.length > 0 && (
          <ul className="space-y-1.5 mb-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                <span className="text-[12px] text-[var(--tx)]">{item.name}{item.qty > 1 ? ` ×${item.qty}` : ""}</span>
                <button type="button" onClick={() => removeItem(idx)} className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]" aria-label="Remove">
                  <Trash2 className="w-[14px] h-[14px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex gap-2 items-center">
          <input value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g. Sectional sofa" className="flex-1 min-w-0 text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--brd)] outline-none transition-colors" onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())} />
          <input type="number" min={1} value={newItemQty} onChange={(e) => setNewItemQty(Number(e.target.value) || 1)} className="w-12 text-center text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-2 py-2.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none transition-colors" />
          <button type="button" onClick={addItem} disabled={!newItemName.trim()} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 shrink-0">
            <Plus className="w-[14px] h-[14px]" /> Add
          </button>
        </div>
        <Field label="Weight Category">
          <select value={weightCategory} onChange={(e) => setWeightCategory(e.target.value)} className={fieldInput}>
            {WEIGHT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
      </section>

      {/* Schedule */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Schedule</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Field label="Date *">
            <div className="relative">
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={`${fieldInput} pr-9`} style={{ colorScheme: "dark" }} />
              <CalendarBlank
                size={14}
                className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[var(--tx3)]"
                aria-hidden
              />
            </div>
          </Field>
          <Field label="Time Window">
            <select value={timeWindow} onChange={(e) => setTimeWindow(e.target.value)} className={fieldInput}>
              <option value="">Select…</option>
              {TIME_WINDOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
            </select>
          </Field>
        </div>
      </section>

      {/* Special Instructions */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Special Instructions</h3>
        <textarea value={specialInstructions} onChange={(e) => setSpecialInstructions(e.target.value)} rows={3} placeholder="Call customer 30 min before arrival. Use service elevator…" className={`${fieldInput} resize-y`} />
      </section>

      {/* Assignment & Pricing */}
      <section className="space-y-2 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
        <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">Assignment & Pricing</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {crews.length > 0 && (
            <Field label="Assign Crew">
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={fieldInput}>
                <option value="">Unassigned</option>
                {crews.map((c) => <option key={c.id} value={c.id}>{c.name}{c.members?.length ? ` (${c.members.length})` : ""}</option>)}
              </select>
            </Field>
          )}
          <Field label="Quoted Price">
            <input
              type="text"
              value={quotedPrice}
              onChange={(e) => setQuotedPrice(e.target.value)}
              onBlur={() => { const n = parseNumberInput(quotedPrice); if (n > 0) setQuotedPrice(formatNumberInput(n)); }}
              placeholder="452.00"
              inputMode="decimal"
              className={fieldInput}
            />
          </Field>
        </div>
      </section>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={loading} className="px-5 py-2.5 rounded-xl font-semibold text-[13px] bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:opacity-90 disabled:opacity-50">
          {loading ? "Creating…" : "Create B2B One-Off Delivery"}
        </button>
      </div>
    </form>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type Item = { name: string; dimensions: string; weight_lb: string; value: string; notes: string };

type PricingLine = { key: string; label: string; amount: number; detail?: string };
type PricingResult = {
  lines: PricingLine[];
  subtotal: number;
  hst: number;
  total: number;
};

const emptyItem = (): Item => ({
  name: "",
  dimensions: "",
  weight_lb: "",
  value: "",
  notes: "",
});

export default function NewOutboundShipmentClient() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Partner
  const [partnerName, setPartnerName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [partnerContactName, setPartnerContactName] = useState("");
  const [partnerContactEmail, setPartnerContactEmail] = useState("");
  const [partnerContactPhone, setPartnerContactPhone] = useState("");

  // Consignor (residential pickup)
  const [consignorName, setConsignorName] = useState("");
  const [consignorEmail, setConsignorEmail] = useState("");
  const [consignorPhone, setConsignorPhone] = useState("");
  const [consignorAddress, setConsignorAddress] = useState("");
  const [consignorAccess, setConsignorAccess] = useState("");
  const [consignorNotes, setConsignorNotes] = useState("");

  // Items
  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [declaredValue, setDeclaredValue] = useState("");

  // Pickup
  const [pickupDate, setPickupDate] = useState("");
  const [pickupWindow, setPickupWindow] = useState("");

  // Pricing inputs
  const [pickupDistanceKm, setPickupDistanceKm] = useState("");
  const [palletCount, setPalletCount] = useState("1");
  const [expectedHoldDays, setExpectedHoldDays] = useState("0");
  const [cratingRequired, setCratingRequired] = useState(false);
  const [outsideStandardZone, setOutsideStandardZone] = useState(false);
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  // Live pricing preview
  const [pricing, setPricing] = useState<PricingResult | null>(null);

  useEffect(() => {
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/admin/outbound-shipments/preview-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pickup_distance_km: Number(pickupDistanceKm) || 0,
            pallet_count: Number(palletCount) || 1,
            declared_value: Number(declaredValue) || 0,
            expected_hold_days: Number(expectedHoldDays) || 0,
            crating_required: cratingRequired,
            outside_standard_zone: outsideStandardZone,
          }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as PricingResult;
        setPricing(data);
      } catch {
        // ignore preview errors
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [pickupDistanceKm, palletCount, declaredValue, expectedHoldDays, cratingRequired, outsideStandardZone]);

  function updateItem(idx: number, patch: Partial<Item>) {
    setItems((arr) => arr.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function removeItem(idx: number) {
    setItems((arr) => (arr.length <= 1 ? arr : arr.filter((_, i) => i !== idx)));
  }

  async function submit(confirmScheduled: boolean) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/outbound-shipments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          partner_name: partnerName,
          business_name: businessName,
          partner_contact_name: partnerContactName,
          partner_contact_email: partnerContactEmail,
          partner_contact_phone: partnerContactPhone,
          consignor_name: consignorName,
          consignor_email: consignorEmail,
          consignor_phone: consignorPhone,
          consignor_address: consignorAddress,
          consignor_access: consignorAccess,
          consignor_notes: consignorNotes,
          items: items
            .filter((it) => it.name.trim())
            .map((it) => ({
              name: it.name.trim(),
              dimensions: it.dimensions.trim() || undefined,
              weight_lb: it.weight_lb ? Number(it.weight_lb) : undefined,
              value: it.value ? Number(it.value) : undefined,
              notes: it.notes.trim() || undefined,
            })),
          declared_value: Number(declaredValue) || 0,
          scheduled_pickup_date: pickupDate || undefined,
          scheduled_pickup_window: pickupWindow,
          requires_palletization: true,
          requires_crating: cratingRequired,
          special_instructions: specialInstructions,
          internal_notes: internalNotes,
          confirm_scheduled: confirmScheduled,
          pricing: {
            pickup_distance_km: Number(pickupDistanceKm) || 0,
            pallet_count: Number(palletCount) || 1,
            expected_hold_days: Number(expectedHoldDays) || 0,
            crating_required: cratingRequired,
            outside_standard_zone: outsideStandardZone,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error ?? "Failed to create shipment");
        return;
      }
      router.push(`/admin/outbound-shipments/${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">B2B reverse logistics</p>
      <h1 className="text-[24px] font-bold text-[var(--tx)] mt-1 mb-6">New outbound shipment</h1>

      {error && (
        <div className="px-4 py-3 rounded-lg bg-red-50 border border-red-200 text-[12px] text-red-700 mb-4">
          {error}
        </div>
      )}

      <div className="grid grid-cols-12 gap-6">
        <div className="col-span-12 lg:col-span-8 space-y-6">
          <Card title="Partner (the B2B customer)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Partner name" value={partnerName} onChange={setPartnerName} placeholder="Logistic GRshop" />
              <Field label="Business name" value={businessName} onChange={setBusinessName} placeholder="Blu Dot" />
              <Field label="Contact name" value={partnerContactName} onChange={setPartnerContactName} />
              <Field label="Contact email" value={partnerContactEmail} onChange={setPartnerContactEmail} type="email" />
              <Field label="Contact phone" value={partnerContactPhone} onChange={setPartnerContactPhone} />
            </div>
          </Card>

          <Card title="Consignor (residential pickup)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Consignor name" value={consignorName} onChange={setConsignorName} placeholder="Timothy Shore" />
              <Field label="Email" value={consignorEmail} onChange={setConsignorEmail} type="email" />
              <Field label="Phone" value={consignorPhone} onChange={setConsignorPhone} />
              <Field label="Access notes" value={consignorAccess} onChange={setConsignorAccess} placeholder="Elevator, freight door, parking spot…" />
              <Field label="Pickup address" value={consignorAddress} onChange={setConsignorAddress} placeholder="465 Broadview Ave, Toronto, ON M4K 2N3" full />
              <Field label="Internal notes about the consignor" value={consignorNotes} onChange={setConsignorNotes} full multiline />
            </div>
          </Card>

          <Card title="Items">
            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-start p-3 border border-[var(--brd)] rounded-lg">
                  <div className="col-span-12 sm:col-span-4">
                    <Field label={`Item ${idx + 1} name`} value={it.name} onChange={(v) => updateItem(idx, { name: v })} placeholder="Blu Dot 4/4 Round Dining Table" />
                  </div>
                  <div className="col-span-6 sm:col-span-3">
                    <Field label="Dimensions" value={it.dimensions} onChange={(v) => updateItem(idx, { dimensions: v })} placeholder="48 × 48 × 29" />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Field label="Weight (lb)" value={it.weight_lb} onChange={(v) => updateItem(idx, { weight_lb: v })} type="number" />
                  </div>
                  <div className="col-span-3 sm:col-span-2">
                    <Field label="Value (CAD)" value={it.value} onChange={(v) => updateItem(idx, { value: v })} type="number" />
                  </div>
                  <div className="col-span-12 sm:col-span-1 flex sm:flex-col sm:items-end pt-5">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-[10px] text-red-600 font-semibold hover:underline">
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setItems((arr) => [...arr, emptyItem()])}
                className="text-[12px] font-semibold text-[var(--wine)] hover:underline"
              >
                + Add another item
              </button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <Field
                label="Total declared value (CAD)"
                value={declaredValue}
                onChange={setDeclaredValue}
                type="number"
                placeholder="4524"
              />
            </div>
          </Card>

          <Card title="Pickup schedule">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup date" value={pickupDate} onChange={setPickupDate} type="date" />
              <Field label="Window" value={pickupWindow} onChange={setPickupWindow} placeholder="10:00 AM – 12:00 PM" />
            </div>
          </Card>

          <Card title="Pricing inputs">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pickup distance from warehouse (km)" value={pickupDistanceKm} onChange={setPickupDistanceKm} type="number" placeholder="8" />
              <Field label="Pallets to build" value={palletCount} onChange={setPalletCount} type="number" />
              <Field label="Expected hold days at warehouse" value={expectedHoldDays} onChange={setExpectedHoldDays} type="number" placeholder="0" />
              <div className="flex flex-col gap-2 pt-5">
                <label className="inline-flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={cratingRequired} onChange={(e) => setCratingRequired(e.target.checked)} />
                  Custom crating required
                </label>
                <label className="inline-flex items-center gap-2 text-[12px]">
                  <input type="checkbox" checked={outsideStandardZone} onChange={(e) => setOutsideStandardZone(e.target.checked)} />
                  Outside standard service zone
                </label>
              </div>
              <Field label="Special instructions (shown to crew)" value={specialInstructions} onChange={setSpecialInstructions} full multiline />
              <Field label="Internal notes (ops only)" value={internalNotes} onChange={setInternalNotes} full multiline />
            </div>
          </Card>
        </div>

        <div className="col-span-12 lg:col-span-4">
          <div className="sticky top-6">
            <Card title="Price preview">
              {pricing ? (
                <div>
                  {pricing.lines.map((l) => (
                    <div key={l.key} className="flex justify-between gap-3 py-1.5 text-[12px]">
                      <div className="flex-1 min-w-0">
                        <div className="text-[var(--tx)]">{l.label}</div>
                        {l.detail && <div className="text-[10px] text-[var(--tx3)] mt-0.5">{l.detail}</div>}
                      </div>
                      <div className="font-mono text-[var(--tx)]">${l.amount.toFixed(2)}</div>
                    </div>
                  ))}
                  <hr className="my-3 border-[var(--brd)]" />
                  <Row label="Subtotal" value={`$${pricing.subtotal.toFixed(2)}`} />
                  <Row label="HST 13%" value={`$${pricing.hst.toFixed(2)}`} />
                  <div className="mt-3 pt-3 border-t border-[var(--brd)]">
                    <Row label="Total CAD" value={`$${pricing.total.toFixed(2)}`} bold />
                  </div>
                </div>
              ) : (
                <p className="text-[12px] text-[var(--tx3)]">Calculating…</p>
              )}

              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={submitting || !consignorAddress || !partnerName}
                  onClick={() => submit(true)}
                  className="px-4 py-2 rounded-md bg-[var(--wine)] text-white text-[12px] font-semibold hover:opacity-90 disabled:opacity-50"
                >
                  {submitting ? "Creating…" : "Save & schedule"}
                </button>
                <button
                  type="button"
                  disabled={submitting || !consignorAddress || !partnerName}
                  onClick={() => submit(false)}
                  className="px-4 py-2 rounded-md border border-[var(--brd)] text-[12px] font-semibold hover:bg-[var(--bg)] disabled:opacity-50"
                >
                  Save as draft
                </button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--brd)] p-4">
      <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)] mb-3">{title}</p>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  full,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  full?: boolean;
  multiline?: boolean;
}) {
  return (
    <label className={`block ${full ? "col-span-2" : ""}`}>
      <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--tx3)]">{label}</span>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--brd)] bg-[var(--bg)] text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--wine)]"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full px-3 py-2 rounded-md border border-[var(--brd)] bg-[var(--bg)] text-[12px] focus:outline-none focus:ring-1 focus:ring-[var(--wine)]"
        />
      )}
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-1">
      <span className="text-[12px] text-[var(--tx2)]">{label}</span>
      <span className={`font-mono text-[12px] ${bold ? "font-bold text-[var(--tx)] text-[14px]" : "text-[var(--tx)]"}`}>{value}</span>
    </div>
  );
}

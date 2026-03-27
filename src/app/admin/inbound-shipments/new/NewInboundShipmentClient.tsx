"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Plus, Trash, Sparkle } from "@phosphor-icons/react";

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

const CARRIERS = ["Day and Ross", "FedEx Freight", "Purolator", "UPS Freight", "Other"];

export default function NewInboundShipmentClient({ partners }: { partners: Partner[] }) {
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
    { name: "", boxes: "1", dimensions: "", weight_lbs: "", declared_value: "" },
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
  const [receivingTier, setReceivingTier] = useState<"standard" | "detailed">("detailed");
  const [assemblyComplexity, setAssemblyComplexity] = useState<"" | "simple" | "moderate" | "complex">("");
  const [specialInstructions, setSpecialInstructions] = useState("");
  const [billingMethod, setBillingMethod] = useState("partner");
  const [estimatedStorageDays, setEstimatedStorageDays] = useState("0");
  const [deliveryPrice, setDeliveryPrice] = useState("");
  const [assemblyPrice, setAssemblyPrice] = useState("");
  const [storagePrice, setStoragePrice] = useState("");
  const [receivingFee, setReceivingFee] = useState("");
  const [totalPrice, setTotalPrice] = useState("");
  const [suggestLoading, setSuggestLoading] = useState(false);

  const resolvedCarrier = carrierName === "Other" ? carrierOther.trim() || "Other" : carrierName;

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
    setSaving(true);
    try {
      if (mode === "partner" && !organizationId) {
        setErr("Select a partner organization.");
        setSaving(false);
        return;
      }

      const parsedItems = items
        .filter((it) => it.name.trim())
        .map((it) => ({
          name: it.name.trim(),
          boxes: parseInt(it.boxes, 10) || 1,
          dimensions: it.dimensions.trim() || null,
          weight_lbs: it.weight_lbs ? parseFloat(it.weight_lbs) : null,
          declared_value: it.declared_value ? parseFloat(it.declared_value) : null,
        }));
      if (parsedItems.length === 0) {
        setErr("Add at least one item with a description.");
        setSaving(false);
        return;
      }

      const body = {
        organization_id: mode === "partner" && organizationId ? organizationId : null,
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
    <div className="max-w-[800px] mx-auto px-3 sm:px-5 py-6">
      <Link
        href="/admin/inbound-shipments"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--tx3)] hover:text-[var(--gold)] mb-6"
      >
        <ArrowLeft size={16} aria-hidden />
        Inbound Shipments
      </Link>

      <h1 className="text-2xl font-semibold text-[var(--tx)] mb-6">Create inbound shipment</h1>

      <form onSubmit={onSubmit} className="space-y-8">
        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Partner / sender</h2>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === "partner"} onChange={() => setMode("partner")} />
              Existing partner
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} />
              New sender
            </label>
          </div>
          {mode === "partner" ? (
            <select
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
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
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required
                placeholder="Business name"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
              <input
                required
                type="email"
                placeholder="Contact email"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={businessEmail}
                onChange={(e) => setBusinessEmail(e.target.value)}
              />
              <input
                placeholder="Contact phone"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
              />
            </div>
          )}
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Issue line (call if delivery issues)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={partnerIssuePhone}
              onChange={(e) => setPartnerIssuePhone(e.target.value)}
              placeholder="e.g. 1-844-403-0392, option 3"
            />
          </label>
        </section>

        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Carrier</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <select
              className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
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
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                placeholder="Carrier name"
                value={carrierOther}
                onChange={(e) => setCarrierOther(e.target.value)}
              />
            )}
            <input
              placeholder="Tracking number"
              className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={carrierTracking}
              onChange={(e) => setCarrierTracking(e.target.value)}
            />
            <input
              type="date"
              className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={carrierEta}
              onChange={(e) => setCarrierEta(e.target.value)}
            />
          </div>
        </section>

        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Items</h2>
            <button
              type="button"
              onClick={() =>
                setItems((prev) => [...prev, { name: "", boxes: "1", dimensions: "", weight_lbs: "", declared_value: "" }])
              }
              className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--gold)]"
            >
              <Plus size={14} weight="bold" aria-hidden />
              Add item
            </button>
          </div>
          {items.map((it, idx) => (
            <div key={idx} className="p-4 rounded-lg border border-[var(--brd)]/60 space-y-2 relative">
              {items.length > 1 && (
                <button
                  type="button"
                  className="absolute top-2 right-2 text-[var(--tx3)] hover:text-red-500"
                  onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                  aria-label="Remove item"
                >
                  <Trash size={18} />
                </button>
              )}
              <input
                required={idx === 0}
                placeholder="Description"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={it.name}
                onChange={(e) => {
                  const v = e.target.value;
                  setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, name: v } : row)));
                }}
              />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <input
                  placeholder="Boxes"
                  className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                  value={it.boxes}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, boxes: v } : row)));
                  }}
                />
                <input
                  placeholder="Dimensions"
                  className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                  value={it.dimensions}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, dimensions: v } : row)));
                  }}
                />
                <input
                  placeholder="Weight (lbs)"
                  className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                  value={it.weight_lbs}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, weight_lbs: v } : row)));
                  }}
                />
                <input
                  placeholder="Declared value ($)"
                  className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                  value={it.declared_value}
                  onChange={(e) => {
                    const v = e.target.value;
                    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, declared_value: v } : row)));
                  }}
                />
              </div>
            </div>
          ))}
        </section>

        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">End customer</h2>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!customerLater} onChange={() => setCustomerLater(false)} />
            Customer details available now
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={customerLater} onChange={() => setCustomerLater(true)} />
            Customer details to be provided later
          </label>
          {customerLater ? (
            <p className="text-sm text-[var(--tx3)]">
              Partner will provide customer details after the shipment is confirmed received.
            </p>
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                required={!customerLater}
                placeholder="Name"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
              <input
                required={!customerLater}
                type="email"
                placeholder="Email"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
              <input
                required={!customerLater}
                placeholder="Phone"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
              <input
                required={!customerLater}
                placeholder="Delivery address"
                className="sm:col-span-2 rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerAddress}
                onChange={(e) => setCustomerAddress(e.target.value)}
              />
              <input
                placeholder="Postal code"
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerPostal}
                onChange={(e) => setCustomerPostal(e.target.value)}
              />
              <select
                className="rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerAccess}
                onChange={(e) => setCustomerAccess(e.target.value)}
              >
                <option value="elevator">Elevator</option>
                <option value="stairs">Stairs</option>
                <option value="loading_dock">Loading dock</option>
                <option value="no_parking">No parking nearby</option>
              </select>
              <textarea
                placeholder="Notes"
                rows={2}
                className="sm:col-span-2 rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Service requirements</h2>
          <select
            className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
            value={serviceLevel}
            onChange={(e) => setServiceLevel(e.target.value)}
          >
            <option value="white_glove">White glove</option>
            <option value="standard">Standard</option>
            <option value="premium">Premium</option>
          </select>
          <div className="grid sm:grid-cols-2 gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresMoveInside} onChange={(e) => setRequiresMoveInside(e.target.checked)} />
              Move inside
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresUnboxing} onChange={(e) => setRequiresUnboxing(e.target.checked)} />
              Unboxing
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresAssembly} onChange={(e) => setRequiresAssembly(e.target.checked)} />
              Assembly
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresDebris} onChange={(e) => setRequiresDebris(e.target.checked)} />
              Debris / packaging removal
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={requiresPod} onChange={(e) => setRequiresPod(e.target.checked)} />
              Signed POD required
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Receiving inspection</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={receivingTier}
              onChange={(e) => setReceivingTier(e.target.value as "standard" | "detailed")}
            >
              <option value="detailed">Detailed (unbox, photograph, document)</option>
              <option value="standard">Standard (quick visual)</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Assembly complexity (for pricing)</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={assemblyComplexity}
              onChange={(e) => setAssemblyComplexity(e.target.value as typeof assemblyComplexity)}
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
            className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
            value={specialInstructions}
            onChange={(e) => setSpecialInstructions(e.target.value)}
          />
        </section>

        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
            <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Pricing</h2>
            <button
              type="button"
              onClick={() => void runSuggest()}
              disabled={suggestLoading}
              className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-[var(--gold)] text-[var(--gold)] text-xs font-semibold disabled:opacity-50"
            >
              <Sparkle size={16} aria-hidden />
              {suggestLoading ? "Calculating…" : "Suggest from address"}
            </button>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Estimated storage days (for quote)</span>
            <input
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={estimatedStorageDays}
              onChange={(e) => setEstimatedStorageDays(e.target.value)}
            />
            <span className="text-xs text-[var(--tx3)]">First 3 days free by default (configurable).</span>
          </label>
          <div className="grid sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Receiving fee</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={receivingFee}
                onChange={(e) => setReceivingFee(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Delivery fee</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={deliveryPrice}
                onChange={(e) => setDeliveryPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Assembly fee</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={assemblyPrice}
                onChange={(e) => setAssemblyPrice(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="text-[var(--tx3)]">Storage fee</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={storagePrice}
                onChange={(e) => setStoragePrice(e.target.value)}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-[var(--tx3)]">Total (pre-tax)</span>
              <input
                className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={totalPrice}
                onChange={(e) => setTotalPrice(e.target.value)}
              />
            </label>
          </div>
          <label className="block text-sm">
            <span className="text-[var(--tx3)]">Bill to</span>
            <select
              className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={billingMethod}
              onChange={(e) => setBillingMethod(e.target.value)}
            >
              <option value="partner">Partner</option>
              <option value="customer">Customer</option>
              <option value="split">Split</option>
            </select>
          </label>
        </section>

        {err ? <p className="text-sm text-red-600">{err}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-[#1f5f3f] text-white text-sm font-semibold disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create shipment"}
        </button>
      </form>
    </div>
  );
}

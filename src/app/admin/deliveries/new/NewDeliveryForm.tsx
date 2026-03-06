"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatPhone, normalizePhone } from "@/lib/phone";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import BackButton from "../../components/BackButton";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { Plus, Trash2 } from "lucide-react";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
  phone?: string;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Office", "Garage", "Other"];
const COMPLEXITY_PRESETS = ["White Glove", "High Value", "Fragile", "Artwork", "Antiques", "Storage", "Assembly Required"];
const fieldInput =
  "w-full text-ui bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors";

export default function NewDeliveryForm({ organizations, crews = [] }: { organizations: Org[]; crews?: Crew[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date") || "";
  const typeFromUrl = searchParams.get("type") || "";
  const orgFromUrl = searchParams.get("org") || "";
  const supabase = createClient();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectType, setProjectType] = useState(["retail", "designer", "hospitality", "gallery"].includes(typeFromUrl) ? typeFromUrl : "retail");
  const [organizationId, setOrganizationId] = useState(orgFromUrl);
  const [contactSearch, setContactSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState(dateFromUrl);
  const [timeSlot, setTimeSlot] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [specialHandling, setSpecialHandling] = useState(false);
  const [quotedPrice, setQuotedPrice] = useState("");
  const [crewId, setCrewId] = useState("");
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>([]);

  const [inventory, setInventory] = useState<{ room: string; item_name: string }[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [itemsFallback, setItemsFallback] = useState("");

  const filteredOrgs = organizations.filter((o) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return o.name?.toLowerCase().includes(q) || o.email?.toLowerCase().includes(q) || o.contact_name?.toLowerCase().includes(q);
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (organizationId) {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        if (!customerName) setCustomerName(org.contact_name || org.name || "");
        if (!customerEmail) setCustomerEmail(org.email || "");
        if (!customerPhone && org.phone) setCustomerPhone(formatPhone(org.phone));
      }
    }
  }, [organizationId, organizations]);

  const addInventoryItem = () => {
    if (!newItemName.trim() || !newRoom) return;
    const name = newItemName.trim();
    const itemName = newItemQty > 1 ? `${name} x${newItemQty}` : name;
    setInventory((prev) => [...prev, { room: newRoom, item_name: itemName }]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const removeInventoryItem = (idx: number) => setInventory((prev) => prev.filter((_, i) => i !== idx));

  const addBulkItems = () => {
    if (!newRoom || !bulkText.trim()) return;
    const lines = bulkText.split("\n").map((l) => l.trim()).filter(Boolean);
    const items = lines.map((line) => {
      const m = line.match(/^(.+?)\s+x(\d+)$/i);
      return { room: newRoom, item_name: m ? `${m[1].trim()} x${m[2]}` : line };
    });
    setInventory((prev) => [...prev, ...items]);
    setBulkText("");
  };

  const toggleComplexity = (p: string) => {
    setComplexityIndicators((prev) => prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) { setError("Customer name is required"); return; }
    if (!deliveryAddress.trim()) { setError("Delivery address is required"); return; }
    if (!scheduledDate) { setError("Date is required"); return; }

    setLoading(true);
    setError("");

    const org = organizations.find((o) => o.id === organizationId);
    const deliveryNumber = `PJ${String(Math.floor(Math.random() * 9000) + 1000).padStart(4, "0")}`;

    const itemsList = inventory.length > 0
      ? inventory.map((i) => `${i.room}: ${i.item_name}`)
      : itemsFallback.split("\n").map((l) => l.trim()).filter(Boolean);

    const instructionsMerged = [instructions, accessNotes && `Access: ${accessNotes}`, internalNotes && `Internal: ${internalNotes}`, complexityIndicators.length > 0 && `Complexity: ${complexityIndicators.join(", ")}`].filter(Boolean).join("\n");

    const { data: created, error: dbError } = await supabase
      .from("deliveries")
      .insert({
        delivery_number: deliveryNumber,
        organization_id: organizationId || null,
        client_name: org?.name || "",
        customer_name: customerName.trim(),
        customer_email: customerEmail.trim() || null,
        customer_phone: customerPhone.trim() ? normalizePhone(customerPhone) : null,
        pickup_address: pickupAddress.trim() || null,
        delivery_address: deliveryAddress.trim(),
        items: itemsList,
        scheduled_date: scheduledDate,
        time_slot: timeSlot || null,
        preferred_time: preferredTime || null,
        delivery_window: deliveryWindow || null,
        status: "scheduled",
        category: projectType || org?.type || "retail",
        instructions: instructionsMerged || null,
        special_handling: specialHandling,
        quoted_price: parseNumberInput(quotedPrice) || null,
        crew_id: crewId || null,
      })
      .select("id, delivery_number")
      .single();

    setLoading(false);
    if (!dbError && created) {
      const path = created.delivery_number
        ? `/admin/deliveries/${encodeURIComponent(created.delivery_number)}`
        : `/admin/deliveries/${created.id}`;
      router.push(path);
      router.refresh();
    } else {
      setError(dbError?.message || "Failed to create delivery");
    }
  };

  return (
    <>
      <div className="mb-4"><BackButton label="Back" /></div>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-[rgba(209,67,67,0.1)] border border-[rgba(209,67,67,0.3)] text-ui text-[var(--red)]">{error}</div>
        )}

        {/* Section: Project type + Client */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Project & Client</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Project Type">
              <select value={projectType} onChange={(e) => setProjectType(e.target.value)} className={fieldInput}>
                <option value="retail">Retail</option>
                <option value="designer">Designer</option>
                <option value="hospitality">Hospitality</option>
                <option value="gallery">Art Gallery</option>
              </select>
            </Field>
            <Field label="Client / Partner">
              <div className="relative" ref={dropdownRef}>
                <input
                  value={contactSearch || (organizationId ? organizations.find((o) => o.id === organizationId)?.name || "" : "")}
                  onChange={(e) => { setContactSearch(e.target.value); setShowDropdown(true); if (!e.target.value) setOrganizationId(""); }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search clients…"
                  className={fieldInput}
                />
                {showDropdown && filteredOrgs.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredOrgs.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => { setOrganizationId(o.id); setContactSearch(o.name); setShowDropdown(false); }}
                        className="w-full text-left px-3 py-2 text-ui text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                      >
                        <span className="font-semibold">{o.name}</span>
                        {o.contact_name && <span className="text-[var(--tx3)]"> · {o.contact_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </section>

        {/* Section: Customer details */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Customer / Recipient</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Name *">
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Full name" className={fieldInput} />
            </Field>
            <Field label="Email">
              <input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="email@example.com" className={fieldInput} />
            </Field>
            <Field label="Phone">
              <input
                type="tel"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                onBlur={() => customerPhone && setCustomerPhone(formatPhone(customerPhone))}
                placeholder="(123) 456-7890"
                className={fieldInput}
              />
            </Field>
          </div>
        </section>

        {/* Section: Addresses */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Addresses</h3>
          <Field label="Pickup Address">
            <AddressAutocomplete value={pickupAddress} onRawChange={setPickupAddress} onChange={(r) => setPickupAddress(r.fullAddress)} placeholder="Warehouse, store, or pickup location" className={fieldInput} />
          </Field>
          <Field label="Delivery Address *">
            <AddressAutocomplete value={deliveryAddress} onRawChange={setDeliveryAddress} onChange={(r) => setDeliveryAddress(r.fullAddress)} placeholder="Delivery destination" className={fieldInput} />
          </Field>
        </section>

        {/* Section: Schedule */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Schedule</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="Date *">
              <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className={fieldInput} />
            </Field>
            <Field label="Time Slot">
              <input type="time" value={timeSlot} onChange={(e) => setTimeSlot(e.target.value)} className={fieldInput} />
            </Field>
            <Field label="Preferred Time">
              <input type="time" value={preferredTime} onChange={(e) => setPreferredTime(e.target.value)} className={fieldInput} />
            </Field>
            <Field label="Delivery Window">
              <select value={deliveryWindow} onChange={(e) => setDeliveryWindow(e.target.value)} className={fieldInput}>
                <option value="">Select window…</option>
                {TIME_WINDOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
              </select>
            </Field>
          </div>
        </section>

        {/* Section: Crew + Pricing */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Assignment & Pricing</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                placeholder="1,234.00"
                inputMode="decimal"
                className={fieldInput}
              />
            </Field>
          </div>
        </section>

        {/* Section: Inventory */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Inventory</h3>
          {inventory.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {inventory.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
                  <span className="text-ui text-[var(--tx)]">
                    <span className="text-[var(--tx3)]">{item.room}:</span> {item.item_name}
                  </span>
                  <button type="button" onClick={() => removeInventoryItem(idx)} className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]" aria-label="Remove">
                    <Trash2 className="w-[14px] h-[14px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex items-center gap-2 mb-2">
            <button type="button" onClick={() => setBulkMode(false)} className={`text-caption font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${!bulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"}`}>
              Single add
            </button>
            <button type="button" onClick={() => setBulkMode(true)} className={`text-caption font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${bulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"}`}>
              Bulk add
            </button>
          </div>
          {bulkMode ? (
            <div className="space-y-2">
              <select value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className={`${fieldInput} max-w-[180px]`}>
                <option value="">Room</option>
                {DEFAULT_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <textarea value={bulkText} onChange={(e) => setBulkText(e.target.value)} placeholder="One item per line, e.g. Couch x2" rows={3} className={`${fieldInput} resize-y`} />
              <button type="button" onClick={addBulkItems} disabled={!bulkText.trim() || !newRoom} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-caption font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50">
                <Plus className="w-[14px] h-[14px]" /> Add all
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-end">
              <select value={newRoom} onChange={(e) => setNewRoom(e.target.value)} className={`${fieldInput} w-full sm:w-[140px]`}>
                <option value="">Room</option>
                {DEFAULT_ROOMS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())} placeholder="Item name" className={`${fieldInput} flex-1 min-w-[120px]`} />
              <input type="number" min={1} max={99} value={newItemQty} onChange={(e) => setNewItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))} className={`${fieldInput} w-16`} />
              <button type="button" onClick={addInventoryItem} disabled={!newItemName.trim() || !newRoom} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-lg text-caption font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50">
                <Plus className="w-[14px] h-[14px]" /> Add
              </button>
            </div>
          )}
          <p className="text-label text-[var(--tx3)]">Or paste a simple list below (one per line).</p>
          <textarea value={itemsFallback} onChange={(e) => setItemsFallback(e.target.value)} rows={2} placeholder="Sofa x2&#10;Coffee Table" className={`${fieldInput} resize-y`} />
        </section>

        {/* Section: Complexity */}
        <section className="space-y-2">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Complexity Indicators</h3>
          <div className="flex flex-wrap gap-2">
            {COMPLEXITY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleComplexity(p)}
                className={`px-3 py-1.5 rounded-full text-caption font-semibold border transition-colors ${
                  complexityIndicators.includes(p)
                    ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
                    : "bg-[var(--bg)] text-[var(--tx3)] border-[var(--brd)] hover:border-[var(--gold)]/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer mt-2">
            <input type="checkbox" checked={specialHandling} onChange={(e) => setSpecialHandling(e.target.checked)} className="rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--gold)]" />
            <span className="text-ui text-[var(--tx)]">Requires special handling (fragile, high-value)</span>
          </label>
        </section>

        {/* Section: Notes */}
        <section className="space-y-3">
          <h3 className="text-label font-bold tracking-wider uppercase text-[var(--tx3)]">Notes & Instructions</h3>
          <Field label="Delivery Instructions">
            <textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={2} placeholder="Special delivery instructions…" className={`${fieldInput} resize-y`} />
          </Field>
          <Field label="Access Notes">
            <textarea value={accessNotes} onChange={(e) => setAccessNotes(e.target.value)} rows={2} placeholder="Building codes, gate access, parking…" className={`${fieldInput} resize-y`} />
          </Field>
          <Field label="Internal Notes">
            <textarea value={internalNotes} onChange={(e) => setInternalNotes(e.target.value)} rows={2} placeholder="Internal team notes (not shared with client)…" className={`${fieldInput} resize-y`} />
          </Field>
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-3 rounded-xl text-ui font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] transition-all disabled:opacity-50"
        >
          {loading ? "Creating…" : "Create Delivery"}
        </button>
      </form>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-section font-bold tracking-wider uppercase text-[var(--tx3)] mb-1.5">{label}</label>
      {children}
    </div>
  );
}

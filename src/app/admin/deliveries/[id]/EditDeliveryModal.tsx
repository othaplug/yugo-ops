"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import { formatPhone, normalizePhone } from "@/lib/phone";
import ModalOverlay from "../../components/ModalOverlay";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  MapPin, Calendar, Users, DollarSign, LayoutList,
  FileText, Clock, Shield, Building,
} from "lucide-react";

/* ═══════════════════════════════════════════════════
   Time helpers
   ═══════════════════════════════════════════════════ */

const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      times.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return times;
})();

/* ═══════════════════════════════════════════════════
   Styled sub-components
   ═══════════════════════════════════════════════════ */

const inputCls = "w-full text-[12px] bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2.5 text-[var(--tx)] placeholder:text-[var(--tx3)]/40 focus:border-[var(--gold)] focus:ring-1 focus:ring-[var(--gold)]/20 outline-none transition-all";
const selectCls = `${inputCls} appearance-none`;
const labelCls = "block text-[9px] font-bold tracking-[0.1em] uppercase text-[var(--tx3)] mb-1.5";

function SectionHeader({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b border-[var(--brd)]/30 mb-3">
      <Icon className="w-3.5 h-3.5 text-[var(--gold)]" />
      <span className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx2)]">{label}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

interface EditDeliveryModalProps {
  delivery: any;
  organizations?: { id: string; name: string; type: string }[];
  crews?: { id: string; name: string; members?: string[] }[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSaved?: (updated: any) => void;
}

export default function EditDeliveryModal({ delivery, organizations = [], crews = [], open: controlledOpen, onOpenChange, onSaved }: EditDeliveryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => { onOpenChange?.(v); if (controlledOpen === undefined) setInternalOpen(v); };
  const [loading, setLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState(delivery?.pickup_address ?? "");
  const [deliveryAddress, setDeliveryAddress] = useState(delivery?.delivery_address ?? "");
  const [quotedPrice, setQuotedPrice] = useState("");
  const [crewId, setCrewId] = useState(delivery?.crew_id || "");
  const router = useRouter();
  const { toast } = useToast();

  // Effective price: admin override → partner booking total → quoted
  const effectivePrice = delivery?.admin_adjusted_price || delivery?.total_price || delivery?.quoted_price || 0;

  useEffect(() => {
    if (open && delivery) {
      setPickupAddress(delivery.pickup_address ?? "");
      setDeliveryAddress(delivery.delivery_address ?? "");
      setQuotedPrice(formatNumberInput(effectivePrice) || "");
      setCrewId(delivery.crew_id || "");
    }
  }, [open, delivery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const itemsRaw = (form.get("items") as string) || "";
    const items = itemsRaw.split("\n").filter((i) => i.trim()).map((line) => {
      const pipeMatch = line.match(/^(.+?)\s*\|\s*(\d+)$/);
      if (pipeMatch) return { name: pipeMatch[1].trim(), qty: parseInt(pipeMatch[2], 10) };
      const xMatch = line.match(/^(.+?)\s+x(\d+)$/i);
      if (xMatch) return { name: xMatch[1].trim(), qty: parseInt(xMatch[2], 10) };
      return { name: line.trim(), qty: 1 };
    });

    const orgId = (form.get("organization_id") as string)?.trim() || null;

    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.get("customer_name"),
          customer_email: form.get("customer_email") || null,
          customer_phone: normalizePhone(String(form.get("customer_phone") || "")) || null,
          delivery_address: deliveryAddress || form.get("delivery_address"),
          pickup_address: pickupAddress || form.get("pickup_address"),
          scheduled_date: form.get("scheduled_date"),
          time_slot: form.get("time_slot") || null,
          delivery_window: form.get("delivery_window"),
          instructions: form.get("instructions"),
          items,
          // Sync all three price fields so admin, partner, and delivery detail always agree
          quoted_price: parseNumberInput(quotedPrice) || null,
          total_price: parseNumberInput(quotedPrice) || null,
          admin_adjusted_price: parseNumberInput(quotedPrice) || null,
          status: form.get("status") || delivery.status,
          special_handling: !!form.get("special_handling"),
          organization_id: orgId || null,
          client_name: orgId ? (organizations.find((o) => o.id === orgId)?.name ?? delivery.client_name) : delivery.client_name,
          crew_id: crewId || null,
          updated_at: new Date().toISOString(),
        }),
      });

      const result = await res.json();
      setLoading(false);

      if (!res.ok) {
        toast(result.error || "Failed to save changes", "alertTriangle");
        return;
      }

      if (onSaved && result.delivery) {
        onSaved(result.delivery);
      }
      setOpen(false);
      router.refresh();
      toast("Changes saved", "check");
    } catch {
      setLoading(false);
      toast("Failed to save changes", "alertTriangle");
    }
  };

  if (!open) {
    if (controlledOpen !== undefined) return null;
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all"
      >
        Edit
      </button>
    );
  }

  return (
    <ModalOverlay open={open} onClose={() => setOpen(false)} title={`Edit ${delivery.delivery_number}`} maxWidth="md">
      <form onSubmit={handleSave} className="p-5 space-y-5 max-h-[75vh] overflow-y-auto">

        {/* ── Client & Customer ── */}
        <div>
          <SectionHeader icon={Building} label="Client & Customer" />
          {organizations.length > 0 && (
            <div className="mb-3">
              <label className={labelCls}>Client / Partner</label>
              <select name="organization_id" className={selectCls} defaultValue={delivery.organization_id || ""}>
                <option value="">— None —</option>
                {organizations.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Customer Name</label>
              <input name="customer_name" defaultValue={delivery.customer_name} className={inputCls} placeholder="Full name" />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input name="customer_email" type="email" defaultValue={delivery.customer_email} className={inputCls} placeholder="email@example.com" />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input name="customer_phone" type="tel" defaultValue={delivery.customer_phone ? formatPhone(delivery.customer_phone) : ""} placeholder="(647) 555-0123" className={inputCls} />
            </div>
          </div>
        </div>

        {/* ── Addresses ── */}
        <div>
          <SectionHeader icon={MapPin} label="Addresses" />
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-0.5 mt-7">
                <div className="w-2 h-2 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
                <div className="w-px h-8 bg-[var(--brd)]" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Pickup</label>
                <AddressAutocomplete value={pickupAddress} onRawChange={setPickupAddress} onChange={(r) => setPickupAddress(r.fullAddress)} placeholder="Pickup address" label="" className={inputCls} />
                <input type="hidden" name="pickup_address" value={pickupAddress} />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-7">
                <div className="w-2 h-2 rounded-full border-2 border-[var(--gold)] bg-[var(--gold)]/20" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Delivery</label>
                <AddressAutocomplete value={deliveryAddress} onRawChange={setDeliveryAddress} onChange={(r) => setDeliveryAddress(r.fullAddress)} placeholder="Delivery address" label="" className={inputCls} />
                <input type="hidden" name="delivery_address" value={deliveryAddress} />
              </div>
            </div>
          </div>
        </div>

        {/* ── Schedule ── */}
        <div>
          <SectionHeader icon={Calendar} label="Schedule" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input name="scheduled_date" type="date" defaultValue={delivery.scheduled_date} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Time Slot</label>
              <select name="time_slot" defaultValue={delivery.time_slot || ""} className={selectCls}>
                <option value="">Select time…</option>
                {TIME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                {delivery.time_slot && !TIME_OPTIONS.includes(delivery.time_slot) && (
                  <option value={delivery.time_slot}>{delivery.time_slot}</option>
                )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Window</label>
              <select name="delivery_window" defaultValue={delivery.delivery_window} className={selectCls}>
                <option value="">Select window…</option>
                {TIME_WINDOW_OPTIONS.map((w) => <option key={w} value={w}>{w}</option>)}
                {delivery.delivery_window && !TIME_WINDOW_OPTIONS.includes(delivery.delivery_window) && (
                  <option value={delivery.delivery_window}>{delivery.delivery_window}</option>
                )}
              </select>
            </div>
          </div>
        </div>

        {/* ── Crew & Pricing ── */}
        <div>
          <SectionHeader icon={DollarSign} label="Crew & Pricing" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Crew</label>
              <select value={crewId} onChange={(e) => setCrewId(e.target.value)} className={selectCls}>
                <option value="">Unassigned</option>
                {crews.map((c) => <option key={c.id} value={c.id}>{c.name}{c.members?.length ? ` (${c.members.length})` : ""}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Quoted Price</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--tx3)]">$</span>
                <input
                  type="text"
                  name="quoted_price"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  onBlur={() => { const n = parseNumberInput(quotedPrice); if (n > 0) setQuotedPrice(formatNumberInput(n)); }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`${inputCls} pl-7`}
                />
              </div>
              {delivery?.total_price > 0 && (
                <p className="text-[9px] text-[var(--tx3)] mt-1">
                  Partner booked at <span className="font-semibold text-[var(--gold)]">${Number(delivery.total_price).toFixed(2)}</span>
                  {delivery.admin_adjusted_price && delivery.admin_adjusted_price !== delivery.total_price && (
                    <span className="ml-1 opacity-70">(adjusted to ${Number(delivery.admin_adjusted_price).toFixed(2)})</span>
                  )}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select name="status" defaultValue={delivery.status} className={selectCls}>
                <option value="pending">Pending</option>
                <option value="confirmed">Confirmed</option>
                <option value="in-transit">In Transit</option>
                <option value="delivered">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer mt-3 p-2.5 rounded-lg hover:bg-[var(--bg)] transition-colors">
            <input name="special_handling" type="checkbox" defaultChecked={!!delivery.special_handling} className="rounded border-[var(--brd)] accent-[var(--gold)]" />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-amber-500" />
              <span className="text-[11px] font-medium text-[var(--tx)]">Requires special handling</span>
            </div>
          </label>
        </div>

        {/* ── Items ── */}
        <div>
          <SectionHeader icon={LayoutList} label="Items" />
          <label className={labelCls}>One item per line (e.g. Sectional Sofa x2)</label>
          <textarea
            name="items"
            rows={4}
            defaultValue={(delivery.items || []).map((i: any) => {
              if (typeof i === "object" && i != null) {
                const name = i.name || i;
                const qty = i.qty ?? 1;
                return qty > 1 ? `${name} x${qty}` : name;
              }
              return i;
            }).join("\n")}
            className={`${inputCls} resize-y font-mono`}
            placeholder="Leather Sofa&#10;Glass Dining Table&#10;King Mattress x2"
          />
        </div>

        {/* ── Notes ── */}
        <div>
          <SectionHeader icon={FileText} label="Instructions" />
          <textarea
            name="instructions"
            rows={3}
            defaultValue={delivery.instructions}
            className={`${inputCls} resize-y`}
            placeholder="Any special delivery instructions or notes…"
          />
        </div>

        {/* ── Submit ── */}
        <div className="sticky bottom-0 pt-3 -mx-5 px-5 pb-1 bg-gradient-to-t from-[var(--card)] via-[var(--card)] to-transparent">
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl text-[12px] font-bold tracking-wide bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 hover:bg-[var(--gold2)] transition-all shadow-sm"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

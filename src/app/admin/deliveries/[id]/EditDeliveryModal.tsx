"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../../components/Toast";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import ModalOverlay from "../../components/ModalOverlay";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import {
  MapPin,
  Calendar,
  Money as DollarSign,
  ListBullets as LayoutList,
  FileText,
  Shield,
  Buildings as Building,
  UserCircle,
} from "@phosphor-icons/react";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";

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

const IN_PROGRESS_STATUSES = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
  "in_transit",
];
function isDeliveryInProgress(
  status: string | null | undefined,
  stage: string | null | undefined,
): boolean {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const st = (stage || "").toLowerCase().replace(/-/g, "_");
  return IN_PROGRESS_STATUSES.includes(s) || IN_PROGRESS_STATUSES.includes(st);
}

/* ═══════════════════════════════════════════════════
   Styled sub-components (premium admin theme)
   ═══════════════════════════════════════════════════ */

const inputCls = "field-input-compact w-full";
const selectCls = `${inputCls} appearance-none`;
const labelCls =
  "block text-[10px] font-semibold tracking-[0.06em] uppercase text-[var(--tx3)] mb-1.5";

function Section({
  icon: Icon,
  title,
  desc,
  children,
}: {
  icon: React.ElementType;
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[var(--brd)]/45 bg-[var(--bg)]/35 p-4 sm:p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="flex items-center justify-center w-8 h-8 rounded-xl bg-[var(--gold)]/12 text-[var(--gold)] shrink-0">
          <Icon className="w-[18px] h-[18px]" weight="duotone" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[13px] font-semibold text-[var(--tx)] leading-tight">
            {title}
          </h3>
          {desc && (
            <p className="text-[11px] text-[var(--tx3)] leading-snug mt-0.5">
              {desc}
            </p>
          )}
        </div>
      </div>
      {children}
    </section>
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

export default function EditDeliveryModal({
  delivery,
  organizations = [],
  crews = [],
  open: controlledOpen,
  onOpenChange,
  onSaved,
}: EditDeliveryModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = (v: boolean) => {
    onOpenChange?.(v);
    if (controlledOpen === undefined) setInternalOpen(v);
  };
  const [loading, setLoading] = useState(false);
  const [pickupAddress, setPickupAddress] = useState(
    delivery?.pickup_address ?? "",
  );
  const [deliveryAddress, setDeliveryAddress] = useState(
    delivery?.delivery_address ?? "",
  );
  const [quotedPrice, setQuotedPrice] = useState("");
  const [crewId, setCrewId] = useState(delivery?.crew_id || "");
  const [deliveryAccess, setDeliveryAccess] = useState(
    delivery?.delivery_access || "elevator",
  );
  const [itemWeightCategory, setItemWeightCategory] = useState(
    delivery?.item_weight_category || "standard",
  );
  const [customerPhone, setCustomerPhone] = useState(
    delivery?.customer_phone ? formatPhone(delivery.customer_phone) : "",
  );
  const customerPhoneInput = usePhoneInput(customerPhone, setCustomerPhone);

  // Receiving client (recipient split): 'partner' = the business contact above
  // is the recipient; 'separate' = a distinct on-site recipient whose tracking
  // texts go to their own number, while business updates stay with the contact.
  const [recipientMode, setRecipientMode] = useState<"partner" | "separate">(
    delivery?.recipient_mode === "separate" ? "separate" : "partner",
  );
  const [recipientName, setRecipientName] = useState(
    delivery?.recipient_name ?? "",
  );
  const [recipientEmail, setRecipientEmail] = useState(
    delivery?.recipient_email ?? "",
  );
  const [recipientPhone, setRecipientPhone] = useState(
    delivery?.recipient_phone ? formatPhone(delivery.recipient_phone) : "",
  );
  const recipientPhoneInput = usePhoneInput(recipientPhone, setRecipientPhone);
  const [recipientNotes, setRecipientNotes] = useState(
    delivery?.recipient_notes ?? "",
  );

  const router = useRouter();
  const { toast } = useToast();

  const effectivePrice = delivery ? effectiveDeliveryPrice(delivery) : 0;

  useEffect(() => {
    if (open && delivery) {
      setPickupAddress(delivery.pickup_address ?? "");
      setDeliveryAddress(delivery.delivery_address ?? "");
      setQuotedPrice(formatNumberInput(effectivePrice) || "");
      setCrewId(delivery.crew_id || "");
      setCustomerPhone(
        delivery.customer_phone ? formatPhone(delivery.customer_phone) : "",
      );
      setDeliveryAccess(delivery.delivery_access || "elevator");
      setItemWeightCategory(delivery.item_weight_category || "standard");
      setRecipientMode(
        delivery.recipient_mode === "separate" ? "separate" : "partner",
      );
      setRecipientName(delivery.recipient_name ?? "");
      setRecipientEmail(delivery.recipient_email ?? "");
      setRecipientPhone(
        delivery.recipient_phone ? formatPhone(delivery.recipient_phone) : "",
      );
      setRecipientNotes(delivery.recipient_notes ?? "");
    }
  }, [open, delivery]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const itemsRaw = (form.get("items") as string) || "";
    const items = itemsRaw
      .split("\n")
      .filter((i) => i.trim())
      .map((line) => {
        const pipeMatch = line.match(/^(.+?)\s*\|\s*(\d+)$/);
        if (pipeMatch)
          return { name: pipeMatch[1].trim(), qty: parseInt(pipeMatch[2], 10) };
        const xMatch = line.match(/^(.+?)\s+x(\d+)$/i);
        if (xMatch)
          return { name: xMatch[1].trim(), qty: parseInt(xMatch[2], 10) };
        return { name: line.trim(), qty: 1 };
      });

    const orgId = (form.get("organization_id") as string)?.trim() || null;
    const separate = recipientMode === "separate";

    try {
      const parsedPrice = parseNumberInput(quotedPrice) || 0;
      const res = await fetch(`/api/admin/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: form.get("customer_name"),
          customer_email: form.get("customer_email") || null,
          customer_phone: normalizePhone(customerPhone) || null,
          delivery_address: deliveryAddress || form.get("delivery_address"),
          pickup_address: pickupAddress || form.get("pickup_address"),
          scheduled_date: form.get("scheduled_date"),
          time_slot: form.get("time_slot") || null,
          delivery_window: form.get("delivery_window"),
          instructions: form.get("instructions"),
          items,
          quoted_price: parsedPrice || null,
          total_price: parsedPrice || null,
          admin_adjusted_price: parsedPrice || null,
          override_price: parsedPrice > 0 ? parsedPrice : null,
          override_reason: parsedPrice > 0 ? "Admin delivery editor" : null,
          status: form.get("status") || delivery.status,
          special_handling: !!form.get("special_handling"),
          organization_id: orgId || null,
          client_name: orgId
            ? (organizations.find((o) => o.id === orgId)?.name ??
              delivery.client_name)
            : delivery.client_name,
          crew_id: crewId || null,
          // Receiving client. Clearing the fields when mode flips back to
          // 'partner' avoids stale recipient contacts getting tracking texts.
          recipient_mode: recipientMode,
          recipient_name: separate ? recipientName.trim() || null : null,
          recipient_phone: separate
            ? normalizePhone(recipientPhone) || null
            : null,
          recipient_email: separate ? recipientEmail.trim() || null : null,
          recipient_notes: separate ? recipientNotes.trim() || null : null,
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

  const segBtn = (active: boolean) =>
    `flex-1 px-3 py-2 rounded-lg text-[11px] font-semibold transition-all ${
      active
        ? "bg-[var(--card)] text-[var(--tx)] shadow-sm"
        : "text-[var(--tx3)] hover:text-[var(--tx2)]"
    }`;

  return (
    <ModalOverlay
      open={open}
      onClose={() => setOpen(false)}
      title={`Edit ${delivery.delivery_number}`}
      maxWidth="lg"
    >
      <form
        onSubmit={handleSave}
        className="p-4 sm:p-5 space-y-4 max-h-[76vh] overflow-y-auto"
      >
        {/* ── Business contact ── */}
        <Section
          icon={Building}
          title="Business contact"
          desc="The partner or business who booked this delivery"
        >
          {organizations.length > 0 && (
            <div className="mb-3">
              <label className={labelCls}>Client / Partner</label>
              <select
                name="organization_id"
                className={selectCls}
                defaultValue={delivery.organization_id || ""}
              >
                <option value="">- None -</option>
                {organizations.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Contact Name</label>
              <input
                name="customer_name"
                defaultValue={delivery.customer_name}
                className={inputCls}
                placeholder="Full name"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                name="customer_email"
                type="email"
                defaultValue={delivery.customer_email}
                className={inputCls}
                placeholder="email@example.com"
              />
            </div>
            <div>
              <label className={labelCls}>Phone</label>
              <input
                ref={customerPhoneInput.ref}
                type="tel"
                value={customerPhone}
                onChange={customerPhoneInput.onChange}
                placeholder={PHONE_PLACEHOLDER}
                className={inputCls}
              />
            </div>
          </div>
        </Section>

        {/* ── Receiving client ── */}
        <Section
          icon={UserCircle}
          title="Receiving client"
          desc="Who receives the delivery on site, and where tracking texts go"
        >
          <div className="inline-flex w-full sm:w-auto p-1 rounded-xl bg-[var(--bg)] border border-[var(--brd)]/60 mb-3">
            <button
              type="button"
              onClick={() => setRecipientMode("partner")}
              className={segBtn(recipientMode === "partner")}
            >
              Same as business contact
            </button>
            <button
              type="button"
              onClick={() => setRecipientMode("separate")}
              className={segBtn(recipientMode === "separate")}
            >
              Different recipient
            </button>
          </div>

          {recipientMode === "partner" ? (
            <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
              Tracking texts and delivery updates go to the business contact
              above. Choose <span className="text-[var(--tx2)]">Different
              recipient</span> when someone else receives the items on site.
            </p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Recipient Name</label>
                  <input
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className={inputCls}
                    placeholder="On-site contact"
                  />
                </div>
                <div>
                  <label className={labelCls}>Recipient Phone</label>
                  <input
                    ref={recipientPhoneInput.ref}
                    type="tel"
                    value={recipientPhone}
                    onChange={recipientPhoneInput.onChange}
                    placeholder={PHONE_PLACEHOLDER}
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Recipient Email</label>
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    className={inputCls}
                    placeholder="email@example.com"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Recipient Notes</label>
                <input
                  value={recipientNotes}
                  onChange={(e) => setRecipientNotes(e.target.value)}
                  className={inputCls}
                  placeholder="Buzzer code, floor, where to leave items…"
                />
              </div>
              <p className="text-[11px] text-[var(--tx3)] leading-relaxed">
                Live tracking texts go to the recipient; the business contact
                still receives booking and payment updates.
              </p>
            </div>
          )}
        </Section>

        {/* ── Route ── */}
        <Section icon={MapPin} title="Route">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center gap-0.5 mt-7">
                <div className="w-2 h-2 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
                <div className="w-px h-8 bg-[var(--brd)]" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Pickup</label>
                <AddressAutocomplete
                  value={pickupAddress}
                  onRawChange={setPickupAddress}
                  onChange={(r) => setPickupAddress(r.fullAddress)}
                  placeholder="Pickup address"
                  label=""
                  className={inputCls}
                />
                <input
                  type="hidden"
                  name="pickup_address"
                  value={pickupAddress}
                />
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex flex-col items-center mt-7">
                <div className="w-2 h-2 rounded-full border-2 border-[var(--gold)] bg-[var(--gold)]/20" />
              </div>
              <div className="flex-1">
                <label className={labelCls}>Delivery</label>
                <AddressAutocomplete
                  value={deliveryAddress}
                  onRawChange={setDeliveryAddress}
                  onChange={(r) => setDeliveryAddress(r.fullAddress)}
                  placeholder="Delivery address"
                  label=""
                  className={inputCls}
                />
                <input
                  type="hidden"
                  name="delivery_address"
                  value={deliveryAddress}
                />
              </div>
            </div>
          </div>
        </Section>

        {/* ── Schedule ── */}
        <Section icon={Calendar} title="Schedule">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Date</label>
              <input
                name="scheduled_date"
                type="date"
                defaultValue={delivery.scheduled_date}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Time Slot</label>
              <select
                name="time_slot"
                defaultValue={delivery.time_slot || ""}
                className={selectCls}
              >
                <option value="">Select time…</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                {delivery.time_slot &&
                  !TIME_OPTIONS.includes(delivery.time_slot) && (
                    <option value={delivery.time_slot}>
                      {delivery.time_slot}
                    </option>
                  )}
              </select>
            </div>
            <div>
              <label className={labelCls}>Window</label>
              <select
                name="delivery_window"
                defaultValue={delivery.delivery_window}
                className={selectCls}
              >
                <option value="">Select window…</option>
                {TIME_WINDOW_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
                {delivery.delivery_window &&
                  !TIME_WINDOW_OPTIONS.includes(delivery.delivery_window) && (
                    <option value={delivery.delivery_window}>
                      {delivery.delivery_window}
                    </option>
                  )}
              </select>
            </div>
          </div>
        </Section>

        {/* ── Crew & Pricing ── */}
        <Section icon={DollarSign} title="Crew & pricing">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Crew</label>
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                disabled={isDeliveryInProgress(delivery?.status, delivery?.stage)}
                className={`${selectCls} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                <option value="">Unassigned</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.members?.length ? ` (${c.members.length})` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Quoted Price</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-[var(--tx3)]">
                  $
                </span>
                <input
                  type="text"
                  name="quoted_price"
                  value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                  onBlur={() => {
                    const n = parseNumberInput(quotedPrice);
                    if (n > 0) setQuotedPrice(formatNumberInput(n));
                  }}
                  placeholder="0.00"
                  inputMode="decimal"
                  className={`${inputCls} field-input--leading-sm`}
                />
              </div>
              {delivery?.total_price > 0 && (
                <p className="text-[10px] text-[var(--tx3)] mt-1">
                  Partner booked at{" "}
                  <span className="font-semibold text-[var(--gold)]">
                    ${Number(delivery.total_price).toFixed(2)}
                  </span>
                  {delivery.admin_adjusted_price &&
                    delivery.admin_adjusted_price !== delivery.total_price && (
                      <span className="ml-1 opacity-70">
                        (adjusted to $
                        {Number(delivery.admin_adjusted_price).toFixed(2)})
                      </span>
                    )}
                </p>
              )}
            </div>
            <div>
              <label className={labelCls}>Delivery Access</label>
              <select
                value={deliveryAccess}
                onChange={(e) => setDeliveryAccess(e.target.value)}
                className={selectCls}
              >
                <option value="elevator">Elevator</option>
                <option value="ground_floor">Ground Floor / Loading Dock</option>
                <option value="loading_dock">Loading Dock</option>
                <option value="basement">Basement</option>
                <option value="basement_stairs">Basement (Stairs)</option>
                <option value="basement_walkout">Basement (Walk-out)</option>
                <option value="walk_up_2nd">Walk-up (2nd floor)</option>
                <option value="walk_up_3rd">Walk-up (3rd floor)</option>
                <option value="walk_up_4th_plus">Walk-up (4th+ floor)</option>
                <option value="long_carry">Long Carry (50m+)</option>
                <option value="narrow_stairs">Narrow Stairs</option>
                <option value="no_parking">No Parking Nearby</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Item Weight</label>
              <select
                value={itemWeightCategory}
                onChange={(e) => setItemWeightCategory(e.target.value)}
                className={selectCls}
              >
                <option value="standard">Standard (under 100 lbs)</option>
                <option value="heavy">Heavy (100 to 250 lbs)</option>
                <option value="very_heavy">Very Heavy (250 to 500 lbs)</option>
                <option value="oversized_fragile">Oversized / Fragile</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Status</label>
              <select
                name="status"
                defaultValue={delivery.status}
                className={selectCls}
              >
                <option value="pending">Pending</option>
                <option value="pending_approval">Awaiting Approval</option>
                <option value="scheduled">Scheduled</option>
                <option value="confirmed">Confirmed</option>
                <option value="in_progress">In Transit</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer mt-3 p-2.5 rounded-lg hover:bg-[var(--bg)] transition-colors">
            <input
              name="special_handling"
              type="checkbox"
              defaultChecked={!!delivery.special_handling}
              className="rounded border-[var(--brd)] accent-[var(--gold)]"
            />
            <div className="flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[11px] font-medium text-[var(--tx)]">
                Requires special handling
              </span>
            </div>
          </label>
        </Section>

        {/* ── Items ── */}
        <Section
          icon={LayoutList}
          title="Items"
          desc="One item per line, e.g. Sectional Sofa x2"
        >
          <textarea
            name="items"
            rows={4}
            defaultValue={normalizeDeliveryItemsForDisplay(delivery.items || [])
              .map((row) => (row.qty > 1 ? `${row.name} x${row.qty}` : row.name))
              .join("\n")}
            className={`${inputCls} resize-y font-mono`}
            placeholder="Leather Sofa&#10;Glass Dining Table&#10;King Mattress x2"
          />
        </Section>

        {/* ── Instructions ── */}
        <Section icon={FileText} title="Instructions">
          <textarea
            name="instructions"
            rows={3}
            defaultValue={delivery.instructions}
            className={`${inputCls} resize-y`}
            placeholder="Any special delivery instructions or notes…"
          />
        </Section>

        {/* ── Submit ── */}
        <div className="sticky bottom-0 pt-3 -mx-4 sm:-mx-5 px-4 sm:px-5 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] bg-gradient-to-t from-[var(--card)] via-[var(--card)] to-transparent">
          <button
            type="submit"
            disabled={loading}
            className="admin-btn admin-btn-primary w-full"
          >
            {loading ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

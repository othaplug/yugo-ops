"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  Warning,
  Phone,
  Envelope,
  XCircle,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";
import {
  ADMIN_PREMIUM_GHOST_CANCEL_CLASS,
  ADMIN_PREMIUM_SOLID_CTA_CLASS,
} from "@/app/admin/components/admin-toolbar-action-classes";
import { formatPlatformDisplay } from "@/lib/date-format";
import { InfoHint } from "@/components/ui/InfoHint";

const toDateInputValue = (d: string | null | undefined): string => {
  if (!d) return "";
  const s = String(d);
  return s.length >= 10 ? s.slice(0, 10) : "";
};

const SECTION_RULE =
  "pb-3 mb-4 border-b border-[color-mix(in_srgb,var(--yugo-primary-text)_16%,transparent)]";
const FIELD_WASH =
  "w-full rounded-lg bg-[color-mix(in_srgb,var(--yugo-primary-text)_7%,transparent)] px-3 py-2.5 text-[13px] text-[var(--tx)] outline-none border-0 focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yugo-primary-text)_28%,transparent)]";

const STATUS_LABELS: Record<string, string> = {
  confirmed: "Confirmed",
  drop_off_scheduled: "Drop-off Scheduled",
  bins_delivered: "Delivered",
  in_use: "In Use",
  pickup_scheduled: "Pickup Scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Overdue",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "text-blue-400",
  drop_off_scheduled: "text-purple-400",
  bins_delivered: "text-emerald-400",
  in_use: "text-amber-400",
  pickup_scheduled: "text-sky-400",
  bins_collected: "text-teal-400",
  completed: "text-green-400",
  overdue: "text-red-400",
  cancelled: "text-neutral-400",
};

const BUNDLE_LABELS: Record<string, string> = {
  studio: "Studio", "1br": "1 Bedroom", "2br": "2 Bedroom",
  "3br": "3 Bedroom", "4br_plus": "4 Bedroom+", individual: "Custom",
};

const ACCESS_LABELS: Record<string, string> = {
  elevator: "Elevator", ground: "Ground Floor", walkup: "Walk-up", concierge: "Concierge",
};

const ALL_STATUSES = [
  "confirmed", "drop_off_scheduled", "bins_delivered", "in_use",
  "pickup_scheduled", "bins_collected", "completed", "overdue", "cancelled",
];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function BinOrderDetailClient({ order }: { order: any }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Pickup complete modal
  const [pickupModal, setPickupModal] = useState(false);
  const [pickupBins, setPickupBins] = useState(order.bin_count ?? 0);
  const [pickupCrew, setPickupCrew] = useState("");
  const [pickupProcessing, setPickupProcessing] = useState(false);

  // Dropoff complete modal
  const [dropoffModal, setDropoffModal] = useState(false);
  const [dropoffCrew, setDropoffCrew] = useState("");
  const [dropoffProcessing, setDropoffProcessing] = useState(false);

  const [scheduleDraft, setScheduleDraft] = useState({
    drop_off_date: toDateInputValue(order.drop_off_date),
    move_date: toDateInputValue(order.move_date),
    pickup_date: toDateInputValue(order.pickup_date),
  });
  const [bundleDraft, setBundleDraft] = useState<string>(order.bundle_type);
  const [chargeUpgradeDiff, setChargeUpgradeDiff] = useState(false);

  useEffect(() => {
    setScheduleDraft({
      drop_off_date: toDateInputValue(order.drop_off_date),
      move_date: toDateInputValue(order.move_date),
      pickup_date: toDateInputValue(order.pickup_date),
    });
    setBundleDraft(order.bundle_type);
  }, [
    order.drop_off_date,
    order.move_date,
    order.pickup_date,
    order.bundle_type,
    order.id,
  ]);

  const fmtDate = (d: string | null) => {
    if (!d) return "-";
    return formatPlatformDisplay(new Date(d + (d.includes("T") ? "" : "T12:00:00")), {
      weekday: "short",
      month: "short",
      day: "numeric",
    }, "-");
  };

  const fmtMoney = (n: number | null) =>
    n != null ? `$${Number(n).toFixed(2)}` : "-";

  const patchOrder = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/bin-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      if (data.success !== true) throw new Error(data.error || "Update failed");
      if (payload.bundle_type != null) {
        const due = typeof data.amountDueCents === "number" ? data.amountDueCents : 0;
        if (data.chargedUpgrade) {
          setMsg({ type: "ok", text: "Bundle updated and card charged for the difference." });
        } else if (due > 0) {
          setMsg({
            type: "ok",
            text: `Bundle updated. Balance due $${(due / 100).toFixed(2)}. Charge the card on file or collect another way.`,
          });
        } else {
          setMsg({ type: "ok", text: "Bundle updated." });
        }
        setChargeUpgradeDiff(false);
      } else {
        setMsg({ type: "ok", text: "Updated successfully" });
      }
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSchedule = () => {
    patchOrder({
      drop_off_date: scheduleDraft.drop_off_date || undefined,
      move_date: scheduleDraft.move_date || undefined,
      pickup_date: scheduleDraft.pickup_date || undefined,
    });
  };

  const handleApplyBundle = () => {
    if (bundleDraft === order.bundle_type) return;
    patchOrder({
      bundle_type: bundleDraft,
      charge_upgrade_diff: chargeUpgradeDiff,
    });
  };

  const handleChargeBalance = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/bin-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "charge_balance" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Charge failed");
      if (data.success !== true) throw new Error(data.error || "Charge failed");
      setMsg({ type: "ok", text: "Balance charged to card on file." });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Charge failed" });
    } finally {
      setSaving(false);
    }
  };

  const paidCents =
    order.paid_total_cents != null
      ? Number(order.paid_total_cents)
      : Math.round(Number(order.total) * 100);
  const totalCents = Math.round(Number(order.total) * 100);
  const balanceDueCents = Math.max(0, totalCents - paidCents);

  const completeDropoff = async () => {
    setDropoffProcessing(true);
    try {
      const res = await fetch(`/api/bin-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_dropoff", crewName: dropoffCrew }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setDropoffModal(false);
      setMsg({ type: "ok", text: "Drop-off marked complete. Client notified." });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setDropoffProcessing(false);
    }
  };

  const completePickup = async () => {
    setPickupProcessing(true);
    try {
      const res = await fetch(`/api/bin-orders/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "complete_pickup", crewName: pickupCrew, binsReturned: pickupBins }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Failed");
      setPickupModal(false);
      const missing = data.binsMissing || 0;
      setMsg({
        type: "ok",
        text: missing > 0
          ? `Pickup complete. ${missing} bin(s) missing, $${data.missingCharge?.toFixed(2)} charged to card.`
          : "Pickup complete. Client thanked via SMS.",
      });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Failed" });
    } finally {
      setPickupProcessing(false);
    }
  };

  return (
    <PageContent>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <Link href="/admin/bin-rentals" className="mt-1 text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-[var(--tx)]">{order.order_number}</h1>
              <span className={`dt-badge tracking-[0.04em] ${STATUS_STYLES[order.status] || "text-[var(--tx3)]"}`}>
                {STATUS_LABELS[order.status] || order.status}
              </span>
              {order.status === "overdue" && (
                <span className="flex items-center gap-1 text-red-400 text-[12px] font-semibold">
                  <Warning size={14} /> Overdue
                </span>
              )}
            </div>
            <p className="text-[13px] text-[var(--tx3)] mt-0.5">
              {BUNDLE_LABELS[order.bundle_type] || order.bundle_type} · {order.bin_count} bins ·{" "}
              Booked {fmtDate(order.created_at)}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 shrink-0">
          {!order.drop_off_completed_at && order.status !== "cancelled" && order.status !== "completed" && (
            <button
              type="button"
              onClick={() => setDropoffModal(true)}
              className={ADMIN_PREMIUM_SOLID_CTA_CLASS}
            >
              Mark delivered
            </button>
          )}
          {order.drop_off_completed_at && !order.pickup_completed_at && order.status !== "cancelled" && (
            <button
              type="button"
              onClick={() => setPickupModal(true)}
              className={ADMIN_PREMIUM_SOLID_CTA_CLASS}
            >
              Mark picked up
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2 ${msg.type === "ok" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"}`}>
          {msg.type === "ok" ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-10">
        {/* Client info */}
        <Section title="Client">
          <InfoRow label="Name" value={order.client_name} />
          <InfoRow
            label="Email"
            value={<a href={`mailto:${order.client_email}`} className="text-[var(--yugo-primary-text)] hover:underline flex items-center gap-1 font-semibold"><Envelope size={12} aria-hidden />{order.client_email}</a>}
          />
          <InfoRow
            label="Phone"
            value={<a href={`tel:${order.client_phone}`} className="text-[var(--yugo-primary-text)] hover:underline flex items-center gap-1 font-semibold"><Phone size={12} aria-hidden />{order.client_phone}</a>}
          />
          <InfoRow label="Source" value={order.source === "move_addon" ? "Moving add-on" : order.source === "admin" ? "Admin created" : "Standalone booking"} />
        </Section>

        {/* Delivery */}
        <Section title="Delivery">
          <InfoRow label="Address" value={order.delivery_address} />
          {order.delivery_postal && <InfoRow label="Postal code" value={order.delivery_postal} />}
          <InfoRow label="Access" value={ACCESS_LABELS[order.delivery_access] || order.delivery_access || "-"} />
          {order.delivery_notes && <InfoRow label="Notes" value={order.delivery_notes} />}
        </Section>

        {/* Bundle */}
        <Section title="Bundle">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[11px] text-[var(--tx3)] leading-snug flex-1">
              Bundle and totals follow platform pricing. Edits apply to this order everywhere it appears.
            </p>
            <InfoHint variant="admin" ariaLabel="Bundle upgrade workflow" className="shrink-0">
              If the new total is higher than what the client already paid, leave the difference as balance due
              or charge the card on file when you apply the change. If there is no card, collect payment outside
              the app and use Charge balance after you record the payment in Square.
            </InfoHint>
          </div>
          <div className="space-y-2 pt-1">
            <label className="block text-[11px] font-semibold text-[var(--tx3)] uppercase tracking-wide" htmlFor="bin-bundle-type">
              Bundle type
            </label>
            <select
              id="bin-bundle-type"
              value={bundleDraft}
              onChange={(e) => setBundleDraft(e.target.value)}
              disabled={saving}
              className={`${FIELD_WASH} disabled:opacity-50 cursor-pointer`}
            >
              {Object.entries(BUNDLE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>
            {order.square_card_id ? (
              <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer">
                <input
                  type="checkbox"
                  checked={chargeUpgradeDiff}
                  onChange={(e) => setChargeUpgradeDiff(e.target.checked)}
                  className="rounded border-[var(--brd)]"
                />
                Charge card on file for the price difference when applying
              </label>
            ) : (
              <p className="text-[11px] text-amber-500/90">
                No card on file. After you apply a more expensive bundle, collect payment manually or add a card, then use Charge balance.
              </p>
            )}
            <button
              type="button"
              onClick={handleApplyBundle}
              disabled={saving || bundleDraft === order.bundle_type}
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] border-0 bg-[color-mix(in_srgb,var(--yugo-primary-text)_10%,transparent)] text-[var(--yugo-primary-text)] hover:bg-[color-mix(in_srgb,var(--yugo-primary-text)_17%,transparent)] disabled:opacity-45 transition-colors"
            >
              Apply bundle change
            </button>
          </div>
          <InfoRow label="Bins allocated" value={String(order.bin_count)} />
          <InfoRow label="Includes paper" value={order.includes_paper ? "Yes" : "No"} />
          <InfoRow label="Includes zip ties" value={order.includes_zip_ties ? "Yes" : "No"} />
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <p className="text-[11px] text-[var(--tx3)] mb-2">
            Date edits save to this order for crew, tracking, and admin views.
          </p>
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1" htmlFor="sched-drop">
                Drop-off date
              </label>
              <input
                id="sched-drop"
                type="date"
                value={scheduleDraft.drop_off_date}
                onChange={(e) =>
                  setScheduleDraft((s) => ({ ...s, drop_off_date: e.target.value }))
                }
                disabled={saving}
                className={`${FIELD_WASH} disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1" htmlFor="sched-move">
                Move date
              </label>
              <input
                id="sched-move"
                type="date"
                value={scheduleDraft.move_date}
                onChange={(e) =>
                  setScheduleDraft((s) => ({ ...s, move_date: e.target.value }))
                }
                disabled={saving}
                className={`${FIELD_WASH} disabled:opacity-50`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1" htmlFor="sched-pickup">
                Pickup date
              </label>
              <input
                id="sched-pickup"
                type="date"
                value={scheduleDraft.pickup_date}
                onChange={(e) =>
                  setScheduleDraft((s) => ({ ...s, pickup_date: e.target.value }))
                }
                disabled={saving}
                className={`${FIELD_WASH} disabled:opacity-50`}
              />
            </div>
            <button
              type="button"
              onClick={handleSaveSchedule}
              disabled={saving}
              className="inline-flex items-center justify-center min-h-[36px] px-4 rounded-lg text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] border-0 bg-[color-mix(in_srgb,var(--yugo-primary-text)_10%,transparent)] text-[var(--yugo-primary-text)] hover:bg-[color-mix(in_srgb,var(--yugo-primary-text)_17%,transparent)] disabled:opacity-45 transition-colors"
            >
              Save schedule
            </button>
          </div>
          {order.drop_off_completed_at && (
            <InfoRow label="Delivered at" value={fmtDate(order.drop_off_completed_at)} highlight="green" />
          )}
          {order.drop_off_crew && <InfoRow label="Drop-off crew" value={order.drop_off_crew} />}
          {order.pickup_completed_at && (
            <InfoRow label="Picked up at" value={fmtDate(order.pickup_completed_at)} highlight="green" />
          )}
          {order.pickup_crew && <InfoRow label="Pickup crew" value={order.pickup_crew} />}
          {order.bins_missing > 0 && (
            <InfoRow label="Bins missing" value={`${order.bins_missing} bins`} highlight="red" />
          )}
        </Section>

        {/* Payment */}
        <Section title="Payment">
          <InfoRow label="Bundle price" value={fmtMoney(order.bundle_price)} />
          {Number(order.delivery_surcharge) > 0 && (
            <InfoRow label="GTA surcharge" value={fmtMoney(order.delivery_surcharge)} />
          )}
          <InfoRow label="HST" value={fmtMoney(order.hst)} />
          <InfoRow label="Total" value={fmtMoney(order.total)} highlight="primary" />
          {balanceDueCents > 0 && (
            <InfoRow
              label="Balance due"
              value={`$${(balanceDueCents / 100).toFixed(2)}`}
              highlight="primary"
            />
          )}
          {Number(order.late_return_fees) > 0 && (
            <InfoRow label="Late fees" value={fmtMoney(order.late_return_fees)} highlight="red" />
          )}
          {Number(order.missing_bin_charge) > 0 && (
            <InfoRow label="Missing bin charge" value={fmtMoney(order.missing_bin_charge)} highlight="red" />
          )}
          <InfoRow
            label="Payment status"
            value={
              order.payment_status === "paid"
                ? <span className="flex items-center gap-1"><CheckCircle size={12} weight="fill" /> Paid</span>
                : order.payment_status === "balance_due"
                  ? "Balance due"
                  : order.payment_status || "-"
            }
          />
          {balanceDueCents > 0 && order.square_card_id && (
            <div className="pt-1">
              <button
                type="button"
                onClick={handleChargeBalance}
                disabled={saving}
                className="inline-flex items-center justify-center min-h-[40px] px-5 rounded-xl text-[10px] font-bold uppercase tracking-[0.12em] leading-none [font-family:var(--font-body)] bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:bg-[var(--admin-primary-fill-hover)] disabled:opacity-45 transition-colors"
              >
                Charge balance to card on file
              </button>
              <p className="text-[11px] text-[var(--tx3)] mt-2">
                Charges the remaining balance for this order total using Square. If you already collected outside Square, skip this and reconcile in your books.
              </p>
            </div>
          )}
          {order.square_payment_id && (
            <InfoRow label="Square payment ID" value={<span className="font-mono text-[11px]">{order.square_payment_id}</span>} />
          )}
        </Section>

        {/* Status update */}
        <Section title="Update Status">
          <div className="space-y-3">
            <select
              defaultValue={order.status}
              onChange={(e) => patchOrder({ status: e.target.value })}
              disabled={saving}
              className={`${FIELD_WASH} disabled:opacity-50 cursor-pointer`}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <p className="text-[11px] text-[var(--tx3)]">Status change takes effect immediately.</p>
          </div>
        </Section>
      </div>

      {/* Photos */}
      {(order.drop_off_photos?.length > 0 || order.pickup_photos?.length > 0) && (
        <div className="mt-10 pt-8 border-t border-[color-mix(in_srgb,var(--yugo-primary-text)_14%,transparent)]">
          <Section title="Photos">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[...(order.drop_off_photos || []), ...(order.pickup_photos || [])].map((url: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Bin photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg shadow-sm hover:opacity-80 transition-opacity" />
                </a>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Drop-off modal */}
      {dropoffModal && (
        <Modal title="Mark Bins Delivered" onClose={() => setDropoffModal(false)}>
          <p className="text-[13px] text-[var(--tx3)] mb-4">Confirm that bins have been delivered to {order.delivery_address}.</p>
          <label className="block text-[12px] font-semibold text-[var(--tx3)] mb-1.5">Crew member name (optional)</label>
          <input
            type="text" value={dropoffCrew} onChange={(e) => setDropoffCrew(e.target.value)}
            placeholder="e.g. Marcus, Alex"
            className={`${FIELD_WASH} mb-4`}
          />
          <p className="text-[12px] text-[var(--tx3)] mb-4">Client will receive SMS: &quot;Your bins have been delivered!&quot;</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => setDropoffModal(false)} className={ADMIN_PREMIUM_GHOST_CANCEL_CLASS}>
              Cancel
            </button>
            <button
              type="button"
              onClick={completeDropoff}
              disabled={dropoffProcessing}
              className={`${ADMIN_PREMIUM_SOLID_CTA_CLASS} flex-1`}
            >
              {dropoffProcessing ? "Saving…" : "Confirm delivery"}
            </button>
          </div>
        </Modal>
      )}

      {/* Pickup modal */}
      {pickupModal && (
        <Modal title="Mark Bins Picked Up" onClose={() => setPickupModal(false)}>
          <p className="text-[13px] text-[var(--tx3)] mb-4">Order delivered {order.bin_count} bins. How many were returned?</p>
          <label className="block text-[12px] font-semibold text-[var(--tx3)] mb-1.5">Bins returned *</label>
          <input
            type="number" min={0} max={order.bin_count} value={pickupBins}
            onChange={(e) => setPickupBins(Math.min(order.bin_count, Math.max(0, parseInt(e.target.value) || 0)))}
            className={`${FIELD_WASH} mb-2`}
          />
          {pickupBins < order.bin_count && (
            <p className="text-[12px] text-red-400 mb-3 flex items-center gap-1">
              <Warning size={12} /> {order.bin_count - pickupBins} missing, ${(order.bin_count - pickupBins) * 20} charge will be applied to card on file.
            </p>
          )}
          <label className="block text-[12px] font-semibold text-[var(--tx3)] mb-1.5">Crew member name (optional)</label>
          <input
            type="text" value={pickupCrew} onChange={(e) => setPickupCrew(e.target.value)}
            placeholder="e.g. Marcus, Alex"
            className={`${FIELD_WASH} mb-4`}
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => setPickupModal(false)} className={ADMIN_PREMIUM_GHOST_CANCEL_CLASS}>
              Cancel
            </button>
            <button
              type="button"
              onClick={completePickup}
              disabled={pickupProcessing}
              className={`${ADMIN_PREMIUM_SOLID_CTA_CLASS} flex-1`}
            >
              {pickupProcessing ? "Saving…" : "Confirm pickup"}
            </button>
          </div>
        </Modal>
      )}
    </PageContent>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section>
      <div className={`flex items-center gap-2 ${SECTION_RULE}`}>
        {icon && <span className="text-[var(--yugo-primary-text)] opacity-90">{icon}</span>}
        <h3 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)]">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "green" | "red" | "gold" | "primary";
}) {
  const colorMap = {
    green: "text-green-400",
    red: "text-red-400",
    gold: "text-[var(--gold)]",
    primary: "text-[var(--yugo-primary-text)]",
  };
  return (
    <div className="flex justify-between items-start gap-3 text-[13px]">
      <span className="text-[var(--tx3)] shrink-0">{label}</span>
      <span className={`text-right ${highlight ? colorMap[highlight] : "text-[var(--tx)]"} font-medium`}>{value}</span>
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60"
        role="presentation"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
      />
      <div className="relative bg-[var(--card)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-[16px] font-bold text-[var(--tx)] mb-1">{title}</h3>
        {children}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Truck,
  CheckCircle,
  Warning,
  Phone,
  Envelope,
  Link as LinkIcon,
  XCircle,
} from "@phosphor-icons/react";
import PageContent from "@/app/admin/components/PageContent";
import { formatPlatformDisplay } from "@/lib/date-format";

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
export default function BinOrderDetailClient({ order, moveCode }: { order: any; moveCode: string | null }) {
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
      if (!res.ok || !data.success) throw new Error(data.error || "Update failed");
      setMsg({ type: "ok", text: "Updated successfully" });
      router.refresh();
    } catch (e) {
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Update failed" });
    } finally {
      setSaving(false);
    }
  };

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
              onClick={() => setDropoffModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#7C9FD4]/15 text-[#7C9FD4] border border-[#7C9FD4]/30 hover:bg-[#7C9FD4]/25 transition-colors text-[13px] font-medium"
            >
              <Truck size={14} /> Mark Delivered
            </button>
          )}
          {order.drop_off_completed_at && !order.pickup_completed_at && order.status !== "cancelled" && (
            <button
              onClick={() => setPickupModal(true)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#22c55e]/15 text-[#22c55e] border border-[#22c55e]/30 hover:bg-[#22c55e]/25 transition-colors text-[13px] font-medium"
            >
              <CheckCircle size={14} /> Mark Picked Up
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-[13px] font-medium flex items-center gap-2 ${msg.type === "ok" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"}`}>
          {msg.type === "ok" ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {msg.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Client info */}
        <Section title="Client">
          <InfoRow label="Name" value={order.client_name} />
          <InfoRow
            label="Email"
            value={<a href={`mailto:${order.client_email}`} className="text-[var(--gold)] hover:underline flex items-center gap-1"><Envelope size={12} />{order.client_email}</a>}
          />
          <InfoRow
            label="Phone"
            value={<a href={`tel:${order.client_phone}`} className="text-[var(--gold)] hover:underline flex items-center gap-1"><Phone size={12} />{order.client_phone}</a>}
          />
          {moveCode && (
            <InfoRow
              label="Linked move"
              value={<Link href={`/admin/moves/${order.move_id}`} className="text-[var(--gold)] hover:underline flex items-center gap-1"><LinkIcon size={12} />{moveCode}</Link>}
            />
          )}
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
          <InfoRow label="Type" value={`${BUNDLE_LABELS[order.bundle_type] || order.bundle_type} (${order.bin_count} bins)`} />
          <InfoRow label="Includes paper" value={order.includes_paper ? "Yes" : "No"} />
          <InfoRow label="Includes zip ties" value={order.includes_zip_ties ? "Yes" : "No"} />
        </Section>

        {/* Schedule */}
        <Section title="Schedule">
          <InfoRow label="Drop-off date" value={fmtDate(order.drop_off_date)} />
          <InfoRow label="Move date" value={fmtDate(order.move_date)} />
          <InfoRow label="Pickup date" value={fmtDate(order.pickup_date)} />
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
          <InfoRow label="Total" value={fmtMoney(order.total)} highlight="gold" />
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
                : order.payment_status || "-"
            }
          />
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
              className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[13px] text-[var(--tx)] focus:outline-none focus:border-[var(--gold)] disabled:opacity-50"
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
        <div className="mt-4">
          <Section title="Photos">
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {[...(order.drop_off_photos || []), ...(order.pickup_photos || [])].map((url: string, i: number) => (
                // eslint-disable-next-line @next/next/no-img-element
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt={`Bin photo ${i + 1}`} className="w-full aspect-square object-cover rounded-lg border border-[var(--brd)] hover:opacity-80 transition-opacity" />
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
            className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[13px] text-[var(--tx)] focus:outline-none focus:border-[var(--gold)] mb-4"
          />
          <p className="text-[12px] text-[var(--tx3)] mb-4">Client will receive SMS: &quot;Your bins have been delivered!&quot;</p>
          <div className="flex gap-2">
            <button onClick={() => setDropoffModal(false)} className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[13px] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">Cancel</button>
            <button
              onClick={completeDropoff}
              disabled={dropoffProcessing}
              className="flex-1 py-2.5 rounded-lg bg-[#7C9FD4] text-white font-semibold text-[13px] hover:bg-[#6a8ec3] transition-colors disabled:opacity-50"
            >
              {dropoffProcessing ? "Saving…" : "Confirm Delivery"}
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
            className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[13px] text-[var(--tx)] focus:outline-none focus:border-[var(--gold)] mb-2"
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
            className="w-full bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-2 text-[13px] text-[var(--tx)] focus:outline-none focus:border-[var(--gold)] mb-4"
          />
          <div className="flex gap-2">
            <button onClick={() => setPickupModal(false)} className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[13px] text-[var(--tx3)] hover:text-[var(--tx)] transition-colors">Cancel</button>
            <button
              onClick={completePickup}
              disabled={pickupProcessing}
              className="flex-1 py-2.5 rounded-lg bg-[#22c55e] text-white font-semibold text-[13px] hover:bg-[#16a34a] transition-colors disabled:opacity-50"
            >
              {pickupProcessing ? "Saving…" : "Confirm Pickup"}
            </button>
          </div>
        </Modal>
      )}
    </PageContent>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon && <span className="text-[var(--gold)]">{icon}</span>}
        <h3 className="text-[11px] font-bold tracking-widest uppercase text-[var(--tx3)]">{title}</h3>
      </div>
      <div className="space-y-2.5">{children}</div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: "green" | "red" | "gold";
}) {
  const colorMap = { green: "text-green-400", red: "text-red-400", gold: "text-[var(--gold)]" };
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
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-6 w-full max-w-sm shadow-2xl">
        <h3 className="text-[16px] font-bold text-[var(--tx)] mb-1">{title}</h3>
        {children}
      </div>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Copy,
  CheckCircle,
  Warning,
  Truck,
  Warehouse,
  User,
  Camera,
} from "@phosphor-icons/react";
import {
  INBOUND_SHIPMENT_STATUS_LABELS,
  INBOUND_INSPECTION_STATUS_LABELS,
} from "@/lib/inbound-shipment-labels";

type Shipment = Record<string, unknown> & { id: string; shipment_number: string; status: string };

type LogRow = { id: string; status: string; notes: string | null; created_at: string };

export default function InboundShipmentDetailClient({
  shipmentId,
  initialShipment,
  publicTrackToken,
}: {
  shipmentId: string;
  initialShipment: Shipment;
  publicTrackToken: string;
}) {
  const [shipment, setShipment] = useState<Shipment>(initialShipment);
  const [log, setLog] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [inspectionNotes, setInspectionNotes] = useState(String(initialShipment.inspection_notes || ""));
  const [overallCondition, setOverallCondition] = useState<"good" | "damaged">("good");

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const trackUrl = `${origin}/shipment/${shipmentId}/track?token=${encodeURIComponent(publicTrackToken)}`;
  const customerUrl = `${origin}/shipment/${shipmentId}/customer?token=${encodeURIComponent(publicTrackToken)}`;
  const rissdCustomerUrl = `${origin}/track/rissd/${shipmentId}?token=${encodeURIComponent(publicTrackToken)}`;

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/inbound-shipments/${shipmentId}`);
    const j = await res.json();
    if (res.ok) {
      setShipment(j.shipment);
      setLog(j.log || []);
      setInspectionNotes(String(j.shipment.inspection_notes || ""));
    }
  }, [shipmentId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  async function postStatus(status: string, extra?: Record<string, unknown>) {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/inbound-shipments/${shipmentId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, ...extra }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Update failed");
      setShipment(j.shipment);
      await reload();
      setMsg("Updated");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function saveInspection(goToStored: boolean) {
    setLoading(true);
    setMsg(null);
    try {
      const inspection_status = goToStored && overallCondition === "good" ? "good" : "damaged";
      const patchRes = await fetch(`/api/admin/inbound-shipments/${shipmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspection_notes: inspectionNotes,
          inspection_status,
        }),
      });
      if (!patchRes.ok) {
        const j = await patchRes.json();
        throw new Error(j.error || "Save failed");
      }
      if (goToStored) {
        await postStatus(overallCondition === "good" ? "stored" : "inspection_failed", {
          inspection_status,
          notes: inspectionNotes,
        });
      } else {
        await reload();
        setMsg("Inspection saved");
      }
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    const res = await fetch(`/api/admin/inbound-shipments/${shipmentId}/photos`, {
      method: "POST",
      body: fd,
    });
    const j = await res.json();
    if (res.ok) {
      setShipment((s) => ({ ...s, inspection_photos: j.photos }));
      setMsg("Photo uploaded");
    } else {
      setMsg(j.error || "Upload failed");
    }
    e.target.value = "";
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text);
    setMsg("Copied");
  }

  const photos = Array.isArray(shipment.inspection_photos) ? (shipment.inspection_photos as string[]) : [];

  return (
    <div className="max-w-[900px] mx-auto px-3 sm:px-5 py-6 space-y-6">
      <Link
        href="/admin/inbound-shipments"
        className="inline-flex items-center gap-1.5 text-sm text-[var(--tx3)] hover:text-[var(--gold)]"
      >
        <ArrowLeft size={16} aria-hidden />
        Inbound Shipments
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold font-mono text-[var(--gold)]">{shipment.shipment_number}</h1>
          <p className="text-sm text-[var(--tx3)] mt-1">
            {INBOUND_SHIPMENT_STATUS_LABELS[shipment.status] || shipment.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => copy(trackUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-xs font-semibold"
          >
            <Copy size={14} aria-hidden />
            Copy public status link
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => copy(customerUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-xs font-semibold"
          >
            <User size={14} aria-hidden />
            Copy customer form link
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => copy(rissdCustomerUrl)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-xs font-semibold"
          >
            <Truck size={14} aria-hidden />
            Copy end-customer track link
          </button>
        </div>
      </div>

      {msg ? <p className="text-sm text-[var(--tx3)]">{msg}</p> : null}

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-3">
        <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)]">Status actions</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("in_transit")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <Truck size={16} aria-hidden />
            Mark in transit
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("received")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <Warehouse size={16} aria-hidden />
            Mark received
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("inspecting")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            Start inspection
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("customer_contacted")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <User size={16} aria-hidden />
            Mark customer contacted
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("delivery_scheduled")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <CheckCircle size={16} aria-hidden />
            Mark delivery scheduled
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("out_for_delivery")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <Truck size={16} aria-hidden />
            Out for delivery
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("delivered")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            <CheckCircle size={16} aria-hidden />
            Mark delivered
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => postStatus("completed")}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[var(--bg2)] text-xs font-semibold border border-[var(--brd)]"
          >
            Close / completed
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 space-y-4">
        <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)] flex items-center gap-2">
          <Camera size={18} className="text-[var(--gold)]" aria-hidden />
          Inspection
        </h2>
        <p className="text-xs text-[var(--tx3)]">
          Upload photos (all sides of packaging, unpacked check, any damage). Minimum four photos recommended.
        </p>
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-[var(--gold)] text-xs font-semibold cursor-pointer">
          <Camera size={16} aria-hidden />
          Upload photo
          <input type="file" accept="image/*" className="hidden" onChange={onPhoto} />
        </label>
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((url) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="aspect-square rounded-lg overflow-hidden bg-[var(--bg2)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
        <label className="block text-sm">
          <span className="text-[var(--tx3)]">Overall condition</span>
          <select
            className="mt-1 w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
            value={overallCondition}
            onChange={(e) => setOverallCondition(e.target.value as "good" | "damaged")}
          >
            <option value="good">All items in good condition</option>
            <option value="damaged">Damage found</option>
          </select>
        </label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
          placeholder="Per-item notes, damage description…"
          value={inspectionNotes}
          onChange={(e) => setInspectionNotes(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={loading}
            onClick={() => saveInspection(false)}
            className="px-4 py-2 rounded-lg border border-[var(--brd)] text-sm font-semibold"
          >
            Save inspection draft
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={() => saveInspection(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1f5f3f] text-white text-sm font-semibold"
          >
            {overallCondition === "good" ? (
              <CheckCircle size={18} weight="fill" aria-hidden />
            ) : (
              <Warning size={18} weight="fill" aria-hidden />
            )}
            Complete inspection
          </button>
        </div>
        {shipment.inspection_status ? (
          <p className="text-xs text-[var(--tx3)]">
            Recorded:{" "}
            {INBOUND_INSPECTION_STATUS_LABELS[String(shipment.inspection_status)] ??
              String(shipment.inspection_status)}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5">
        <h2 className="text-sm font-bold capitalize tracking-wide text-[var(--tx3)] mb-3">Timeline</h2>
        <ul className="space-y-3 text-sm">
          {log.map((row) => (
            <li key={row.id} className="border-b border-[var(--brd)]/40 pb-2">
              <div className="font-medium">{INBOUND_SHIPMENT_STATUS_LABELS[row.status] || row.status}</div>
              <div className="text-xs text-[var(--tx3)]">{new Date(row.created_at).toLocaleString()}</div>
              {row.notes ? <div className="text-[var(--tx3)] mt-1">{row.notes}</div> : null}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

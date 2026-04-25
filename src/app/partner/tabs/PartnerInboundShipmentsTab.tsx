"use client";

import { useEffect, useState } from "react";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { ShippingContainer, ArrowSquareOut } from "@phosphor-icons/react";
import { INBOUND_SHIPMENT_STATUS_LABELS } from "@/lib/inbound-shipment-labels";

type Row = {
  id: string;
  shipment_number: string;
  status: string;
  items: unknown;
  received_at: string | null;
  delivery_scheduled_date: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_address: string | null;
  customer_postal: string | null;
  customer_access: string | null;
  customer_notes: string | null;
};

function itemTitle(items: unknown): string {
  try {
    const arr = Array.isArray(items) ? items : [];
    return (arr[0] as { name?: string })?.name?.trim() || "—";
  } catch {
    return "—";
  }
}

export default function PartnerInboundShipmentsTab() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Row | null>(null);
  const [form, setForm] = useState({
    customer_name: "",
    customer_email: "",
    customer_phone: "",
    customer_address: "",
    customer_postal: "",
    customer_access: "elevator",
    customer_notes: "",
    partner_resolution_choice: "",
    partner_resolution_notes: "",
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/partner/inbound-shipments");
      const j = await res.json();
      if (!cancelled && res.ok) setRows(j.shipments || []);
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selected) return;
    setForm({
      customer_name: selected.customer_name || "",
      customer_email: selected.customer_email || "",
      customer_phone: selected.customer_phone || "",
      customer_address: selected.customer_address || "",
      customer_postal: selected.customer_postal || "",
      customer_access: selected.customer_access || "elevator",
      customer_notes: selected.customer_notes || "",
      partner_resolution_choice: "",
      partner_resolution_notes: "",
    });
  }, [selected]);

  async function submitCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/partner/inbound-shipments/${selected.id}/customer-details`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      setRows((prev) => prev.map((r) => (r.id === selected.id ? { ...r, ...j.shipment } : r)));
      setMsg("Saved");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShippingContainer className="text-[#5C1A33]" size={24} weight="duotone" aria-hidden />
        <h2 className="text-lg font-semibold text-[var(--tx)]">Inbound shipments</h2>
      </div>
      <p className="text-sm text-[var(--tx3)]">
        Freight shipped to Yugo for receive, inspect, store, and white glove delivery. Provide customer details when we
        confirm receipt.
      </p>

      {loading ? (
        <p className="text-sm text-[var(--tx3)]">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-[var(--tx3)]">No inbound shipments yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[var(--brd)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-[var(--tx3)] border-b border-[var(--brd)]">
                <th className="px-3 py-2 font-semibold">Reference</th>
                <th className="px-3 py-2 font-semibold">Item</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Received</th>
                <th className="px-3 py-2 font-semibold">Delivery</th>
                <th className="px-3 py-2 font-semibold">Customer</th>
                <th className="px-3 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--brd)]/50">
                  <td className="px-3 py-2 font-mono text-[#5C1A33] font-semibold">{r.shipment_number}</td>
                  <td className="px-3 py-2">{itemTitle(r.items)}</td>
                  <td className="px-3 py-2">{INBOUND_SHIPMENT_STATUS_LABELS[r.status] || r.status}</td>
                  <td className="px-3 py-2 text-[var(--tx3)]">
                    {r.received_at
                      ? new Date(r.received_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
                      : "—"}
                  </td>
                  <td className="px-3 py-2 text-[var(--tx3)]">
                    {r.delivery_scheduled_date
                      ? new Date(r.delivery_scheduled_date + "T12:00:00").toLocaleDateString("en-CA", {
                          month: "short",
                          day: "numeric",
                        })
                      : "TBD"}
                  </td>
                  <td className="px-3 py-2 text-[var(--tx3)]">
                    {r.customer_name?.trim() ? r.customer_name : "Pending details"}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setSelected(r)}
                      className="text-xs font-semibold text-[#5C1A33] inline-flex items-center gap-1"
                    >
                      Details <ArrowSquareOut size={14} aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 modal-overlay" role="dialog">
          <div className="w-full max-w-lg rounded-2xl bg-[var(--card)] border border-[var(--brd)] shadow-xl max-h-[90vh] overflow-y-auto p-5">
            <div className="flex justify-between items-start gap-2 mb-4">
              <div>
                <div className="font-mono text-[#5C1A33] font-semibold">{selected.shipment_number}</div>
                <div className="text-xs text-[var(--tx3)]">
                  {INBOUND_SHIPMENT_STATUS_LABELS[selected.status] || selected.status}
                </div>
              </div>
              <button type="button" className="text-sm text-[var(--tx3)]" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
            <form onSubmit={submitCustomer} className="space-y-3 text-sm">
              <p className="text-xs text-[var(--tx3)]">
                When we confirm receipt, add the end customer&apos;s delivery information here.
              </p>
              <input
                required
                placeholder="Customer name"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_name}
                onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
              />
              <input
                required
                type="email"
                placeholder="Email"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_email}
                onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
              />
              <input
                required
                placeholder="Phone"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_phone}
                onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
              />
              <AddressAutocomplete
                required
                placeholder="Delivery address"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_address}
                onRawChange={(t) => setForm((f) => ({ ...f, customer_address: t }))}
                onChange={(r) =>
                  setForm((f) => ({
                    ...f,
                    customer_address: r.fullAddress,
                    ...(r.postalCode && !f.customer_postal?.trim()
                      ? { customer_postal: r.postalCode }
                      : {}),
                  }))
                }
              />
              <input
                placeholder="Postal"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_postal}
                onChange={(e) => setForm((f) => ({ ...f, customer_postal: e.target.value }))}
              />
              <select
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_access}
                onChange={(e) => setForm((f) => ({ ...f, customer_access: e.target.value }))}
              >
                <option value="elevator">Elevator</option>
                <option value="stairs">Stairs</option>
                <option value="loading_dock">Loading dock</option>
              </select>
              <textarea
                rows={2}
                placeholder="Notes"
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 bg-[var(--bg)]"
                value={form.customer_notes}
                onChange={(e) => setForm((f) => ({ ...f, customer_notes: e.target.value }))}
              />
              {msg ? <p className="text-xs text-[var(--tx3)]">{msg}</p> : null}
              <button
                type="submit"
                disabled={saving}
                className="w-full py-2.5 rounded-xl bg-[#1f5f3f] text-white font-semibold disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save customer details"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import { User, EnvelopeSimple, Phone, MapPin, Chats, CheckCircle } from "@phosphor-icons/react";

export default function PublicInboundCustomerClient({ id, token }: { id: string; token: string }) {
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
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

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/public/inbound-shipment/${id}/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...form }),
      });
      const j = await res.json();
      if (!res.ok) {
        setErr(j.error || "Save failed");
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="min-h-screen bg-[#FAF8F5] flex items-center justify-center px-4">
        <div className="max-w-md text-center">
          <CheckCircle className="mx-auto text-[#2D6A4F]" size={48} weight="fill" aria-hidden />
          <h1 className="text-xl font-semibold mt-4">Thank you</h1>
          <p className="text-sm text-[var(--tx3)] mt-2">
            Your details were submitted. Our team will reach out to schedule delivery.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF8F5] px-4 py-10 text-[var(--tx)]">
      <div className="max-w-md mx-auto">
        <h1 className="text-xl font-semibold mb-1">Customer delivery details</h1>
        <p className="text-sm text-[var(--tx3)] mb-6">
          Provide the end customer&apos;s information so we can schedule white glove delivery.
        </p>

        <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-[var(--brd)] bg-white p-5 shadow-sm">
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-[var(--tx3)] mb-1">
              <User size={16} aria-hidden /> Name
            </span>
            <input
              required
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_name}
              onChange={(e) => setForm((f) => ({ ...f, customer_name: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-[var(--tx3)] mb-1">
              <EnvelopeSimple size={16} aria-hidden /> Email
            </span>
            <input
              required
              type="email"
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_email}
              onChange={(e) => setForm((f) => ({ ...f, customer_email: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-[var(--tx3)] mb-1">
              <Phone size={16} aria-hidden /> Phone
            </span>
            <input
              required
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_phone}
              onChange={(e) => setForm((f) => ({ ...f, customer_phone: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-[var(--tx3)] mb-1">
              <MapPin size={16} aria-hidden /> Delivery address
            </span>
            <input
              required
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_address}
              onChange={(e) => setForm((f) => ({ ...f, customer_address: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--tx3)] mb-1 block">Postal code</span>
            <input
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_postal}
              onChange={(e) => setForm((f) => ({ ...f, customer_postal: e.target.value }))}
            />
          </label>
          <label className="block text-sm">
            <span className="text-[var(--tx3)] mb-1 block">Building access</span>
            <select
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_access}
              onChange={(e) => setForm((f) => ({ ...f, customer_access: e.target.value }))}
            >
              <option value="elevator">Elevator</option>
              <option value="stairs">Stairs</option>
              <option value="loading_dock">Loading dock</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="block text-sm">
            <span className="flex items-center gap-1.5 text-[var(--tx3)] mb-1">
              <Chats size={16} aria-hidden /> Notes
            </span>
            <textarea
              rows={3}
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.customer_notes}
              onChange={(e) => setForm((f) => ({ ...f, customer_notes: e.target.value }))}
            />
          </label>

          <div className="pt-2 border-t border-[var(--brd)]/40">
            <p className="text-xs text-[var(--tx3)] mb-2">If you are responding to a damage notice, tell us how to proceed.</p>
            <label className="block text-sm mb-2">
              <span className="text-[var(--tx3)] mb-1 block">Resolution preference</span>
              <select
                className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
                value={form.partner_resolution_choice}
                onChange={(e) => setForm((f) => ({ ...f, partner_resolution_choice: e.target.value }))}
              >
                <option value="">—</option>
                <option value="return_sender">Return to sender</option>
                <option value="deliver_as_is">Deliver as-is (customer informed)</option>
                <option value="hold_replacement">Hold for replacement</option>
                <option value="other">Other</option>
              </select>
            </label>
            <textarea
              rows={2}
              placeholder="Additional instructions"
              className="w-full rounded-lg border border-[var(--brd)] px-3 py-2 text-sm bg-[var(--bg)]"
              value={form.partner_resolution_notes}
              onChange={(e) => setForm((f) => ({ ...f, partner_resolution_notes: e.target.value }))}
            />
          </div>

          {err ? <p className="text-sm text-red-600">{err}</p> : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#1f5f3f] text-white text-sm font-semibold disabled:opacity-60"
          >
            {loading ? "Saving…" : "Submit"}
          </button>
        </form>
      </div>
    </div>
  );
}

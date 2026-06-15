"use client";

import { useState } from "react";
import {
  User,
  EnvelopeSimple,
  Phone,
  MapPin,
  Chats,
  CheckCircle,
} from "@phosphor-icons/react";
import YugoLogo from "@/components/YugoLogo";

/* Premium client palette (explicit, never admin dark vars). */
const BG = "#FAF7F2";
const INK = "#241C16";
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const MUTED = "rgba(36,28,22,0.58)";
const FIELD_BORDER = "rgba(44,62,45,0.22)";
const CARD_BORDER = "rgba(92,26,51,0.14)";

/** Full building-access list for a white glove delivery. */
const ACCESS_OPTIONS: { value: string; label: string }[] = [
  { value: "elevator", label: "Elevator" },
  { value: "freight_elevator", label: "Freight / service elevator" },
  { value: "ground_floor", label: "Ground floor / street level" },
  { value: "walk_up_2", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4_plus", label: "Walk-up (4th floor or higher)" },
  { value: "stairs", label: "Stairs" },
  { value: "narrow_stairs", label: "Narrow stairs" },
  { value: "loading_dock", label: "Loading dock" },
  { value: "concierge", label: "Concierge / front desk" },
  { value: "long_carry", label: "Long carry from parking" },
  { value: "other", label: "Other (add a note)" },
];

const fieldClass =
  "w-full rounded-lg border px-3.5 py-2.5 text-[14px] outline-none transition-colors focus:border-[#5C1A33] focus:ring-2 focus:ring-[#5C1A33]/15";

export default function PublicInboundCustomerClient({
  id,
  token,
}: {
  id: string;
  token: string;
}) {
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

  const fieldStyle = { backgroundColor: "#fff", borderColor: FIELD_BORDER, color: INK };
  const labelStyle = { color: FOREST };

  if (done) {
    return (
      <div
        className="min-h-screen flex items-center justify-center px-4"
        style={{ backgroundColor: BG }}
      >
        <div className="max-w-md text-center">
          <CheckCircle
            className="mx-auto"
            style={{ color: FOREST }}
            size={52}
            weight="fill"
            aria-hidden
          />
          <h1
            className="font-hero text-[26px] mt-5"
            style={{ color: INK }}
          >
            Thank you
          </h1>
          <p className="text-[14px] mt-3 leading-relaxed" style={{ color: MUTED }}>
            Your details were submitted. Our team will be in touch to arrange
            your white glove delivery.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen px-4 py-12"
      style={{ backgroundColor: BG, color: INK }}
    >
      <div className="max-w-md mx-auto">
        <div className="flex flex-col items-center text-center mb-7">
          <YugoLogo size={30} variant="black" />
          <div
            className="w-10 h-px my-4"
            style={{ backgroundColor: `${WINE}33` }}
          />
          <h1 className="font-hero text-[28px] leading-tight" style={{ color: INK }}>
            Customer delivery details
          </h1>
          <p className="text-[13px] mt-2 leading-relaxed max-w-xs" style={{ color: MUTED }}>
            Share where and how to deliver, so we can arrange your white glove
            delivery with care.
          </p>
        </div>

        <form
          onSubmit={onSubmit}
          className="space-y-5 rounded-2xl border bg-white p-6 shadow-[0_2px_14px_rgba(92,26,51,0.05)]"
          style={{ borderColor: CARD_BORDER }}
        >
          <label className="block">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              <User size={15} aria-hidden /> Name
            </span>
            <input
              required
              className={fieldClass}
              style={fieldStyle}
              value={form.customer_name}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_name: e.target.value }))
              }
            />
          </label>

          <label className="block">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              <EnvelopeSimple size={15} aria-hidden /> Email
            </span>
            <input
              required
              type="email"
              className={fieldClass}
              style={fieldStyle}
              value={form.customer_email}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_email: e.target.value }))
              }
            />
          </label>

          <label className="block">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              <Phone size={15} aria-hidden /> Phone
            </span>
            <input
              required
              className={fieldClass}
              style={fieldStyle}
              value={form.customer_phone}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_phone: e.target.value }))
              }
            />
          </label>

          <label className="block">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              <MapPin size={15} aria-hidden /> Delivery address
            </span>
            <input
              required
              className={fieldClass}
              style={fieldStyle}
              value={form.customer_address}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_address: e.target.value }))
              }
            />
          </label>

          <label className="block">
            <span
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              Postal code
            </span>
            <input
              className={fieldClass}
              style={fieldStyle}
              value={form.customer_postal}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_postal: e.target.value }))
              }
            />
          </label>

          <label className="block">
            <span
              className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              Building access
            </span>
            <select
              className={`${fieldClass} appearance-none`}
              style={fieldStyle}
              value={form.customer_access}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_access: e.target.value }))
              }
            >
              {ACCESS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
              style={labelStyle}
            >
              <Chats size={15} aria-hidden /> Notes
            </span>
            <textarea
              rows={3}
              className={fieldClass}
              style={fieldStyle}
              placeholder="Anything our crew should know (parking, buzzer, preferred times)…"
              value={form.customer_notes}
              onChange={(e) =>
                setForm((f) => ({ ...f, customer_notes: e.target.value }))
              }
            />
          </label>

          <div className="pt-4 border-t" style={{ borderColor: `${WINE}14` }}>
            <p className="text-[12px] mb-3 leading-relaxed" style={{ color: MUTED }}>
              If you are responding to a damage notice, tell us how you would
              like us to proceed.
            </p>
            <label className="block mb-3">
              <span
                className="block text-[11px] font-semibold uppercase tracking-[0.08em] mb-1.5"
                style={labelStyle}
              >
                Resolution preference
              </span>
              <select
                className={`${fieldClass} appearance-none`}
                style={fieldStyle}
                value={form.partner_resolution_choice}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    partner_resolution_choice: e.target.value,
                  }))
                }
              >
                <option value="">Select if applicable</option>
                <option value="return_sender">Return to sender</option>
                <option value="deliver_as_is">
                  Deliver as-is (customer informed)
                </option>
                <option value="hold_replacement">Hold for replacement</option>
                <option value="other">Other</option>
              </select>
            </label>
            <textarea
              rows={2}
              placeholder="Additional instructions"
              className={fieldClass}
              style={fieldStyle}
              value={form.partner_resolution_notes}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  partner_resolution_notes: e.target.value,
                }))
              }
            />
          </div>

          {err ? (
            <p className="text-[13px] font-medium" style={{ color: "#B42318" }}>
              {err}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl text-[12px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: WINE }}
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
          <p className="text-[11px] text-center" style={{ color: MUTED }}>
            Handled by Yugo white glove delivery.
          </p>
        </form>
      </div>
    </div>
  );
}

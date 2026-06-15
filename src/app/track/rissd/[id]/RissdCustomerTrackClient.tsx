"use client";

import { Armchair, CheckCircle, Camera } from "@phosphor-icons/react";
import {
  INBOUND_SHIPMENT_STATUS_LABELS,
  INBOUND_SERVICE_LEVEL_LABELS,
} from "@/lib/inbound-shipment-labels";
import YugoLogo from "@/components/YugoLogo";

type Shipment = {
  shipment_number: string;
  partner_name: string | null;
  business_name: string | null;
  items: unknown;
  status: string;
  service_level: string;
  delivery_scheduled_date: string | null;
  delivery_window: string | null;
  requires_move_inside: boolean | null;
  requires_unboxing: boolean | null;
  requires_assembly: boolean | null;
  requires_debris_removal: boolean | null;
  inspection_photos?: unknown;
  inspection_status?: string | null;
  received_at?: string | null;
};

/* Premium client palette (explicit). */
const BG = "#FAF7F2";
const INK = "#241C16";
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const MUTED = "rgba(36,28,22,0.58)";
const CARD_BORDER = "rgba(92,26,51,0.14)";

function primaryItemName(items: unknown): string {
  try {
    const arr = Array.isArray(items) ? items : [];
    const first = arr[0] as { name?: string } | undefined;
    return first?.name?.trim() || "Your order";
  } catch {
    return "Your order";
  }
}

export default function RissdCustomerTrackClient({
  shipment,
}: {
  shipment: Shipment;
}) {
  const brand =
    shipment.partner_name || shipment.business_name || "Your retailer";
  const itemLabel = primaryItemName(shipment.items);
  const statusLabel =
    INBOUND_SHIPMENT_STATUS_LABELS[shipment.status] || shipment.status;
  const serviceLabel =
    INBOUND_SERVICE_LEVEL_LABELS[shipment.service_level] ||
    shipment.service_level;

  const services: { on: boolean; label: string }[] = [
    { on: !!shipment.requires_move_inside, label: "Move inside" },
    { on: !!shipment.requires_unboxing, label: "Unboxing" },
    { on: !!shipment.requires_assembly, label: "Assembly" },
    { on: !!shipment.requires_debris_removal, label: "Packaging removal" },
  ];

  const dateLabel = shipment.delivery_scheduled_date
    ? new Date(shipment.delivery_scheduled_date + "T12:00:00").toLocaleDateString(
        "en-CA",
        { weekday: "long", month: "long", day: "numeric" },
      )
    : null;

  const photos = Array.isArray(shipment.inspection_photos)
    ? (shipment.inspection_photos as string[]).filter(
        (u) => typeof u === "string" && u,
      )
    : [];
  const inspected = !!shipment.received_at || photos.length > 0;
  const conditionGood = shipment.inspection_status === "good";

  const card =
    "rounded-2xl border bg-white p-6 shadow-[0_2px_14px_rgba(92,26,51,0.05)]";

  return (
    <div className="min-h-screen px-4 py-12" style={{ backgroundColor: BG, color: INK }}>
      <div className="max-w-lg mx-auto">
        <div className="flex flex-col items-center text-center mb-7">
          <YugoLogo size={28} variant="black" />
          <p
            className="text-[11px] font-bold uppercase tracking-[0.16em] mt-3"
            style={{ color: MUTED }}
          >
            Handled by Yugo
          </p>
          <h1 className="font-hero text-[28px] leading-tight mt-1" style={{ color: INK }}>
            Your {brand} delivery
          </h1>
          <p
            className="text-[13px] mt-2 flex items-center gap-1.5"
            style={{ color: MUTED }}
          >
            <Armchair size={15} aria-hidden />
            {itemLabel}
          </p>
        </div>

        <div className={`${card} space-y-5`} style={{ borderColor: CARD_BORDER }}>
          {dateLabel && (
            <div>
              <div
                className="text-[11px] font-bold uppercase tracking-[0.1em]"
                style={{ color: MUTED }}
              >
                Delivery
              </div>
              <div className="font-hero text-[20px] mt-0.5" style={{ color: INK }}>
                {dateLabel}
              </div>
              {shipment.delivery_window ? (
                <div className="text-[13px]" style={{ color: MUTED }}>
                  Window: {shipment.delivery_window}
                </div>
              ) : null}
            </div>
          )}

          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1.5"
              style={{ color: MUTED }}
            >
              Service level
            </div>
            <div className="text-[14px] font-semibold" style={{ color: INK }}>
              {serviceLabel}
            </div>
          </div>

          <div>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.1em] mb-2"
              style={{ color: MUTED }}
            >
              Includes
            </div>
            <ul className="space-y-2">
              {services.map((s) =>
                s.on ? (
                  <li
                    key={s.label}
                    className="flex items-center gap-2 text-[14px]"
                    style={{ color: INK }}
                  >
                    <CheckCircle
                      className="shrink-0"
                      style={{ color: FOREST }}
                      size={18}
                      weight="fill"
                      aria-hidden
                    />
                    {s.label}
                  </li>
                ) : null,
              )}
            </ul>
          </div>

          <div className="pt-3 border-t" style={{ borderColor: `${WINE}14` }}>
            <div
              className="text-[11px] font-bold uppercase tracking-[0.1em]"
              style={{ color: MUTED }}
            >
              Status
            </div>
            <div className="font-hero text-[18px] mt-1" style={{ color: WINE }}>
              {statusLabel}
            </div>
            {!shipment.delivery_scheduled_date && (
              <p className="text-[13px] mt-2 leading-relaxed" style={{ color: MUTED }}>
                Live tracking will be available on the day of delivery once your
                route is dispatched.
              </p>
            )}
          </div>
        </div>

        {/* ── Condition on arrival: photos + inspection from our warehouse ── */}
        {inspected && (
          <div className={`${card} mt-5`} style={{ borderColor: CARD_BORDER }}>
            <div
              className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.1em] mb-1"
              style={{ color: MUTED }}
            >
              <Camera size={16} style={{ color: WINE }} aria-hidden />
              Condition on arrival
            </div>
            <p className="text-[13px] leading-relaxed mb-3" style={{ color: FOREST }}>
              {conditionGood
                ? "Your item arrived at our facility and passed inspection in good condition. We will keep it protected until delivery."
                : "Your item arrived at our facility and has been inspected. Your coordinator will be in touch with any details."}
            </p>
            {photos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {photos.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="block aspect-square rounded-xl overflow-hidden border"
                    style={{
                      borderColor: CARD_BORDER,
                      backgroundColor: "#f3efe9",
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Your item on arrival"
                      className="w-full h-full object-cover"
                    />
                  </a>
                ))}
              </div>
            )}
          </div>
        )}

        <p className="text-[11px] text-center mt-6" style={{ color: MUTED }}>
          Questions about your delivery? Reply to your confirmation message and
          your Yugo coordinator will help.
        </p>
      </div>
    </div>
  );
}

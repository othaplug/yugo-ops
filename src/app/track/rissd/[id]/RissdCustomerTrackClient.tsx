"use client";

import { Armchair, CheckCircle, ShippingContainer } from "@phosphor-icons/react";
import { INBOUND_SHIPMENT_STATUS_LABELS, INBOUND_SERVICE_LEVEL_LABELS } from "@/lib/inbound-shipment-labels";

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
};

function primaryItemName(items: unknown): string {
  try {
    const arr = Array.isArray(items) ? items : [];
    const first = arr[0] as { name?: string } | undefined;
    return first?.name?.trim() || "Your order";
  } catch {
    return "Your order";
  }
}

export default function RissdCustomerTrackClient({ shipment }: { shipment: Shipment }) {
  const brand = shipment.partner_name || shipment.business_name || "Your retailer";
  const itemLabel = primaryItemName(shipment.items);
  const statusLabel = INBOUND_SHIPMENT_STATUS_LABELS[shipment.status] || shipment.status;
  const serviceLabel = INBOUND_SERVICE_LEVEL_LABELS[shipment.service_level] || shipment.service_level;

  const services: { on: boolean; label: string }[] = [
    { on: !!shipment.requires_move_inside, label: "Move inside" },
    { on: !!shipment.requires_unboxing, label: "Unboxing" },
    { on: !!shipment.requires_assembly, label: "Assembly" },
    { on: !!shipment.requires_debris_removal, label: "Packaging removal" },
  ];

  const dateLabel = shipment.delivery_scheduled_date
    ? new Date(shipment.delivery_scheduled_date + "T12:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-[var(--tx)] px-4 py-10">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-1">
          <ShippingContainer className="text-[#C9A962]" size={26} weight="duotone" aria-hidden />
          <p className="text-xs font-bold capitalize tracking-wider text-[var(--tx3)]">Handled by Yugo</p>
        </div>
        <h1 className="text-2xl font-semibold leading-tight">
          Your {brand} delivery
        </h1>
        <p className="text-sm text-[var(--tx3)] mt-2 flex items-center gap-1.5">
          <Armchair size={16} aria-hidden />
          {itemLabel}
        </p>

        <div className="mt-8 rounded-2xl border border-[var(--brd)] bg-white p-6 shadow-sm space-y-4">
          {dateLabel && (
            <div>
              <div className="text-xs font-semibold capitalize text-[var(--tx3)]">Delivery</div>
              <div className="text-lg font-semibold">{dateLabel}</div>
              {shipment.delivery_window ? (
                <div className="text-sm text-[var(--tx3)]">Window: {shipment.delivery_window}</div>
              ) : null}
            </div>
          )}
          <div>
            <div className="text-xs font-semibold capitalize text-[var(--tx3)] mb-2">Service level</div>
            <div className="text-sm font-medium">{serviceLabel}</div>
          </div>
          <div>
            <div className="text-xs font-semibold capitalize text-[var(--tx3)] mb-2">Includes</div>
            <ul className="space-y-2">
              {services.map((s) =>
                s.on ? (
                  <li key={s.label} className="flex items-center gap-2 text-sm">
                    <CheckCircle className="text-[#2D6A4F] shrink-0" size={18} weight="fill" aria-hidden />
                    {s.label}
                  </li>
                ) : null,
              )}
            </ul>
          </div>
          <div className="pt-2 border-t border-[var(--brd)]/50">
            <div className="text-xs font-semibold capitalize text-[var(--tx3)]">Status</div>
            <div className="text-base font-semibold mt-1">{statusLabel}</div>
            {!shipment.delivery_scheduled_date && (
              <p className="text-sm text-[var(--tx3)] mt-2">
                Live tracking will be available on the day of delivery once your route is dispatched.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

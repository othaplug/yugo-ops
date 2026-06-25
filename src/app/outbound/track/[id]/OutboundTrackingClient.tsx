"use client";

/**
 * Partner-facing tracking page for outbound staging shipments.
 *
 * Read-only timeline view: progress bar, milestone timestamps, pallet specs
 * once palletized, and carrier handoff details once handed off.
 *
 * Mounted at /outbound/track/[id]?token=...
 */

const FOREST = "#2C3E2D";
const WINE = "#5C1A33";
const CREAM = "#FAF6EE";
const TEXT_MUTED = "#3B3A36AA";

type Progress = { key: string; label: string; completed: boolean; current: boolean };
type Pallet = { count?: number | null; dimensions?: string | null; weight_lb?: number | null };
type Carrier = { name?: string | null; pro_number?: string | null; bol_number?: string | null };

type Data = {
  shipment: {
    id: string;
    shipment_number: string;
    status: string;
    status_label: string;
    partner: { partner_name: string | null; business_name: string | null };
    consignor: { name: string | null; address: string | null };
    items: Array<{ name?: string; weight_lb?: number; dimensions?: string }> | null;
    total_pieces: number | null;
    declared_value: number | null;
    schedule: {
      pickup_date: string | null;
      pickup_window: string | null;
      carrier_pickup_appointment_at: string | null;
    };
    milestones: Record<string, string | null>;
    pallet: Pallet | null;
    carrier: Carrier | null;
    pricing: {
      pickup_price: number | null;
      palletization_price: number | null;
      hold_price_total: number | null;
      declared_value_fee: number | null;
      subtotal: number | null;
      tax_amount: number | null;
      total_price: number | null;
    };
  };
  progress: Progress[];
};

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-CA", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return iso;
  }
}

export default function OutboundTrackingClient({ data }: { data: Data }) {
  const { shipment, progress } = data;
  const isCancelled = shipment.status === "cancelled";

  return (
    <div style={{ minHeight: "100vh", background: CREAM, padding: "32px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <p
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: WINE,
              margin: 0,
            }}
          >
            Outbound staging
          </p>
          <h1
            style={{
              fontFamily: "Georgia, serif",
              fontSize: 32,
              fontWeight: 700,
              color: FOREST,
              margin: "8px 0",
            }}
          >
            Shipment {shipment.shipment_number}
          </h1>
          <p style={{ fontSize: 14, color: TEXT_MUTED, margin: 0 }}>
            Tracking for {shipment.partner.partner_name ?? "your shipment"} ·{" "}
            <span style={{ fontWeight: 600, color: FOREST }}>{shipment.status_label}</span>
          </p>
        </div>

        {/* Progress timeline */}
        {!isCancelled && progress.length > 0 && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: `${FOREST}99`,
                margin: "0 0 16px",
              }}
            >
              Progress
            </p>
            <ol style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {progress.map((p, i) => {
                const isLast = i === progress.length - 1;
                const tone = p.completed ? FOREST : `${FOREST}40`;
                return (
                  <li key={p.key} style={{ display: "flex", gap: 16, paddingBottom: isLast ? 0 : 14, position: "relative" }}>
                    {!isLast && (
                      <span
                        aria-hidden
                        style={{
                          position: "absolute",
                          left: 7,
                          top: 16,
                          bottom: 0,
                          width: 1,
                          background: `${FOREST}1A`,
                        }}
                      />
                    )}
                    <span
                      aria-hidden
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: "50%",
                        background: tone,
                        boxShadow: p.current ? `0 0 0 4px ${WINE}30` : `0 0 0 3px ${tone}1F`,
                        marginTop: 4,
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <p
                        style={{
                          fontSize: 14,
                          fontWeight: p.current ? 700 : 500,
                          color: p.completed ? FOREST : TEXT_MUTED,
                          margin: 0,
                          lineHeight: 1.4,
                        }}
                      >
                        {p.label}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {/* Milestones */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
          <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${FOREST}99`, margin: "0 0 16px" }}>
            Pickup & milestones
          </p>
          <Row label="Consignor" value={shipment.consignor.name ?? "—"} />
          <Row label="Pickup address" value={shipment.consignor.address ?? "—"} />
          <Row
            label="Scheduled pickup"
            value={
              shipment.schedule.pickup_date
                ? `${shipment.schedule.pickup_date}${shipment.schedule.pickup_window ? ` · ${shipment.schedule.pickup_window}` : ""}`
                : "—"
            }
          />
          <Row label="Picked up" value={fmtDateTime(shipment.milestones.picked_up_at)} />
          <Row label="At warehouse" value={fmtDateTime(shipment.milestones.received_at_warehouse_at)} />
          <Row label="Palletized" value={fmtDateTime(shipment.milestones.palletized_at)} />
          <Row label="Ready for carrier" value={fmtDateTime(shipment.milestones.ready_for_carrier_at)} />
          <Row label="Handed off" value={fmtDateTime(shipment.milestones.handed_off_at)} />
        </div>

        {/* Pallet specs */}
        {shipment.pallet && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${FOREST}99`, margin: "0 0 16px" }}>
              Pallet specs
            </p>
            <Row label="Count" value={shipment.pallet.count?.toString() ?? "—"} />
            <Row label="Dimensions" value={shipment.pallet.dimensions ?? "—"} />
            <Row label="Weight" value={shipment.pallet.weight_lb ? `${shipment.pallet.weight_lb} lb` : "—"} />
          </div>
        )}

        {/* Carrier handoff */}
        {shipment.carrier && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${FOREST}99`, margin: "0 0 16px" }}>
              Carrier handoff
            </p>
            <Row label="Carrier" value={shipment.carrier.name ?? "—"} />
            <Row label="BOL" value={shipment.carrier.bol_number ?? "—"} monospace />
            <Row label="PRO" value={shipment.carrier.pro_number ?? "—"} monospace />
          </div>
        )}

        {/* Pricing */}
        {shipment.pricing.total_price && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, marginBottom: 24 }}>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: `${FOREST}99`, margin: "0 0 16px" }}>
              Pricing
            </p>
            {shipment.pricing.pickup_price ? (
              <Row label="Pickup & intake" value={`$${shipment.pricing.pickup_price.toFixed(2)}`} />
            ) : null}
            {shipment.pricing.palletization_price ? (
              <Row label="Palletization" value={`$${shipment.pricing.palletization_price.toFixed(2)}`} />
            ) : null}
            {shipment.pricing.hold_price_total ? (
              <Row label="Warehouse hold" value={`$${shipment.pricing.hold_price_total.toFixed(2)}`} />
            ) : null}
            {shipment.pricing.declared_value_fee ? (
              <Row label="Declared value handling" value={`$${shipment.pricing.declared_value_fee.toFixed(2)}`} />
            ) : null}
            <hr style={{ border: 0, borderTop: `1px solid ${FOREST}1F`, margin: "12px 0" }} />
            <Row label="Subtotal" value={shipment.pricing.subtotal ? `$${shipment.pricing.subtotal.toFixed(2)}` : "—"} />
            <Row label="HST" value={shipment.pricing.tax_amount ? `$${shipment.pricing.tax_amount.toFixed(2)}` : "—"} />
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${FOREST}1F` }}>
              <Row label="Total CAD" value={`$${shipment.pricing.total_price.toFixed(2)}`} bold />
            </div>
          </div>
        )}

        <p style={{ fontSize: 12, color: TEXT_MUTED, textAlign: "center", margin: "32px 0 16px" }}>
          Questions? Email <a href="mailto:support@helloyugo.com" style={{ color: FOREST }}>support@helloyugo.com</a>
        </p>
      </div>
    </div>
  );
}

function Row({ label, value, monospace, bold }: { label: string; value: string; monospace?: boolean; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 16, padding: "6px 0" }}>
      <span style={{ fontSize: 13, color: TEXT_MUTED }}>{label}</span>
      <span
        style={{
          fontSize: bold ? 16 : 13,
          color: FOREST,
          fontWeight: bold ? 700 : 500,
          fontFamily: monospace ? "monospace" : undefined,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

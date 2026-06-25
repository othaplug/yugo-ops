/**
 * Outbound staging — partner notification emails.
 *
 * Four canonical touchpoints in the lifecycle:
 *   1. CONFIRMED   — admin scheduled the pickup. Partner sees pickup window
 *      + tracking link + price breakdown.
 *   2. PICKED_UP   — crew has the items, en route to warehouse.
 *   3. READY       — palletized + BOL printed, awaiting carrier appointment.
 *   4. HANDED_OFF  — carrier collected. Partner gets PRO + BOL for their
 *      onward tracking, plus a closing summary.
 *
 * Each helper renders inline HTML and returns it as a string. The actual
 * Resend send happens at the call site (route or cron) using sendEmail —
 * keeps this module free of side effects so it's easy to unit-test or
 * preview locally.
 */

import {
  OUTBOUND_STAGING_PARTNER_LABELS,
  type OutboundStagingStatus,
} from "./transitions";

export type PartnerEmailContext = {
  shipmentNumber: string;
  partnerContactName: string | null;
  partnerName: string | null;
  consignorName: string | null;
  consignorAddress: string | null;
  scheduledPickupDate: string | null;
  scheduledPickupWindow: string | null;
  totalPrice: number | null;
  declaredValue: number | null;
  trackingUrl: string;
};

const FOREST = "#2C3E2D";
const WINE = "#5C1A33";
const CREAM = "#FAF6EE";
const RULE = `border-top:1px solid ${FOREST}1F;`;

function shell(inner: string): string {
  return `<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:${CREAM};">
<table width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};padding:24px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:${FOREST};">
${inner}
</table>
</td></tr></table>
</body></html>`;
}

function pricingTable(price: number | null): string {
  if (price == null || !Number.isFinite(price) || price <= 0) return "";
  return `
<div style="margin:24px 0;padding:18px;background:${CREAM};border-radius:8px;">
  <div style="font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:${FOREST}99;margin-bottom:6px;">Total</div>
  <div style="font-size:24px;font-weight:700;color:${FOREST};">$${price.toFixed(2)} CAD</div>
</div>`;
}

function footer(trackingUrl: string): string {
  return `
<table width="100%" style="margin-top:24px;${RULE}padding-top:16px;">
<tr><td>
<a href="${trackingUrl}" style="display:inline-block;background:${WINE};color:#fff;text-decoration:none;font-size:13px;font-weight:600;padding:12px 24px;border-radius:6px;">Track this shipment</a>
</td></tr>
</table>
<p style="font-size:12px;color:${FOREST}99;margin-top:24px;">
  Questions? Reply to this email or contact your coordinator at support@helloyugo.com.
</p>`;
}

function header(eyebrow: string, headline: string): string {
  return `
<div style="font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:${WINE};">${eyebrow}</div>
<h1 style="font-size:24px;font-weight:700;margin:8px 0 16px;color:${FOREST};font-family:Georgia,serif;">${headline}</h1>`;
}

function detailsBlock(ctx: PartnerEmailContext): string {
  const window = ctx.scheduledPickupWindow ? ` · ${ctx.scheduledPickupWindow}` : "";
  return `
<table width="100%" style="font-size:13px;line-height:1.6;color:${FOREST};margin:8px 0 16px;">
<tr><td style="padding:6px 0;width:140px;color:${FOREST}99;">Shipment</td><td style="padding:6px 0;font-weight:600;">${ctx.shipmentNumber}</td></tr>
<tr><td style="padding:6px 0;color:${FOREST}99;">Consignor</td><td style="padding:6px 0;">${ctx.consignorName ?? "—"}</td></tr>
<tr><td style="padding:6px 0;color:${FOREST}99;">Pickup address</td><td style="padding:6px 0;">${ctx.consignorAddress ?? "—"}</td></tr>
<tr><td style="padding:6px 0;color:${FOREST}99;">Pickup date</td><td style="padding:6px 0;">${ctx.scheduledPickupDate ?? "—"}${window}</td></tr>
${ctx.declaredValue ? `<tr><td style="padding:6px 0;color:${FOREST}99;">Declared value</td><td style="padding:6px 0;">$${Number(ctx.declaredValue).toFixed(2)} CAD</td></tr>` : ""}
</table>`;
}

export function renderConfirmationEmail(ctx: PartnerEmailContext): {
  subject: string;
  html: string;
} {
  const greeting = ctx.partnerContactName?.split(/\s+/)[0] ?? "there";
  const inner = `
<tr><td>
  ${header("Shipment confirmed", `Pickup booked for ${ctx.scheduledPickupDate ?? "your shipment"}`)}
  <p style="font-size:14px;line-height:1.6;">Hi ${greeting},</p>
  <p style="font-size:14px;line-height:1.6;">
    We're confirmed for your outbound staging shipment. Below is the booking summary — you can track every step at the link at the bottom of this email.
  </p>
  ${detailsBlock(ctx)}
  ${pricingTable(ctx.totalPrice)}
  ${footer(ctx.trackingUrl)}
</td></tr>`;
  return {
    subject: `Yugo shipment ${ctx.shipmentNumber} confirmed — pickup ${ctx.scheduledPickupDate ?? "scheduled"}`,
    html: shell(inner),
  };
}

export function renderPickedUpEmail(ctx: PartnerEmailContext): {
  subject: string;
  html: string;
} {
  const greeting = ctx.partnerContactName?.split(/\s+/)[0] ?? "there";
  const inner = `
<tr><td>
  ${header("Picked up", "Your shipment is en route to our warehouse")}
  <p style="font-size:14px;line-height:1.6;">Hi ${greeting},</p>
  <p style="font-size:14px;line-height:1.6;">
    Our crew completed the pickup at ${ctx.consignorAddress ?? "the consignor's address"} and is bringing the items to the Yugo warehouse for intake and palletization.
  </p>
  <p style="font-size:14px;line-height:1.6;">
    You'll get the next update once palletizing is complete and the shipment is ready for your carrier.
  </p>
  ${footer(ctx.trackingUrl)}
</td></tr>`;
  return {
    subject: `Yugo shipment ${ctx.shipmentNumber} picked up`,
    html: shell(inner),
  };
}

export type ReadyForCarrierContext = PartnerEmailContext & {
  palletCount: number | null;
  palletDimensions: string | null;
  palletWeightLb: number | null;
};

export function renderReadyForCarrierEmail(
  ctx: ReadyForCarrierContext,
): { subject: string; html: string } {
  const greeting = ctx.partnerContactName?.split(/\s+/)[0] ?? "there";
  const palletSpec = [
    ctx.palletCount ? `${ctx.palletCount} pallet${ctx.palletCount === 1 ? "" : "s"}` : null,
    ctx.palletDimensions ?? null,
    ctx.palletWeightLb ? `${ctx.palletWeightLb} lb` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const inner = `
<tr><td>
  ${header("Ready for pickup", "Your shipment is ready for the carrier")}
  <p style="font-size:14px;line-height:1.6;">Hi ${greeting},</p>
  <p style="font-size:14px;line-height:1.6;">
    Palletizing is complete and the shipment is staged at the Yugo warehouse. Please coordinate a pickup appointment with your carrier — we'll release at the door once they arrive with a matching BOL.
  </p>
  ${palletSpec ? `<div style="margin:18px 0;padding:14px;background:${CREAM};border-radius:8px;font-size:13px;line-height:1.6;"><strong style="color:${FOREST};">Pallet specs:</strong> ${palletSpec}</div>` : ""}
  ${footer(ctx.trackingUrl)}
</td></tr>`;
  return {
    subject: `Yugo shipment ${ctx.shipmentNumber} ready for carrier pickup`,
    html: shell(inner),
  };
}

export type HandedOffContext = PartnerEmailContext & {
  carrierName: string | null;
  carrierProNumber: string | null;
  carrierBolNumber: string | null;
  handedOffAt: string | null;
};

export function renderHandedOffEmail(
  ctx: HandedOffContext,
): { subject: string; html: string } {
  const greeting = ctx.partnerContactName?.split(/\s+/)[0] ?? "there";
  const inner = `
<tr><td>
  ${header("Handed off", "Your shipment is now with your carrier")}
  <p style="font-size:14px;line-height:1.6;">Hi ${greeting},</p>
  <p style="font-size:14px;line-height:1.6;">
    ${ctx.carrierName ?? "Your carrier"} collected the pallet on ${ctx.handedOffAt ?? "today"}. Use the carrier references below to track the onward leg.
  </p>
  <table width="100%" style="font-size:13px;line-height:1.6;color:${FOREST};margin:8px 0 16px;">
    ${ctx.carrierName ? `<tr><td style="padding:6px 0;width:140px;color:${FOREST}99;">Carrier</td><td style="padding:6px 0;font-weight:600;">${ctx.carrierName}</td></tr>` : ""}
    ${ctx.carrierBolNumber ? `<tr><td style="padding:6px 0;color:${FOREST}99;">BOL</td><td style="padding:6px 0;font-family:monospace;">${ctx.carrierBolNumber}</td></tr>` : ""}
    ${ctx.carrierProNumber ? `<tr><td style="padding:6px 0;color:${FOREST}99;">PRO</td><td style="padding:6px 0;font-family:monospace;">${ctx.carrierProNumber}</td></tr>` : ""}
  </table>
  <p style="font-size:14px;line-height:1.6;">Thanks for shipping with Yugo. Reply if anything's off and we'll sort it.</p>
  ${footer(ctx.trackingUrl)}
</td></tr>`;
  return {
    subject: `Yugo shipment ${ctx.shipmentNumber} handed off to ${ctx.carrierName ?? "carrier"}`,
    html: shell(inner),
  };
}

/** Convenience map keyed by status so the transition route can fire the
 * right email without a switch. Each entry returns null if a status
 * doesn't trigger a partner email. */
export const STATUS_EMAIL_KEY: Partial<Record<OutboundStagingStatus, "confirmation" | "picked_up" | "ready_for_carrier" | "handed_off">> = {
  scheduled: "confirmation",
  picked_up: "picked_up",
  ready_for_carrier: "ready_for_carrier",
  handed_off: "handed_off",
};

/** Public helper used in tests + the tracking page label resolution. */
export function statusPartnerLabel(s: OutboundStagingStatus): string {
  return OUTBOUND_STAGING_PARTNER_LABELS[s];
}

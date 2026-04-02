import { getClientSupportEmail } from "@/lib/email/client-support-email";
import { emailLayout, legacyEmailLayout, equinoxPromoLayout, equinoxPromoCta, equinoxPromoFinePrint } from "@/lib/email-templates";
import { formatCurrency } from "@/lib/format-currency";
import { formatAccessForDisplay } from "@/lib/format-text";
import { formatPhone } from "@/lib/phone";

/* ═══════════════════════════════════════════════════════════
   Pre-Move, Post-Move, Review & Lifecycle Email Templates
   ═══════════════════════════════════════════════════════════ */

/** First name only for email greetings (all client-facing emails). */
function firstName(full: string | undefined): string {
  return ((full || "").trim().split(/\s+/)[0]) || "";
}

function dateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "To be confirmed";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const GOLD_BTN = "#B8962E";
const EQ_SANS = "Helvetica Neue,Helvetica,Arial,sans-serif";
const EQ_H1 =
  "font-size:24px;font-weight:700;margin:0 0 12px;color:#FFFFFF;letter-spacing:0.02em;text-transform:none;line-height:1.35;font-family:Helvetica Neue,Helvetica,Arial,sans-serif";
const EQ_LEAD =
  "font-size:14px;color:#A3A3A3;line-height:1.65;margin:0 0 26px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif";
const EQ_EYE =
  "font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.06em;text-transform:none;margin-bottom:10px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif";
const EQ_PANEL =
  "background:#1C1C1C;border:1px solid rgba(255,255,255,0.1);border-radius:2px;padding:20px;margin-bottom:20px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif";
const EQ_MUTED = "#8A8A8A";
const EQ_VALUE = "#F0F0F0";
const EQ_CREME_HEAD = "#FAF9F6";
/** Hero headlines in legacy emails (reviews, quote follow-ups). */
const HERO_SERIF = "'Instrument Serif', Georgia, 'Times New Roman', serif";

function ctaButton(url: string, label: string, sub?: string): string {
  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:24px 0 ${sub ? "6px" : "16px"};">
      <tr>
        <td align="center" style="text-align:center;">
          <a href="${url}" style="display:inline-block;background-color:${GOLD_BTN};color:#0A0806;padding:14px 32px;font-size:13px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:0.02em;text-transform:none;font-family:${EQ_SANS};">
            ${label}
          </a>
        </td>
      </tr>
    </table>
    ${sub ? `<p style="font-size:10px;color:${EQ_MUTED};text-align:center;margin:0 0 16px;letter-spacing:0.04em;font-family:${EQ_SANS};">${sub}</p>` : ""}
  `;
}

/** Star rating links: 1–3 → review page (feedback), 4–5 → redirect API (Google). */
function starRatingLinks(reviewUrl: string, reviewRedirectUrl: string): string {
  const sep = reviewUrl.includes("?") ? "&" : "?";
  const starStyle = "display:inline-block;width:36px;height:36px;line-height:36px;text-align:center;font-size:18px;color:#C9A962;text-decoration:none;margin:0 2px;border-radius:8px;background:rgba(201,169,98,0.15)";
  const link1 = `${reviewUrl}${sep}rating=1`;
  const link2 = `${reviewUrl}${sep}rating=2`;
  const link3 = `${reviewUrl}${sep}rating=3`;
  const link4 = `${reviewRedirectUrl}${reviewRedirectUrl.includes("?") ? "&" : "?"}rating=4`;
  const link5 = `${reviewRedirectUrl}${reviewRedirectUrl.includes("?") ? "&" : "?"}rating=5`;
  return `
    <div style="font-size:11px;color:#B8B5B0;margin-bottom:10px;text-align:center">Rate your experience:</div>
    <div style="margin:0 0 24px;text-align:center">
      <a href="${link1}" style="${starStyle}" title="1 star">1</a>
      <a href="${link2}" style="${starStyle}" title="2 stars">2</a>
      <a href="${link3}" style="${starStyle}" title="3 stars">3</a>
      <a href="${link4}" style="${starStyle}" title="4 stars">4</a>
      <a href="${link5}" style="${starStyle}" title="5 stars">5</a>
    </div>
  `;
}

/* ── T-72 Hours: Checklist Email ── */

export interface PreMove72hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  fromAccess?: string | null;
  toAccess?: string | null;
  trackingUrl: string;
}

export function preMove72hrEmail(d: PreMove72hrData): string {
  const accessNotes: string[] = [];
  const fromAccessLabel = formatAccessForDisplay(d.fromAccess);
  const toAccessLabel = formatAccessForDisplay(d.toAccess);
  if (fromAccessLabel && toAccessLabel && fromAccessLabel !== "None" && toAccessLabel !== "None")
    accessNotes.push(`<strong>Access:</strong> Pickup: ${fromAccessLabel}; Drop-off: ${toAccessLabel} - please reserve the elevator/loading dock.`);
  else if (fromAccessLabel && fromAccessLabel !== "None")
    accessNotes.push(`<strong>Access:</strong> ${fromAccessLabel} - please reserve the elevator/loading dock.`);
  else if (toAccessLabel && toAccessLabel !== "None")
    accessNotes.push(`<strong>Access:</strong> ${toAccessLabel} - please reserve the elevator/loading dock.`);

  return emailLayout(`
    <div style="${EQ_EYE}">Three days to go</div>
    <h1 style="${EQ_H1}">Your move is almost here${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your move is confirmed for <strong style="color:#E8E8E8">${dateDisplay(d.moveDate)}</strong>. A little preparation goes a long way. Here is a quick checklist to make the day as smooth as possible.
    </p>

    <div style="${EQ_PANEL}">
      <div style="font-size:10px;color:#B8962E;text-transform:none;font-weight:700;letter-spacing:0.12em;margin-bottom:14px;font-family:${EQ_SANS}">Pre-move checklist</div>
      <div style="font-size:13px;color:${EQ_MUTED};line-height:2;font-family:${EQ_SANS}">
        <div>— Book elevator or loading dock at both locations</div>
        <div>— Reserve parking access for our truck</div>
        <div>— Finish packing any remaining boxes</div>
        <div>— Clear hallways and pathways throughout</div>
        <div>— Arrange care for pets and young children on the day</div>
        <div>— Keep valuables, medications, and important documents with you</div>
        <div>— Defrost the freezer and empty the fridge</div>
      </div>
    </div>

    ${accessNotes.length > 0 ? `
      <div style="background:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.22);border-radius:2px;padding:16px;margin-bottom:20px;font-family:${EQ_SANS}">
        <div style="font-size:10px;color:#B8962E;font-weight:700;letter-spacing:0.1em;text-transform:none;margin-bottom:8px">Access notes</div>
        <div style="font-size:12px;color:#A3A3A3;line-height:1.6">
          ${accessNotes.join("<br/>")}
        </div>
      </div>
    ` : ""}

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:22px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Move details</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Reference</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:#B8962E;font-weight:700">${d.moveCode}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">From</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.fromAddress}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">To</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.toAddress}</td></tr>
    </table>

    ${ctaButton(d.trackingUrl, "Track your move")}
    <p style="font-size:11px;color:${EQ_MUTED};text-align:center;font-family:${EQ_SANS}">
      We are here if you need anything. Email ${getClientSupportEmail()} or reach your coordinator directly.
    </p>
  `);
}

/* ── T-24 Hours: Crew Details ── */

export interface PreMove24hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  crewLeadName?: string | null;
  crewSize?: number | null;
  truckInfo?: string | null;
  arrivalWindow?: string | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  trackingUrl: string;
}

export function preMove24hrEmail(d: PreMove24hrData): string {
  return emailLayout(`
    <div style="${EQ_EYE}">Tomorrow&apos;s the day</div>
    <h1 style="${EQ_H1}">Your crew is confirmed${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Everything is in place for your move tomorrow. Your arrival window and crew details are below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:18px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Crew details</td>
      </tr>
      ${d.crewLeadName ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Crew lead</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_VALUE};font-weight:600">${d.crewLeadName}</td></tr>` : ""}
      ${d.crewSize ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Crew size</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE};font-weight:600">${d.crewSize} movers</td></tr>` : ""}
      ${d.truckInfo ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Truck</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE};font-weight:600">${d.truckInfo}</td></tr>` : ""}
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Arrival</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:#B8962E;font-weight:700">${d.arrivalWindow ?? "Morning window - your coordinator will confirm the exact time"}</td></tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:20px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Move details</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Date</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_VALUE};font-weight:600">${dateDisplay(d.moveDate)}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">From</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.fromAddress}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">To</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.toAddress}</td></tr>
    </table>

    ${d.coordinatorName ? `
      <div style="background:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.22);border-radius:2px;padding:16px;margin-bottom:20px;font-family:${EQ_SANS}">
        <div style="font-size:10px;color:#B8962E;font-weight:700;letter-spacing:0.1em;text-transform:none;margin-bottom:6px">Your coordinator</div>
        <div style="font-size:13px;color:${EQ_VALUE};margin-top:4px">${d.coordinatorName}${d.coordinatorPhone ? ` &middot; ${formatPhone(d.coordinatorPhone)}` : ""}</div>
        <div style="font-size:11px;color:${EQ_MUTED};margin-top:4px">Available by phone or text if you need anything before tomorrow.</div>
      </div>
    ` : ""}

    ${ctaButton(d.trackingUrl, "Track your move live")}
    <p style="font-size:11px;color:${EQ_MUTED};text-align:center;font-family:${EQ_SANS}">
      Your crew will call approximately 30 minutes before they arrive.
    </p>
  `);
}

/* ── Balance Receipt ── */

export interface BalanceReceiptData {
  clientName: string;
  moveCode: string;
  amount: number;
  paymentMethod?: string | null;
  totalPaid: number;
  trackingUrl: string;
}

export function balanceReceiptEmail(d: BalanceReceiptData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#2D9F5A">Payment received</div>
    <h1 style="${EQ_H1}">Thank you${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your payment has been completed. Your account for this move is now paid in full.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:24px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Payment summary</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Reference</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:#B8962E;font-weight:700">${d.moveCode}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Balance paid</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:#2D9F5A;font-weight:700">${formatCurrency(d.amount)}</td></tr>
      ${d.paymentMethod ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Payment method</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.paymentMethod}</td></tr>` : ""}
      <tr><td style="border-top:1px solid rgba(255,255,255,0.1);padding:14px 16px;font-size:12px;color:#B8962E;font-weight:700;text-transform:none;letter-spacing:0.08em">Total paid</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.1);padding:14px 16px;font-size:14px;color:#B8962E;font-weight:700">${formatCurrency(d.totalPaid)}</td></tr>
    </table>

    ${ctaButton(d.trackingUrl, "View move details")}
  `);
}

/* ── Move Complete ── */

export interface MoveCompleteData {
  clientName: string;
  moveCode: string;
  fromAddress: string;
  toAddress: string;
  completedDate: string | null;
  trackingUrl: string;
  surveyUrl?: string | null;
}

export function moveCompleteEmail(d: MoveCompleteData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#2D9F5A">Move complete</div>
    <h1 style="${EQ_H1}">Congratulations${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your move is complete. It was a privilege to take care of your home and belongings today. Your documents and receipts are ready in your portal whenever you need them.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:24px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Move summary</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Reference</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:#B8962E;font-weight:700">${d.moveCode}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">From</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.fromAddress}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">To</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.toAddress}</td></tr>
      ${d.completedDate ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Completed</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:#2D9F5A;font-weight:700">${dateDisplay(d.completedDate)}</td></tr>` : ""}
    </table>

    <div style="margin-bottom:22px;font-family:${EQ_SANS}">
      <div style="font-size:10px;color:#B8962E;text-transform:none;font-weight:700;letter-spacing:0.12em;margin-bottom:10px">Your documents</div>
      <p style="font-size:13px;color:${EQ_MUTED};line-height:1.65;margin:0">
        Your move summary, invoice, and receipt are available to download directly from your portal. We keep these secure and accessible at any time.
      </p>
    </div>

    <div style="margin-bottom:24px;font-family:${EQ_SANS}">
      <div style="font-size:10px;color:#B8962E;text-transform:none;font-weight:700;letter-spacing:0.12em;margin-bottom:10px">What&apos;s next</div>
      <div style="font-size:13px;color:${EQ_MUTED};line-height:1.85">
        <div>1. Download your documents from the portal</div>
        <div>2. A brief follow-up will arrive by email shortly</div>
        <div>3. Settle in and enjoy your new space</div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View your move portal")}
  `);
}

/* ── Review Request (score >= 4 or null) ── */

export interface ReviewRequestData {
  clientName: string;
  moveCode: string;
  googleReviewUrl: string;
  referralUrl?: string | null;
  trackingUrl: string;
}

export function reviewRequestEmail(d: ReviewRequestData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">How Was Your Experience?</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your feedback means a great deal to us and to families looking for a mover they can trust. A brief review is the best way to share your experience.
    </p>

    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 24px;">
      <tr>
        <td align="center">
          <a href="${d.googleReviewUrl}" style="display:block;background-color:${GOLD_BTN};color:#0A0806;padding:14px 32px;font-size:13px;font-weight:700;text-decoration:none;text-align:center;letter-spacing:0.02em;text-transform:none;">
            Share Your Experience
          </a>
        </td>
      </tr>
    </table>

    ${d.referralUrl ? `
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:20px;">
        <tr>
          <td style="background-color:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.25);padding:22px;text-align:center;">
            <div style="font-size:8px;color:#C9A962;text-transform:none;font-weight:700;letter-spacing:2px;margin-bottom:8px;">Know Someone Moving?</div>
            <div style="font-family:'Instrument Serif', Georgia, serif;font-size:24px;font-weight:400;color:#F5F5F3;margin-bottom:8px;">Give $50. Get $50.</div>
            <p style="font-size:12px;color:#B8B5B0;margin:0 0 16px;line-height:1.6;">Share your referral link and you both receive $50 off a future move.</p>
            <a href="${d.referralUrl}" style="display:inline-block;background-color:transparent;color:#C9A962;padding:9px 22px;font-size:11px;font-weight:700;letter-spacing:1px;text-decoration:none;border:1px solid #C9A96280;text-transform:none;">
              Share Your Link
            </a>
          </td>
        </tr>
      </table>
    ` : ""}

    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for trusting Yugo with your home. The Yugo Team
    </p>
  `);
}

/* ── Tier-specific Review Request (2h after completion) ── */

export interface ReviewRequestTierData {
  clientName: string;
  tier: "essential" | "signature" | "estate" | string;
  reviewUrl: string;
  /** URL for 4–5 star clicks: saves rating and redirects to Google. */
  reviewRedirectUrl: string;
  referralUrl?: string | null;
  trackingUrl: string;
  coordinatorName?: string | null;
}

/** @deprecated Use reviewRequestCuratedEmail */
export const reviewRequestEssentialsEmail = (d: ReviewRequestTierData): string => reviewRequestCuratedEmail(d);

export function reviewRequestCuratedEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">How Was Your Experience?</div>
    <h1 style="font-family:'Instrument Serif', Verdana, Helvetica, sans-serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      It was a pleasure taking care of your move today. We hope you are already settling in comfortably.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If you have a moment, we would be truly grateful for a brief review. Your words help other families find the level of care they deserve, and they mean everything to our crew.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for trusting Yugo with your home. The Yugo Team
    </p>
  `);
}

/** @deprecated Use reviewRequestSignatureEmail */
export const reviewRequestPremierEmail = (d: ReviewRequestTierData): string => reviewRequestSignatureEmail(d);

export function reviewRequestSignatureEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">Your Experience Matters</div>
    <h1 style="font-family:'Instrument Serif', Verdana, Helvetica, sans-serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">How was your move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      It was truly a pleasure taking care of your move today. We hope you are already settling in and feeling at home.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If you have a moment, a brief review would mean the world to our team. Your words help other families find the care and confidence they deserve on moving day.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="font-size:11px;color:#666;text-align:center">
      With gratitude, The Yugo Team
    </p>
  `);
}

export function reviewRequestEstateEmail(d: ReviewRequestTierData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">A Note of Gratitude</div>
    <h1 style="font-family:'Instrument Serif', Verdana, Helvetica, sans-serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">${firstName(d.clientName) ? `${firstName(d.clientName)}, it was our privilege` : "It was our privilege"}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Thank you for entrusting Yugo with your home and belongings. Every detail of your move matters to us, and we hope today reflected that.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If your experience was as exceptional as we intended, we would be honoured by a brief review. It helps other families find the quality of care they deserve, and it means everything to our team.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="font-size:11px;color:#666;text-align:center">
      With gratitude,<br/>${d.coordinatorName || "The Yugo Team"}<br/>Yugo, The Art of Moving
    </p>
  `);
}

export interface ReviewRequestReminderData {
  clientName: string;
  reviewUrl: string;
  /** URL for 4–5 star clicks: saves rating and redirects to Google. */
  reviewRedirectUrl: string;
}

export function reviewRequestReminderEmail(d: ReviewRequestReminderData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">A Gentle Reminder</div>
    <h1 style="font-family:'Instrument Serif', Verdana, Helvetica, sans-serif;font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">A moment for your review${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We know settling in keeps you busy. Whenever you have a moment, your review would mean the world to our team and to families searching for a mover they can trust.
    </p>
    ${starRatingLinks(d.reviewUrl, d.reviewRedirectUrl)}
    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing Yugo. The Yugo Team
    </p>
  `);
}

/* ── Low Satisfaction Follow-Up (score < 4) ── */

export interface LowSatisfactionData {
  clientName: string;
  moveCode: string;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  coordinatorEmail?: string | null;
  trackingUrl: string;
}

export function lowSatisfactionEmail(d: LowSatisfactionData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D48A29;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">We Are Here For You</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We hear you${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We understand your experience fell short of what you deserved, and we sincerely apologize. This is not the standard we hold ourselves to, and we are committed to making it right.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;color:#B8B5B0;line-height:1.7">
        <div>Your dedicated coordinator is available to resolve this personally:</div>
        ${d.coordinatorName ? `<div style="color:#E8E5E0;font-weight:600;margin-top:8px">${d.coordinatorName}</div>` : ""}
        ${d.coordinatorPhone ? `<div style="color:#C9A962;margin-top:4px">${formatPhone(d.coordinatorPhone)}</div>` : ""}
        ${d.coordinatorEmail ? `<div style="color:#C9A962;margin-top:4px">${d.coordinatorEmail}</div>` : ""}
      </div>
    </div>

    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Please reach us at ${getClientSupportEmail()} or call us directly. We will not consider this resolved until you are fully satisfied.
    </p>

    ${ctaButton(d.trackingUrl, "View your move details")}
  `);
}

/* ── Internal Alert: Low Satisfaction ── */

export interface InternalLowSatAlertData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  npsScore: number | null;
  moveDate: string | null;
}

export function internalLowSatAlertEmail(d: InternalLowSatAlertData): string {
  return legacyEmailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:none;margin-bottom:8px">Low Satisfaction Alert</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${d.moveCode} - ${d.clientName}</h1>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
      <div style="font-size:12px;color:#D14343;font-weight:600">NPS/Satisfaction Score: ${d.npsScore ?? "N/A"}/5</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">This client reported a low satisfaction score. Follow up immediately.</div>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Client:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientEmail}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientPhone ? formatPhone(d.clientPhone) : "-"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Move Date:</td><td style="color:#E8E5E0;padding:4px 0">${d.moveDate ? dateDisplay(d.moveDate) : "-"}</td></tr>
      </table>
    </div>

    <div style="background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px">
      <div style="font-size:11px;color:#C9A962;font-weight:600">Action Required</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">Contact the client within 2 hours. Review request has been suppressed.</div>
    </div>
  `);
}

/* ── Referral Offer ── */

export interface ReferralOfferData {
  clientName: string;
  referralUrl: string;
}

export function referralOfferEmail(d: ReferralOfferData): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Give $50. Get $50.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${name ? `${name}, refer` : "Refer"} a friend to Yugo and you will both receive <strong style="color:#FFFFFF;">$50 off</strong> a residential move. Credits apply automatically when they book.</p>
    ${equinoxPromoCta(d.referralUrl, "Share Your Link")}
    ${equinoxPromoFinePrint("Residential moves only. One referral bonus per new customer.")}
  `);
}

/* ═══════════════════════════════════════════════════════════
   Quote Follow-Up Email Templates
   ═══════════════════════════════════════════════════════════ */

export interface QuoteFollowup1Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
}

export function quoteFollowup1Email(d: QuoteFollowup1Data): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${name ? `${name}, your` : "Your"} Yugo quote is ready.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">We have prepared a guaranteed flat-rate ${d.serviceLabel.toLowerCase()} quote for you. One transparent price, nothing added on the day.</p>
    ${equinoxPromoCta(d.quoteUrl, "View Your Quote")}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:#737373;text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `);
}

export interface QuoteFollowup2Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  moveDate: string | null;
  expiresAt: string | null;
  /** variant hint: warm | essential | cold (default) */
  tier?: string | null;
  /** set from cold variant — show inline urgency line */
  includeInlinePrices?: boolean;
  addons?: string[];
}

export function quoteFollowup2Email(d: QuoteFollowup2Data): string {
  const name = firstName(d.clientName);
  const isCold = d.includeInlinePrices;
  const isWarm = !isCold && d.tier;

  let heading: string;
  let body: string;
  let ctaLabel: string;

  const expiryText = (() => {
    if (!d.expiresAt) return null;
    const days = Math.max(0, Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / 86400000));
    return days <= 1 ? "Offer ends today." : `Offer ends in ${days} days.`;
  })();

  if (isWarm) {
    heading = name ? `${name}, your booking is almost complete.` : "Your booking is almost complete.";
    body = "Your preferred package is still available. Secure your date and rate whenever you are ready.";
    ctaLabel = "Complete My Booking";
  } else if (isCold) {
    heading = name ? `A note for you, ${name}.` : "A note about your quote.";
    body = "Your Yugo quote is still available for a few more days. One guaranteed flat rate, no hourly charges, nothing added at the end.";
    ctaLabel = "View Your Quote";
  } else {
    heading = name ? `A gentle reminder, ${name}.` : "A gentle reminder.";
    body = d.moveDate
      ? `Availability for <strong style="color:#FFFFFF;">${dateDisplay(d.moveDate)}</strong> is limited. Your guaranteed rate is held until your quote expires.`
      : "Your guaranteed flat-rate price is held until your quote expires. When you are ready, securing your date takes just a moment.";
    ctaLabel = "Secure My Date";
  }

  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${heading}</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${body}${expiryText ? `<br/><br/><span style="color:#FFFFFF;font-weight:600;">${expiryText}</span>` : ""}</p>
    ${equinoxPromoCta(d.quoteUrl, ctaLabel)}
    ${equinoxPromoFinePrint(`Need to adjust anything? Email <a href="mailto:${getClientSupportEmail()}" style="color:#737373;text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `);
}

export interface QuoteFollowup3Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  expiresAt: string | null;
  /** hot variant — payment was started */
  tier?: string | null;
}

/* ═══════════════════════════════════════════════════════════
   Cancellation Confirmation Email
   ═══════════════════════════════════════════════════════════ */

export interface CancellationConfirmData {
  clientName: string;
  moveCode: string;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  cancellationReason: string;
  refundAmount: number | null;
  trackingUrl: string;
}

export function cancellationConfirmEmail(d: CancellationConfirmData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#D14343">Cancellation confirmed</div>
    <h1 style="${EQ_H1}">Your booking is cancelled${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Move reference <strong style="color:#E8E8E8">${d.moveCode}</strong> has been cancelled. Details are below.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:22px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Cancelled move</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Reference</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:#B8962E;font-weight:700">${d.moveCode}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">From</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.fromAddress}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">To</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.toAddress}</td></tr>
      ${d.moveDate ? `<tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Date</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${dateDisplay(d.moveDate)}</td></tr>` : ""}
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED};vertical-align:top">Reason</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.cancellationReason}</td></tr>
    </table>

    ${d.refundAmount && d.refundAmount > 0 ? `
      <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.22);border-radius:2px;padding:20px;margin-bottom:22px;font-family:${EQ_SANS}">
        <div style="font-size:10px;color:#2D9F5A;text-transform:none;font-weight:700;letter-spacing:0.12em;margin-bottom:8px">Refund issued</div>
        <div style="font-size:26px;font-weight:700;color:#2D9F5A;margin-bottom:8px">${formatCurrency(d.refundAmount)}</div>
        <div style="font-size:12px;color:${EQ_MUTED};line-height:1.6">
          Refunds typically post within 3&ndash;5 business days; your bank may take up to 7 business days.
        </div>
      </div>
    ` : `
      <div style="background:rgba(212,138,41,0.08);border:1px solid rgba(212,138,41,0.22);border-radius:2px;padding:16px;margin-bottom:22px;font-family:${EQ_SANS}">
        <div style="font-size:12px;color:#D48A29;line-height:1.6">
          Per our cancellation policy, no refund applies. Email ${getClientSupportEmail()} with questions.
        </div>
      </div>
    `}

    <p style="${EQ_LEAD}">
      We hope to have the opportunity to serve you again. Please email ${getClientSupportEmail()} or visit our site whenever you are ready to rebook.
    </p>

    ${ctaButton(d.trackingUrl, "View cancellation details")}
  `);
}

/* ═══════════════════════════════════════════════════════════
   Updated Quote Email
   ═══════════════════════════════════════════════════════════ */

export interface QuoteUpdatedData {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  changesSummary: string;
}

export function quoteUpdatedEmail(d: QuoteUpdatedData): string {
  const name = firstName(d.clientName);
  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${name ? `${name}, your` : "Your"} quote has been updated.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0 0 18px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">We have revised your ${d.serviceLabel.toLowerCase()} quote. A summary of the changes is below.</p>
    <p style="font-size:14px;color:#DDDDDD;line-height:1.65;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;border-left:2px solid #FFFFFF;padding-left:16px;">${d.changesSummary}</p>
    ${equinoxPromoCta(d.quoteUrl, "Review Updated Quote")}
    ${equinoxPromoFinePrint(`Questions? Email <a href="mailto:${getClientSupportEmail()}" style="color:#737373;text-decoration:underline;">${getClientSupportEmail()}</a>`)}
  `);
}

/* ═══════════════════════════════════════════════════════════
   Balance Reminder & Auto-Charge Email Templates
   ═══════════════════════════════════════════════════════════ */

export interface BalanceReminder72hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  trackingUrl: string;
}

export function balanceReminder72hrEmail(d: BalanceReminder72hrData): string {
  return emailLayout(`
    <div style="${EQ_EYE}">Balance due</div>
    <h1 style="${EQ_H1}">Remaining balance${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Amount <strong style="color:#B8962E">${formatCurrency(d.balanceAmount)}</strong> is due before your move on <strong style="color:#E8E8E8">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="${EQ_PANEL}">
      <div style="font-size:10px;color:#B8962E;text-transform:none;font-weight:700;letter-spacing:0.12em;margin-bottom:12px">Automatic payment</div>
      <div style="background:rgba(184,150,46,0.08);border:1px solid rgba(184,150,46,0.2);border-radius:2px;padding:16px;font-family:${EQ_SANS}">
        <div style="font-size:13px;color:#B8962E;font-weight:700;margin-bottom:8px">Card on file</div>
        <div style="font-size:12px;color:${EQ_MUTED};line-height:1.65">
          We will charge <strong style="color:#E8E8E8">${formatCurrency(d.balanceAmount)}</strong> approximately 48 hours before your move. No action required.
        </div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View move details")}
    <p style="font-size:11px;color:${EQ_MUTED};text-align:center;font-family:${EQ_SANS}">
      Questions? Email ${getClientSupportEmail()} or call your coordinator.
    </p>
  `);
}

export interface BalanceReminder48hrData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  ccTotal: number;
  autoChargeDate: string | null;
  paymentPageUrl: string;
  trackingUrl: string;
}

export function balanceReminder48hrEmail(d: BalanceReminder48hrData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#D48A29">Balance due soon</div>
    <h1 style="${EQ_H1}">${formatCurrency(d.balanceAmount)} due${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your remaining balance will be charged to the card on file before your move on <strong style="color:#E8E8E8">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="margin-bottom:22px;font-family:${EQ_SANS}">
      <div style="background:rgba(184,150,46,0.1);border:1px solid rgba(184,150,46,0.28);border-radius:2px;padding:22px;text-align:center">
        <div style="font-size:10px;color:#B8962E;font-weight:700;text-transform:none;letter-spacing:0.12em;margin-bottom:10px">Scheduled charge</div>
        <div style="font-size:28px;font-weight:700;color:#B8962E;margin-bottom:10px;letter-spacing:0.02em">${formatCurrency(d.balanceAmount)}</div>
        <div style="font-size:12px;color:${EQ_MUTED};line-height:1.65">
          Charge date: <strong style="color:#E8E8E8">${dateDisplay(d.autoChargeDate)}</strong>. No action needed.
        </div>
      </div>
    </div>

    <p style="font-size:11px;color:${EQ_MUTED};text-align:center;font-family:${EQ_SANS}">
      Questions? Email ${getClientSupportEmail()} or call your coordinator.
    </p>
  `);
}

export interface BalanceAutoChargeReceiptData {
  clientName: string;
  moveCode: string;
  baseBalance: number;
  processingFee: number;
  transactionFee: number;
  totalCharged: number;
  trackingUrl: string;
}

export function balanceAutoChargeReceiptEmail(d: BalanceAutoChargeReceiptData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#2D9F5A">Payment charged</div>
    <h1 style="${EQ_H1}">Payment received${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      Your card on file was charged for the remaining balance on move <strong style="color:#B8962E">${d.moveCode}</strong>.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:20px;font-family:${EQ_SANS}">
      <tr>
        <td style="background-color:${EQ_CREME_HEAD};padding:10px 14px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.12em;text-transform:none;width:58%;">Description</td>
        <td align="right" style="background-color:${EQ_CREME_HEAD};padding:10px 14px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.12em;text-transform:none">Amount</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:12px 14px;font-size:12px;color:${EQ_VALUE}">Base balance</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.08);padding:12px 14px;font-size:12px;color:${EQ_VALUE}">${formatCurrency(d.baseBalance)}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 14px;font-size:12px;color:${EQ_MUTED}">Processing fee (3.3%)</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 14px;font-size:12px;color:${EQ_VALUE}">${formatCurrency(d.processingFee)}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 14px;font-size:12px;color:${EQ_MUTED}">Transaction fee</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.06);padding:12px 14px;font-size:12px;color:${EQ_VALUE}">${formatCurrency(d.transactionFee)}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.12);padding:14px 14px;font-size:12px;color:#B8962E;font-weight:700;text-transform:none;letter-spacing:0.08em">Total</td><td align="right" style="border-top:1px solid rgba(255,255,255,0.12);padding:14px 14px;font-size:15px;color:#B8962E;font-weight:700">${formatCurrency(d.totalCharged)}</td></tr>
    </table>

    <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.22);border-radius:2px;padding:16px;margin-bottom:22px;text-align:center;font-family:${EQ_SANS}">
      <div style="font-size:13px;color:#2D9F5A;font-weight:600">Your account is paid in full.</div>
    </div>

    ${ctaButton(d.trackingUrl, "View move details")}
  `);
}

export interface BalanceChargeFailedClientData {
  clientName: string;
  moveCode: string;
  balanceAmount: number;
}

export function balanceChargeFailedClientEmail(d: BalanceChargeFailedClientData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#D14343">Payment failed</div>
    <h1 style="${EQ_H1}">Action required${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="${EQ_LEAD}">
      We could not charge your card on file for <strong style="color:#D14343">${formatCurrency(d.balanceAmount)}</strong> (move <strong style="color:#B8962E">${d.moveCode}</strong>).
    </p>

    <div style="background:rgba(209,67,67,0.08);border:1px solid rgba(209,67,67,0.25);border-radius:2px;padding:22px;margin-bottom:22px;text-align:center;font-family:${EQ_SANS}">
      <div style="font-size:13px;color:#D14343;font-weight:600;margin-bottom:10px">Please contact us before your move.</div>
      <div style="font-size:15px;color:${EQ_VALUE};font-weight:700;letter-spacing:0.04em">1-833-333-YUGO (9846)</div>
    </div>

    <p style="font-size:12px;color:${EQ_MUTED};line-height:1.65;text-align:center;font-family:${EQ_SANS}">
      Or email ${getClientSupportEmail()}; your coordinator will follow up.
    </p>
  `);
}

export interface BalanceChargeFailedAdminData {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  moveDate: string | null;
  balanceAmount: number;
  errorMessage: string;
}

export function balanceChargeFailedAdminEmail(d: BalanceChargeFailedAdminData): string {
  return emailLayout(`
    <div style="${EQ_EYE};color:#D14343">Urgent</div>
    <h1 style="${EQ_H1}">${d.moveCode} - charge failed</h1>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.22);border-radius:2px;padding:16px;margin-bottom:20px;font-family:${EQ_SANS}">
      <div style="font-size:12px;color:#D14343;font-weight:600">Auto-charge ${formatCurrency(d.balanceAmount)} failed</div>
      <div style="font-size:11px;color:${EQ_MUTED};margin-top:6px">Error: ${d.errorMessage}</div>
    </div>

    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;border:1px solid rgba(255,255,255,0.14);margin-bottom:20px;font-family:${EQ_SANS}">
      <tr>
        <td colspan="2" style="background-color:${EQ_CREME_HEAD};padding:11px 16px;font-size:10px;font-weight:700;color:#B8962E;letter-spacing:0.14em;text-transform:none;">Client</td>
      </tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Name</td><td style="border-top:1px solid rgba(255,255,255,0.08);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.clientName}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Email</td><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.clientEmail}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Phone</td><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.clientPhone ? formatPhone(d.clientPhone) : "-"}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Move date</td><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_VALUE}">${d.moveDate ? dateDisplay(d.moveDate) : "-"}</td></tr>
      <tr><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:${EQ_MUTED}">Balance</td><td style="border-top:1px solid rgba(255,255,255,0.06);padding:11px 16px;font-size:12px;color:#D14343;font-weight:700">${formatCurrency(d.balanceAmount)}</td></tr>
    </table>

    <div style="background:rgba(184,150,46,0.1);border:1px solid rgba(184,150,46,0.22);border-radius:2px;padding:16px;font-family:${EQ_SANS}">
      <div style="font-size:10px;color:#B8962E;font-weight:700;letter-spacing:0.1em;text-transform:none;margin-bottom:6px">Action required</div>
      <div style="font-size:12px;color:${EQ_MUTED}">Contact the client immediately. Move is imminent and balance is unpaid.</div>
    </div>
  `);
}

export function quoteFollowup3Email(d: QuoteFollowup3Data): string {
  const name = firstName(d.clientName);
  const isHot = (d as QuoteFollowup3Data & { tier?: string }).tier === "hot";
  const expiryDisplay = d.expiresAt ? dateDisplay(d.expiresAt) : null;
  const heading = isHot
    ? (name ? `${name}, pick up where you left off.` : "Pick up where you left off.")
    : (name ? `${name}, your quote is expiring soon.` : "Your quote is expiring soon.");
  const body = isHot
    ? "Your quote is still active. Complete your booking whenever you are ready and your date will be secured."
    : `Your ${d.serviceLabel.toLowerCase()} quote ${expiryDisplay ? `expires <strong style="color:#FFFFFF;">${expiryDisplay}</strong>` : "is expiring soon"}. After that, we will need to refresh your rate based on availability.`;

  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${heading}</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${body}</p>
    ${equinoxPromoCta(d.quoteUrl, isHot ? "Complete Booking" : "View Your Quote")}
    ${equinoxPromoFinePrint(`Need more time? Email <a href="mailto:${getClientSupportEmail()}" style="color:#737373;text-decoration:underline;">${getClientSupportEmail()}</a> and we will be happy to help.`)}
  `);
}

/* ── Post-move: 72hr Perks & Referral Email ── */

export interface PostMovePerksEmailData {
  clientName: string;
  moveCode: string;
  referralCode: string | null;
  referredDiscount: number;
  referrerCredit: number;
  trackingUrl: string;
  activePerks: { title: string; description: string | null; offer_type: string; discount_value: number | null; redemption_code: string | null; redemption_url: string | null }[];
}

export function postMovePerksEmail(d: PostMovePerksEmailData): string {
  const name = firstName(d.clientName);

  const perksHtml = d.activePerks.length > 0
    ? d.activePerks.map((p) => {
        const offerLabel =
          p.offer_type === "percentage_off" && p.discount_value ? `${p.discount_value}% off` :
          p.offer_type === "dollar_off" && p.discount_value ? `$${p.discount_value} off` :
          p.offer_type === "free_service" ? "Free service" :
          p.offer_type === "consultation" ? "Free consultation" :
          "Special offer";
        return `
          <div style="border-top:1px solid rgba(255,255,255,0.1);padding:16px 0;">
            <div style="font-size:13px;font-weight:600;color:#FFFFFF;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin-bottom:4px;">${p.title} <span style="font-size:10px;color:#737373;font-weight:400;">- ${offerLabel}</span></div>
            ${p.description ? `<div style="font-size:13px;color:#A3A3A3;margin-bottom:8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${p.description}</div>` : ""}
            ${p.redemption_code ? `<span style="font-family:monospace;font-size:12px;font-weight:700;color:#FFFFFF;letter-spacing:0.08em;">${p.redemption_code}</span>` : ""}
            ${p.redemption_url ? `<a href="${p.redemption_url}" style="font-size:12px;color:#FFFFFF;text-decoration:underline;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;margin-left:${p.redemption_code ? "12px" : "0"};">Redeem</a>` : ""}
          </div>
        `;
      }).join("")
    : "";

  const referralBlock = d.referralCode
    ? `
      <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:28px 0 8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Know someone planning a move? Share your code and they receive <strong style="color:#FFFFFF;">$${d.referredDiscount} off</strong>. You earn a <strong style="color:#FFFFFF;">$${d.referrerCredit} credit</strong> as our thank you.</p>
      <div style="border:1px solid rgba(255,255,255,0.2);padding:20px;text-align:center;margin-bottom:8px;">
        <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.2em;color:#FFFFFF;">${d.referralCode}</div>
        <div style="font-size:11px;color:#595959;margin-top:6px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your referral code</div>
      </div>
    `
    : "";

  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">${name ? `${name}, your` : "Your"} move is complete.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Thank you for trusting Yugo with your home. Your exclusive post-move perks are waiting below.</p>
    ${perksHtml ? `<div style="margin-top:8px;">${perksHtml}</div>` : ""}
    ${referralBlock}
    ${equinoxPromoCta(d.trackingUrl, "View Move Summary")}
  `);
}

/* ── Post-move: 365-day Anniversary Email ── */

export interface MoveAnniversaryEmailData {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string | null;
  toAddress: string | null;
  referralCode: string | null;
  referredDiscount: number;
}

export function moveAnniversaryEmail(d: MoveAnniversaryEmailData): string {
  const name = firstName(d.clientName);
  const moveDateStr = d.moveDate
    ? new Date(d.moveDate + "T00:00:00").toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" })
    : "last year";
  const route = d.fromAddress && d.toAddress
    ? ` from ${d.fromAddress.split(",")[0]} to ${d.toAddress.split(",")[0]}`
    : "";

  return equinoxPromoLayout(`
    <h1 style="font-size:30px;font-weight:700;color:#FFFFFF;margin:0 0 18px;letter-spacing:-0.01em;line-height:1.15;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">One year${name ? `, ${name}` : ""}.</h1>
    <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:0;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">We had the pleasure of moving you${route} on <strong style="color:#FFFFFF;">${moveDateStr}</strong>. We hope you have settled in beautifully.</p>
    ${d.referralCode ? `
      <p style="font-size:15px;color:#A3A3A3;line-height:1.6;margin:28px 0 8px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Planning another move, or know someone who is? Your referral code gives them <strong style="color:#FFFFFF;">$${d.referredDiscount} off</strong>.</p>
      <div style="border:1px solid rgba(255,255,255,0.2);padding:20px;text-align:center;">
        <div style="font-family:monospace;font-size:22px;font-weight:700;letter-spacing:0.2em;color:#FFFFFF;">${d.referralCode}</div>
        <div style="font-size:11px;color:#595959;margin-top:6px;font-family:Helvetica Neue,Helvetica,Arial,sans-serif;">Your referral code</div>
      </div>
    ` : ""}
    ${equinoxPromoFinePrint(`Planning your next move? Email <a href="mailto:${getClientSupportEmail()}" style="color:#737373;text-decoration:underline;">${getClientSupportEmail()}</a> and we would be glad to help.`)}
  `);
}

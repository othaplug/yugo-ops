import { emailLayout } from "@/lib/email-templates";
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

function ctaButton(url: string, label: string): string {
  return `
    <a href="${url}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:24px 0 16px">
      ${label}
    </a>
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
  if (fromAccessLabel && fromAccessLabel !== "None")
    accessNotes.push(`<strong>Pickup access:</strong> ${fromAccessLabel} &mdash; please reserve the elevator/loading dock.`);
  if (toAccessLabel && toAccessLabel !== "None")
    accessNotes.push(`<strong>Drop-off access:</strong> ${toAccessLabel} &mdash; please reserve the elevator/loading dock.`);

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">3 Days To Go</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your move is almost here${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move is scheduled for <strong style="color:#E8E5E0">${dateDisplay(d.moveDate)}</strong>. Here&apos;s a quick checklist to make sure everything goes smoothly.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Pre-Move Checklist</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:2">
        <div>&#9744; Book elevator/loading dock at both locations</div>
        <div>&#9744; Reserve parking spots for our truck</div>
        <div>&#9744; Finish packing boxes (if self-packing)</div>
        <div>&#9744; Clear hallways and pathways</div>
        <div>&#9744; Arrange care for pets and small children</div>
        <div>&#9744; Separate valuables and personal documents to carry yourself</div>
        <div>&#9744; Defrost freezer and empty fridge</div>
      </div>
    </div>

    ${accessNotes.length > 0 ? `
      <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
        <div style="font-size:11px;color:#C9A962;font-weight:600;margin-bottom:6px">Access Notes</div>
        <div style="font-size:12px;color:#B8B5B0;line-height:1.6">
          ${accessNotes.join("<br/>")}
        </div>
      </div>
    ` : ""}

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:16px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Reference:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${d.moveCode}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.toAddress}</td></tr>
      </table>
    </div>

    ${ctaButton(d.trackingUrl, "Track Your Move")}
    <p style="font-size:11px;color:#666;text-align:center">
      Questions? Reply to this email or call your coordinator.
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
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Tomorrow&apos;s the Day</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your crew is ready${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Everything is set for your move tomorrow. Here are the details.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Crew Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        ${d.crewLeadName ? `<tr><td style="color:#666;padding:4px 0">Crew Lead:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${d.crewLeadName}</td></tr>` : ""}
        ${d.crewSize ? `<tr><td style="color:#666;padding:4px 0">Crew Size:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${d.crewSize} movers</td></tr>` : ""}
        ${d.truckInfo ? `<tr><td style="color:#666;padding:4px 0">Truck:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${d.truckInfo}</td></tr>` : ""}
        <tr><td style="color:#666;padding:4px 0">Arrival:</td><td style="color:#C9A962;font-weight:600;padding:4px 0;text-align:right">${d.arrivalWindow ?? "Morning — we'll confirm exact time"}</td></tr>
      </table>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Move Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Date:</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${dateDisplay(d.moveDate)}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.toAddress}</td></tr>
      </table>
    </div>

    ${d.coordinatorName ? `
      <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
        <div style="font-size:11px;color:#C9A962;font-weight:600">Your Coordinator</div>
        <div style="font-size:13px;color:#E8E5E0;margin-top:4px">${d.coordinatorName}${d.coordinatorPhone ? ` &middot; ${formatPhone(d.coordinatorPhone)}` : ""}</div>
        <div style="font-size:11px;color:#999;margin-top:2px">Available by phone or text for any last-minute questions.</div>
      </div>
    ` : ""}

    ${ctaButton(d.trackingUrl, "Track Your Move Live")}
    <p style="font-size:11px;color:#666;text-align:center">
      Our crew will call 30 minutes before arrival. See you tomorrow!
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
    <div style="font-size:9px;font-weight:700;color:#2D9F5A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Payment Received</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Balance paid${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We&apos;ve received your balance payment. Your account is now paid in full.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Reference:</td><td style="color:#C9A962;font-weight:600;padding:4px 0;text-align:right">${d.moveCode}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Balance Paid:</td><td style="color:#2D9F5A;font-weight:600;padding:4px 0;text-align:right">${formatCurrency(d.amount)}</td></tr>
        ${d.paymentMethod ? `<tr><td style="color:#666;padding:4px 0">Method:</td><td style="color:#E8E5E0;padding:4px 0;text-align:right">${d.paymentMethod}</td></tr>` : ""}
        <tr><td colspan="2" style="border-top:1px solid #2A2A2A;padding:0;height:8px"></td></tr>
        <tr><td style="color:#666;padding:4px 0">Total Paid:</td><td style="color:#E8E5E0;font-weight:700;padding:4px 0;text-align:right">${formatCurrency(d.totalPaid)}</td></tr>
      </table>
    </div>

    ${ctaButton(d.trackingUrl, "View Move Details")}
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
    <div style="font-size:9px;font-weight:700;color:#2D9F5A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Move Complete</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">You&apos;re all moved in${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move has been completed. We hope everything went perfectly. All your move documents and receipts are available in your tracking portal.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Reference:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${d.moveCode}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.toAddress}</td></tr>
        ${d.completedDate ? `<tr><td style="color:#666;padding:3px 0">Completed:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${dateDisplay(d.completedDate)}</td></tr>` : ""}
      </table>
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What&apos;s Next</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>1. Your receipts and documents are in your portal</div>
        <div>2. We&apos;ll send a brief satisfaction survey</div>
        <div>3. Enjoy your new space!</div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View Your Move Portal")}
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">How Was Your Move?</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We&apos;d love your feedback${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your review helps other families find a mover they can trust. It only takes 30 seconds.
    </p>

    <a href="${d.googleReviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:0 0 24px">
      Leave a Google Review
    </a>

    ${d.referralUrl ? `
      <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
        <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:8px">Refer a Friend</div>
        <div style="font-family:serif;font-size:24px;font-weight:700;color:#F5F5F3;margin-bottom:6px">Give $50, Get $50</div>
        <p style="font-size:12px;color:#B8B5B0;margin:0 0 14px">
          Share your referral link and you both save on your next move.
        </p>
        <a href="${d.referralUrl}" style="display:inline-block;background:transparent;color:#C9A962;padding:8px 22px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.4px;text-decoration:none;border:1px solid rgba(201,169,98,0.4)">
          Share Referral Link
        </a>
      </div>
    ` : ""}

    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing YUGO+. We can&apos;t wait to move you again!
    </p>
  `);
}

/* ── Tier-specific Review Request (2h after completion) ── */

export interface ReviewRequestTierData {
  clientName: string;
  tier: "curated" | "signature" | "estate" | string;
  reviewUrl: string;
  referralUrl?: string | null;
  trackingUrl: string;
  coordinatorName?: string | null;
}

/** @deprecated Use reviewRequestCuratedEmail */
export const reviewRequestEssentialsEmail = (d: ReviewRequestTierData): string => reviewRequestCuratedEmail(d);

export function reviewRequestCuratedEmail(d: ReviewRequestTierData): string {
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">How Was Your Yugo Move?</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">How was your Yugo move${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}?</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move is complete, and we hope everything went smoothly.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If you have a moment, we&apos;d be grateful for a Google review. Your feedback helps other families find reliable movers and helps our crew know they&apos;re doing a great job.
    </p>
    <a href="${d.reviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:0 0 24px">
      ★★★★★ Leave a Review
    </a>
    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing Yugo. — The Yugo Team
    </p>
  `);
}

/** @deprecated Use reviewRequestSignatureEmail */
export const reviewRequestPremierEmail = (d: ReviewRequestTierData): string => reviewRequestSignatureEmail(d);

export function reviewRequestSignatureEmail(d: ReviewRequestTierData): string {
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">We&apos;d Love Your Feedback</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We&apos;d love your feedback${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move is complete, and we hope everything went smoothly.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If you have a moment, we&apos;d be grateful for a Google review. Your feedback helps other families find reliable movers and helps our crew know they&apos;re doing a great job.
    </p>
    <a href="${d.reviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:0 0 24px">
      ★★★★★ Leave a Review
    </a>
    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing Yugo. — The Yugo Team
    </p>
  `);
}

export function reviewRequestEstateEmail(d: ReviewRequestTierData): string {
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">How Did We Do?</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">${firstName(d.clientName) || "Dear Client"}, it was our privilege — how did we do?</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Thank you for choosing Yugo for your move. It was a privilege to take care of your home and belongings.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If your experience was as exceptional as we aimed for, we would be honoured by a brief review. It helps families like yours find the level of care they deserve.
    </p>
    <a href="${d.reviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:0 0 24px">
      ★★★★★ Share Your Experience
    </a>
    <p style="font-size:11px;color:#666;text-align:center">
      With gratitude,<br/>${d.coordinatorName || "The Yugo Team"}<br/>Yugo — The Art of Moving
    </p>
  `);
}

export interface ReviewRequestReminderData {
  clientName: string;
  reviewUrl: string;
}

export function reviewRequestReminderEmail(d: ReviewRequestReminderData): string {
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Quick Reminder</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Quick reminder — your Yugo review</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We know you&apos;re busy settling in. If you have 30 seconds, a quick review means the world to our team.
    </p>
    <a href="${d.reviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:11px 28px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;text-align:center;margin:0 0 24px">
      ★★★★★ Leave a Review
    </a>
    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing Yugo.
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D48A29;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">We Want to Make It Right</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We&apos;re sorry${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We understand your recent move didn&apos;t meet expectations, and we sincerely apologize. Your satisfaction is our priority and we want to make this right.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;color:#B8B5B0;line-height:1.7">
        <div>Your coordinator is standing by to resolve this personally:</div>
        ${d.coordinatorName ? `<div style="color:#E8E5E0;font-weight:600;margin-top:8px">${d.coordinatorName}</div>` : ""}
        ${d.coordinatorPhone ? `<div style="color:#C9A962;margin-top:4px">${formatPhone(d.coordinatorPhone)}</div>` : ""}
        ${d.coordinatorEmail ? `<div style="color:#C9A962;margin-top:4px">${d.coordinatorEmail}</div>` : ""}
      </div>
    </div>

    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Please reply to this email or call us directly. We&apos;ll work with you until you&apos;re completely satisfied.
    </p>

    ${ctaButton(d.trackingUrl, "View Your Move Details")}
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Low Satisfaction Alert</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${d.moveCode} &mdash; ${d.clientName}</h1>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
      <div style="font-size:12px;color:#D14343;font-weight:600">NPS/Satisfaction Score: ${d.npsScore ?? "N/A"}/5</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">This client reported a low satisfaction score. Follow up immediately.</div>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Client:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientEmail}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientPhone ? formatPhone(d.clientPhone) : "—"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Move Date:</td><td style="color:#E8E5E0;padding:4px 0">${d.moveDate ? dateDisplay(d.moveDate) : "—"}</td></tr>
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Exclusive Offer</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Give $50, Get $50</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Hi${firstName(d.clientName) ? ` ${firstName(d.clientName)}` : ""}, thanks for moving with YUGO+! As a thank you, here&apos;s an exclusive offer: refer a friend and you both get $50 off.
    </p>

    <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:24px;text-align:center;margin-bottom:20px">
      <div style="font-family:serif;font-size:32px;font-weight:700;color:#C9A962;margin-bottom:8px">$50</div>
      <div style="font-size:13px;color:#B8B5B0">for you and your friend</div>
    </div>

    <div style="font-size:13px;color:#B8B5B0;line-height:1.8;margin-bottom:24px">
      <div><strong style="color:#E8E5E0">How it works:</strong></div>
      <div>1. Share your unique link with a friend</div>
      <div>2. They book a residential move with YUGO+</div>
      <div>3. You both get $50 off &mdash; applied automatically</div>
    </div>

    ${ctaButton(d.referralUrl, "Share Your Referral Link")}

    <p style="font-size:11px;color:#666;text-align:center">
      Valid for residential moves only. One referral bonus per friend.
    </p>
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Quote Is Ready</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Just checking in${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We sent your ${d.serviceLabel.toLowerCase()} quote yesterday but noticed you haven&apos;t had a chance to review it yet.
    </p>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your personalized quote is waiting for you &mdash; it includes flat-rate pricing with no hidden fees, multiple package options, and everything you need to book with confidence.
    </p>

    ${ctaButton(d.quoteUrl, "View Your Quote")}

    <p style="font-size:11px;color:#666;text-align:center">
      Have questions? Simply reply to this email and your coordinator will get back to you right away.
    </p>
  `);
}

export interface QuoteFollowup2Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  moveDate: string | null;
  expiresAt: string | null;
}

export function quoteFollowup2Email(d: QuoteFollowup2Data): string {
  const moveDateStr = dateDisplay(d.moveDate);
  let urgencyLine = "";
  if (d.expiresAt) {
    const daysLeft = Math.max(
      0,
      Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
    );
    urgencyLine = daysLeft <= 1
      ? "Your quote expires tomorrow."
      : `Your quote expires in ${daysLeft} days.`;
  }

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D48A29;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Don&apos;t Miss Out</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your date is filling up${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We noticed you reviewed your ${d.serviceLabel.toLowerCase()} quote but haven&apos;t booked yet. We wanted to let you know that availability for <strong style="color:#E8E5E0">${moveDateStr}</strong> is limited.
    </p>

    ${urgencyLine ? `
      <div style="background:rgba(212,138,41,0.1);border:1px solid rgba(212,138,41,0.25);border-radius:8px;padding:14px;margin-bottom:20px;text-align:center">
        <div style="font-size:13px;color:#D48A29;font-weight:600">${urgencyLine}</div>
      </div>
    ` : ""}

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">Why Book Now</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&#10003; Lock in your flat-rate price &mdash; no surprises</div>
        <div>&#10003; Secure your preferred date before it&apos;s taken</div>
        <div>&#10003; Only a $100 deposit to reserve &mdash; balance due later</div>
        <div>&#10003; Full refund if you cancel within the policy window</div>
      </div>
    </div>

    ${ctaButton(d.quoteUrl, "Secure Your Date")}

    <p style="font-size:11px;color:#666;text-align:center">
      Need to adjust anything? Reply to this email and we&apos;ll update your quote.
    </p>
  `);
}

export interface QuoteFollowup3Data {
  clientName: string;
  quoteUrl: string;
  serviceLabel: string;
  expiresAt: string | null;
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
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Cancellation Confirmed</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your move has been cancelled${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We&apos;re sorry to see you go. Your move <strong style="color:#E8E5E0">${d.moveCode}</strong> has been cancelled.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Cancelled Move</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Reference:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${d.moveCode}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.toAddress}</td></tr>
        ${d.moveDate ? `<tr><td style="color:#666;padding:3px 0">Date:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${dateDisplay(d.moveDate)}</td></tr>` : ""}
        <tr><td style="color:#666;padding:3px 0">Reason:</td><td style="color:#E8E5E0;padding:3px 0;text-align:right">${d.cancellationReason}</td></tr>
      </table>
    </div>

    ${d.refundAmount && d.refundAmount > 0 ? `
      <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.2);border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:9px;color:#2D9F5A;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Refund Issued</div>
        <div style="font-family:serif;font-size:24px;font-weight:700;color:#2D9F5A;margin-bottom:6px">${formatCurrency(d.refundAmount)}</div>
        <div style="font-size:12px;color:#B8B5B0">
          Your refund has been submitted and will appear on your statement within 3&ndash;5 business days. Depending on your bank, it may take up to 7 business days.
        </div>
      </div>
    ` : `
      <div style="background:rgba(212,138,41,0.08);border:1px solid rgba(212,138,41,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
        <div style="font-size:12px;color:#D48A29">
          Based on our cancellation policy, no refund is applicable for this cancellation. If you have questions, please reply to this email.
        </div>
      </div>
    `}

    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If you need to rebook in the future, we&apos;d love to help. Just reply to this email or visit our website anytime.
    </p>

    ${ctaButton(d.trackingUrl, "View Cancellation Details")}
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
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Quote Updated</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your updated quote is ready${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We&apos;ve updated your ${d.serviceLabel.toLowerCase()} quote based on the changes discussed. Please review the updated pricing below.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What Changed</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.7">${d.changesSummary}</div>
    </div>

    ${ctaButton(d.quoteUrl, "View Updated Quote")}

    <p style="font-size:11px;color:#666;text-align:center">
      This replaces your previous quote. The previous link will redirect here.
    </p>
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
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Balance Due</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your remaining balance is due${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your remaining balance of <strong style="color:#C9A962">${formatCurrency(d.balanceAmount)}</strong> is due before your move on <strong style="color:#E8E5E0">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Payment Options</div>

      <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.2);border-radius:8px;padding:14px;margin-bottom:12px">
        <div style="font-size:13px;color:#2D9F5A;font-weight:700;margin-bottom:6px">Option 1: E-Transfer — No fee</div>
        <div style="font-size:12px;color:#B8B5B0;line-height:1.6">
          Send <strong style="color:#E8E5E0">${formatCurrency(d.balanceAmount)}</strong> via e-transfer to:<br/>
          <strong style="color:#C9A962">payments@helloyugo.com</strong><br/>
          Reference: <strong style="color:#E8E5E0">${d.moveCode}</strong>
        </div>
      </div>

      <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px">
        <div style="font-size:13px;color:#C9A962;font-weight:700;margin-bottom:6px">Option 2: Credit Card — Charged 24 hours before your move</div>
        <div style="font-size:12px;color:#B8B5B0;line-height:1.6">
          We&apos;ll charge your card on file 24 hours before your move.<br/>
          Credit card payments include a <strong style="color:#E8E5E0">3.3% processing fee</strong>.
        </div>
      </div>
    </div>

    ${ctaButton(d.trackingUrl, "View Move Details")}
    <p style="font-size:11px;color:#666;text-align:center">
      Questions? Reply to this email or call your coordinator.
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
    <div style="font-size:9px;font-weight:700;color:#D48A29;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Balance Due</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your balance of ${formatCurrency(d.balanceAmount)} is due${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Choose how to pay your remaining balance before your move on <strong style="color:#E8E5E0">${dateDisplay(d.moveDate)}</strong>.
    </p>

    <div style="margin-bottom:20px">
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border-spacing:0 10px">
        <tr>
          <td style="background:rgba(45,159,90,0.1);border:1px solid rgba(45,159,90,0.3);border-radius:10px;padding:20px;text-align:center">
            <div style="font-size:11px;color:#2D9F5A;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">E-Transfer — $0 fee</div>
            <div style="font-family:serif;font-size:24px;font-weight:700;color:#2D9F5A;margin-bottom:10px">${formatCurrency(d.balanceAmount)}</div>
            <div style="font-size:12px;color:#B8B5B0;line-height:1.6;margin-bottom:14px">
              Send to <strong style="color:#C9A962">payments@helloyugo.com</strong><br/>
              Reference: <strong style="color:#E8E5E0">${d.moveCode}</strong>
            </div>
          </td>
        </tr>
        <tr>
          <td style="background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:20px;text-align:center">
            <div style="font-size:11px;color:#C9A962;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Credit Card — Includes processing fee</div>
            <div style="font-family:serif;font-size:24px;font-weight:700;color:#C9A962;margin-bottom:10px">${formatCurrency(d.ccTotal)}</div>
            <a href="${d.paymentPageUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:9px 22px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:0.5px;text-decoration:none;margin-top:4px">
              Pay by Credit Card
            </a>
          </td>
        </tr>
      </table>
    </div>

    <div style="background:rgba(212,138,41,0.1);border:1px solid rgba(212,138,41,0.2);border-radius:8px;padding:14px;margin-bottom:20px;text-align:center">
      <div style="font-size:12px;color:#D48A29;line-height:1.6">
        If no payment is received, your card on file will be automatically charged <strong style="color:#E8E5E0">${formatCurrency(d.ccTotal)}</strong> on <strong style="color:#E8E5E0">${dateDisplay(d.autoChargeDate)}</strong>.
      </div>
    </div>

    <p style="font-size:11px;color:#666;text-align:center">
      Questions? Reply to this email or call your coordinator.
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
    <div style="font-size:9px;font-weight:700;color:#2D9F5A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Payment Charged</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Balance payment received${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your card on file has been charged for the remaining balance on move <strong style="color:#C9A962">${d.moveCode}</strong>.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Payment Breakdown</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Base balance:</td><td style="color:#E8E5E0;padding:4px 0;text-align:right">${formatCurrency(d.baseBalance)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Processing fee (3.3%):</td><td style="color:#E8E5E0;padding:4px 0;text-align:right">${formatCurrency(d.processingFee)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Transaction fee:</td><td style="color:#E8E5E0;padding:4px 0;text-align:right">${formatCurrency(d.transactionFee)}</td></tr>
        <tr><td colspan="2" style="border-top:1px solid #2A2A2A;padding:0;height:8px"></td></tr>
        <tr><td style="color:#2D9F5A;font-weight:700;padding:4px 0">Total charged:</td><td style="color:#2D9F5A;font-weight:700;font-size:14px;padding:4px 0;text-align:right">${formatCurrency(d.totalCharged)}</td></tr>
      </table>
    </div>

    <div style="background:rgba(45,159,90,0.08);border:1px solid rgba(45,159,90,0.2);border-radius:8px;padding:14px;margin-bottom:20px;text-align:center">
      <div style="font-size:13px;color:#2D9F5A;font-weight:600">Your account is now paid in full.</div>
    </div>

    ${ctaButton(d.trackingUrl, "View Move Details")}
  `);
}

export interface BalanceChargeFailedClientData {
  clientName: string;
  moveCode: string;
  balanceAmount: number;
}

export function balanceChargeFailedClientEmail(d: BalanceChargeFailedClientData): string {
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Payment Failed</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We couldn&apos;t process your payment${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We attempted to charge your card on file for the remaining balance of <strong style="color:#D14343">${formatCurrency(d.balanceAmount)}</strong> on move <strong style="color:#C9A962">${d.moveCode}</strong>, but the payment was declined.
    </p>

    <div style="background:rgba(209,67,67,0.08);border:1px solid rgba(209,67,67,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:13px;color:#D14343;font-weight:600;margin-bottom:8px">Please call us to resolve this before your move.</div>
      <div style="font-size:14px;color:#E8E5E0;font-weight:700;margin-top:8px">1-833-333-YUGO (9846)</div>
    </div>

    <p style="font-size:12px;color:#B8B5B0;line-height:1.6;text-align:center">
      You can also reply to this email and your coordinator will follow up.
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
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">URGENT: Payment Failed</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${d.moveCode} &mdash; Balance charge failed</h1>

    <div style="background:rgba(209,67,67,0.1);border:1px solid rgba(209,67,67,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
      <div style="font-size:12px;color:#D14343;font-weight:600">Auto-charge for ${formatCurrency(d.balanceAmount)} failed</div>
      <div style="font-size:11px;color:#B8B5B0;margin-top:4px">Error: ${d.errorMessage}</div>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Client:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientEmail}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientPhone ? formatPhone(d.clientPhone) : "&mdash;"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Move Date:</td><td style="color:#E8E5E0;padding:4px 0">${d.moveDate ? dateDisplay(d.moveDate) : "&mdash;"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Balance:</td><td style="color:#D14343;font-weight:600;padding:4px 0">${formatCurrency(d.balanceAmount)}</td></tr>
      </table>
    </div>

    <div style="background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px">
      <div style="font-size:11px;color:#C9A962;font-weight:600">Action Required</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">Contact client immediately. Move is tomorrow and balance is unpaid.</div>
    </div>
  `);
}

export function quoteFollowup3Email(d: QuoteFollowup3Data): string {
  const expiryDate = d.expiresAt
    ? new Date(d.expiresAt).toLocaleDateString("en-CA", { month: "long", day: "numeric" })
    : "soon";

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#D14343;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Final Reminder</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Last chance${firstName(d.clientName) ? `, ${firstName(d.clientName)}` : ""}</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your ${d.serviceLabel.toLowerCase()} quote expires <strong style="color:#D14343">${expiryDate}</strong>. After that, we won&apos;t be able to guarantee the same pricing or availability.
    </p>

    <div style="background:rgba(209,67,67,0.08);border:1px solid rgba(209,67,67,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
      <div style="font-size:11px;color:#D14343;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:6px">Quote Expiring</div>
      <div style="font-size:14px;color:#B8B5B0">
        Your flat-rate pricing and date availability will no longer be held after expiry.
      </div>
    </div>

    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      If your plans have changed, no worries at all. But if you&apos;d still like to move forward, now is the time to lock it in.
    </p>

    ${ctaButton(d.quoteUrl, "Book Before It Expires")}

    <p style="font-size:11px;color:#666;text-align:center">
      Need more time? Reply and we can extend your quote or adjust the details.
    </p>
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
    ? `
      <div style="margin-bottom:24px">
        <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Your Yugo Perks</div>
        ${d.activePerks.map((p) => {
          const offerLabel =
            p.offer_type === "percentage_off" && p.discount_value ? `${p.discount_value}% off` :
            p.offer_type === "dollar_off" && p.discount_value ? `$${p.discount_value} off` :
            p.offer_type === "free_service" ? "Free service" :
            p.offer_type === "consultation" ? "Free consultation" :
            "Special offer";
          return `
            <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:16px;margin-bottom:10px">
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">
                <span style="font-size:13px;font-weight:600;color:#F5F5F3">${p.title}</span>
                <span style="font-size:9px;font-weight:700;color:#C9A962;background:rgba(201,169,98,0.12);padding:3px 8px;border-radius:999px;white-space:nowrap;margin-left:8px">${offerLabel}</span>
              </div>
              ${p.description ? `<p style="font-size:12px;color:#888;margin:0 0 8px;line-height:1.5">${p.description}</p>` : ""}
              ${p.redemption_code ? `<span style="font-family:monospace;font-size:11px;font-weight:600;color:#C9A962;background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.2);padding:4px 10px;border-radius:6px">${p.redemption_code}</span>` : ""}
              ${p.redemption_url ? `<a href="${p.redemption_url}" style="font-size:11px;color:#C9A962;text-decoration:underline;margin-left:${p.redemption_code ? "12px" : "0"}">Redeem →</a>` : ""}
            </div>
          `;
        }).join("")}
      </div>
    `
    : "";

  const referralHtml = d.referralCode
    ? `
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:12px">Refer a Friend</div>
        <p style="font-size:13px;color:#B8B5B0;line-height:1.6;margin:0 0 16px">
          Know someone moving soon? Share your unique code and they&apos;ll get <strong style="color:#F5F5F3">$${d.referredDiscount} off</strong> their first Yugo move. When they book, you earn a <strong style="color:#F5F5F3">$${d.referrerCredit} credit</strong>.
        </p>
        <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.25);border-radius:8px;padding:14px;text-align:center">
          <div style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:3px;color:#C9A962">${d.referralCode}</div>
          <div style="font-size:10px;color:#666;margin-top:4px">Your personal referral code</div>
        </div>
      </div>
    `
    : "";

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Move Perks</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">
      Thanks for moving with Yugo${name ? `, ${name}` : ""}!
    </h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move <strong style="color:#C9A962">${d.moveCode}</strong> is complete. Here are some exclusive perks and a way to share the Yugo experience with friends.
    </p>

    ${perksHtml}
    ${referralHtml}

    ${ctaButton(d.trackingUrl, "View Your Move")}
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

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Move Anniversary</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">
      One year since your move${name ? `, ${name}` : ""}!
    </h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      It&apos;s been a whole year since we helped you move on <strong style="color:#E8E5E0">${moveDateStr}</strong>
      ${d.fromAddress && d.toAddress ? ` from ${d.fromAddress.split(",")[0]} to ${d.toAddress.split(",")[0]}` : ""}.
      We hope you&apos;re loving your new home!
    </p>

    ${d.referralCode ? `
    <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.25);border-radius:10px;padding:20px;margin-bottom:24px;text-align:center">
      <p style="font-size:13px;color:#B8B5B0;margin:0 0 12px;line-height:1.6">
        Moving again or know someone who is? Share your code for <strong style="color:#F5F5F3">$${d.referredDiscount} off</strong>.
      </p>
      <div style="font-family:monospace;font-size:20px;font-weight:700;letter-spacing:3px;color:#C9A962">${d.referralCode}</div>
    </div>
    ` : ""}

    <p style="font-size:12px;color:#666;text-align:center;line-height:1.6">
      Need to move again? We&apos;d love to help. Reply to this email or visit yugomoves.com.
    </p>
  `);
}

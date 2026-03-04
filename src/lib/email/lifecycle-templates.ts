import { emailLayout } from "@/lib/email-templates";
import { formatCurrency } from "@/lib/format-currency";

/* ═══════════════════════════════════════════════════════════
   Pre-Move, Post-Move, Review & Lifecycle Email Templates
   ═══════════════════════════════════════════════════════════ */

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
    <a href="${url}" style="display:block;background:#C9A962;color:#0D0D0D;padding:16px 28px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;text-align:center;margin:24px 0 16px">
      ${label} &rarr;
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
  if (d.fromAccess && d.fromAccess !== "none")
    accessNotes.push(`<strong>Pickup access:</strong> ${d.fromAccess} &mdash; please reserve the elevator/loading dock.`);
  if (d.toAccess && d.toAccess !== "none")
    accessNotes.push(`<strong>Drop-off access:</strong> ${d.toAccess} &mdash; please reserve the elevator/loading dock.`);

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">3 Days To Go</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your move is almost here${d.clientName ? `, ${d.clientName}` : ""}!</h1>
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
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your crew is ready${d.clientName ? `, ${d.clientName}` : ""}!</h1>
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
        <div style="font-size:13px;color:#E8E5E0;margin-top:4px">${d.coordinatorName}${d.coordinatorPhone ? ` &middot; ${d.coordinatorPhone}` : ""}</div>
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
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Balance paid${d.clientName ? `, ${d.clientName}` : ""}!</h1>
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
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">You&apos;re all moved in${d.clientName ? `, ${d.clientName}` : ""}!</h1>
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
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We&apos;d love your feedback${d.clientName ? `, ${d.clientName}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your review helps other families find a mover they can trust. It only takes 30 seconds.
    </p>

    <a href="${d.googleReviewUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:16px 28px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;text-align:center;margin:0 0 24px">
      Leave a Google Review &rarr;
    </a>

    ${d.referralUrl ? `
      <div style="background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.2);border-radius:10px;padding:20px;margin-bottom:20px;text-align:center">
        <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:8px">Refer a Friend</div>
        <div style="font-family:serif;font-size:24px;font-weight:700;color:#F5F5F3;margin-bottom:6px">Give $50, Get $50</div>
        <p style="font-size:12px;color:#B8B5B0;margin:0 0 14px">
          Share your referral link and you both save on your next move.
        </p>
        <a href="${d.referralUrl}" style="display:inline-block;background:transparent;color:#C9A962;padding:10px 24px;border-radius:8px;font-size:13px;font-weight:600;text-decoration:none;border:1px solid rgba(201,169,98,0.4)">
          Share Referral Link
        </a>
      </div>
    ` : ""}

    <p style="font-size:11px;color:#666;text-align:center">
      Thank you for choosing YUGO. We can&apos;t wait to move you again!
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
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">We&apos;re sorry${d.clientName ? `, ${d.clientName}` : ""}.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      We understand your recent move didn&apos;t meet expectations, and we sincerely apologize. Your satisfaction is our priority and we want to make this right.
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:13px;color:#B8B5B0;line-height:1.7">
        <div>Your coordinator is standing by to resolve this personally:</div>
        ${d.coordinatorName ? `<div style="color:#E8E5E0;font-weight:600;margin-top:8px">${d.coordinatorName}</div>` : ""}
        ${d.coordinatorPhone ? `<div style="color:#C9A962;margin-top:4px">${d.coordinatorPhone}</div>` : ""}
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
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#E8E5E0;padding:4px 0">${d.clientPhone || "—"}</td></tr>
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
      Hi${d.clientName ? ` ${d.clientName}` : ""}, thanks for moving with YUGO! As a thank you, here&apos;s an exclusive offer: refer a friend and you both get $50 off.
    </p>

    <div style="background:rgba(201,169,98,0.12);border:1px solid rgba(201,169,98,0.3);border-radius:10px;padding:24px;text-align:center;margin-bottom:20px">
      <div style="font-family:serif;font-size:32px;font-weight:700;color:#C9A962;margin-bottom:8px">$50</div>
      <div style="font-size:13px;color:#B8B5B0">for you and your friend</div>
    </div>

    <div style="font-size:13px;color:#B8B5B0;line-height:1.8;margin-bottom:24px">
      <div><strong style="color:#E8E5E0">How it works:</strong></div>
      <div>1. Share your unique link with a friend</div>
      <div>2. They book a residential move with YUGO</div>
      <div>3. You both get $50 off &mdash; applied automatically</div>
    </div>

    ${ctaButton(d.referralUrl, "Share Your Referral Link")}

    <p style="font-size:11px;color:#666;text-align:center">
      Valid for residential moves only. One referral bonus per friend.
    </p>
  `);
}

import { getEmailBaseUrl } from "./email-base-url";
import { formatCurrency } from "./format-currency";
import { formatPhone } from "./phone";

function emailFooter(loginUrl?: string) {
  const baseUrl = loginUrl ? loginUrl.replace(/\/login.*$/, "") : getEmailBaseUrl();
  void baseUrl; // loginUrl-derived base is used for tracking links; learn more always goes to public site
  const learnMoreUrl = `${getEmailBaseUrl()}/about`;
  const logoUrl = getEmailLogoUrl();
  return `
    <div style="font-size:10px;color:#999;text-align:left;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
      <img src="${logoUrl}" alt="YUGO" width="52" height="14" style="display:inline-block;vertical-align:middle;border:0;height:14px;width:auto" />
      <span style="color:#888;margin:0 6px">·</span>
      <a href="${learnMoreUrl}" style="color:#C9A962;text-decoration:none">Learn more</a>
      <div style="margin-top:6px;font-size:9px;color:#888">Powered by YUGO+</div>
    </div>
  `;
}

/** Official YUGO logo URL for emails (gold version on dark background). */
function getEmailLogoUrl(): string {
  const base = getEmailBaseUrl();
  return `${base}/images/yugo-logo-gold.png`;
}

/** YUGO logo centered at top — used for all emails. Uses official logo image. */
function emailLogo() {
  return notifyEmailLogo();
}

/** Global email wrapper: same container + logo + footer used across all YUGO transactional emails */
export function emailLayout(innerHtml: string, footerLoginUrl?: string): string {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      ${innerHtml}
      ${emailFooter(footerLoginUrl)}
    </div>
  `;
}

/** Official YUGO logo image (gold on dark). Fallback alt text for clients that block images. */
function notifyEmailLogo() {
  const logoUrl = getEmailLogoUrl();
  return `
    <div style="text-align:center;margin-bottom:28px">
      <img src="${logoUrl}" alt="YUGO" width="120" height="32" style="display:inline-block;max-width:120px;height:auto;border:0" />
    </div>
  `;
}

const STATUS_COLORS: Record<string, string> = {
  pending: "#D48A29",
  confirmed: "#2D9F5A",
  scheduled: "#4A7CE5",
  "in-transit": "#C9A962",
  dispatched: "#C9A962",
  delivered: "#2D9F5A",
  cancelled: "#D14343",
};

function statusBadge(status: string) {
  const s = (status || "").replace("-", " ");
  const c = STATUS_COLORS[status] || "#C9A962";
  return `<span style="display:inline-block;padding:4px 10px;border-radius:6px;font-size:11px;font-weight:600;background:${c}22;color:${c}">${s.charAt(0).toUpperCase() + s.slice(1)}</span>`;
}

export function deliveryNotificationEmail(delivery: {
  delivery_number: string;
  customer_name: string;
  client_name?: string;
  delivery_address: string;
  pickup_address?: string;
  scheduled_date: string;
  delivery_window: string;
  status: string;
  items_count?: number;
  trackUrl?: string;
}) {
  const trackUrl = delivery.trackUrl || `${getEmailBaseUrl()}/track/delivery/${delivery.delivery_number}`;
  const items = delivery.items_count ?? 0;
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Project Update</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${delivery.delivery_number} — ${delivery.customer_name}</h1>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:8px">Current Status</div>
        <div style="margin-bottom:16px">${statusBadge(delivery.status)}</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:12px">
          <div><span style="color:#666">Delivery to:</span><br/><span style="font-weight:600">${delivery.delivery_address || "—"}</span></div>
          <div><span style="color:#666">Pickup from:</span><br/><span style="font-weight:600">${delivery.pickup_address || "—"}</span></div>
          <div><span style="color:#666">Date & window:</span><br/><span style="font-weight:600">${delivery.scheduled_date || "—"} • ${delivery.delivery_window || "—"}</span></div>
          <div><span style="color:#666">Items:</span><br/><span style="font-weight:600">${items} items</span></div>
        </div>
      </div>
      
      <a href="${trackUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track this project →
      </a>
      
      ${emailFooter()}
    </div>
  `;
}

function formatStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    confirmed: "Confirmed",
    scheduled: "Scheduled",
    paid: "Paid",
    final_payment_received: "Paid",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    delivered: "Completed",
    pending: "Confirmed",
    "in-transit": "In Progress",
    dispatched: "In Progress",
  };
  return labels[status] || (status || "").replace(/_/g, " ").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const LIVE_STAGE_LABELS: Record<string, string> = {
  pending: "Pending",
  on_route: "En Route",
  arrived_on_site: "Arrived On-Site",
  loading: "Loading",
  in_transit: "In Transit",
  unloading: "Unloading",
  job_complete: "Job Complete",
};

/** Timeline: status index 0–4, live stages 0–5 when in_progress */
const STATUS_INDEX: Record<string, number> = {
  confirmed: 0,
  scheduled: 1,
  paid: 2,
  final_payment_received: 2,
  in_progress: 3,
  completed: 4,
  cancelled: -1,
  delivered: 4,
  pending: 0,
  "in-transit": 3,
  dispatched: 3,
};

const STAGE_INDEX: Record<string, number> = {
  pending: -1,
  on_route: 0,
  arrived_on_site: 1,
  loading: 2,
  in_transit: 3,
  unloading: 4,
  job_complete: 5,
};

function moveStatusBarHtml(status: string, stage?: string | null): string {
  const isCancelled = (status || "").toLowerCase() === "cancelled";
  const isCompleted = (status || "").toLowerCase() === "completed" || (status || "").toLowerCase() === "delivered";
  const statusIdx = STATUS_INDEX[(status || "").toLowerCase()] ?? 0;
  const stageKey = stage ?? "";
  const stageIdx = stageKey ? (STAGE_INDEX[stageKey] ?? -1) : -1;

  let pct = 0;
  let currentLabel = formatStatusLabel(status);
  let labelColor = "#2D9F5A";

  if (isCancelled) {
    pct = 0;
    currentLabel = "Cancelled";
    labelColor = "#D14343";
  } else if (isCompleted) {
    pct = 100;
    currentLabel = "Completed";
  } else if (statusIdx === 3 && stageIdx >= 0) {
    const stageLabel = LIVE_STAGE_LABELS[stageKey] || stageKey.replace(/_/g, " ");
    currentLabel = stageLabel;
    pct = 60 + Math.round(((stageIdx + 1) / 6) * 40);
  } else {
    pct = Math.round(((statusIdx + 1) / 5) * 100);
  }

  return `
    <style>
      @keyframes moveBarShimmer {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.8; }
      }
      .move-bar-fill {
        animation: moveBarShimmer 2.5s ease-in-out infinite;
        -webkit-animation: moveBarShimmer 2.5s ease-in-out infinite;
      }
    </style>
    <div style="margin:20px 0 24px">
      <div style="font-size:9px;font-weight:700;color:#666;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">Current Stage</div>
      <div style="height:10px;background:#1E1E1E;border-radius:999px;overflow:hidden;border:1px solid #2A2A2A">
        <div class="move-bar-fill" style="height:100%;width:${pct}%;min-width:${pct > 0 ? 4 : 0}px;background:linear-gradient(90deg,#ECDEC4,#C9A962);border-radius:999px"></div>
      </div>
      <div style="font-size:12px;font-weight:600;color:${labelColor};margin-top:8px;letter-spacing:0.3px">${currentLabel}</div>
    </div>
  `;
}

export function moveNotificationEmail(move: {
  move_id: string;
  move_number: string;
  client_name: string;
  move_type: string;
  status: string;
  stage?: string;
  next_action?: string;
  from_address: string;
  to_address: string;
  scheduled_date: string;
  estimate?: number;
  deposit_paid?: number;
  balance_due?: number;
  trackUrl?: string;
  changes_made?: string;
}) {
  const trackUrl = move.trackUrl || `${getEmailBaseUrl()}/track/move/${move.move_id}`;
  const statusBarHtml = moveStatusBarHtml(move.status, move.stage);
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${notifyEmailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Your Move Was Updated</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Your Move Was Updated</h1>
      <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 4px">
        We&apos;ve made changes to your move recently.
      </p>
      ${statusBarHtml}
      <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
        Click below to view your full dashboard and see what changed.
      </p>
      <a href="${trackUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track your move →
      </a>
      <p style="font-size:11px;color:#999;margin-top:24px;line-height:1.5">
        This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.
      </p>
      ${emailFooter()}
    </div>
  `;
}

export function trackingLinkEmail(params: {
  clientName: string;
  trackUrl: string;
  moveNumber: string;
}) {
  const { clientName, trackUrl } = params;
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${notifyEmailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Track your move</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Hi${clientName ? `, ${clientName}` : ""}</h1>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.6;margin:0 0 20px">
        Use the link below to track your move, view documents, and message your coordinator. No account or login required.
      </p>
      <a href="${trackUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track your move →
      </a>
      <p style="font-size:11px;color:#999;margin-top:24px;line-height:1.5">
        This link is unique to your move. If you didn&apos;t expect this email, you can safely ignore it.
      </p>
      ${emailFooter()}
    </div>
  `;
}

export function invoiceEmail(invoice: {
  invoice_number: string;
  client_name: string;
  amount: number;
  due_date: string;
}) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:32px;border-radius:12px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px">Invoice</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:16px">${invoice.invoice_number}</div>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:8px">Amount Due</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">${formatCurrency(invoice.amount)}</div>
        <div style="font-size:10px;color:#666;margin-top:4px">Due: ${invoice.due_date}</div>
      </div>
      
      ${emailFooter()}
    </div>
  `;
}

export function changeRequestNotificationEmail(params: {
  client_name: string;
  status: "approved" | "rejected";
  type: string;
  description: string;
  portalUrl: string;
  feeCents?: number;
}) {
  const { client_name, status, type, description, portalUrl, feeCents = 0 } = params;
  const isApproved = status === "approved";
  const feeDollars = feeCents > 0 ? (feeCents / 100).toFixed(2) : "";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Change Request Update</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Your change request has been ${isApproved ? "approved" : "declined"}</h1>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:11px;color:#999;margin-bottom:8px"><strong>Request type:</strong> ${type}</div>
        <p style="font-size:12px;color:#E8E5E0;line-height:1.5;margin:0">${description}</p>
        <div style="margin-top:16px;padding-top:16px;border-top:1px solid #2A2A2A">
          <span style="display:inline-block;padding:6px 12px;border-radius:6px;font-size:11px;font-weight:600;background:${isApproved ? "#2D9F5A22" : "#D1434322"};color:${isApproved ? "#2D9F5A" : "#D14343"}">
            ${isApproved ? "Approved" : "Declined"}
          </span>
        </div>
        ${isApproved && feeDollars ? `
        <p style="font-size:12px;color:#E8E5E0;line-height:1.5;margin:16px 0 0">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>
        ` : ""}
      </div>
      
      <a href="${portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track your move →
      </a>
      
      ${emailFooter()}
    </div>
  `;
}

export function extraItemApprovalEmail(params: {
  client_name: string;
  description: string;
  portalUrl: string;
  feeCents?: number;
}) {
  const { client_name, description, portalUrl, feeCents = 0 } = params;
  const feeDollars = feeCents > 0 ? (feeCents / 100).toFixed(2) : "";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Extra Item Approved</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Your extra item has been approved</h1>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
        <p style="font-size:12px;color:#E8E5E0;line-height:1.5;margin:0">${description}</p>
        ${feeDollars ? `
        <p style="font-size:12px;color:#E8E5E0;line-height:1.5;margin:16px 0 0">A fee of $${feeDollars} has been added. Please pay your updated balance in your portal.</p>
        ` : ""}
      </div>
      
      <a href="${portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track your move →
      </a>
      
      ${emailFooter()}
    </div>
  `;
}

export function inviteUserEmail(params: {
  name: string;
  email: string;
  roleLabel: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to YUGO+${name ? `, ${name}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        You&apos;ve been invited to join YUGO+ as a <strong style="color:#C9A962">${roleLabel}</strong>. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
      </p>
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your credentials</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Email:</strong> ${email}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>Temporary password:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${tempPassword}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Log in to continue setup
      </a>
      <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.5">
        For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.
      </p>
      ${emailFooter(loginUrl)}
    </div>
  `;
}

export function inviteUserEmailText(params: { name: string; email: string; roleLabel: string; tempPassword: string; loginUrl: string }) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited

Welcome to YUGO+${name ? `, ${name}` : ""}

You've been invited to join YUGO+ as a ${roleLabel}. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by YUGO+ | Learn more: ${baseUrl}/about`;
}

export function invitePartnerEmail(params: {
  contactName: string;
  companyName: string;
  email: string;
  typeLabel: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited as a Partner</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to YUGO+${contactName ? `, ${contactName}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        <strong style="color:#C9A962">${companyName}</strong> has been invited as a <strong style="color:#C9A962">${typeLabel}</strong> partner on YUGO+. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
      </p>
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your credentials</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Email:</strong> ${email}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>Temporary password:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${tempPassword}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Log in to continue setup
      </a>
      <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.5">
        For security, you&apos;ll be asked to create a new password when you first sign in. If you didn&apos;t expect this invitation, you can safely ignore this email.
      </p>
      ${emailFooter(loginUrl)}
    </div>
  `;
}

export function invitePartnerEmailText(params: { contactName: string; companyName: string; email: string; typeLabel: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited as a Partner

Welcome to YUGO+${contactName ? `, ${contactName}` : ""}

${companyName} has been invited as a ${typeLabel} partner on YUGO+. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by YUGO+ | Learn more: ${baseUrl}/about`;
}

/** Email when an existing YUGO user is added to a partner (no new account, no temp password). */
export function addedToPartnerEmail(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { contactName, companyName, loginUrl } = params;
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Portal access added</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">You&apos;ve been added to ${companyName}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        Your account now has access to <strong style="color:#C9A962">${companyName}</strong> on the YUGO+ Partner Portal. Log in with your existing password to view deliveries and manage requests.
      </p>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Log in to Partner Portal
      </a>
      ${emailFooter(loginUrl)}
    </div>
  `;
}

export function addedToPartnerEmailText(params: { contactName: string; companyName: string; loginUrl: string }) {
  const { companyName, loginUrl } = params;
  return `Portal access added

You've been added to ${companyName} on the YUGO+ Partner Portal. Log in with your existing password to view deliveries and manage requests.

Log in: ${loginUrl}`;
}

export function partnerPasswordResetEmail(params: {
  contactName: string;
  companyName: string;
  email: string;
  tempPassword: string;
  loginUrl: string;
}) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Password Reset</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">New password for your YUGO+ partner account</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        A new temporary password has been set for your <strong style="color:#C9A962">${companyName}</strong> partner portal access${contactName ? ` (${contactName})` : ""}. Sign in with the credentials below and you&apos;ll be prompted to set a new password.
      </p>
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your credentials</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Email:</strong> ${email}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>New temporary password:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${tempPassword}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Log in to partner portal
      </a>
      <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.5">
        For security, we recommend changing this password after you sign in. If you didn&apos;t request this, contact your admin.
      </p>
      ${emailFooter(loginUrl)}
    </div>
  `;
}

export function partnerPasswordResetEmailText(params: { contactName: string; companyName: string; email: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `Password Reset – YUGO+ Partner Portal

A new temporary password has been set for your ${companyName} partner portal access. Sign in with the credentials below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
New temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, we recommend changing this password after you sign in. If you didn't request this, contact your admin.

Powered by YUGO+ | Learn more: ${baseUrl}/about`;
}

function darkEmailWrapper(html: string) {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0F0F0F;min-height:100%">
      <tr><td style="padding:24px 16px">
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
    ${html}
    </div>
      </td></tr>
    </table>
  `;
}

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  const displayName = client.name || "Partner";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Partner Portal Access</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to YUGO+${displayName !== "Partner" ? `, ${displayName}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 16px">
        Your partner portal is ready. Sign in anytime to:
      </p>
      <ul style="font-size:13px;color:#999;line-height:1.7;margin:0 0 24px;padding-left:20px">
        <li>Track deliveries and see real-time status</li>
        <li>View and download invoices</li>
        <li>Message our team and get support</li>
      </ul>
      <a href="${client.portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Access Your Portal
      </a>
      <p style="font-size:11px;color:#666;margin-top:20px;line-height:1.5">
        If you didn&apos;t request this, you can safely ignore this email.
      </p>
      ${emailFooter()}
    </div>
  `;
}

export function referralReceivedEmail(params: { agentName: string; clientName: string; property: string }) {
  const { agentName, clientName, property } = params;
  const ref = clientName || property || "this property";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Referral Received</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Hi ${agentName},</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        Your referral for <strong style="color:#C9A962">${ref}</strong> has been received and added to our pipeline.
      </p>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">
        We&apos;ll be in touch as we process the lead. Thank you for partnering with YUGO+.
      </p>
      ${emailFooter()}
    </div>
  `;
}

export function crewPortalInviteEmail(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  const inner = `
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Crew Portal Access</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to the Crew Portal${name ? `, ${name}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        You&apos;ve been invited to log in to the YUGO+ Crew Portal to start jobs, update status, and share your location with dispatch.
      </p>
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your login</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Phone:</strong> ${phoneDisplay}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>PIN:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${pin}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Log in to Crew Portal
      </a>
      <p style="font-size:11px;color:#666;margin-top:24px;line-height:1.5">
        Sessions expire after one shift (12h). Keep your PIN secure. If you didn&apos;t expect this invite, you can safely ignore this email.
      </p>
  `;
  return emailLayout(inner, loginUrl);
}

export function crewPortalInviteEmailText(params: { name: string; email: string; loginUrl: string; phone: string; pin: string }) {
  const { name, loginUrl, phone, pin } = params;
  const phoneDisplay = formatPhone(phone);
  return `Crew Portal Access

Welcome to the Crew Portal${name ? `, ${name}` : ""}

You've been invited to log in to the YUGO+ Crew Portal to start jobs, update status, and share your location with dispatch.

Your login:
Phone: ${phoneDisplay}
PIN: ${pin}

Log in: ${loginUrl}

Sessions expire after one shift (12h). Keep your PIN secure. If you didn't expect this invite, you can safely ignore this email.

Powered by YUGO+`;
}

export function bookingConfirmationEmail(params: {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  fromAddress: string;
  toAddress: string;
  tierLabel: string;
  serviceLabel: string;
  totalWithTax: number;
  depositPaid: number;
  balanceRemaining: number;
  trackingUrl: string;
}): string {
  const {
    clientName,
    moveCode,
    moveDate,
    fromAddress,
    toAddress,
    tierLabel,
    serviceLabel,
    totalWithTax,
    depositPaid,
    balanceRemaining,
    trackingUrl,
  } = params;

  const dateDisplay = moveDate
    ? new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "To be confirmed";

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Booking Confirmed</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">You&apos;re All Set${clientName ? `, ${clientName}` : ""}!</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your deposit has been received and your ${serviceLabel.toLowerCase()} is confirmed.
    </p>

    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;padding:6px 16px;border-radius:20px;font-size:12px;font-weight:600;background:rgba(201,169,98,0.15);color:#C9A962;border:1px solid rgba(201,169,98,0.3)">
        ${moveCode}
      </span>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Move Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Service:</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${serviceLabel}${tierLabel ? ` &mdash; ${tierLabel}` : ""}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Date:</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${dateDisplay}</td></tr>
        <tr><td style="color:#666;padding:3px 0">From:</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${fromAddress}</td></tr>
        <tr><td style="color:#666;padding:3px 0">To:</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${toAddress}</td></tr>
      </table>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Payment Summary</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:3px 0">Total (incl. HST):</td><td style="color:#E8E5E0;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(totalWithTax)}</td></tr>
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(depositPaid)}</td></tr>
        <tr><td colspan="2" style="border-top:1px solid #2A2A2A;padding:0;height:8px"></td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(balanceRemaining)}</td></tr>
      </table>
    </div>

    <div style="margin-bottom:24px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What Happens Next</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>1. Your coordinator will reach out within 24 hours</div>
        <div>2. We&apos;ll confirm your crew and timing details</div>
        <div>3. Track your move anytime using the link below</div>
      </div>
    </div>

    <a href="${trackingUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:16px;text-align:center">
      Track Your Move &rarr;
    </a>

    <p style="font-size:11px;color:#666;margin-top:16px;text-align:center">
      Questions? Reply to this email or call us anytime.
    </p>
  `);
}

/* ═══════════════════════════════════════════════════════
   TIER-SPECIFIC BOOKING CONFIRMATION EMAILS (Prompt 80)
   ═══════════════════════════════════════════════════════ */

export interface TierConfirmationParams {
  clientName: string;
  moveCode: string;
  moveDate: string | null;
  timeWindow: string;
  fromAddress: string;
  toAddress: string;
  tierLabel: string;
  serviceLabel: string;
  crewSize: number;
  truckDisplayName: string;
  totalWithTax: number;
  depositPaid: number;
  balanceRemaining: number;
  trackingUrl: string;
  includes: string[];
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  coordinatorEmail?: string | null;
  crewNames?: string | null;
}

function confirmDateDisplay(dateStr: string | null): string {
  if (!dateStr) return "To be confirmed";
  return new Date(dateStr + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function essentialsConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Move Confirmed</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Your Yugo move is confirmed${p.clientName ? `, ${p.clientName}` : ""}.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Your move is confirmed. Here are your details:
    </p>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Move Details</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:#666;padding:4px 0">From:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">To:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Package:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">Essentials</td></tr>
        <tr><td style="color:#666;padding:4px 0">Crew:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:#666;padding:4px 0">Vehicle:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed flat rate)</td></tr>
      </table>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What to Expect</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; Our crew will arrive within your time window</div>
        <div>&middot; All moving blankets, equipment, and floor protection included</div>
        <div>&middot; You&apos;ll receive a reminder 48 hours before your move</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What to Prepare</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; Have boxes packed and sealed</div>
        <div>&middot; Clear pathways for the crew</div>
        <div>&middot; Confirm elevator booking if applicable</div>
      </div>
    </div>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <p style="font-size:11px;color:#666;margin:0 0 16px;text-align:center">
      Questions? Reply to this email or call us anytime.
    </p>
  `);
}

export function premierConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Booking Confirmed</div>
    <h1 style="font-size:22px;font-weight:700;margin:0 0 8px;color:#F5F5F3">Great choice${p.clientName ? `, ${p.clientName}` : ""} &mdash; your Premier move is confirmed.</h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.6;margin:0 0 24px">
      Everything is set. No surprises &mdash; just a smooth, professional move.
    </p>

    <div style="background:#1E1E1E;border:1px solid #C9A96233;border-radius:10px;padding:20px;margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:14px">Your Premier Move</div>
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${dateStr} &middot; ${p.timeWindow}</td></tr>
        <tr><td style="color:#666;padding:4px 0">From:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">To:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Package:</td><td style="color:#C9A962;font-weight:600;padding:4px 0;text-align:right">Premier</td></tr>
        <tr><td style="color:#666;padding:4px 0">Crew:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.crewSize} professional movers</td></tr>
        <tr><td style="color:#666;padding:4px 0">Vehicle:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0;text-align:right">${formatCurrency(p.totalWithTax)} (guaranteed &mdash; no surprises)</td></tr>
      </table>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">What&apos;s Included</div>
      <div style="font-size:12px;color:#B8B5B0;line-height:2">
        ${(p.includes || []).map((inc) => `<div><span style="color:#C9A962">&#10003;</span> ${inc}</div>`).join("")}
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">Before Your Move</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.8">
        <div>&middot; You&apos;ll receive a reminder 48 hours before</div>
        <div>&middot; A day-before SMS with your crew details and ETA window</div>
        <div>&middot; Our team will handle disassembly &mdash; just let us know which pieces need it</div>
      </div>
    </div>

    <div style="margin-bottom:20px">
      <div style="font-size:9px;color:#C9A962;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:10px">Your Tracking Page</div>
      <div style="font-size:13px;color:#B8B5B0;line-height:1.6">
        Follow your move in real-time on move day:
      </div>
    </div>

    <a href="${p.trackingUrl}" style="display:block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:16px;text-align:center">
      Track Your Move &rarr;
    </a>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:16px;margin-bottom:20px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#2D9F5A;font-weight:600;padding:3px 0">&#10003; Deposit paid:</td><td style="color:#2D9F5A;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:3px 0">Balance remaining:</td><td style="color:#C9A962;font-weight:600;padding:3px 0;text-align:right">${formatCurrency(p.balanceRemaining)}</td></tr>
      </table>
    </div>

    <p style="font-size:12px;color:#B8B5B0;margin:0 0 16px;text-align:center">
      Looking forward to a smooth move.<br/>
      <strong style="color:#E8E5E0">&mdash; The Yugo Team</strong>
    </p>
  `);
}

export function estateConfirmationEmail(p: TierConfirmationParams): string {
  const dateStr = confirmDateDisplay(p.moveDate);
  const coordName = p.coordinatorName || "Your coordinator";
  const DIV = `<div style="width:100%;height:1px;background:linear-gradient(to right,transparent,#C9A96244,transparent);margin:24px 0"></div>`;

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#5C1A33;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">Estate Experience</div>
    <h1 style="font-family:Georgia,'Times New Roman',serif;font-size:24px;font-weight:400;margin:0 0 12px;color:#F5F5F3;line-height:1.3">
      Welcome to your Yugo Estate experience${p.clientName ? `, ${p.clientName}` : ""}.
    </h1>
    <p style="font-size:14px;color:#B8B5B0;line-height:1.7;margin:0 0 28px">
      Thank you for entrusting Yugo with your move. Your Estate experience has been confirmed, and every detail is being prepared with care.
    </p>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:9px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Your Estate Move</div>
      <table style="width:100%;font-size:13px;border-collapse:collapse">
        <tr><td style="color:#666;padding:6px 0">Date:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${dateStr}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Time:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${p.timeWindow} &mdash; your crew will arrive promptly</td></tr>
        <tr><td style="color:#666;padding:6px 0">Origin:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${p.fromAddress}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Destination:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${p.toAddress}</td></tr>
        ${p.crewNames ? `<tr><td style="color:#666;padding:6px 0">Your Crew:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${p.crewNames}</td></tr>` : ""}
        <tr><td style="color:#666;padding:6px 0">Your Vehicle:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${p.truckDisplayName}</td></tr>
        <tr><td style="color:#666;padding:6px 0">Your Coordinator:</td><td style="color:#E8E5E0;font-weight:600;padding:6px 0;text-align:right">${coordName}</td></tr>
      </table>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:9px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Your Estate Experience Includes</div>
      <div style="font-size:12px;color:#B8B5B0;line-height:2.2">
        ${(p.includes || []).map((inc) => `<div><span style="color:#C9A962">&#10022;</span> ${inc}</div>`).join("")}
      </div>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:9px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">What Happens Next</div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:0 0 16px">
        Within the next 24 hours, your coordinator ${coordName} will reach out personally to:
      </p>
      <div style="font-size:13px;color:#B8B5B0;line-height:2">
        <div>&middot; Schedule your pre-move walkthrough (in-person or virtual)</div>
        <div>&middot; Confirm any items requiring special handling</div>
        <div>&middot; Review your timeline and any access requirements</div>
        <div>&middot; Answer every question you have</div>
      </div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:16px 0 0">
        72 hours before your move, you&apos;ll receive a detailed itinerary with crew names, vehicle details, and your move-day timeline.
      </p>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.7;margin:8px 0 0">
        On move day, ${coordName} will be available by phone throughout the entire process.
      </p>
    </div>

    ${DIV}

    <div style="margin-bottom:4px">
      <div style="font-size:9px;color:#5C1A33;text-transform:uppercase;font-weight:700;letter-spacing:2px;margin-bottom:14px">Your Move Tracker</div>
      <p style="font-size:13px;color:#B8B5B0;line-height:1.6;margin:0 0 12px">Follow every step in real-time:</p>
    </div>

    <a href="${p.trackingUrl}" style="display:block;background:#5C1A33;color:#FFFFFF;padding:16px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:20px;text-align:center;letter-spacing:0.5px">
      Track Your Move &rarr;
    </a>

    ${DIV}

    <div style="text-align:center;margin-bottom:4px">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:18px;color:#C9A962;margin-bottom:4px">Investment: ${formatCurrency(p.totalWithTax)}</div>
      <div style="font-size:11px;color:#666">This is your guaranteed rate. No hourly charges. No surprises. No hidden fees.</div>
      <div style="margin-top:8px;font-size:12px">
        <span style="color:#2D9F5A;font-weight:600">&#10003; Deposit paid: ${formatCurrency(p.depositPaid)}</span>
        <span style="color:#666;margin:0 8px">&middot;</span>
        <span style="color:#C9A962;font-weight:600">Balance: ${formatCurrency(p.balanceRemaining)}</span>
      </div>
    </div>

    ${DIV}

    <div style="text-align:center;margin-bottom:8px">
      <p style="font-size:14px;color:#B8B5B0;font-style:italic;margin:0 0 16px">It&apos;s our privilege to handle your move.</p>
      ${p.coordinatorName ? `
        <div style="font-size:13px;color:#E8E5E0;font-weight:600">${p.coordinatorName}</div>
        <div style="font-size:11px;color:#666;margin-top:2px">Move Coordinator, Yugo</div>
        ${p.coordinatorPhone ? `<div style="font-size:11px;color:#C9A962;margin-top:4px">${formatPhone(p.coordinatorPhone)}</div>` : ""}
        ${p.coordinatorEmail ? `<div style="font-size:11px;color:#C9A962;margin-top:2px">${p.coordinatorEmail}</div>` : ""}
      ` : ""}
    </div>
  `);
}

export function internalBookingAlertEmail(params: {
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  moveCode: string;
  serviceLabel: string;
  tierLabel: string;
  totalWithTax: number;
  depositPaid: number;
  fromAddress: string;
  toAddress: string;
  moveDate: string | null;
  paymentId: string;
}): string {
  const {
    clientName,
    clientEmail,
    clientPhone,
    moveCode,
    serviceLabel,
    tierLabel,
    totalWithTax,
    depositPaid,
    fromAddress,
    toAddress,
    moveDate,
    paymentId,
  } = params;

  const dateDisplay = moveDate
    ? new Date(moveDate + "T00:00:00").toLocaleDateString("en-CA", {
        weekday: "short",
        month: "short",
        day: "numeric",
      })
    : "TBD";

  return emailLayout(`
    <div style="font-size:9px;font-weight:700;color:#2D9F5A;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">New Booking</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${clientName} &mdash; ${serviceLabel}${tierLabel ? ` (${tierLabel})` : ""}</h1>

    <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:16px">
      <table style="width:100%;font-size:12px;border-collapse:collapse">
        <tr><td style="color:#666;padding:4px 0;width:100px">Move:</td><td style="color:#C9A962;font-weight:600;padding:4px 0">${moveCode}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Client:</td><td style="color:#E8E5E0;padding:4px 0">${clientName}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Email:</td><td style="color:#E8E5E0;padding:4px 0">${clientEmail}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Phone:</td><td style="color:#E8E5E0;padding:4px 0">${clientPhone ? formatPhone(clientPhone) : "—"}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Date:</td><td style="color:#E8E5E0;padding:4px 0">${dateDisplay}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Route:</td><td style="color:#E8E5E0;padding:4px 0">${fromAddress} &rarr; ${toAddress}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Total:</td><td style="color:#E8E5E0;font-weight:600;padding:4px 0">${formatCurrency(totalWithTax)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Deposit:</td><td style="color:#2D9F5A;font-weight:600;padding:4px 0">${formatCurrency(depositPaid)}</td></tr>
        <tr><td style="color:#666;padding:4px 0">Square:</td><td style="color:#E8E5E0;padding:4px 0;font-size:10px;font-family:monospace">${paymentId}</td></tr>
      </table>
    </div>

    <div style="background:rgba(201,169,98,0.1);border:1px solid rgba(201,169,98,0.2);border-radius:8px;padding:14px;margin-bottom:20px">
      <div style="font-size:11px;color:#C9A962;font-weight:600">Action needed:</div>
      <div style="font-size:12px;color:#B8B5B0;margin-top:4px">Assign a crew and confirm timing with the client within 24 hours.</div>
    </div>
  `);
}

export function verificationCodeEmail(params: { code: string; purpose: "email_change" | "2fa" }) {
  const { code, purpose } = params;
  const title = purpose === "email_change" ? "Verify your email change" : "Your YUGO+ login code";
  const desc = purpose === "email_change"
    ? "You requested to change your email address. Enter this code to confirm:"
    : "Use this code to complete your sign-in. It expires in 15 minutes.";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Verification</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">${title}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">${desc}</p>
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
        <code style="font-size:28px;font-weight:700;letter-spacing:8px;color:#C9A962;font-family:monospace">${code}</code>
      </div>
      <p style="font-size:11px;color:#666;line-height:1.5">If you didn't request this, you can safely ignore this email. Your account remains secure.</p>
      ${emailFooter()}
    </div>
  `;
}

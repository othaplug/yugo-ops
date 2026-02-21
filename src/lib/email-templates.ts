import { getEmailBaseUrl } from "./email-base-url";
import { formatCurrency } from "./format-currency";
import { formatPhone } from "./phone";

function emailFooter(loginUrl?: string) {
  const url = loginUrl ? loginUrl.replace(/\/login.*$/, "") : getEmailBaseUrl();
  return `
    <div style="font-size:10px;color:#999;text-align:left;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
      <span style="font-family:'Instrument Serif',Georgia,serif;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#C9A962">OPS+</span>
      <span style="color:#888;margin:0 6px">·</span>
      <a href="${url}" style="color:#C9A962;text-decoration:none">Learn more</a>
      <div style="margin-top:6px;font-size:9px;color:#888">Powered by OPS+</div>
    </div>
  `;
}

/** OPS+ logo centered at top — used for all emails */
function emailLogo() {
  return notifyEmailLogo();
}

/** Global email wrapper: same container + logo + footer used across all OPS+ transactional emails */
function emailLayout(innerHtml: string, footerLoginUrl?: string): string {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      ${innerHtml}
      ${emailFooter(footerLoginUrl)}
    </div>
  `;
}

/** OPS+ oval badge only (matches notify/track email screenshot) */
function notifyEmailLogo() {
  return `
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-flex;align-items:center;padding:8px 20px;border-radius:9999px;background:#0F0F0F;border:1px solid rgba(201,169,98,0.35);font-family:'Instrument Serif',Georgia,serif;font-size:14px;font-weight:600;letter-spacing:1.5px;color:#C9A962">OPS+</div>
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
}) {
  const { client_name, status, type, description, portalUrl } = params;
  const isApproved = status === "approved";
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
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to OPS+${name ? `, ${name}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        You&apos;ve been invited to join OPS+ as a <strong style="color:#C9A962">${roleLabel}</strong>. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
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

Welcome to OPS+${name ? `, ${name}` : ""}

You've been invited to join OPS+ as a ${roleLabel}. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by OPS+ | Learn more: ${baseUrl}`;
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
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to OPS+${contactName ? `, ${contactName}` : ""}</h1>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        <strong style="color:#C9A962">${companyName}</strong> has been invited as a <strong style="color:#C9A962">${typeLabel}</strong> partner on OPS+. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
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

Welcome to OPS+${contactName ? `, ${contactName}` : ""}

${companyName} has been invited as a ${typeLabel} partner on OPS+. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by OPS+ | Learn more: ${baseUrl}`;
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
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">New password for your OPS+ partner account</h1>
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
  return `Password Reset – OPS+ Partner Portal

A new temporary password has been set for your ${companyName} partner portal access. Sign in with the credentials below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
New temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, we recommend changing this password after you sign in. If you didn't request this, contact your admin.

Powered by OPS+ | Learn more: ${baseUrl}`;
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
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">Welcome to OPS+${displayName !== "Partner" ? `, ${displayName}` : ""}</h1>
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
        We&apos;ll be in touch as we process the lead. Thank you for partnering with OPS+.
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
        You&apos;ve been invited to log in to the OPS+ Crew Portal to start jobs, update status, and share your location with dispatch.
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

You've been invited to log in to the OPS+ Crew Portal to start jobs, update status, and share your location with dispatch.

Your login:
Phone: ${phoneDisplay}
PIN: ${pin}

Log in: ${loginUrl}

Sessions expire after one shift (12h). Keep your PIN secure. If you didn't expect this invite, you can safely ignore this email.

Powered by OPS+`;
}

export function verificationCodeEmail(params: { code: string; purpose: "email_change" | "2fa" }) {
  const { code, purpose } = params;
  const title = purpose === "email_change" ? "Verify your email change" : "Your OPS+ login code";
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

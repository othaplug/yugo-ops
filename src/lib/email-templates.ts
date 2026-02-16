const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://yugo-ops.vercel.app";

function emailFooter(loginUrl?: string) {
  const url = loginUrl ? loginUrl.replace(/\/login.*$/, "") : baseUrl;
  return `
    <div style="font-size:10px;color:#555;text-align:left;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
      <span style="font-family:'Instrument Serif',Georgia,serif;font-size:11px;font-weight:600;letter-spacing:1.5px;color:#C9A962">OPS+</span>
      <span style="color:#444;margin:0 6px">·</span>
      <a href="${url}" style="color:#C9A962;text-decoration:none">Learn more</a>
      <div style="margin-top:6px;font-size:9px;color:#444">Powered by OPS+</div>
    </div>
  `;
}

function emailLogo() {
  return `
    <div style="text-align:center;margin-bottom:28px">
      <div style="display:inline-flex;align-items:center;justify-content:center;padding:6px 16px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:20px;letter-spacing:3px;color:#C9A962;font-weight:400">OPS+</span>
      </div>
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
  const trackUrl = delivery.trackUrl || `${baseUrl}/track/delivery/${delivery.delivery_number}`;
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
}) {
  const trackUrl = move.trackUrl || `${baseUrl}/track/move/${move.move_id}`;
  const typeLabel = move.move_type === "office" ? "Office / Commercial" : "Residential";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:560px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Move Update</div>
      <h1 style="font-size:20px;font-weight:700;margin:0 0 20px;color:#F5F5F3">${move.move_number} — ${move.client_name}</h1>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:20px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:8px">Current Status</div>
        <div style="margin-bottom:16px">${statusBadge(move.status)}</div>
        ${move.stage ? `<div style="margin-bottom:8px"><span style="color:#666;font-size:11px">Stage:</span> <span style="font-weight:600">${(move.stage || "").replace(/_/g, " ")}</span></div>` : ""}
        ${move.next_action ? `<div style="margin-bottom:12px"><span style="color:#666;font-size:11px">Next action:</span> <span style="font-weight:600;color:#C9A962">${move.next_action}</span></div>` : ""}
        <div style="display:grid;grid-template-columns:1fr;gap:12px;font-size:12px;margin-top:16px;padding-top:16px;border-top:1px solid #2A2A2A">
          <div><span style="color:#666">From:</span><br/><span style="font-weight:600">${move.from_address || "—"}</span></div>
          <div><span style="color:#666">To:</span><br/><span style="font-weight:600">${move.to_address || "—"}</span></div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div><span style="color:#666">Move date:</span><br/><span style="font-weight:600">${move.scheduled_date || "—"}</span></div>
            <div><span style="color:#666">Type:</span><br/><span style="font-weight:600">${typeLabel}</span></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:8px;padding-top:12px;border-top:1px solid #2A2A2A">
            <div><span style="color:#666">Estimate:</span><br/><span style="font-weight:600;color:#C9A962">$${(move.estimate || 0).toLocaleString()}</span></div>
            <div><span style="color:#666">Deposit paid:</span><br/><span style="font-weight:600;color:#2D9F5A">$${(move.deposit_paid || 0).toLocaleString()}</span></div>
            <div><span style="color:#666">Balance due:</span><br/><span style="font-weight:600">$${(move.balance_due || 0).toLocaleString()}</span></div>
          </div>
        </div>
      </div>
      
      <a href="${trackUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:14px 28px;border-radius:10px;font-size:14px;font-weight:600;text-decoration:none;margin-bottom:24px">
        Track this move →
      </a>
      
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
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">$${invoice.amount.toLocaleString()}</div>
        <div style="font-size:10px;color:#666;margin-top:4px">Due: ${invoice.due_date}</div>
      </div>
      
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
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+${name ? `, ${name}` : ""}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        You&apos;ve been invited to join OPS+ as a <strong style="color:#C9A962">${roleLabel}</strong>. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
      </p>
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your credentials</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Email:</strong> ${email}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>Temporary password:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${tempPassword}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.2s">
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
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited as a Partner</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+${contactName ? `, ${contactName}` : ""}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        <strong style="color:#C9A962">${companyName}</strong> has been invited as a <strong style="color:#C9A962">${typeLabel}</strong> partner on OPS+. Your account has been created — sign in with the temporary password below and you&apos;ll be prompted to set a new password.
      </p>
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:20px;margin-bottom:24px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:6px">Your credentials</div>
        <div style="font-size:12px;color:#E8E5E0;margin-bottom:4px"><strong>Email:</strong> ${email}</div>
        <div style="font-size:12px;color:#E8E5E0"><strong>Temporary password:</strong> <code style="background:#0F0F0F;padding:2px 8px;border-radius:4px;font-family:monospace">${tempPassword}</code></div>
      </div>
      <a href="${loginUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.2s">
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

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  const displayName = client.name || "Partner";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      ${emailLogo()}
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Partner Portal Access</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+${displayName !== "Partner" ? `, ${displayName}` : ""}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 16px">
        Your partner portal is ready. Sign in anytime to:
      </p>
      <ul style="font-size:13px;color:#999;line-height:1.7;margin:0 0 24px;padding-left:20px">
        <li>Track deliveries and see real-time status</li>
        <li>View and download invoices</li>
        <li>Message our team and get support</li>
      </ul>
      <a href="${client.portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.2s">
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
      <p style="font-size:11px;color:#666;line-height:1.5">If you didn&apos;t request this, you can safely ignore this email. Your account remains secure.</p>
      ${emailFooter()}
    </div>
  `;
}
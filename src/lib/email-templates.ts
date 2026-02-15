export function deliveryNotificationEmail(delivery: {
  delivery_number: string;
  customer_name: string;
  delivery_address: string;
  scheduled_date: string;
  delivery_window: string;
  status: string;
}) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:500px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:32px;border-radius:12px;border:1px solid #2A2A2A">
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:22px;letter-spacing:4px;color:#C9A962">OPS+</span>
      </div>
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px">Delivery Update</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:16px">${delivery.delivery_number} — ${delivery.customer_name}</div>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:16px;margin-bottom:16px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;letter-spacing:0.5px;margin-bottom:4px">Status</div>
        <div style="font-size:13px;font-weight:600;color:#C9A962">${delivery.status.charAt(0).toUpperCase() + delivery.status.slice(1).replace("-", " ")}</div>
      </div>
      
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
        <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:12px">
          <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700">Delivery To</div>
          <div style="font-size:11px;margin-top:4px">${delivery.delivery_address}</div>
        </div>
        <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:12px">
          <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700">Window</div>
          <div style="font-size:11px;margin-top:4px">${delivery.scheduled_date} • ${delivery.delivery_window}</div>
        </div>
      </div>
      
      <div style="font-size:10px;color:#555;text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #2A2A2A">
        Powered by <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span>
      </div>
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
      <div style="text-align:center;margin-bottom:24px">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-size:22px;letter-spacing:4px;color:#C9A962">OPS+</span>
      </div>
      <div style="font-size:9px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:16px">Invoice</div>
      
      <div style="font-size:14px;font-weight:600;margin-bottom:16px">${invoice.invoice_number}</div>
      
      <div style="background:#1E1E1E;border:1px solid #2A2A2A;border-radius:8px;padding:20px;text-align:center;margin-bottom:16px">
        <div style="font-size:9px;color:#666;text-transform:uppercase;font-weight:700;margin-bottom:8px">Amount Due</div>
        <div style="font-family:serif;font-size:28px;font-weight:700;color:#C9A962">$${invoice.amount.toLocaleString()}</div>
        <div style="font-size:10px;color:#666;margin-top:4px">Due: ${invoice.due_date}</div>
      </div>
      
      <div style="font-size:10px;color:#555;text-align:center;padding-top:16px;border-top:1px solid #2A2A2A">
        Powered by <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span>
      </div>
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
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
          <span style="font-family:'Instrument Serif',Georgia,serif;font-size:24px;letter-spacing:4px;color:#C9A962">OPS+</span>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+, ${name || "there"}</h2>
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
      <div style="font-size:10px;color:#555;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span> · <a href="${baseUrl}" style="color:#C9A962;text-decoration:none">Learn more</a>
      </div>
    </div>
  `;
}

export function inviteUserEmailText(params: { name: string; email: string; roleLabel: string; tempPassword: string; loginUrl: string }) {
  const { name, email, roleLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited

Welcome to OPS+, ${name || "there"}

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
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
          <span style="font-family:'Instrument Serif',Georgia,serif;font-size:24px;letter-spacing:4px;color:#C9A962">OPS+</span>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">You&apos;re Invited as a Partner</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+, ${contactName || "there"}</h2>
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
      <div style="font-size:10px;color:#555;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span> · <a href="${baseUrl}" style="color:#C9A962;text-decoration:none">Learn more</a>
      </div>
    </div>
  `;
}

export function invitePartnerEmailText(params: { contactName: string; companyName: string; email: string; typeLabel: string; tempPassword: string; loginUrl: string }) {
  const { contactName, companyName, email, typeLabel, tempPassword, loginUrl } = params;
  const baseUrl = loginUrl.replace(/\/login.*$/, "");
  return `You're Invited as a Partner

Welcome to OPS+, ${contactName || "there"}

${companyName} has been invited as a ${typeLabel} partner on OPS+. Your account has been created. Sign in with the temporary password below and you'll be prompted to set a new password.

Your credentials:
Email: ${email}
Temporary password: ${tempPassword}

Log in: ${loginUrl}

For security, you'll be asked to create a new password when you first sign in. If you didn't expect this invitation, you can safely ignore this email.

Powered by OPS+ | Learn more: ${baseUrl}`;
}

export function welcomeEmail(client: { name: string; email: string; portalUrl: string }) {
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
          <span style="font-family:'Instrument Serif',Georgia,serif;font-size:24px;letter-spacing:4px;color:#C9A962">OPS+</span>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Welcome</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Welcome to OPS+, ${client.name}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">
        Your partner portal is ready. Track deliveries, view invoices, and communicate with our team — all in one place.
      </p>
      <a href="${client.portalUrl}" style="display:inline-block;background:#C9A962;color:#0D0D0D;padding:12px 28px;border-radius:10px;font-size:13px;font-weight:600;text-decoration:none;transition:all 0.2s">
        Access Your Portal
      </a>
      <div style="font-size:10px;color:#555;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span>
      </div>
    </div>
  `;
}

export function referralReceivedEmail(params: { agentName: string; clientName: string; property: string }) {
  const { agentName, clientName, property } = params;
  const ref = clientName || property || "this property";
  return `
    <div style="font-family:'DM Sans',sans-serif;max-width:520px;margin:0 auto;background:#0F0F0F;color:#E8E5E0;padding:36px;border-radius:14px;border:1px solid #2A2A2A">
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
          <span style="font-family:'Instrument Serif',Georgia,serif;font-size:24px;letter-spacing:4px;color:#C9A962">OPS+</span>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Referral Received</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">Hi ${agentName},</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 20px">
        Your referral for <strong style="color:#C9A962">${ref}</strong> has been received and added to our pipeline.
      </p>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">
        We&apos;ll be in touch as we process the lead. Thank you for partnering with OPS+.
      </p>
      <div style="font-size:10px;color:#555;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span>
      </div>
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
      <div style="text-align:center;margin-bottom:28px">
        <div style="display:inline-flex;align-items:center;justify-content:center;padding:8px 20px;border-radius:9999px;background:rgba(201,169,98,0.08);border:1px solid rgba(201,169,98,0.35)">
          <span style="font-family:'Instrument Serif',Georgia,serif;font-size:24px;letter-spacing:4px;color:#C9A962">OPS+</span>
        </div>
      </div>
      <div style="font-size:10px;font-weight:700;color:#C9A962;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px">Verification</div>
      <h2 style="font-size:20px;font-weight:600;margin:0 0 16px;color:#F5F5F3">${title}</h2>
      <p style="font-size:13px;color:#999;line-height:1.6;margin:0 0 24px">${desc}</p>
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:10px;padding:24px;text-align:center;margin-bottom:24px">
        <code style="font-size:28px;font-weight:700;letter-spacing:8px;color:#C9A962;font-family:monospace">${code}</code>
      </div>
      <p style="font-size:11px;color:#666;line-height:1.5">If you didn&apos;t request this, you can safely ignore this email. Your account remains secure.</p>
      <div style="font-size:10px;color:#555;text-align:center;margin-top:32px;padding-top:20px;border-top:1px solid #2A2A2A">
        <span style="font-family:'Instrument Serif',Georgia,serif;font-weight:600;letter-spacing:2px;color:#C9A962">OPS+</span>
      </div>
    </div>
  `;
}
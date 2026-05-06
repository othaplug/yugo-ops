/** PM batch outbound copy for coordinators and partner confirmations. */

export type PmBatchMailDetailRow = {
  moveCode: string;
  unit: string;
  unitSize: string;
  tenantName: string;
  tenantPhone: string | null;
  tenantEmail: string | null;
  buildingName: string;
  propertyAddress: string;
  scheduledDate: string;
  arrivalWindowLabel: string;
  reasonLabel: string;
  reasonCode: string;
  zone: string;
  estimatedPreTax: number;
  packingRequired: boolean;
  holdingUnit: string | null;
  afterHours: boolean;
  holidaySurcharge: boolean;
  tenantMayNotBeOnSite: boolean;
  linkedMoveCode?: string | null;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatPmBatchCad(amount: number): string {
  return new Intl.NumberFormat("en-CA", {
    style: "currency",
    currency: "CAD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(amount));
}

function humanFallbackReason(reasonCode: string): string {
  const t = reasonCode.trim();
  if (!t) return "Portfolio move";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function lookupPmReasonLabel(
  reasonCode: string,
  labelsByCode: Record<string, string>,
): string {
  const key = reasonCode.trim();
  const fromDb = labelsByCode[key]?.trim();
  return fromDb && fromDb.length > 0 ? fromDb : humanFallbackReason(key);
}

/**
 * Plain multiline summary for coordinator notification (converted to HTML with line breaks).
 */
export function buildPmBatchStaffNotifyBody(opts: {
  partnerName: string;
  coordinatorLabel: string;
  draft: boolean;
  earliestDate: string;
  latestDate: string;
  moveCount: number;
  uniqueTenantCount: number;
  rows: PmBatchMailDetailRow[];
}): string {
  const heading = `${opts.partnerName} · ${opts.moveCount} move${opts.moveCount === 1 ? "" : "s"}${opts.draft ? " (draft)" : ""} · ${opts.earliestDate} to ${opts.latestDate}`;
  const opener = `${heading}\nRecorded by ${opts.coordinatorLabel} · ${opts.uniqueTenantCount} named occupant profile${opts.uniqueTenantCount === 1 ? "" : "s"}\n`;
  const blocks: string[] = [opener];

  opts.rows.forEach((r, i) => {
    const contactBits: string[] = [];
    if (r.tenantPhone?.trim()) contactBits.push(`Phone ${r.tenantPhone.trim()}`);
    if (r.tenantEmail?.trim())
      contactBits.push(`Email ${r.tenantEmail.trim().toLowerCase()}`);
    const contactSuffix = contactBits.length ? ` · ${contactBits.join(" · ")}` : "";

    const flags: string[] = [];
    if (r.packingRequired) flags.push("Packing scoped");
    if (r.afterHours) flags.push("After hours premium");
    if (r.holidaySurcharge) flags.push("Holiday window");
    if (r.holdingUnit?.trim()) flags.push(`Holding route ${r.holdingUnit.trim()}`);
    if (r.tenantMayNotBeOnSite) flags.push("Tenant walkthrough unsure");
    if (r.linkedMoveCode?.trim()) flags.push(`Linked with ${String(r.linkedMoveCode).trim()}`);

    const flagLine = flags.length > 0 ? `\n  Ops flags · ${flags.join(" · ")}` : "";

    blocks.push(
      [
        `Move ${i + 1}`,
        `  Job ${r.moveCode} · ${r.reasonLabel} (${r.reasonCode})`,
        `  Tenant ${r.tenantName}${contactSuffix}`,
        `  ${r.buildingName} · Unit ${r.unit} · ${r.unitSize.replace(/_/g, " ").toUpperCase()}`,
        `  Property line ${r.propertyAddress}`,
        `  Scheduled ${r.scheduledDate} · Arrival ${r.arrivalWindowLabel} · Zone ${r.zone}`,
        `  Estimated contract (pre-tax) ${formatPmBatchCad(r.estimatedPreTax)}`,
        `${flagLine}`.trimEnd(),
      ]
        .filter((line) => line.trim().length > 0)
        .join("\n"),
    );
  });

  blocks.push(
    `\nPortfolio jobs bill on partner invoice cadence shown in Ops.\nSearch Ops by move code above for paperwork and checklist.`,
  );
  return blocks.join("\n\n");
}

// ─── Design tokens (mirrors email-templates.ts premium shell) ─────────────────
const FONT = "system-ui,'Segoe UI',Helvetica,Arial,sans-serif";
const SERIF = "'Instrument Serif',Georgia,'Times New Roman',serif";
const PAGE = "#FCF9F4";
const BODY = "#3A3532";
const MUTED = "#6B635C";
const FAINT = "#9B928B";
const RULE = "rgba(44,62,45,0.15)";
const ISLAND = "rgba(44,62,45,0.06)";
const WINE = "#2B0416";

/** Partner-facing confirmation HTML — premium design system. */
export function buildPmBatchPartnerEmailHtml(opts: {
  partnerName: string;
  adminBaseUrl: string;
  moveCount: number;
  rows: PmBatchMailDetailRow[];
}): string {
  const base = opts.adminBaseUrl.replace(/\/$/, "");
  const logoUrl = `${base}/images/yugo-logo-wine.png`;
  const partnerUrl = `${base}/partner`;
  const n = opts.moveCount;
  const nameEsc = escapeHtml(opts.partnerName);

  const rowsHtml = opts.rows
    .map((r, i) => {
      const flags: string[] = [];
      if (r.packingRequired) flags.push("Packing scoped");
      if (r.afterHours) flags.push("After-hours premium");
      if (r.holidaySurcharge) flags.push("Holiday window");
      if (r.holdingUnit?.trim()) flags.push(`Holding route ${escapeHtml(r.holdingUnit.trim())}`);
      if (r.linkedMoveCode?.trim()) flags.push(`Linked with ${escapeHtml(String(r.linkedMoveCode).trim())}`);
      if (r.tenantMayNotBeOnSite) flags.push("Tenant walkthrough unconfirmed");

      const flagHtml = flags.length
        ? `<tr><td colspan="2" style="padding:6px 0 0;font-size:11px;color:${FAINT};font-family:${FONT};line-height:1.5;">${flags.join("&nbsp;·&nbsp;")}</td></tr>`
        : "";

      const kvRow = (label: string, value: string, top = true) =>
        `<tr>
          <td style="padding:${top ? "8" : "4"}px 10px ${top ? "4" : "2"}px 0;font-size:11px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.06em;white-space:nowrap;vertical-align:top;font-family:${FONT};width:38%;">${label}</td>
          <td style="padding:${top ? "8" : "4"}px 0 ${top ? "4" : "2"}px;font-size:12px;font-weight:600;color:${BODY};text-align:right;vertical-align:top;font-family:${FONT};">${value}</td>
        </tr>`;

      const contactLines: string[] = [];
      if (r.tenantPhone?.trim()) contactLines.push(escapeHtml(r.tenantPhone.trim()));
      if (r.tenantEmail?.trim()) contactLines.push(escapeHtml(r.tenantEmail.trim().toLowerCase()));
      const contactValue = contactLines.length ? contactLines.join("<br>") : `<span style="color:${FAINT}">No contact on file</span>`;

      return `
<tr><td style="padding:20px 0 0;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;background:${ISLAND};border:1px solid ${RULE};padding:0;">
    <tr><td style="padding:12px 14px 10px;">
      <div style="font-size:10px;font-weight:700;color:${MUTED};text-transform:uppercase;letter-spacing:0.1em;font-family:${FONT};margin-bottom:4px;">Move ${i + 1}</div>
      <div style="font-size:16px;font-weight:700;color:${WINE};font-family:${SERIF};letter-spacing:0;margin-bottom:2px;">${escapeHtml(r.tenantName)}</div>
      <div style="font-size:12px;color:${MUTED};font-family:${FONT};">${escapeHtml(r.reasonLabel)} &nbsp;·&nbsp; ${escapeHtml(r.moveCode)}</div>
    </td></tr>
    <tr><td style="padding:0 14px 14px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;border-top:1px solid ${RULE};margin-top:6px;">
        ${kvRow("Building", `${escapeHtml(r.buildingName)} · Unit ${escapeHtml(r.unit)} (${escapeHtml(r.unitSize.replace(/_/g, " "))})`)}
        ${kvRow("Address", escapeHtml(r.propertyAddress), false)}
        ${kvRow("Scheduled", escapeHtml(r.scheduledDate), false)}
        ${kvRow("Window", escapeHtml(r.arrivalWindowLabel), false)}
        ${kvRow("Zone", escapeHtml(r.zone), false)}
        ${kvRow("Contact", contactValue, false)}
        ${kvRow("Estimate (pre-tax)", escapeHtml(formatPmBatchCad(r.estimatedPreTax)), false)}
        ${flagHtml}
      </table>
    </td></tr>
  </table>
</td></tr>`;
    })
    .join("");

  const ctaStyle = `display:inline-block;background:${WINE};color:#FFFBF7;font-family:${FONT};font-size:10px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;text-decoration:none;padding:12px 24px;border:1px solid rgba(0,0,0,0.35);`;

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Portfolio batch · ${nameEsc}</title></head>
<body style="margin:0;padding:0;background:${PAGE};-webkit-font-smoothing:antialiased;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;background:${PAGE};">
  <tr><td align="center" style="padding:32px 16px 48px;">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;max-width:560px;">

      <!-- Logo -->
      <tr><td style="padding-bottom:28px;text-align:center;">
        <img src="${logoUrl}" alt="Yugo" width="80" height="22" style="display:inline-block;border:0;max-width:80px;" />
      </td></tr>

      <!-- Eyebrow + headline -->
      <tr><td style="padding-bottom:6px;">
        <div style="font-size:11px;font-weight:700;color:${WINE};letter-spacing:0.1em;text-transform:uppercase;font-family:${FONT};margin-bottom:10px;">Portfolio batch confirmed</div>
        <div style="font-size:26px;font-weight:400;color:${BODY};font-family:${SERIF};letter-spacing:0;line-height:1.2;margin-bottom:16px;">${n} move${n === 1 ? "" : "s"} scheduled for ${nameEsc}</div>
        <p style="font-size:14px;color:${MUTED};line-height:1.65;margin:0 0 0;">${nameEsc}, Operations has confirmed and logged the ${n} portfolio move${n === 1 ? "" : "s"} below. Each job is live in the system with a unique move code, tenant profile, and scheduled window.</p>
      </td></tr>

      <!-- Move cards -->
      <table width="100%" cellpadding="0" cellspacing="0" border="0" role="presentation" style="border-collapse:collapse;">${rowsHtml}</table>

      <!-- Rule -->
      <tr><td style="padding:28px 0 0;"><div style="height:1px;background:${RULE};"></div></td></tr>

      <!-- CTA -->
      <tr><td style="padding:24px 0 0;text-align:center;">
        <a href="${escapeHtml(partnerUrl)}" style="${ctaStyle}">Open partner workspace</a>
      </td></tr>

      <!-- Footer note -->
      <tr><td style="padding-top:24px;">
        <p style="font-size:12px;color:${FAINT};line-height:1.6;font-family:${FONT};margin:0;">Move codes and billing details are accessible in your partner workspace. If anything needs correcting, reply to your coordinator or reach us at (647)&nbsp;370-4525.</p>
      </td></tr>

      <!-- Yugo footer -->
      <tr><td style="padding-top:28px;text-align:center;border-top:1px solid ${RULE};margin-top:28px;">
        <p style="font-size:11px;color:${FAINT};font-family:${FONT};margin:16px 0 0;">Yugo Moving &amp; Logistics &nbsp;·&nbsp; Toronto, ON &nbsp;·&nbsp; <a href="https://helloyugo.com" style="color:${FAINT};text-decoration:none;">helloyugo.com</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>`;
}

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

/** Partner-facing confirmation HTML. */
export function buildPmBatchPartnerEmailHtml(opts: {
  partnerName: string;
  adminBaseUrl: string;
  moveCount: number;
  rows: PmBatchMailDetailRow[];
}): string {
  const base = opts.adminBaseUrl.replace(/\/$/, "");
  const font = "system-ui,Segoe UI,sans-serif";
  const rowsHtml = opts.rows
    .map((r, i) => {
      const phone = r.tenantPhone?.trim()
        ? `<div style="margin:2px 0">Phone · ${escapeHtml(r.tenantPhone.trim())}</div>`
        : "";
      const email = r.tenantEmail?.trim()
        ? `<div style="margin:2px 0">Email · ${escapeHtml(r.tenantEmail.trim())}</div>`
        : `<div style="margin:2px 0;color:#704c00">Tenant email blank · SMS may be the easiest path until Operations adds contacts</div>`;

      const badges: string[] = [];
      if (r.packingRequired) badges.push("Packing scoped");
      if (r.afterHours) badges.push("After hours premium");
      if (r.holidaySurcharge) badges.push("Holiday window");
      if (r.holdingUnit?.trim()) badges.push(`Holding ${escapeHtml(r.holdingUnit.trim())}`);
      if (r.linkedMoveCode?.trim())
        badges.push(`Linked · ${escapeHtml(String(r.linkedMoveCode).trim())}`);

      const badgeHtml = badges.length
        ? `<div style="margin-top:8px;font-size:11px;color:#705c50">${escapeHtml(badges.join(" · "))}</div>`
        : "";

      return `
<tr>
  <td style="padding:16px;border-bottom:1px solid #eae5df;vertical-align:top;font-family:${font}">
    <div style="font-size:13px;font-weight:700;color:#1a1a1a">Move ${i + 1} · ${escapeHtml(r.moveCode)}</div>
    <div style="font-size:12px;color:#555;margin-top:4px;line-height:1.5">${escapeHtml(r.reasonLabel)}</div>
    <div style="font-size:12px;margin-top:8px;line-height:1.55;color:#1b1f1e">
      <strong>Tenant</strong> · ${escapeHtml(r.tenantName)}
      ${phone}
      ${email}
      <div style="margin-top:8px"><strong>Building</strong> · ${escapeHtml(r.buildingName)} · Unit ${escapeHtml(r.unit)} · ${escapeHtml(r.unitSize.replace(/_/g, " "))}</div>
      <div style="margin-top:6px">${escapeHtml(r.propertyAddress)}</div>
      <div style="margin-top:10px"><strong>Schedule</strong> · ${escapeHtml(r.scheduledDate)} · Window ${escapeHtml(r.arrivalWindowLabel)} · Zone ${escapeHtml(r.zone)}</div>
      <div style="margin-top:6px"><strong>Estimate pre-tax</strong> · ${escapeHtml(formatPmBatchCad(r.estimatedPreTax))}</div>
      ${badgeHtml}
    </div>
  </td>
</tr>`;
    })
    .join("");

  return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;font-family:${font}">
<tr><td style="padding-bottom:14px;font-size:15px;line-height:1.55;color:#1a1f1b">${escapeHtml(
    opts.partnerName,
  )}, Operations confirmed <strong>${opts.moveCount}</strong> scheduled portfolio move${opts.moveCount === 1 ? "" : "s"} from your batch. Each line is below.</td></tr>
<tr><td><table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border:1px solid #eae5df;border-radius:10px;overflow:hidden;background:#fffdfb">${rowsHtml}</table></td></tr>
<tr><td style="padding-top:16px;font-size:13px;line-height:1.55;color:#4a463f">If anything needs correcting, reply to your coordinator thread or open <a href="${escapeHtml(`${base}/partner`)}" style="color:#2C3E2D;font-weight:600;text-decoration:none">partner workspace</a> for statuses.</td></tr>
</table>`;
}

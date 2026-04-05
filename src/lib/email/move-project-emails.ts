import { emailLayout } from "@/lib/email-templates";
import { getEmailBaseUrl } from "@/lib/email-base-url";

export function moveProjectMorningClientEmailHtml(opts: {
  clientName: string;
  projectName: string;
  dayLabel: string;
  dayDate: string;
  description: string;
  trackingUrl?: string | null;
  /** Estate / wine band vs standard cream */
  variant: "estate" | "standard";
}): string {
  const base = getEmailBaseUrl().replace(/\/$/, "");
  const track = opts.trackingUrl?.trim() || `${base}/track/move`;
  const isEstate = opts.variant === "estate";
  const bandBg = isEstate ? "#5C1A33" : "#F9EDE4";
  const bandInk = isEstate ? "#F9EDE4" : "#2C3E2D";
  const bodyInk = isEstate ? "#3A3532" : "#3A3532";

  return emailLayout(
    `
    <div style="font-size:9px;font-weight:700;color:${isEstate ? "#F9EDE4" : "#2C3E2D"};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;opacity:0.85">Your project day</div>
    <h1 style="font-size:20px;font-weight:700;margin:0 0 16px;color:${bodyInk}">Hi ${escapeHtml(opts.clientName || "there")}</h1>
    <p style="font-size:14px;color:#6B635C;line-height:1.6;margin:0 0 16px">
      <strong style="color:#2C3E2D">${escapeHtml(opts.projectName)}</strong> — today is <strong>${escapeHtml(opts.dayLabel)}</strong>
      (${escapeHtml(opts.dayDate)}).
    </p>
    ${opts.description.trim() ? `<p style="font-size:14px;color:#6B635C;line-height:1.6;margin:0 0 20px">${escapeHtml(opts.description)}</p>` : ""}
    <div style="background:${bandBg};color:${bandInk};padding:16px 20px;margin:0 0 24px;border-radius:0">
      <p style="font-size:13px;margin:0;line-height:1.5;opacity:0.95">
        Follow live updates on your tracking page when the crew is en route.
      </p>
    </div>
    <a href="${track}" style="display:inline-block;border:2px solid #2C3E2D;color:#2C3E2D;padding:12px 22px;border-radius:0;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:0.08em;text-transform:uppercase">
      Open tracking
    </a>
  `,
    undefined,
    "generic",
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

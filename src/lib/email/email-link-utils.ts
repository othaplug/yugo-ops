import { EMAIL_FOREST } from "@/lib/email/email-brand-tokens";

/** Escape text for HTML body / attribute safety (addresses, codes). */
export function escapeHtmlEmail(text: string): string {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Mapbox policy: OpenStreetMap search link (no default blue). Default ink: forest. */
export function emailMapLinkHtml(
  address: string,
  /** Hex or CSS color for link text (e.g. Estate wine `#2B0416`). */
  linkColor: string = EMAIL_FOREST,
): string {
  const plain = String(address).trim();
  if (!plain) return "—";
  const esc = escapeHtmlEmail(plain);
  const href = `https://www.openstreetmap.org/search?query=${encodeURIComponent(plain)}`.replace(
    /&/g,
    "&amp;",
  );
  const linkBody = `color:${linkColor} !important;-webkit-text-fill-color:${linkColor};text-decoration:underline;font-weight:600`;
  return `<a href="${href}" style="${linkBody}">${esc}</a>`;
}

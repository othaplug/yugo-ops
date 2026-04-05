import { getEmailBaseUrl } from "@/lib/email-base-url";
import { statusUpdateEmailHtml } from "@/lib/email-templates";

export function winBackQuoteRequestUrl(): string {
  const base = getEmailBaseUrl();
  return `${base}/quote-widget?utm_source=email&utm_medium=win_back&utm_campaign=reengage`;
}

export function buildWinBackEmailHtml(params: { firstName: string }): string {
  const name = params.firstName.trim() || "there";
  const ctaUrl = winBackQuoteRequestUrl();
  return statusUpdateEmailHtml({
    eyebrow: "Yugo",
    headline: "Still thinking about your move?",
    body: `Hi ${name},<br/><br/>We know plans change. If you would like a fresh look at pricing or have new dates in mind, we would be happy to help — no pressure, just a quick check-in.<br/><br/>You can start a new quote request in a few minutes. If you prefer to talk it through, reply to this email or call us and we will connect you with your coordinator.`,
    ctaUrl,
    ctaLabel: "GET A FRESH QUOTE",
    includeFooter: true,
    tone: "premium",
  });
}

export const WIN_BACK_EMAIL_SUBJECT = "Still thinking about your move?";

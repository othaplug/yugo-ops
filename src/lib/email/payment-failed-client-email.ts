import { getEmailBaseUrl } from "@/lib/email-base-url";
import { getCompanyPhone } from "@/lib/config";
import { statusUpdateEmailHtml } from "@/lib/email-templates";

export async function buildPaymentFailedClientEmailHtml(params: {
  firstName: string;
  quoteId: string;
  friendlyReason: string;
}): Promise<string> {
  const name = params.firstName.trim() || "there";
  const base = getEmailBaseUrl();
  const retryUrl = `${base}/quote/${encodeURIComponent(params.quoteId)}?retry=1`;
  const supportPhone = await getCompanyPhone();
  const phoneLine = supportPhone
    ? `<br/><br/>Questions? Call <a href="tel:${supportPhone.replace(/\D/g, "")}" style="color:#2C3E2D;font-weight:600;">${supportPhone}</a>.`
    : "";
  return statusUpdateEmailHtml({
    eyebrow: "Payment",
    headline: "We could not process your payment",
    body: `Hi ${name},<br/><br/>Your agreement is on file, but we were not able to complete your deposit payment.<br/><br/><strong>What happened</strong><br/>${params.friendlyReason}${phoneLine}<br/><br/>You can try again securely using the link below.`,
    ctaUrl: retryUrl,
    ctaLabel: "RETRY PAYMENT",
    includeFooter: true,
    tone: "premium",
  });
}

export const PAYMENT_FAILED_CLIENT_SUBJECT = "We could not process your payment — quick fix needed";

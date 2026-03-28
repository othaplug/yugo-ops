import { detectMultipleDates } from "./detect-multiple-dates";
import { detectServiceTypeFromText } from "./detect-service-type-text";

const SKIP_EMAIL = /movebuddy|yugo|helloyugo|unsubscribe|no-?reply/i;

export type ParsedInquiryFields = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  preferred_date?: string | null;
  message?: string | null;
  service_type?: string | null;
  detected_dates: string[];
  detected_service_type?: string | null;
};

/**
 * Best-effort extraction from pasted email or notes. Coordinator should verify all fields.
 */
export function parseRawInquiryText(text: string): ParsedInquiryFields {
  const raw = (text || "").trim();
  const out: ParsedInquiryFields = {
    detected_dates: detectMultipleDates(raw),
    message: raw || null,
  };

  const emails = raw.match(/[\w.+-]+@[\w.-]+\.\w+/g);
  if (emails?.length) {
    const client = emails.find((e) => !SKIP_EMAIL.test(e));
    if (client) out.email = client.toLowerCase();
  }

  const phones = raw.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g);
  if (phones?.length) out.phone = phones[0]!.replace(/\s+/g, " ").trim();

  const addrRe =
    /\d+\s+[\w.\s]+(?:Street|St|Avenue|Ave|Road|Rd|Drive|Dr|Boulevard|Blvd|Way|Court|Ct|Crescent|Cres)[\w\s,.-]+(?:ON|Ontario|Toronto|Canada)?[\s,]*(?:[A-Z]\d[A-Z]\s?\d[A-Z]\d)?/gi;
  const addresses = raw.match(addrRe);
  if (addresses?.length) {
    out.from_address = addresses[0]!.trim();
    if (addresses.length >= 2) out.to_address = addresses[1]!.trim();
  }

  if (out.detected_dates.length > 0) {
    out.preferred_date = out.detected_dates[0]!;
  }

  const nameMatch = raw.match(
    /(?:Name|Client|Contact|Hi|Dear)\s*[:#]?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/m,
  );
  if (nameMatch?.[1]) {
    const parts = nameMatch[1].trim().split(/\s+/);
    out.first_name = parts[0] || null;
    out.last_name = parts.slice(1).join(" ") || null;
  }

  const svc = detectServiceTypeFromText(raw, "");
  if (svc) {
    out.service_type = svc.slug;
    out.detected_service_type = svc.slug;
  }

  return out;
}

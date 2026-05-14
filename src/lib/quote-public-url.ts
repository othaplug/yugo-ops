import { getConfig } from "@/lib/config";

/** Client-facing quote URL using platform_config `public_domain`.
 *
 * Default is `www.yugoplus.co` (NOT the apex) — the apex 307-redirects to
 * www on Vercel, and webhook senders that POST back to a quote-derived URL
 * (Square, etc.) don't follow redirects. Always serve the canonical www
 * host so every link aims at a 200 response. */
export async function getPublicQuoteUrl(quoteId: string): Promise<string> {
  const raw = (await getConfig("public_domain", "www.yugoplus.co")).trim();
  const host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `https://${host}/quote/${quoteId}`;
}

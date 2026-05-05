import { getConfig } from "@/lib/config";

/** Client-facing quote URL using platform_config `public_domain` (e.g. liveyugo.com). */
export async function getPublicQuoteUrl(quoteId: string): Promise<string> {
  const raw = (await getConfig("public_domain", "yugoplus.co")).trim();
  const host = raw.replace(/^https?:\/\//i, "").replace(/\/$/, "");
  return `https://${host}/quote/${quoteId}`;
}

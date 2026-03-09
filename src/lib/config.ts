import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cached platform_config reader for server-side use.
 * Reads from Supabase `platform_config` table with a short in-memory TTL
 * so frequently-accessed values (company phone, email, etc.) don't hit the DB every request.
 */

let cache: Record<string, string> = {};
let cacheTime = 0;
const TTL_MS = 60_000; // 1 minute

async function loadConfig(): Promise<Record<string, string>> {
  if (Date.now() - cacheTime < TTL_MS && Object.keys(cache).length > 0) {
    return cache;
  }
  try {
    const sb = createAdminClient();
    const { data } = await sb.from("platform_config").select("key, value");
    const map: Record<string, string> = {};
    for (const row of data ?? []) {
      map[row.key] = row.value;
    }
    cache = map;
    cacheTime = Date.now();
    return map;
  } catch (err) {
    console.error("[config] Failed to load platform_config", err);
    return cache; // stale is better than nothing
  }
}

export async function getConfig(key: string, fallback = ""): Promise<string> {
  const map = await loadConfig();
  return map[key] || fallback;
}

export async function getConfigs(
  keys: string[],
  fallbacks: Record<string, string> = {},
): Promise<Record<string, string>> {
  const map = await loadConfig();
  const result: Record<string, string> = {};
  for (const k of keys) {
    result[k] = map[k] || fallbacks[k] || "";
  }
  return result;
}

export async function getCompanyPhone(): Promise<string> {
  return getConfig(
    "company_phone",
    process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525",
  );
}

export async function getCompanyEmail(): Promise<string> {
  return getConfig(
    "company_email",
    process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@helloyugo.com",
  );
}

export async function getDispatchPhone(): Promise<string> {
  return getConfig(
    "dispatch_phone",
    process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525",
  );
}

export async function getNotificationsFromEmail(): Promise<string> {
  const name = await getConfig("company_name", "Yugo+");
  const email = await getConfig(
    "notifications_from_email",
    "notifications@opsplus.co",
  );
  return `${name} <${email}>`;
}

export async function getAdminNotificationEmail(): Promise<string> {
  return getConfig("admin_notification_email", "notifications@opsplus.co");
}

export async function getReviewUrl(): Promise<string> {
  return getConfig(
    "company_review_url",
    process.env.NEXT_PUBLIC_REVIEW_URL ||
      "https://g.page/r/CRbJqWRCVlYBEAE/review",
  );
}

export function invalidateConfigCache(): void {
  cacheTime = 0;
}

/**
 * Crew login lockout: after N failed PIN attempts, block that phone until cooldown.
 * Uses DB for multi-instance deployments.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const LOCKOUT_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export function normalizePhoneForLockout(phone: string): string {
  return phone.replace(/\D/g, "").slice(-10);
}

export async function checkLockout(phone: string): Promise<{ locked: boolean; retryAfterMinutes?: number }> {
  const key = normalizePhoneForLockout(phone);
  if (!key) return { locked: false };

  const admin = createAdminClient();
  const { data: row } = await admin
    .from("crew_lockout_attempts")
    .select("locked_until")
    .eq("key", key)
    .maybeSingle();

  if (!row?.locked_until) return { locked: false };
  const lockedUntil = new Date(row.locked_until).getTime();
  const now = Date.now();
  if (now < lockedUntil) {
    return {
      locked: true,
      retryAfterMinutes: Math.ceil((lockedUntil - now) / 60_000),
    };
  }
  await admin.from("crew_lockout_attempts").delete().eq("key", key);
  return { locked: false };
}

export async function recordFailedAttempt(phone: string): Promise<void> {
  const key = normalizePhoneForLockout(phone);
  if (!key) return;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("crew_lockout_attempts")
    .select("failed_attempts, locked_until")
    .eq("key", key)
    .maybeSingle();

  const now = new Date().toISOString();
  let failedAttempts = (existing?.failed_attempts ?? 0) + 1;
  let lockedUntil: string | null = null;
  if (failedAttempts >= LOCKOUT_FAILED_ATTEMPTS) {
    const until = new Date(Date.now() + LOCKOUT_DURATION_MS);
    lockedUntil = until.toISOString();
  }

  const { error } = await admin.from("crew_lockout_attempts").upsert(
    {
      key,
      failed_attempts: failedAttempts,
      locked_until: lockedUntil,
      updated_at: now,
    },
    { onConflict: "key" }
  );
  if (error) console.error("[crew-lockout] upsert error:", error);
}

/** Clear lockout for a phone (e.g. after successful login or admin PIN reset). */
export async function clearLockout(phone: string): Promise<void> {
  const key = normalizePhoneForLockout(phone);
  if (!key) return;
  const admin = createAdminClient();
  await admin.from("crew_lockout_attempts").delete().eq("key", key);
}

import type { SupabaseClient } from "@supabase/supabase-js"
import { generateRecordId } from "@/lib/ids/generate-id"

/**
 * Generate a unique delivery number from the global record sequence.
 * Returns e.g. "DLV-30203" — sequential and shared with YG/MV IDs.
 */
export async function generateDeliveryNumber(supabase: SupabaseClient): Promise<string> {
  return generateRecordId("DLV", supabase)
}

/**
 * Normalize any delivery ID format to canonical DLV-{number}.
 * Handles legacy 4-digit codes (DLV-1234, PJ9146, DEL-9146) and
 * new sequential codes (DLV-30203).
 */
export function normalizeDeliveryNumber(raw: string | null | undefined): string {
  const code = String(raw || "").trim().replace(/^#/, "")
  if (!code) return "DLV-0000"
  // Match all trailing digits (covers both 4-digit legacy and 5-digit new codes)
  const match = code.match(/(\d+)$/)
  const digits = match ? match[1] : "0000"
  return `DLV-${digits}`
}

/** True if the string looks like a delivery ID (PJ, DLV, DEL- prefix). */
export function isDeliveryId(s: string | null | undefined): boolean {
  const code = String(s || "").trim().toUpperCase()
  return code.startsWith("PJ") || code.startsWith("DLV") || code.startsWith("DEL-")
}

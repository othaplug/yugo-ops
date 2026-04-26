import type { SupabaseClient } from "@supabase/supabase-js"
import { generateRecordId } from "@/lib/ids/generate-id"

/**
 * Numeric part of quote_id for HubSpot job_no (no prefix), or null if not a plain numeric suffix.
 * Works for both old YG-3173 and new YG-30201 styles.
 */
export function quoteNumericSuffixForHubSpot(quoteId: string, prefix: string): string | null {
  if (!quoteId.startsWith(prefix)) return null
  const num = quoteId.slice(prefix.length)
  if (!/^\d+$/.test(num)) return null
  return num
}

/**
 * Parse numeric suffix from a display quote id (e.g. YG-30245 → 30245).
 * Accepts common casing; does not require a specific prefix beyond LETTER(S)-DIGITS.
 */
export function numericSuffixFromQuoteDisplayId(quoteIdText: string): string | null {
  const t = quoteIdText.trim()
  const m = t.match(/^([A-Za-z]+)-(\d+)$/)
  if (!m) return null
  return m[2] || null
}

/**
 * When converting a quote to a move or B2B delivery, reuse the same numeric suffix; only the prefix changes.
 * @throws if the quote id does not contain a plain numeric suffix
 */
export function convertedRecordCodeFromQuoteId(
  quoteIdText: string,
  prefix: "MV" | "DLV",
): string {
  const raw = quoteIdText.trim()
  const num =
    quoteNumericSuffixForHubSpot(raw.toUpperCase(), "YG-") ??
    numericSuffixFromQuoteDisplayId(raw)
  if (!num) {
    throw new Error(`Cannot derive record code from quote id (expected e.g. YG-30245): ${quoteIdText}`)
  }
  return `${prefix}-${num}`
}

export type GenerateNextQuoteIdOptions = {
  /** When set, next id syncs above HubSpot job_no if that exceeds the sequence value. */
  hubspotAccessToken?: string | null
}

/**
 * Generate the next quote_id from the global_record_seq with the YG prefix.
 * Returns e.g. "YG-30201".
 *
 * HubSpot sync: the numeric suffix is patched into the deal's job_no property
 * by the caller after insert — same as before, now always a 5-digit number.
 */
export async function generateNextQuoteId(
  sb: SupabaseClient,
  _options?: GenerateNextQuoteIdOptions,
): Promise<string> {
  return generateRecordId("YG", sb)
}

/** Postgres unique violation (quote_id). */
export function isQuoteIdUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  const m = (err.message || "").toLowerCase()
  return m.includes("duplicate") || m.includes("unique constraint") || m.includes("quotes_quote_id")
}

/**
 * The prefix used for quote IDs — now always "YG-" (hyphenated).
 * Kept for callers that build the HubSpot deal name or strip the prefix.
 */
export async function getQuoteIdPrefix(_sb: SupabaseClient): Promise<string> {
  return "YG-"
}

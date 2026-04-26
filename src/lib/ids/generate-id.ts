import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Three-prefix unified record ID system.
 *
 * All record types share one global Postgres sequence (global_record_seq).
 * The prefix identifies the category; the number always increments across all types.
 *
 * YG  — Residential/office/specialty/event/white-glove/labour/bin QUOTES
 * MV  — Confirmed MOVES (any tier, any type — residential, office, PM, estate)
 * DLV — ALL delivery-related records (B2B quotes, B2B jobs, one-offs, partner deliveries)
 *
 * Quote → move / quote → delivery reuse the same numeric suffix (YG-30245 → MV-30245 / DLV-30245).
 * Use generateRecordId only for brand-new records (new quotes, direct move/delivery without a quote).
 */
export type RecordPrefix = "YG" | "MV" | "DLV"

/**
 * Call generate_record_id(prefix) on the Supabase DB and return the result.
 * Throws if the RPC fails — callers should propagate the error.
 */
export async function generateRecordId(
  prefix: RecordPrefix,
  supabase: SupabaseClient,
): Promise<string> {
  const { data, error } = await supabase.rpc("generate_record_id", { prefix })

  if (error) {
    console.error(`[generate-id] Failed to generate ${prefix} record ID:`, error)
    throw new Error(`Failed to generate record ID: ${error.message}`)
  }

  return data as string
}

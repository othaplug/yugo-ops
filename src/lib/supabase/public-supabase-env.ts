/**
 * URL + anon (publishable) key for server / proxy. Prefer NEXT_PUBLIC_* so the
 * browser bundle matches; SUPABASE_* fallbacks cover env that only sets
 * server-style names (e.g. some hosting sync layouts).
 */
export function getSupabaseUrlAndAnonKey(): { url: string; anonKey: string } {
  const url =
    (process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "").trim() || "";
  const anonKey =
    (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "").trim() ||
    "";
  return { url, anonKey };
}

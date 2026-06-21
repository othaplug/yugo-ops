import { createClient } from "@supabase/supabase-js";

/**
 * Service-role admin client. The DB schema is captured in
 * src/lib/database.types.ts (regenerate after migrations:
 *   supabase gen types typescript --linked > src/lib/database.types.ts) and
 * `npm run check:db` validates every .from().select() against it to catch
 * phantom-column queries (a column a table lacks errors the whole query and
 * returns null). Fully typing this client surfaces ~550 pre-existing
 * return-type mismatches, so the guard runs as a separate check for now.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for admin operations");
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

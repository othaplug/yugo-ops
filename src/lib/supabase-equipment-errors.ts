/**
 * Detect PostgREST / Supabase errors when equipment tables are missing or not in schema cache.
 */
export function isEquipmentRelationUnavailable(message: string | undefined | null): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes("schema cache") ||
    (m.includes("could not find") && (m.includes("equipment_checks") || m.includes("equipment_check"))) ||
    (m.includes("relation") && m.includes("does not exist") && m.includes("equipment"))
  );
}

export const EQUIPMENT_TRACKING_UNAVAILABLE_MESSAGE =
  "Equipment check isn’t set up on this server yet. Ask your administrator to apply pending Supabase migrations, then in the Supabase dashboard use “Reload schema” for the API.";

export const EQUIPMENT_TRACKING_UNAVAILABLE_CODE = "EQUIPMENT_TRACKING_UNAVAILABLE" as const;

/**
 * Convert snake_case, kebab-case, or lowercase text to Title Case.
 * "piano_upright" → "Piano Upright"
 * "in_progress"  → "In Progress"
 * "walk_up_3rd"  → "Walk Up 3rd"
 */
export function toTitleCase(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

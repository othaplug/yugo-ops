/**
 * Strip legacy client message blocks from internal_notes.
 * Before the dedicated messages table, client messages were appended as:
 *   ---
 *   [YYYY-MM-DD HH:MM:SS] (Client message)
 *   message content
 * These are now in the messages table; remove them from display.
 */
export function stripClientMessagesFromNotes(
  notes: string | null | undefined
): string {
  if (!notes || !notes.trim()) return notes ?? "";
  let result = notes;
  // Remove blocks: optional separator + [timestamp] (Client message)\n + content
  // Content runs until next --- or end
  result = result.replace(
    /\n*---\n*\n*\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \(Client message\)\n[\s\S]*?(?=\n\n---|\n---|$)/g,
    ""
  );
  // Also remove block at very start (no preceding ---)
  result = result.replace(
    /^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\] \(Client message\)\n[\s\S]*?(?=\n\n---|\n---|$)/m,
    ""
  );
  // Trim trailing separators and whitespace
  result = result.replace(/\n*---\n*$/g, "").trim();
  return result || "";
}

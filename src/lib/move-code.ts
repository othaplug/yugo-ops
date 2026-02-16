/** Returns move code (6 chars max, e.g. MV3343). Uses move.move_code if set, else fallback from id. */
export function getMoveCode(move: { move_code?: string | null; id?: string | null } | string | null | undefined): string {
  if (!move) return "MV0000";
  const code = typeof move === "object" && move && "move_code" in move ? move.move_code : null;
  if (code && code.trim()) return code.trim().slice(0, 6);
  const id = typeof move === "object" && move && "id" in move ? move.id : typeof move === "string" ? move : null;
  if (!id) return "MV0000";
  let h = 0;
  for (let i = 0; i < id.length; i++) h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  return "MV" + String(Math.abs(h) % 10000).padStart(4, "0");
}

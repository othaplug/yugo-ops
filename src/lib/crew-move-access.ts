import { formatAccessForDisplay } from "@/lib/format-text";

/**
 * Parse lines written by create-move: "From: …" / "To: …" (case-insensitive).
 */
export const parseFromToLinesFromAccessNotes = (
  accessNotes: string | null | undefined,
): { from: string | null; to: string | null } => {
  const raw = (accessNotes || "").trim();
  if (!raw) return { from: null, to: null };
  const fromM = raw.match(/^\s*From:\s*([^\r\n]+)/im);
  const toM = raw.match(/^\s*To:\s*([^\r\n]+)/im);
  return {
    from: fromM?.[1]?.trim() || null,
    to: toM?.[1]?.trim() || null,
  };
};

/**
 * Pick from/to access: columns → access_notes (From:/To: lines) → optional quote.
 */
export const resolveMoveAccessLines = (args: {
  fromAccess: string | null | undefined;
  toAccess: string | null | undefined;
  accessNotes: string | null | undefined;
  fromAccessFromQuote?: string | null | undefined;
  toAccessFromQuote?: string | null | undefined;
}): { from: string | null; to: string | null } => {
  const { from: nFrom, to: nTo } = parseFromToLinesFromAccessNotes(
    args.accessNotes,
  );
  let from = args.fromAccess?.trim() || nFrom || null;
  let to = args.toAccess?.trim() || nTo || null;
  if (!from && args.fromAccessFromQuote?.trim()) {
    from = args.fromAccessFromQuote.trim();
  }
  if (!to && args.toAccessFromQuote?.trim()) {
    to = args.toAccessFromQuote.trim();
  }
  return { from, to };
};

/** Label for a single end (e.g. "Elevator", "Ground floor") — never return empty for non-empty input. */
export const accessLineText = (
  raw: string | null | undefined,
): string | null => {
  if (!raw?.trim()) return null;
  return formatAccessForDisplay(raw) ?? raw.trim();
};

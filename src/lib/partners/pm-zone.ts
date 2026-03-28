/** Canadian postal FSA (first 3 chars of A1A 1A1). */
export function extractPostalFsas(text: string): { from: string | null; to: string | null } {
  const re = /([A-Za-z]\d[A-Za-z])\s*(\d[A-Za-z]\d)/g;
  const hits: string[] = [];
  let m: RegExpExecArray | null;
  const upper = text.toUpperCase();
  while ((m = re.exec(upper)) !== null) {
    hits.push(m[1]! + m[2]!);
  }
  if (hits.length === 0) return { from: null, to: null };
  if (hits.length === 1) return { from: hits[0]!, to: hits[0]! };
  return { from: hits[0]!, to: hits[hits.length - 1]! };
}

function fsaRegion(fsa: string | null): "toronto" | "durham_peel_york" | "other_gta" | "unknown" {
  if (!fsa || fsa.length < 1) return "unknown";
  const c = fsa[0]!;
  if (c === "M") return "toronto";
  if (c === "L") {
    const n = fsa[1];
    if (n === "0" || n === "1" || n === "2" || n === "3" || n === "4" || n === "5" || n === "6" || n === "7" || n === "8" || n === "9") {
      const num = parseInt(n, 10);
      if (num <= 6) return "durham_peel_york";
    }
    return "other_gta";
  }
  if (c === "K" || c === "N") return "other_gta";
  return "unknown";
}

function normalizeLine(a: string): string {
  return a
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Heuristic zone for PM contract pricing. `partnerRegion` is a hint (e.g. gta, durham).
 */
export function detectZone(
  fromAddress: string,
  toAddress: string,
  partnerRegion: string = "gta"
): "same_building" | "local" | "within_region" | "to_from_toronto" | "outside_gta" {
  const fromN = normalizeLine(fromAddress);
  const toN = normalizeLine(toAddress);
  if (fromN.length > 8 && fromN === toN) return "same_building";

  const { from: f1, to: t1 } = extractPostalFsas(fromAddress + " " + toAddress);
  const fsaFrom = f1;
  const fsaTo = t1;

  if (!fsaFrom || !fsaTo) {
    if (partnerRegion.toLowerCase().includes("gta")) return "local";
    return "outside_gta";
  }

  const r1 = fsaRegion(fsaFrom);
  const r2 = fsaRegion(fsaTo);

  if (fsaFrom.slice(0, 3) === fsaTo.slice(0, 3)) return "local";

  const crossTorontoDurham =
    (r1 === "toronto" && r2 === "durham_peel_york") || (r2 === "toronto" && r1 === "durham_peel_york");
  if (crossTorontoDurham) return "to_from_toronto";

  if (r1 === "other_gta" && r2 === "other_gta") return "within_region";
  if (r1 === "toronto" && r2 === "toronto") return "within_region";
  if (r1 === "durham_peel_york" && r2 === "durham_peel_york") return "within_region";

  if (r1 === "unknown" && r2 === "unknown") return "outside_gta";

  const inGta =
    (r1 === "toronto" || r1 === "durham_peel_york" || r1 === "other_gta") &&
    (r2 === "toronto" || r2 === "durham_peel_york" || r2 === "other_gta");
  if (inGta) return "within_region";

  return "outside_gta";
}

/**
 * Parse item name and quantity from move_inventory item_name.
 * Supports: "Club chairs x2", "Night tables ×2", "Queen bed frame x1 (requires disassembly)"
 * Returns base name (without qty suffix) and quantity for display in ITEM and QTY columns.
 */
export function parseItemNameAndQty(itemName: string): { baseName: string; qty: number } {
  const s = (itemName || "").trim();
  if (!s) return { baseName: "", qty: 1 };

  // x2, ×2, x 2 at end or before trailing text like "(requires disassembly)"
  // Match last occurrence of " x2" or " ×2" - supports both ASCII x and Unicode ×
  const xMatch = s.match(/^(.+?)\s*[x×]\s*(\d+)\s*(.*)$/i);
  if (xMatch) {
    const rest = (xMatch[3] || "").trim();
    const baseName = (xMatch[1].trim() + (rest ? " " + rest : "")).trim();
    return { baseName: baseName || s, qty: Math.max(1, parseInt(xMatch[2], 10)) };
  }

  // (2), (x2) at end
  const parenMatch = s.match(/^(.+?)\s*\(\s*x?\s*(\d+)\s*\)\s*$/i);
  if (parenMatch) return { baseName: parenMatch[1].trim(), qty: Math.max(1, parseInt(parenMatch[2], 10)) };

  // 2x at end (reverse order)
  const revMatch = s.match(/^(.+?)\s+(\d+)\s*[x×]\s*$/i);
  if (revMatch) return { baseName: revMatch[1].trim(), qty: Math.max(1, parseInt(revMatch[2], 10)) };

  return { baseName: s, qty: 1 };
}

/**
 * Split a comma-separated item list, respecting delimiters that live
 * INSIDE parentheses / brackets / quotes. Without this guard, an item
 * like `Artwork — framed (large, Over 48")` was split at the comma
 * inside the parenthetical and displayed as two separate rows
 * ("Artwork — framed (large" and `Over 48")`).
 */
function splitTopLevelCommas(s: string): string[] {
  const out: string[] = [];
  let buf = "";
  let paren = 0;
  let bracket = 0;
  let brace = 0;
  let inDouble = false;
  let inSingle = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (!inSingle && !inDouble) {
      if (c === "(") paren++;
      else if (c === ")") paren = Math.max(0, paren - 1);
      else if (c === "[") bracket++;
      else if (c === "]") bracket = Math.max(0, bracket - 1);
      else if (c === "{") brace++;
      else if (c === "}") brace = Math.max(0, brace - 1);
    }
    if (c === '"' && !inSingle) inDouble = !inDouble;
    else if (c === "'" && !inDouble) inSingle = !inSingle;
    if (
      c === "," &&
      paren === 0 &&
      bracket === 0 &&
      brace === 0 &&
      !inDouble &&
      !inSingle
    ) {
      out.push(buf);
      buf = "";
      continue;
    }
    buf += c;
  }
  if (buf.length > 0) out.push(buf);
  return out;
}

/** Expand "Table x1, Couch x2" into rows for display */
export function expandItemRow(itemName: string): { label: string; qty: number }[] {
  const parts = splitTopLevelCommas(itemName)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) {
    const { baseName, qty } = parseItemNameAndQty(itemName);
    return [{ label: baseName || itemName, qty }];
  }
  return parts.map((part) => {
    const { baseName, qty } = parseItemNameAndQty(part);
    return { label: baseName || part, qty };
  });
}

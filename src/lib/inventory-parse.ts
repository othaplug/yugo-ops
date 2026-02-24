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

/** Expand "Table x1, Couch x2" into rows for display */
export function expandItemRow(itemName: string): { label: string; qty: number }[] {
  const parts = itemName.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) {
    const { baseName, qty } = parseItemNameAndQty(itemName);
    return [{ label: baseName || itemName, qty }];
  }
  return parts.map((part) => {
    const { baseName, qty } = parseItemNameAndQty(part);
    return { label: baseName || part, qty };
  });
}

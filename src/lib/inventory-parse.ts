/**
 * Parse item name and quantity from move_inventory item_name.
 * Supports: "Club chairs x2", "sofas x 2", "Coffee tables (x3)", "Desk (2)", "Cabinet 3 ft x1"
 * Returns base name (without qty suffix) and quantity for display in ITEM and QTY columns.
 */
export function parseItemNameAndQty(itemName: string): { baseName: string; qty: number } {
  const s = (itemName || "").trim();
  if (!s) return { baseName: "", qty: 1 };

  // x2, x 2, x3 at end (space optional before x: "Club chairs x2" or "Club chairsx2")
  const xMatch = s.match(/^(.+?)\s*x\s*(\d+)\s*$/i);
  if (xMatch) return { baseName: xMatch[1].trim(), qty: Math.max(1, parseInt(xMatch[2], 10)) };

  // (2), (x2) at end
  const parenMatch = s.match(/^(.+?)\s*\(\s*x?\s*(\d+)\s*\)\s*$/i);
  if (parenMatch) return { baseName: parenMatch[1].trim(), qty: Math.max(1, parseInt(parenMatch[2], 10)) };

  // 2x at end (reverse order)
  const revMatch = s.match(/^(.+?)\s+(\d+)\s*x\s*$/i);
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

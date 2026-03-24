import { parseItemNameAndQty } from "@/lib/inventory-parse";

export type NormalizedDeliveryItem = { name: string; qty: number; room: string };

function tryParseJsonObjectItem(s: string): { name: string; qty: number } | null {
  const t = s.trim();
  if (!t.startsWith("{")) return null;
  try {
    const o = JSON.parse(t) as unknown;
    if (!o || typeof o !== "object" || Array.isArray(o)) return null;
    const rec = o as Record<string, unknown>;
    const name = rec.name;
    if (typeof name !== "string" || !name.trim()) return null;
    const qtyRaw = rec.qty ?? rec.quantity;
    const qty =
      typeof qtyRaw === "number" && Number.isFinite(qtyRaw)
        ? Math.max(1, Math.floor(qtyRaw))
        : 1;
    return { name: name.trim(), qty };
  } catch {
    return null;
  }
}

/**
 * Normalizes one deliveries.items[] element for display and grouping.
 * Handles: `{ name, qty }` objects, stringified JSON rows, "Room: item x2" lines, and plain text.
 */
export function normalizeDeliveryItem(raw: unknown): NormalizedDeliveryItem {
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return { name: "", qty: 1, room: "Items" };

    const fromJson = tryParseJsonObjectItem(t);
    if (fromJson) return { ...fromJson, room: "Items" };

    const colonIdx = t.indexOf(":");
    if (colonIdx > -1) {
      const room = t.slice(0, colonIdx).trim() || "Items";
      const rest = t.slice(colonIdx + 1).trim();
      const { baseName, qty } = parseItemNameAndQty(rest);
      return { name: (baseName || rest).trim() || rest, qty, room };
    }

    const { baseName, qty } = parseItemNameAndQty(t);
    return { name: (baseName || t).trim(), qty, room: "Items" };
  }

  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const o = raw as Record<string, unknown>;
    const n = o.name;
    if (typeof n === "string" && n.trim()) {
      const qtyRaw = o.qty ?? o.quantity;
      const qty =
        typeof qtyRaw === "number" && Number.isFinite(qtyRaw)
          ? Math.max(1, Math.floor(qtyRaw))
          : 1;
      return { name: n.trim(), qty, room: "Items" };
    }
  }

  return { name: String(raw ?? "").trim() || "Item", qty: 1, room: "Items" };
}

/** Flat list for admin / PDF / partner summaries (no room column). */
export function normalizeDeliveryItemsForDisplay(raw: unknown): { name: string; qty: number }[] {
  const arr = Array.isArray(raw) ? raw : [];
  return arr.map((el) => {
    const { name, qty } = normalizeDeliveryItem(el);
    return { name, qty };
  });
}

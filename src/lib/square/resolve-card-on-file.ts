import { squareClient } from "@/lib/square";

export type ResolvedCard = {
  /** The Square card id to charge (`ccof:...`). */
  cardId: string;
  /** True when this differs from the preferred/stored id (card was swapped). */
  changed: boolean;
  last4?: string | null;
  cardBrand?: string | null;
} | null;

/**
 * Resolve the card to charge for a Square customer = the card currently ON FILE,
 * read LIVE from Square. The stored/preferred card id is only a hint: a client
 * can delete and re-add a card any time, so charging a stale id makes Square
 * reject the whole payment with NOT_FOUND ("did not find matching card" —
 * MV-30402). We must charge whatever enabled card the customer has NOW.
 *
 *  - preferred card still enabled → use it (changed=false)
 *  - otherwise → the most recently added enabled card (changed=true)
 *  - customer has no enabled card → null (caller handles "no card on file")
 *
 * On a Square/network error we fall back to the preferred id so a transient
 * outage never blocks a charge that would otherwise have worked.
 */
export async function resolveCardOnFile(
  customerId: string | null | undefined,
  preferredCardId?: string | null,
): Promise<ResolvedCard> {
  const cid = (customerId ?? "").trim();
  const pref = (preferredCardId ?? "").trim();
  if (!cid) return pref ? { cardId: pref, changed: false } : null;

  const cards: Array<{
    id?: string;
    enabled?: boolean;
    last4?: string | null;
    cardBrand?: string | null;
    createdAt?: string;
  }> = [];
  try {
    const list = await squareClient.cards.list({ customerId: cid, sortOrder: "ASC" });
    for await (const c of list) cards.push(c as never);
  } catch (e) {
    console.warn("[resolveCardOnFile] cards.list failed:", (e as Error)?.message ?? e);
    return pref ? { cardId: pref, changed: false } : null;
  }

  const enabled = cards.filter((c) => c.id && c.enabled !== false);
  if (enabled.length === 0) return null;

  const kept = pref ? enabled.find((c) => c.id === pref) : undefined;
  if (kept) return { cardId: kept.id!, changed: false, last4: kept.last4 ?? null, cardBrand: kept.cardBrand ?? null };

  // Most recently added enabled card — the one the client just switched to.
  const newest = [...enabled].sort((a, b) =>
    String(b.createdAt ?? "").localeCompare(String(a.createdAt ?? "")),
  )[0];
  return { cardId: newest.id!, changed: true, last4: newest.last4 ?? null, cardBrand: newest.cardBrand ?? null };
}

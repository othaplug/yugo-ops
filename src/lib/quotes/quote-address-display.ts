import { formatAccessForDisplay } from "@/lib/format-text";
import { abbreviateAddressRegions } from "@/lib/address-abbrev";

export type QuoteStopLocation = { address: string; access: string | null };

function normalizeLocationRow(raw: unknown): QuoteStopLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const address = String(o.address ?? "").trim();
  if (!address) return null;
  const acc = o.access != null && String(o.access).trim() ? String(o.access).trim() : null;
  return { address, access: acc };
}

/** JSONB / API may occasionally return a stringified array — normalize to []. */
function coalesceJsonArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return [];
    try {
      const p = JSON.parse(t) as unknown;
      return Array.isArray(p) ? p : [];
    } catch {
      return [];
    }
  }
  return [];
}

function addressFromExtraItem(item: unknown): string {
  if (typeof item === "string") return item.trim();
  if (item && typeof item === "object") {
    const o = item as Record<string, unknown>;
    return String(o.address ?? "").trim();
  }
  return "";
}

function normAddrKey(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

function dedupeStopRows(rows: QuoteStopLocation[]): QuoteStopLocation[] {
  const seen = new Set<string>();
  const out: QuoteStopLocation[] = [];
  for (const r of rows) {
    const k = normAddrKey(r.address);
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}

/** Pickup rows: `factors.pickup_locations` + `factors.additional_pickup_addresses`, else quote primary. */
export function pickupLocationsFromQuote(
  factors: Record<string, unknown> | null | undefined,
  primaryAddress: string | null | undefined,
  primaryAccess: string | null | undefined,
): QuoteStopLocation[] {
  const fac = factors ?? {};
  const primary = (primaryAddress ?? "").trim();
  const pa = primaryAccess != null && String(primaryAccess).trim() ? String(primaryAccess).trim() : null;

  let rows = coalesceJsonArray(fac.pickup_locations)
    .map(normalizeLocationRow)
    .filter(Boolean) as QuoteStopLocation[];

  if (rows.length === 0 && primary) {
    rows = [{ address: primary, access: pa }];
  } else if (rows.length > 0 && primary) {
    const pk = normAddrKey(primary);
    const hasPrimary = rows.some((r) => normAddrKey(r.address) === pk);
    if (!hasPrimary) {
      rows = [{ address: primary, access: pa }, ...rows];
    }
  }

  const extraPick = coalesceJsonArray(fac.additional_pickup_addresses);
  for (const ex of extraPick) {
    const addr = addressFromExtraItem(ex);
    if (addr) rows.push({ address: addr, access: null });
  }

  rows = rows.filter((r) => r.address.trim().length > 0);
  return dedupeStopRows(rows);
}

/** Dropoff rows: `factors.dropoff_locations` + `factors.additional_dropoff_addresses`, else quote primary. */
export function dropoffLocationsFromQuote(
  factors: Record<string, unknown> | null | undefined,
  primaryAddress: string | null | undefined,
  primaryAccess: string | null | undefined,
): QuoteStopLocation[] {
  const fac = factors ?? {};
  const primary = (primaryAddress ?? "").trim();
  const pa = primaryAccess != null && String(primaryAccess).trim() ? String(primaryAccess).trim() : null;

  let rows = coalesceJsonArray(fac.dropoff_locations)
    .map(normalizeLocationRow)
    .filter(Boolean) as QuoteStopLocation[];

  if (rows.length === 0 && primary) {
    rows = [{ address: primary, access: pa }];
  } else if (rows.length > 0 && primary) {
    const pk = normAddrKey(primary);
    const hasPrimary = rows.some((r) => normAddrKey(r.address) === pk);
    if (!hasPrimary) {
      rows = [{ address: primary, access: pa }, ...rows];
    }
  }

  const extraDrop = coalesceJsonArray(fac.additional_dropoff_addresses);
  for (const ex of extraDrop) {
    const addr = addressFromExtraItem(ex);
    if (addr) rows.push({ address: addr, access: null });
  }

  rows = rows.filter((r) => r.address.trim().length > 0);
  return dedupeStopRows(rows);
}

export function abbreviateLocationRows(rows: QuoteStopLocation[]): QuoteStopLocation[] {
  return rows.map((r) => ({
    address: abbreviateAddressRegions(r.address),
    access: r.access,
  }));
}

export function accessLabel(access: string | null | undefined): string | null {
  return formatAccessForDisplay(access);
}

export type AdditionalStopInput = { address?: string | null };

/** Build factors.pickup_locations / dropoff_locations for quote generation (primary + extras). */
export function pickupDropoffFactorsFromPayload(input: {
  from_address: string;
  to_address: string;
  from_access?: string | null;
  to_access?: string | null;
  additional_pickup_addresses?: AdditionalStopInput[] | null;
  additional_dropoff_addresses?: AdditionalStopInput[] | null;
}): {
  pickup_locations: QuoteStopLocation[];
  dropoff_locations: QuoteStopLocation[];
  multi_pickup: boolean;
  multi_dropoff: boolean;
} {
  const extraPick = (input.additional_pickup_addresses ?? [])
    .map((x) => (x.address ?? "").trim())
    .filter((a) => a.length > 0)
    .map((address) => ({ address, access: null as string | null }));
  const extraDrop = (input.additional_dropoff_addresses ?? [])
    .map((x) => (x.address ?? "").trim())
    .filter((a) => a.length > 0)
    .map((address) => ({ address, access: null as string | null }));

  const fromAcc = input.from_access != null && String(input.from_access).trim() ? String(input.from_access).trim() : null;
  const toAcc = input.to_access != null && String(input.to_access).trim() ? String(input.to_access).trim() : null;

  const pickup_locations: QuoteStopLocation[] = [
    { address: input.from_address.trim(), access: fromAcc },
    ...extraPick,
  ].filter((r) => r.address.length > 0);

  const dropoff_locations: QuoteStopLocation[] = [
    { address: input.to_address.trim(), access: toAcc },
    ...extraDrop,
  ].filter((r) => r.address.length > 0);

  return {
    pickup_locations,
    dropoff_locations,
    multi_pickup: pickup_locations.length > 1,
    multi_dropoff: dropoff_locations.length > 1,
  };
}

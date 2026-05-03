export type ContractRateCard = Record<string, unknown>;

function num(v: unknown): number | undefined {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/**
 * Price a move from a partner contract rate_card JSON.
 * moveType keys match rate card sections, e.g. renovation_move_out, renovation_bundle, tenant_move_gta.
 * unitSize: studio | 1br | 2br | 3br | 4br_plus
 */
export function getContractPrice(
  rateCard: ContractRateCard | null | undefined,
  moveType: string,
  unitSize: string,
  extras: { weekend?: boolean; afterHours?: boolean; holiday?: boolean }
): number {
  const card = rateCard && typeof rateCard === "object" ? rateCard : {};
  const section = card[moveType] as Record<string, unknown> | undefined;
  if (!section || typeof section !== "object") {
    throw new Error(`No rate section for ${moveType}`);
  }
  const baseRate = num(section[unitSize]);
  if (baseRate == null) {
    throw new Error(`No rate for ${moveType} / ${unitSize}`);
  }

  let total = baseRate;
  const weekend = num(card.weekend_surcharge) ?? 150;
  const holiday = num(card.holiday_surcharge) ?? 200;
  const afterPrem = num(card.after_hours_premium) ?? 0.2;

  if (extras.weekend) total += weekend;
  if (extras.holiday) total += holiday;
  if (extras.afterHours) total = Math.round(total * (1 + afterPrem));

  return total;
}

/** Like getContractPrice but returns null instead of throwing (unknown section/unit). */
export function tryGetContractPrice(
  rateCard: ContractRateCard | null | undefined,
  moveType: string,
  unitSize: string,
  extras: { weekend?: boolean; afterHours?: boolean; holiday?: boolean },
): number | null {
  try {
    return getContractPrice(rateCard, moveType, unitSize, extras);
  } catch {
    return null;
  }
}

/** Default fixed-rate card for property management contracts (CAD). Keys feed pm_rate_cards via seedPmRateMatrixFromDefaults. */
export const DEFAULT_PM_RATE_CARD: Record<string, unknown> = {
  tenant_move_out: { studio: 449, "1br": 649, "2br": 849, "3br": 1199, "4br_plus": 1599 },
  tenant_move_in: { studio: 449, "1br": 649, "2br": 849, "3br": 1199, "4br_plus": 1599 },
  reno_move_out: { studio: 349, "1br": 549, "2br": 749, "3br": 1099 },
  reno_move_in: { studio: 349, "1br": 549, "2br": 749, "3br": 1099 },
  suite_transfer: { studio: 249, "1br": 449, "2br": 649 },
  emergency_relocation: { studio: 549, "1br": 749, "2br": 949, "3br": 1299, "4br_plus": 1699 },
  staging: { studio: 249, "1br": 449, "2br": 649 },
  unit_turnover: { studio: 549, "1br": 749, "2br": 949, "3br": 1299 },
  /** Fallback bands for reasons not listed in the published matrix */
  tenant_move_gta: { studio: 449, "1br": 649, "2br": 849, "3br": 1199, "4br_plus": 1599 },
  tenant_move_outside: { studio: 649, "1br": 849, "2br": 1149, "3br": 1499, "4br_plus": 1899 },
  weekend_surcharge: 100,
  after_hours_premium: 0.15,
  holiday_surcharge: 150,
  storage_weekly_small: 100,
  storage_weekly_large: 150,
  assembly_per_item: 85,
  packing_per_room: 150,
};

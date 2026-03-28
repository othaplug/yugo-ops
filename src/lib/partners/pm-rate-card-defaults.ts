/** Default fixed-rate card for property management contracts (CAD). */
export const DEFAULT_PM_RATE_CARD: Record<string, unknown> = {
  renovation_move_out: { studio: 450, "1br": 650, "2br": 950, "3br": 1350, "4br_plus": 1800 },
  renovation_move_in: { studio: 400, "1br": 600, "2br": 900, "3br": 1250, "4br_plus": 1700 },
  renovation_bundle: { studio: 800, "1br": 1150, "2br": 1750, "3br": 2450, "4br_plus": 3300 },
  tenant_move_gta: { studio: 500, "1br": 700, "2br": 1050, "3br": 1500, "4br_plus": 2000 },
  tenant_move_outside: { studio: 700, "1br": 950, "2br": 1350, "3br": 1900, "4br_plus": 2500 },
  weekend_surcharge: 150,
  after_hours_premium: 0.2,
  holiday_surcharge: 200,
  storage_weekly_small: 100,
  storage_weekly_large: 150,
  assembly_per_item: 85,
  packing_per_room: 150,
};

/**
 * Defaults for specialty quote math. Merged with platform_config JSON overrides
 * (`specialty_project_base_prices`, `specialty_equipment_surcharges`).
 */

export const SPECIALTY_PROJECT_BASE_DEFAULTS: Record<string, number> = {
  /** Midpoints from coordinator guide — override via `specialty_project_base_prices` in platform_config */
  piano_upright: 400,
  piano_grand: 750,
  art_sculpture: 120,
  antiques_estate: 600,
  safe_vault: 400,
  safe_under_300lbs: 250,
  safe_over_300lbs: 500,
  pool_table: 400,
  pool_table_slate: 1000,
  hot_tub: 650,
  wine_collection: 2000,
  aquarium: 325,
  motorcycle: 400,
  gym_equipment: 112,
  trade_show: 1250,
  medical_lab: 1550,
  other: 500,
  art_installation: 800,
  "Art installation": 800,
  "Trade show": 1200,
  estate_cleanout: 600,
  "Estate cleanout": 600,
  staging: 500,
  "Home staging": 500,
  wine_transport: 400,
  "Wine transport": 400,
  medical_equip: 800,
  "Medical equipment": 800,
  piano_move: 400,
  "Piano move": 400,
  event_setup: 600,
  "Event setup/teardown": 600,
  custom: 500,
  Custom: 500,
};

/** Primary UI label per canonical key (first match wins for legacy duplicates). */
export const SPECIALTY_PROJECT_LABELS: Record<string, string> = {
  piano_upright: "Piano (upright)",
  piano_grand: "Piano (grand)",
  art_sculpture: "Art / sculpture",
  antiques_estate: "Antiques / estate",
  safe_vault: "Safe / vault",
  pool_table: "Pool table (non-slate)",
  pool_table_slate: "Pool table (slate)",
  safe_under_300lbs: "Safe (under 300 lb)",
  safe_over_300lbs: "Safe (over 300 lb)",
  motorcycle: "Motorcycle",
  gym_equipment: "Gym equipment (per piece)",
  hot_tub: "Hot tub",
  wine_collection: "Wine collection",
  aquarium: "Aquarium",
  trade_show: "Trade show",
  medical_lab: "Medical / lab",
  other: "Other / custom scope",
  art_installation: "Art installation (legacy)",
  estate_cleanout: "Estate cleanout (legacy)",
  staging: "Home staging (legacy)",
  wine_transport: "Wine transport (legacy)",
  medical_equip: "Medical equipment (legacy)",
  piano_move: "Piano move (legacy)",
  event_setup: "Event setup / teardown (legacy)",
  custom: "Custom project",
};

export const SPECIALTY_EQUIPMENT_DEFAULTS: Record<string, number> = {
  crane_rigging: 750,
  "A-frame cart": 40,
  "Crating kit": 80,
  "Climate truck": 150,
  "Air-ride suspension": 120,
  "Lift gate": 100,
  Crane: 500,
  Custom: 200,
};

export const SPECIALTY_EQUIPMENT_LABELS: Record<string, string> = {
  crane_rigging: "Crane / rigging",
  "A-frame cart": "A-frame cart",
  "Crating kit": "Crating kit",
  "Climate truck": "Climate truck",
  "Air-ride suspension": "Air-ride suspension",
  "Lift gate": "Lift gate",
  Crane: "Crane (legacy)",
  Custom: "Custom equipment",
};

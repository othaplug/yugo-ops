/**
 * Defaults for specialty quote math. Merged with platform_config JSON overrides
 * (`specialty_project_base_prices`, `specialty_equipment_surcharges`).
 */

export const SPECIALTY_PROJECT_BASE_DEFAULTS: Record<string, number> = {
  piano_upright: 600,
  piano_grand: 1400,
  art_sculpture: 900,
  antiques_estate: 1750,
  safe_vault: 800,
  pool_table: 1050,
  hot_tub: 1400,
  wine_collection: 950,
  aquarium: 1000,
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
  piano_move: 600,
  "Piano move": 600,
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
  pool_table: "Pool table",
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

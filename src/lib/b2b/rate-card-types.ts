/**
 * TypeScript types for the B2B flat-band rate card stored in platform_config.
 * Key: "b2b_rate_card"
 */

export type B2BZoneRates = {
  "1-5"?: number;
  "6-10"?: number;
  "11-15"?: number;
  "16-20"?: number;
  "21-25"?: number;
  "26-30"?: number;
};

export type B2BZoneBandRates = {
  gta?: B2BZoneRates;
  extended_gta?: B2BZoneRates;
  regional_ontario?: B2BZoneRates;
};

export type CabinetTierRates = {
  standard?: B2BZoneBandRates;
  partner?: B2BZoneBandRates;
};

export type FlooringZoneCounts = {
  "20"?: number;
  "40"?: number;
  "60"?: number;
  "80"?: number;
  "100"?: number;
};

export type FlooringHandlingZoneRates = {
  gta?: FlooringZoneCounts;
  extended_gta?: FlooringZoneCounts;
  regional_ontario?: FlooringZoneCounts;
};

export type FlooringMaterialRates = {
  standard_curbside?: FlooringHandlingZoneRates;
  standard_inside?: FlooringHandlingZoneRates;
  partner_curbside?: FlooringHandlingZoneRates;
  partner_inside?: FlooringHandlingZoneRates;
};

export type ApplianceZoneRates = {
  "1-5"?: number;
  "6-10"?: number;
  "11-15"?: number;
  "16-20"?: number;
};

export type ApplianceZoneBandRates = {
  gta?: ApplianceZoneRates;
  extended_gta?: ApplianceZoneRates;
  regional_ontario?: ApplianceZoneRates;
};

export type ApplianceTierRates = {
  standard?: ApplianceZoneBandRates;
  partner?: ApplianceZoneBandRates;
};

export type B2BRateCard = {
  cabinets?: CabinetTierRates;
  flooring?: {
    vinyl?: FlooringMaterialRates;
    hardwood?: FlooringMaterialRates;
    tile?: FlooringMaterialRates;
  };
  appliances?: ApplianceTierRates;
};

/** Parse and validate a raw JSON value from platform_config as a B2BRateCard. */
export function parseRateCard(raw: unknown): B2BRateCard | null {
  if (!raw || typeof raw !== "object") return null;
  return raw as B2BRateCard;
}

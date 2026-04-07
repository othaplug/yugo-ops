export type PricingZone = {
  id: string;
  label: string;
  description: string;
  /** Representative delivery address for Mapbox driving distance + dimensional pricing. */
  sampleDeliveryAddress: string;
  radiusKm: number;
  color: string;
  fillOpacity: number;
  borderOpacity: number;
  distanceMultiplier: number;
  surchargeLabel: string;
};

/** Toronto-centred delivery zones (concentric rings; inner zones sit above outer on the map). */
export const PRICING_ZONES: PricingZone[] = [
  {
    id: "core",
    label: "Toronto core",
    description: "Downtown, midtown, East York, the Beaches",
    sampleDeliveryAddress: "1 Dundas St W, Toronto, ON M5G 1Z3, Canada",
    radiusKm: 12,
    color: "#2B3927",
    fillOpacity: 0.12,
    borderOpacity: 0.35,
    distanceMultiplier: 1.0,
    surchargeLabel: "Base rate",
  },
  {
    id: "inner",
    label: "Inner GTA",
    description: "North York, Scarborough, Etobicoke, east Toronto",
    sampleDeliveryAddress: "4789 Yonge St, North York, ON M2N 0G3, Canada",
    radiusKm: 28,
    color: "#3D7A35",
    fillOpacity: 0.08,
    borderOpacity: 0.3,
    distanceMultiplier: 1.0,
    surchargeLabel: "Base rate",
  },
  {
    id: "greater",
    label: "Greater GTA",
    description: "Mississauga, Brampton, Markham, Vaughan, Richmond Hill, Pickering",
    sampleDeliveryAddress: "100 City Centre Dr, Mississauga, ON L5B 2C9, Canada",
    radiusKm: 50,
    color: "#C9A96E",
    fillOpacity: 0.08,
    borderOpacity: 0.3,
    distanceMultiplier: 1.08,
    surchargeLabel: "+8%",
  },
  {
    id: "extended",
    label: "Extended GTA",
    description: "Oakville, Burlington, Milton, Newmarket, Ajax, Whitby, Oshawa",
    sampleDeliveryAddress: "1011 Upper Middle Rd E, Oakville, ON L6H 5Z9, Canada",
    radiusKm: 75,
    color: "#D4895A",
    fillOpacity: 0.07,
    borderOpacity: 0.25,
    distanceMultiplier: 1.15,
    surchargeLabel: "+15%",
  },
  {
    id: "southern",
    label: "Southern Ontario",
    description: "Hamilton, Kitchener, Barrie, Peterborough, St. Catharines",
    sampleDeliveryAddress: "21 King St W, Hamilton, ON L8P 4W7, Canada",
    radiusKm: 130,
    color: "#9B3A5A",
    fillOpacity: 0.06,
    borderOpacity: 0.2,
    distanceMultiplier: 1.25,
    surchargeLabel: "+25%",
  },
  {
    id: "region",
    label: "Extended region",
    description: "London, Kingston, Collingwood, Muskoka",
    sampleDeliveryAddress: "420 Wellington St, London, ON N6A 3C2, Canada",
    radiusKm: 200,
    color: "#66143D",
    fillOpacity: 0.05,
    borderOpacity: 0.15,
    distanceMultiplier: 1.4,
    surchargeLabel: "+40%",
  },
];

export const TORONTO_CENTER_LNG_LAT: [number, number] = [-79.3832, 43.6532];

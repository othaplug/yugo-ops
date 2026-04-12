export type WaiverCategoryCode =
  | "disassembly_risk"
  | "tight_access"
  | "pre_existing_damage"
  | "fragile_no_crating"
  | "property_risk"
  | "weight_exceeds"
  | "client_packed"
  | "other";

export type WaiverCategory = {
  code: WaiverCategoryCode;
  label: string;
  description: string;
  examples: string[];
  risks: string[];
};

export const WAIVER_CATEGORIES: WaiverCategory[] = [
  {
    code: "disassembly_risk",
    label: "Disassembly risk",
    description:
      "Item cannot be safely disassembled due to previous poor installation, stripped screws, glued joints, or non-standard hardware.",
    examples: [
      "Bed frame with stripped or cross-threaded bolts",
      "Wall-mounted unit with anchors embedded in drywall",
      "IKEA furniture assembled with glue (not designed for disassembly)",
      "Custom built-in that was never meant to be removed",
    ],
    risks: [
      "Broken joints or hardware during disassembly",
      "Inability to reassemble at destination",
      "Cosmetic damage to the piece",
    ],
  },
  {
    code: "tight_access",
    label: "Tight access or fit",
    description:
      "Item dimensions are very close to or exceed the available clearance through doorways, hallways, stairwells, or elevator doors.",
    examples: [
      "Sofa wider than doorframe by less than 2 inches",
      "King mattress through narrow hallway with tight turn",
      "Large dresser through spiral staircase",
      "Oversized art through standard elevator door",
    ],
    risks: [
      "Scratches or dents to walls, door frames, or banisters",
      "Scuffing or tearing of item upholstery or finish",
      "Item may not fit and need to return to origin",
    ],
  },
  {
    code: "pre_existing_damage",
    label: "Pre-existing damage",
    description:
      "Item has visible existing damage, wear, or structural weakness that may worsen during handling and transport.",
    examples: [
      "Cracked glass on a table top",
      "Wobbly chair leg",
      "Chipped veneer on dresser",
      "Water-damaged particle board",
      "Loose mirror backing",
    ],
    risks: [
      "Existing damage may worsen during move",
      "Item may break during handling despite careful treatment",
      "Yugo cannot guarantee item arrives in better condition than pickup",
    ],
  },
  {
    code: "fragile_no_crating",
    label: "Fragile item without crating",
    description:
      "Item is highly fragile and would normally require custom crating for safe transport, but client has opted not to use crating.",
    examples: [
      "Large framed glass artwork",
      "Marble table top",
      "Antique mirror",
      "Ceramic or porcelain sculpture",
      "Neon sign",
    ],
    risks: [
      "Breakage during transport despite wrapping",
      "Vibration damage on road",
      "Damage from shifting during transit",
    ],
  },
  {
    code: "property_risk",
    label: "Property damage risk",
    description:
      "Moving the item through the space poses a risk of damage to the property itself: walls, floors, door frames, banisters, or elevators.",
    examples: [
      "Heavy safe on hardwood floors without protection path",
      "Piano down narrow stairs with tight turn",
      "Heavy equipment through finished basement",
      "Oversized item through freshly painted hallway",
    ],
    risks: [
      "Scratches, dents, or scuffs to walls and door frames",
      "Floor scratches or indentations",
      "Damage to banisters or railings",
      "Paint damage on walls or trim",
    ],
  },
  {
    code: "weight_exceeds",
    label: "Extreme weight",
    description:
      "Item exceeds the safe handling capacity for the crew size or equipment available on-site.",
    examples: [
      "Safe over 500 lbs with only 2 movers",
      "Solid wood armoire on 3rd floor walk-up",
      "Cast iron bathtub",
      "Commercial equipment without lift gate",
    ],
    risks: [
      "Item may be dropped",
      "Injury risk to crew",
      "Property damage from weight",
      "Item may not be moveable with available crew",
    ],
  },
  {
    code: "client_packed",
    label: "Client-packed items",
    description:
      "Client packed boxes or items themselves without professional packing. Yugo cannot verify the packing quality or contents.",
    examples: [
      "Client-packed boxes with no indication of contents",
      "Fragile items packed by client without proper materials",
      "Electronics packed without original packaging",
      "Glassware packed in newspaper instead of bubble wrap",
    ],
    risks: [
      "Items may shift or break inside the box during transit",
      "Yugo cannot be held responsible for packing quality",
      "Contents may be damaged despite careful handling of the box",
    ],
  },
  {
    code: "other",
    label: "Other risk",
    description: "A risk not covered by the categories above.",
    examples: [],
    risks: [],
  },
];

export const waiverCategoryByCode: Record<WaiverCategoryCode, WaiverCategory> =
  WAIVER_CATEGORIES.reduce(
    (acc, c) => {
      acc[c.code] = c;
      return acc;
    },
    {} as Record<WaiverCategoryCode, WaiverCategory>,
  );

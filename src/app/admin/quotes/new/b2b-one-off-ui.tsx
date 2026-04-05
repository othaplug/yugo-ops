"use client";

import React from "react";
import {
  Wrench,
  Diamond,
  Trash,
  Truck,
  X,
  Plus,
  Warning,
  type IconProps,
} from "@phosphor-icons/react";
import {
  getWeightTier,
  normalizeB2bWeightCategory,
  tierRequiresActualWeight,
  weightTierSelectOptions,
} from "@/lib/pricing/weight-tiers";

/** Brand tokens: map to theme vars so admin dark mode stays readable (no wine-on-wine text). */
export const B2B_ONEOFF_CSS = {
  "--yugo-wine": "var(--yugo-primary-text, #2C3E2D)",
  "--yugo-off-white": "var(--tx)",
  "--yugo-rose": "var(--yugo-rose-accent, #2C3E2D)",
  "--yugo-green": "#2B3927",
  "--yugo-leather": "var(--tx2, #492A1D)",
  "--yugo-border": "color-mix(in srgb, var(--brd) 85%, transparent)",
} as React.CSSProperties;

export const B2B_PREVIEW_HEADER_BY_CODE: Record<string, string> = {
  flooring: "Materials Delivery",
  furniture_retail: "White Glove Delivery",
  designer: "Interior Designer Delivery",
  interior_designer: "Interior Designer Delivery",
  medical_equipment: "Medical Equipment Delivery",
  appliance: "Appliance Delivery",
  art_gallery: "Art & Gallery Delivery",
  restaurant_hospitality: "Restaurant & Hospitality Delivery",
  ecommerce_bulk: "E-Commerce / Last-Mile Delivery",
  ecommerce: "E-Commerce / Last-Mile Delivery",
  cabinetry: "Cabinetry & Fixtures Delivery",
  office_furniture: "Office Furniture Delivery",
  custom: "Custom Delivery",
};

/** Title Case labels by vertical code (Office / commercial uses office move, not B2B). */
export const B2B_VERTICAL_DROPDOWN_LABEL: Record<string, string> = {
  furniture_retail: "Furniture Retail Delivery",
  flooring: "Flooring / Building Materials",
  designer: "Interior Designer Projects",
  interior_designer: "Interior Designer Projects",
  medical_equipment: "Medical / Lab Equipment",
  appliance: "Appliance Delivery",
  art_gallery: "Art & Gallery",
  restaurant_hospitality: "Restaurant / Hospitality",
  ecommerce_bulk: "E-Commerce / Last-Mile",
  ecommerce: "E-Commerce / Last-Mile",
  cabinetry: "Cabinetry & Fixtures",
  office_furniture: "Office Furniture",
  custom: "Custom / Specialty",
};

/** Exclude true office-move verticals from B2B quote dropdown — not office_furniture (commercial SKUs). */
export const B2B_OFFICE_VERTICAL_CODES = new Set([
  "office",
  "office_commercial",
  "commercial_furniture",
]);

const CATALOG: Record<string, string[]> = {
  flooring: [
    "Flooring Boxes",
    "T-Mold Transition Strips",
    "Reducers",
    "Stair Nosing",
    "Quarter Round / Trim",
    "Underlayment Rolls",
    "Molding Bundles",
    "Skid / Pallet",
    "Countertop Slab",
  ],
  furniture_retail: [
    "Sofa",
    "Dining Table",
    "Chair",
    "Bed Frame",
    "Dresser",
    "Bookshelf",
    "TV Unit",
    "Console Table",
    "Coffee Table",
    "End Table",
  ],
  appliance: [
    "Refrigerator",
    "Washer",
    "Dryer",
    "Range/Oven",
    "Dishwasher",
    "Microwave (OTR)",
    "Freezer",
    "Wine Cooler",
  ],
  art_gallery: ["Framed Art", "Sculpture", "Unframed Canvas", "Glass Display"],
  restaurant_hospitality: [
    "Dining Table",
    "Bar Counter",
    "Chair Stack",
    "Booth Section",
    "Commercial Oven",
    "Prep Station",
    "Wine Fridge",
  ],
  medical_equipment: [
    "Exam Table",
    "Imaging Unit",
    "Dental Chair",
    "Monitor Station",
  ],
  ecommerce: ["Parcel", "Oversized Parcel", "Pallet"],
  ecommerce_bulk: ["Parcel", "Oversized Parcel", "Pallet"],
  designer: ["Sofa", "Accent Chair", "Area Rug", "Artwork", "Console"],
  cabinetry: ["Base Cabinet", "Wall Cabinet", "Countertop", "Vanity"],
  office_furniture: [
    "Desk",
    "Office Chair",
    "File Cabinet",
    "Conference Table",
  ],
};

export function b2bItemCatalogForVertical(code: string): string[] | null {
  const c = code.trim().toLowerCase();
  return CATALOG[c] ?? null;
}

const FLOORING_ACCESSORY_SUBSTRINGS = [
  "t-mold",
  "t-mould",
  "reducer",
  "stair nosing",
  "quarter round",
  "trim",
  "underlayment",
  "transition strip",
];

export function isFlooringBundledAccessory(
  description: string,
  verticalCode: string,
): boolean {
  if (verticalCode.trim().toLowerCase() !== "flooring") return false;
  const d = description.trim().toLowerCase();
  if (!d) return false;
  if (d.includes("flooring box")) return false;
  if (d.includes("skid") || d.includes("pallet")) return false;
  return FLOORING_ACCESSORY_SUBSTRINGS.some((s) => d.includes(s));
}

export function isSkidCatalogLabel(description: string): boolean {
  const d = description.trim().toLowerCase();
  return d.includes("skid") && d.includes("pallet");
}

export const B2B_ACCESS_PILLS: { value: string; label: string }[] = [
  { value: "ground_floor", label: "Ground Floor" },
  { value: "elevator", label: "Elevator" },
  { value: "loading_dock", label: "Loading Dock" },
  { value: "concierge", label: "Concierge" },
  { value: "walk_up_2nd", label: "Walk-Up 2nd" },
  { value: "walk_up_3rd", label: "Walk-Up 3rd" },
  { value: "walk_up_4th_plus", label: "Walk-Up 4th+" },
  { value: "narrow_stairs", label: "Narrow Stairs" },
];

export const B2B_PARKING_PILLS: { value: string; label: string }[] = [
  { value: "dedicated", label: "Dedicated / Loading Dock" },
  { value: "street", label: "Street Parking" },
  { value: "no_dedicated", label: "No Parking (+$75)" },
];

/** @deprecated Use weightTierSelectOptions() — kept for older embeds that still read this id. */
export const B2B_WEIGHT_PILLS = weightTierSelectOptions().map((o) => ({
  value: o.value,
  label: o.label.split(" — ")[0] ?? o.label,
  hint: o.shortHint,
}));

export function defaultHandlingForCatalogItem(
  verticalCode: string,
  itemLabel: string,
): string {
  const v = verticalCode.trim().toLowerCase();
  const d = itemLabel.trim().toLowerCase();
  if (isSkidCatalogLabel(itemLabel)) return "skid_drop";
  if (v === "flooring" && (d.includes("box") || d.includes("underlayment")))
    return "carry_in";
  if (v === "flooring") return "carry_in";
  if (v === "furniture_retail" || v === "designer" || v === "interior_designer")
    return "room_of_choice";
  if (v === "appliance") return "threshold";
  if (v === "art_gallery") return "white_glove";
  return "threshold";
}

export function defaultWeightForCatalogItem(itemLabel: string): string {
  const d = itemLabel.trim().toLowerCase();
  // Cabinetry & fixtures
  if (d.includes("upper cabinet") || d.includes("wall cabinet")) return "heavy";
  if (
    d.includes("lower") ||
    d.includes("base cabinet") ||
    d.includes("pantry") ||
    d.includes("tall cabinet")
  )
    return "very_heavy";
  if (d.includes("vanity")) return "heavy";
  if (d.includes("countertop")) return "super_heavy";
  if (d.includes("island")) return "very_heavy";
  if (d.includes("closet system") || d.includes("panel")) return "standard";
  if (
    d.includes("door") ||
    d.includes("drawer front") ||
    d.includes("hardware") ||
    d.includes("filler") ||
    d.includes("trim")
  )
    return "light";
  // Furniture retail
  if (d.includes("sofa") || d.includes("sectional")) return "heavy";
  if (d.includes("dining table")) return "heavy";
  if (d.includes("dresser")) return "heavy";
  if (d.includes("bed frame")) return "heavy";
  if (d.includes("coffee table")) return "standard";
  if (d.includes("chair") && !d.includes("dental")) return "light";
  // Medical
  if (d.includes("mri")) return "extreme";
  if (d.includes("ultrasound")) return "heavy";
  if (d.includes("exam table")) return "very_heavy";
  if (d.includes("dental chair")) return "very_heavy";
  if (d.includes("x-ray")) return "heavy";
  if (
    d.includes("lab instrument") ||
    d.includes("monitor") ||
    d.includes("display") ||
    d.includes("cart")
  )
    return "standard";
  if (d.includes("sterilization")) return "heavy";
  // Appliance
  if (
    d.includes("refrigerator") ||
    d.includes("washer") ||
    d.includes("dryer") ||
    d.includes("stove") ||
    d.includes("range") ||
    d.includes("freezer")
  )
    return "very_heavy";
  if (d.includes("dishwasher") || d.includes("wine cooler")) return "heavy";
  if (d.includes("microwave")) return "standard";
  // Restaurant
  if (d.includes("booth") || d.includes("kitchen equipment"))
    return "very_heavy";
  if (d.includes("table") && !d.includes("exam")) return "heavy";
  if (d.includes("bar stool") || d.includes("chair stack")) return "light";
  if (d.includes("pos") || d.includes("signage")) return "standard";
  if (d.includes("display case")) return "heavy";
  // E-commerce
  if (d.includes("small parcel")) return "light";
  if (d.includes("medium parcel")) return "standard";
  if (d.includes("large parcel")) return "heavy";
  if (d.includes("oversized") || d.includes("pallet")) return "very_heavy";
  // Office
  if (d.includes("conference table")) return "very_heavy";
  if (
    d.includes("desk") ||
    d.includes("filing") ||
    d.includes("bookcase") ||
    d.includes("credenza")
  )
    return "heavy";
  if (
    d.includes("office chair") ||
    d.includes("cubicle") ||
    d.includes("whiteboard")
  )
    return "standard";
  // Flooring / generic
  if (d.includes("pallet") || d.includes("skid")) return "very_heavy";
  if (d.includes("flooring box") || d.includes("underlayment"))
    return "standard";
  if (d.includes("parcel")) return "standard";
  return "standard";
}

export function isMoveDateTodayToronto(isoDate: string): boolean {
  const raw = isoDate?.trim();
  if (!raw) return false;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  if (!y || !m || !d) return false;
  const today = `${y}-${m}-${d}`;
  return raw === today;
}

export function B2bSectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className="text-[16px] font-bold pb-2 mb-4 border-b border-[var(--brd)]"
      style={{ color: "var(--yugo-primary-text, var(--tx))" }}
    >
      {children}
    </h3>
  );
}

export function B2bPill({
  selected,
  onClick,
  children,
  title,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={`px-4 py-2 rounded-md text-[13px] font-medium transition-colors border ${
        selected
          ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
          : "bg-transparent text-[var(--tx)] border-[var(--brd)] hover:bg-[var(--bg2)]"
      }`}
    >
      {children}
    </button>
  );
}

export function B2bFieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="block text-[13px] font-medium mb-1 text-[var(--tx2)]">
      {children}
    </span>
  );
}

const b2bInputClass =
  "w-full h-11 rounded-lg border px-3 text-[15px] outline-none focus:ring-0 bg-[var(--card)]";

export function b2bInputStyleProps(focusWine = true): React.CSSProperties {
  return {
    borderColor: "var(--brd)",
    ...(focusWine
      ? ({ "--tw-ring-color": "var(--gold)" } as React.CSSProperties)
      : undefined),
  };
}

export function B2bItemRowView(props: {
  idx: number;
  row: {
    description: string;
    qty: number;
    weight_category?: string;
    weight_lbs?: number;
    actual_weight_lbs?: number;
    fragile?: boolean;
    handling_type?: string;
    assembly_required?: boolean;
    debris_removal?: boolean;
    haul_away?: boolean;
    bundled?: boolean;
    is_skid?: boolean;
  };
  verticalCode: string;
  showCarryInPerBox: boolean;
  showHaulAwayFlag: boolean;
  onChange: (idx: number, patch: Partial<typeof props.row>) => void;
  onRemove: (idx: number) => void;
  catalogOpen: number | null;
  setCatalogOpen: (idx: number | null) => void;
  suggestions: string[];
  wine: string;
  leather: string;
}) {
  const {
    idx,
    row,
    verticalCode,
    showCarryInPerBox,
    showHaulAwayFlag,
    onChange,
    onRemove,
    catalogOpen,
    setCatalogOpen,
    suggestions,
    wine,
    leather,
  } = props;

  const handlingOptions: { key: string; label: string }[] = [
    { key: "threshold", label: "Threshold" },
    { key: "room_of_choice", label: "Room Placement" },
    { key: "white_glove", label: "White Glove" },
    ...(showCarryInPerBox
      ? [{ key: "carry_in", label: "Carry-In Per Box" } as const]
      : []),
    ...(row.is_skid || row.handling_type === "skid_drop"
      ? [{ key: "skid_drop", label: "Skid Drop" } as const]
      : []),
  ];

  const ht = row.handling_type || "threshold";
  const tierCode = normalizeB2bWeightCategory(
    row.weight_category || "standard",
  );
  const tier = getWeightTier(tierCode);
  const needsActual = tierRequiresActualWeight(tierCode);

  const iconBtn = (
    active: boolean,
    Icon: React.ComponentType<IconProps>,
    label: string,
    on: () => void,
  ) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={on}
      className="p-1.5 rounded-md transition-colors"
      style={{
        color: active ? wine : leather,
        backgroundColor: active ? `${wine}18` : "transparent",
      }}
    >
      <Icon
        className="w-4 h-4"
        weight={active ? "fill" : "regular"}
        aria-hidden
      />
    </button>
  );

  return (
    <div
      className="rounded-lg border p-3 space-y-2"
      style={{ borderColor: "var(--yugo-border, rgba(73,42,29,0.25))" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="number"
          min={1}
          className={`${b2bInputClass} w-[60px] text-center tabular-nums shrink-0`}
          style={b2bInputStyleProps()}
          value={row.qty}
          onChange={(e) => {
            const n = Math.max(1, Math.floor(Number(e.target.value) || 1));
            onChange(idx, { qty: n });
          }}
        />
        <div className="relative flex-1 min-w-[140px]">
          <input
            className={`${b2bInputClass}`}
            style={b2bInputStyleProps()}
            placeholder="Item Description..."
            value={row.description}
            onChange={(e) => {
              const v = e.target.value;
              onChange(idx, { description: v });
              setCatalogOpen(idx);
            }}
            onFocus={() => setCatalogOpen(idx)}
            onBlur={() => window.setTimeout(() => setCatalogOpen(null), 150)}
          />
          {catalogOpen === idx && suggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 top-full mt-1 max-h-40 overflow-auto rounded-lg border bg-[var(--card)] shadow-lg text-[13px]">
              {suggestions.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-[var(--bg)]"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    const skid = isSkidCatalogLabel(s);
                    onChange(idx, {
                      description: s,
                      handling_type: skid
                        ? "skid_drop"
                        : defaultHandlingForCatalogItem(verticalCode, s),
                      weight_category: defaultWeightForCatalogItem(s),
                      is_skid: skid,
                      bundled:
                        verticalCode === "flooring"
                          ? isFlooringBundledAccessory(s, verticalCode)
                          : false,
                    });
                    setCatalogOpen(null);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          className="w-7 h-7 shrink-0 rounded-full flex items-center justify-center text-white"
          style={{ backgroundColor: "#DC2626" }}
          aria-label="Remove Line"
          onClick={() => onRemove(idx)}
        >
          <X className="w-3.5 h-3.5" weight="bold" aria-hidden />
        </button>
      </div>

      <div className="space-y-1.5">
        <B2bFieldLabel>Weight range *</B2bFieldLabel>
        <select
          className={b2bInputClass}
          style={b2bInputStyleProps()}
          value={tierCode}
          onChange={(e) => {
            const next = e.target.value;
            const clearActual = !tierRequiresActualWeight(next)
              ? { actual_weight_lbs: undefined }
              : {};
            onChange(idx, { weight_category: next, ...clearActual });
          }}
          aria-label="Weight range"
        >
          {weightTierSelectOptions().map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
              {o.shortHint !== "Base" ? ` (${o.shortHint})` : ""} —{" "}
              {getWeightTier(o.value)?.examples ?? ""}
            </option>
          ))}
        </select>
        {tier && tier.priceFactor > 1 && (
          <p className="text-[10px] leading-snug" style={{ color: leather }}>
            {tier.range}
            {tier.requiresEquipment?.length
              ? ` · Equipment: ${tier.requiresEquipment.join(", ")}`
              : ""}
          </p>
        )}
        {needsActual && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-2 space-y-1.5">
            <label className="flex items-center gap-1.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">
              <Warning className="w-3.5 h-3.5 shrink-0" aria-hidden />
              Actual weight (lbs) *
            </label>
            <input
              type="number"
              min={1}
              required={needsActual}
              placeholder="e.g. 650"
              className={`${b2bInputClass} max-w-[120px]`}
              style={b2bInputStyleProps()}
              value={
                row.actual_weight_lbs != null && row.actual_weight_lbs > 0
                  ? String(row.actual_weight_lbs)
                  : ""
              }
              onChange={(e) => {
                const v = e.target.value.trim();
                const n = v === "" ? undefined : Number(v);
                onChange(idx, {
                  actual_weight_lbs:
                    n !== undefined && Number.isFinite(n) && n > 0
                      ? Math.round(n)
                      : undefined,
                });
              }}
            />
            {tierCode === "super_heavy" && (
              <p className="text-[10px] text-amber-800/90 dark:text-amber-200/90">
                This item typically needs 4+ crew and lift equipment. Crew and
                truck recommendations update from weight.
              </p>
            )}
            {tierCode === "extreme" && (
              <p className="text-[10px] text-amber-800/90 dark:text-amber-200/90">
                Admin review recommended. Pricing includes a per-pound surcharge
                over 800 lbs ($0.50/lb).
              </p>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <span
          className="text-[11px] font-medium uppercase tracking-wide mr-1"
          style={{ color: leather }}
        >
          Handling
        </span>
        {handlingOptions.map((p) => (
          <B2bPill
            key={p.key}
            selected={ht === p.key}
            onClick={() => {
              const skid = p.key === "skid_drop";
              onChange(idx, {
                handling_type: p.key,
                is_skid: skid || row.is_skid,
              });
            }}
          >
            {p.label}
          </B2bPill>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {iconBtn(!!row.assembly_required, Wrench, "Assembly Required", () =>
          onChange(idx, { assembly_required: !row.assembly_required }),
        )}
        {iconBtn(!!row.fragile, Diamond, "Fragile", () =>
          onChange(idx, { fragile: !row.fragile }),
        )}
        {iconBtn(
          !!row.debris_removal,
          Trash,
          "Debris / Packaging Removal",
          () => onChange(idx, { debris_removal: !row.debris_removal }),
        )}
        {showHaulAwayFlag
          ? iconBtn(!!row.haul_away, Truck, "Haul-Away (+$95)", () =>
              onChange(idx, { haul_away: !row.haul_away }),
            )
          : null}
        <input
          type="number"
          min={1}
          placeholder="lbs"
          className={`${b2bInputClass} w-[70px] text-center text-[13px]`}
          style={b2bInputStyleProps()}
          value={
            row.weight_lbs != null && row.weight_lbs > 0
              ? String(row.weight_lbs)
              : ""
          }
          onChange={(e) => {
            const v = e.target.value.trim();
            const n = v === "" ? undefined : Number(v);
            onChange(idx, {
              weight_lbs:
                n !== undefined && Number.isFinite(n) && n > 0
                  ? Math.round(n)
                  : undefined,
            });
          }}
        />
        {row.bundled ? (
          <span className="dt-badge text-[var(--grn)]">Bundled</span>
        ) : null}
        {(row.actual_weight_lbs ?? row.weight_lbs ?? 0) > 300 ||
        (tier?.crewImpact ?? 0) >= 1 ? (
          <span className="dt-badge text-red-400">Heavy Item</span>
        ) : null}
      </div>

      {row.is_skid || row.handling_type === "skid_drop" ? (
        <p className="text-[11px]" style={{ color: leather }}>
          Requires Tailgate Or Forklift
        </p>
      ) : null}
    </div>
  );
}

export function B2bAddItemCircle({
  onClick,
  wine,
}: {
  onClick: () => void;
  wine: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center justify-center rounded-full text-white shrink-0"
      style={{ width: 24, height: 24, backgroundColor: wine }}
      aria-label="Add Item"
    >
      <Plus className="w-3.5 h-3.5" weight="bold" aria-hidden />
    </button>
  );
}

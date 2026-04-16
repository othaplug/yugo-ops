"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import YugoLogo from "@/components/YugoLogo";
import YugoMarketingFooter from "@/components/YugoMarketingFooter";
import SeasonalPricingPreview from "@/components/SeasonalPricingPreview";
import { normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  CaretLeft,
  CaretDown,
  CaretRight,
  X,
  Plus,
  WarningCircle,
  CalendarBlank,
  House,
  Buildings,
  Lock,
  Check,
} from "@phosphor-icons/react";
/**
 * Aligned with `quote-shared.ts` / premium quote UI — keep hex values in sync.
 */
const WINE = "#5C1A33";
const CREAM = "#FAF7F2";
const FOREST_BODY = "#3E4D40";
const FOREST_MUTED = "#5A6B5E";
const QUOTE_EYEBROW_CLASS = "text-[11px] font-bold tracking-[0.12em] uppercase";

/** Selection rings, progress fill, primary chrome — wine (not forest). */
const ACCENT = WINE;

/* ── Move types ── */
const MOVE_TYPES = [
  {
    key: "residential",
    label: "Residential",
    desc: "Home or apartment",
    icon: "house" as const,
  },
  {
    key: "office",
    label: "Office / Commercial",
    desc: "Business relocation",
    icon: "buildings" as const,
  },
] as const;

/* ── Residential sizes ── */
const HOME_SIZES = [
  { key: "studio", label: "Studio" },
  { key: "1br", label: "1 Bedroom" },
  { key: "2br", label: "2 Bedrooms" },
  { key: "3br", label: "3 Bedrooms" },
  { key: "4br", label: "4 Bedrooms" },
  { key: "5br_plus", label: "5+ Bedrooms" },
];

const OFFICE_SIZES = [
  { key: "small", label: "Small (< 1,500 sqft)" },
  { key: "medium", label: "Medium (1,500 – 5,000 sqft)" },
  { key: "large", label: "Large (5,000+ sqft)" },
];

const BUILDING_TYPES = [
  { key: "apartment", label: "Apartment" },
  { key: "condo", label: "Condo" },
  { key: "house", label: "House" },
  { key: "townhouse", label: "Townhouse" },
];

const ACCESS_OPTIONS = [
  { key: "ground", label: "Ground Floor" },
  { key: "elevator", label: "Elevator" },
  { key: "stairs_2", label: "Stairs, 2nd Floor" },
  { key: "stairs_3", label: "Stairs, 3rd Floor" },
  { key: "stairs_4", label: "Stairs, 4th+ Floor" },
  { key: "loading_dock", label: "Loading Dock" },
];

/* ── Estimated boxes per home size ── */
const BOX_ESTIMATES: Record<string, number> = {
  studio: 12,
  "1br": 25,
  "2br": 38,
  "3br": 52,
  "4br": 68,
  "5br_plus": 95,
  small: 20,
  medium: 40,
  large: 70,
};

/* ── Furniture catalog ── */
interface CatalogItem {
  id: string;
  name: string;
  fragile: boolean;
}

const FURNITURE_CATALOG: Record<string, CatalogItem[]> = {
  "Living Room": [
    { id: "sofa_2", name: "2-Seater Sofa", fragile: false },
    { id: "sofa_3", name: "3-Seater Sofa", fragile: false },
    { id: "sectional", name: "Sectional Sofa", fragile: false },
    { id: "armchair", name: "Armchair", fragile: false },
    { id: "coffee_table", name: "Coffee Table", fragile: true },
    { id: "tv_stand", name: "TV Stand", fragile: false },
    { id: "tv_small", name: 'TV (32–50")', fragile: true },
    { id: "tv_large", name: 'TV (55"+)', fragile: true },
    { id: "bookshelf", name: "Bookshelf", fragile: false },
    { id: "floor_lamp", name: "Floor Lamp", fragile: true },
    { id: "rug_large", name: "Area Rug", fragile: false },
  ],
  Bedroom: [
    { id: "bed_queen", name: "Queen Bed + Mattress", fragile: false },
    { id: "bed_king", name: "King Bed + Mattress", fragile: false },
    { id: "bed_single", name: "Single / Twin Bed", fragile: false },
    { id: "dresser", name: "Dresser", fragile: false },
    { id: "nightstand", name: "Nightstand", fragile: false },
    { id: "wardrobe", name: "Wardrobe / Armoire", fragile: true },
    { id: "desk", name: "Desk", fragile: false },
    { id: "mirror_lg", name: "Large Mirror", fragile: true },
  ],
  "Dining Room": [
    { id: "dining_table_4", name: "Dining Table (4-seat)", fragile: true },
    { id: "dining_table_6", name: "Dining Table (6-8 seat)", fragile: true },
    { id: "dining_chairs_4", name: "Dining Chairs (set of 4)", fragile: false },
    { id: "buffet", name: "Buffet / Sideboard", fragile: false },
    { id: "china_cabinet", name: "China Cabinet", fragile: true },
  ],
  "Kitchen & Laundry": [
    { id: "fridge", name: "Refrigerator", fragile: false },
    { id: "washer", name: "Washer", fragile: false },
    { id: "dryer", name: "Dryer", fragile: false },
    { id: "dishwasher", name: "Dishwasher", fragile: false },
    { id: "kitchen_island", name: "Kitchen Island / Cart", fragile: false },
  ],
  "Home Office": [
    { id: "office_desk", name: "Office Desk", fragile: false },
    { id: "office_chair", name: "Office Chair", fragile: false },
    { id: "filing_cabinet", name: "Filing Cabinet", fragile: false },
    { id: "monitor", name: "Computer Monitor", fragile: true },
    { id: "printer", name: "Printer", fragile: true },
  ],
  "Special Items": [
    { id: "piano_upright", name: "Piano (Upright)", fragile: true },
    { id: "piano_grand", name: "Piano (Grand)", fragile: true },
    { id: "pool_table", name: "Pool Table", fragile: true },
    { id: "exercise_equip", name: "Exercise Equipment", fragile: false },
    { id: "outdoor_set", name: "Outdoor Furniture Set", fragile: false },
    { id: "bbq", name: "BBQ / Grill", fragile: false },
    { id: "artwork_lg", name: "Large Artwork / Painting", fragile: true },
    { id: "safe", name: "Safe / Heavy Box", fragile: false },
  ],
};

/** Office / commercial belongings (used when move type is Office) */
const OFFICE_FURNITURE_CATALOG: Record<string, CatalogItem[]> = {
  "Desks & Workstations": [
    { id: "office_desk_single", name: "Single Desk", fragile: false },
    { id: "office_desk_l", name: "L-Shaped Desk", fragile: false },
    { id: "office_desk_standing", name: "Standing Desk", fragile: false },
    {
      id: "workstation_cubicle",
      name: "Cubicle / Workstation",
      fragile: false,
    },
    { id: "reception_desk", name: "Reception Desk", fragile: false },
  ],
  Seating: [
    { id: "office_chair_task", name: "Task Chair", fragile: false },
    { id: "office_chair_exec", name: "Executive Chair", fragile: false },
    { id: "guest_chair", name: "Guest / Visitor Chair", fragile: false },
    { id: "conference_chair", name: "Conference Chair", fragile: false },
    { id: "sofa_office", name: "Office Sofa / Lounge", fragile: false },
  ],
  "Storage & Filing": [
    { id: "filing_cabinet_2", name: "2-Drawer Filing Cabinet", fragile: false },
    { id: "filing_cabinet_4", name: "4-Drawer Filing Cabinet", fragile: false },
    { id: "lateral_file", name: "Lateral File Cabinet", fragile: false },
    { id: "storage_shelf", name: "Storage / Bookcase", fragile: false },
    { id: "locker", name: "Storage Locker", fragile: false },
  ],
  "Meeting & Common Areas": [
    {
      id: "conference_table_small",
      name: "Conference Table (4–6 seat)",
      fragile: true,
    },
    {
      id: "conference_table_large",
      name: "Conference Table (8+ seat)",
      fragile: true,
    },
    { id: "whiteboard", name: "Whiteboard / Display", fragile: true },
    { id: "tv_display", name: "TV / Display Screen", fragile: true },
    { id: "credenza", name: "Credenza / Sideboard", fragile: false },
  ],
  "Tech & Equipment": [
    { id: "monitor_single", name: "Computer Monitor", fragile: true },
    { id: "monitor_multi", name: "Dual / Multi Monitor Setup", fragile: true },
    { id: "printer_desk", name: "Desktop Printer", fragile: true },
    { id: "printer_floor", name: "Floor Printer / Copier", fragile: true },
    { id: "server_rack", name: "Server / Network Cabinet", fragile: true },
  ],
  "Office Special Items": [
    { id: "safe_office", name: "Safe", fragile: false },
    { id: "plan_file", name: "Plan File / Blueprint Cabinet", fragile: false },
    { id: "reception_seating", name: "Reception Seating Set", fragile: false },
    { id: "break_room_table", name: "Break Room Table", fragile: false },
    { id: "artwork_office", name: "Artwork / Signage", fragile: true },
  ],
};

/* ── Types ── */
interface InventoryEntry {
  itemId: string;
  name: string;
  qty: number;
  fragile: boolean;
}

interface DateEstimate {
  date: string;
  dayOfWeek: number;
  dayName: string;
  dayShort: string;
  monthDay: string;
  am: number;
  pm: number;
  available: boolean;
}

/* ── Component ── */
export default function QuoteWidgetClient() {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<"left" | "right">("left");

  // Step 0 — move type + size
  const [moveType, setMoveType] = useState("");
  const [moveSize, setMoveSize] = useState("");
  const [officeSize, setOfficeSize] = useState("");

  // Step 1 — locations & access
  const [fromPostal, setFromPostal] = useState("");
  const [toPostal, setToPostal] = useState("");
  const [buildingTypeFrom, setBuildingTypeFrom] = useState("apartment");
  const [buildingTypeTo, setBuildingTypeTo] = useState("apartment");
  const [accessFrom, setAccessFrom] = useState("ground");
  const [accessTo, setAccessTo] = useState("ground");

  // Step 2 — inventory
  const [inventory, setInventory] = useState<InventoryEntry[]>([]);
  const [expandedRooms, setExpandedRooms] = useState<Record<string, boolean>>(
    {},
  );
  const [otherItems, setOtherItems] = useState<{ name: string; qty: number }[]>(
    [],
  );
  const [specialHandling, setSpecialHandling] = useState("");

  // Step 3 — date + results
  const [moveDate, setMoveDate] = useState("");
  const [preferredTime, setPreferredTime] = useState<"am" | "pm">("am");
  const [dateEstimates, setDateEstimates] = useState<DateEstimate[]>([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState<"am" | "pm">("am");
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(false);
  const [estimateErrorMessage, setEstimateErrorMessage] = useState<
    string | null
  >(null);
  const [calendarOffset, setCalendarOffset] = useState(0);

  // Step 4 — lead capture
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const phoneInput = usePhoneInput(phone, setPhone);
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [leadNumber, setLeadNumber] = useState("");

  // reCAPTCHA
  const recaptchaLoadedRef = useRef(false);
  const preferredMoveDateInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recaptchaLoadedRef.current) return;
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey) return;
    recaptchaLoadedRef.current = true;
    const s = document.createElement("script");
    s.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    s.async = true;
    document.head.appendChild(s);
  }, []);

  const getRecaptchaToken = useCallback(async (): Promise<string | null> => {
    const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
    if (!siteKey || !(window as any).grecaptcha) return null; // eslint-disable-line @typescript-eslint/no-explicit-any
    try {
      return await (window as any).grecaptcha.execute(siteKey, {
        action: "submit_lead",
      }); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch {
      return null;
    }
  }, []);

  /* ── Navigation ── */
  const goNext = useCallback(() => {
    setDirection("left");
    setStep((s) => s + 1);
  }, []);
  const goBack = useCallback(() => {
    setDirection("right");
    setStep((s) => s - 1);
  }, []);

  /* ── Postal formatting ── */
  const formatPostal = (val: string) => {
    const clean = val.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    if (clean.length <= 3) return clean;
    return clean.slice(0, 3) + " " + clean.slice(3, 6);
  };

  /* ── Inventory helpers ── */
  const totalItems = inventory.reduce((sum, e) => sum + e.qty, 0);
  const sizeKey = moveType === "office" ? officeSize : moveSize;
  const estimatedBoxes = BOX_ESTIMATES[sizeKey] || 30;

  const furnitureItemsForEstimate = useCallback((): Record<string, number> => {
    const m: Record<string, number> = {};
    for (const e of inventory) {
      m[e.name] = (m[e.name] ?? 0) + e.qty;
    }
    for (const o of otherItems) {
      const n = o.name.trim();
      if (!n) continue;
      m[n] = (m[n] ?? 0) + Math.max(1, o.qty || 1);
    }
    return m;
  }, [inventory, otherItems]);

  const toggleRoom = (room: string) => {
    setExpandedRooms((prev) => ({ ...prev, [room]: !prev[room] }));
  };

  const updateItem = (
    itemId: string,
    itemName: string,
    fragile: boolean,
    delta: number,
  ) => {
    setInventory((prev) => {
      const idx = prev.findIndex((e) => e.itemId === itemId);
      if (idx >= 0) {
        const newQty = Math.max(0, prev[idx]!.qty + delta);
        if (newQty === 0) return prev.filter((_, i) => i !== idx);
        return prev.map((e, i) => (i === idx ? { ...e, qty: newQty } : e));
      }
      if (delta > 0)
        return [...prev, { itemId, name: itemName, qty: 1, fragile }];
      return prev;
    });
  };

  const getItemQty = (itemId: string) =>
    inventory.find((e) => e.itemId === itemId)?.qty || 0;

  /* ── Fetch estimates for calendar ── */
  const fetchEstimates = useCallback(
    async (startDate?: string) => {
      setEstimateLoading(true);
      setEstimateError(false);
      setEstimateErrorMessage(null);
      try {
        const from = (fromPostal || "").replace(/\s/g, "").toUpperCase();
        const to = (toPostal || "").replace(/\s/g, "").toUpperCase();
        const body = {
          moveType: moveType || "residential",
          moveSize: moveType === "office" ? undefined : moveSize || "2br",
          officeSize:
            moveType === "office" ? officeSize || "medium" : undefined,
          fromPostal: from,
          toPostal: to,
          buildingTypeFrom: buildingTypeFrom || "apartment",
          buildingTypeTo: buildingTypeTo || "apartment",
          accessFrom: accessFrom || "ground",
          accessTo: accessTo || "ground",
          furnitureItems: furnitureItemsForEstimate(),
          estimatedBoxes,
          startDate: startDate || moveDate || undefined,
          days: 14,
        };
        const res = await fetch("/api/widget/estimate-range", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          const msg =
            typeof data?.error === "string"
              ? data.error
              : res.status === 400
                ? "Please check your postal codes and move size."
                : "Something went wrong. Please try again.";
          setEstimateErrorMessage(msg);
          setEstimateError(true);
          return;
        }
        if (!data.estimates || !Array.isArray(data.estimates)) {
          setEstimateErrorMessage("Invalid response. Please try again.");
          setEstimateError(true);
          return;
        }
        setDateEstimates(data.estimates);
        if (!selectedDate && data.estimates.length > 0) {
          const target = moveDate || data.estimates[0].date;
          setSelectedDate(target);
        }
      } catch {
        setEstimateErrorMessage(
          "Network error. Please check your connection and try again.",
        );
        setEstimateError(true);
      } finally {
        setEstimateLoading(false);
      }
    },
    [
      moveType,
      moveSize,
      officeSize,
      fromPostal,
      toPostal,
      buildingTypeFrom,
      buildingTypeTo,
      accessFrom,
      accessTo,
      totalItems,
      moveDate,
      selectedDate,
      furnitureItemsForEstimate,
      estimatedBoxes,
    ],
  );

  const handleGoToResults = useCallback(() => {
    goNext();
    fetchEstimates();
  }, [goNext, fetchEstimates]);

  const handleCalendarNav = (dir: -1 | 1) => {
    const newOffset = Math.max(0, calendarOffset + dir * 7);
    setCalendarOffset(newOffset);
    if (dateEstimates.length > 0 && newOffset + 7 > dateEstimates.length) {
      const lastDate = dateEstimates[dateEstimates.length - 1]!.date;
      const d = new Date(lastDate + "T12:00:00");
      d.setDate(d.getDate() + 1);
      fetchEstimates(d.toISOString().split("T")[0]);
    }
  };

  const visibleDates = dateEstimates.slice(calendarOffset, calendarOffset + 7);

  const selectedEstimate = dateEstimates.find((e) => e.date === selectedDate);
  const selectedPrice = selectedEstimate
    ? selectedTime === "am"
      ? selectedEstimate.am
      : selectedEstimate.pm
    : 0;
  const essentialPriceRounded = selectedPrice;
  const signaturePriceRounded =
    essentialPriceRounded > 0
      ? Math.round((essentialPriceRounded * 1.5) / 50) * 50
      : 0;
  const estatePriceRounded =
    essentialPriceRounded > 0
      ? Math.round((essentialPriceRounded * 3.15) / 50) * 50
      : 0;

  /* ── Submit lead ── */
  const handleSubmitLead = useCallback(async () => {
    if (!name.trim() || !email.trim()) return;
    setSubmitting(true);
    try {
      const recaptchaToken = await getRecaptchaToken();
      const res = await fetch("/api/widget/lead", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() ? normalizePhone(phone) : null,
          moveType,
          moveSize,
          officeSize: moveType === "office" ? officeSize : undefined,
          fromPostal,
          toPostal,
          buildingTypeFrom,
          buildingTypeTo,
          accessFrom,
          accessTo,
          moveDate: selectedDate || moveDate || null,
          preferredTime: selectedTime,
          flexibleDate: !moveDate,
          estimateLow: Math.round(selectedPrice * 0.9),
          estimateHigh: Math.round(selectedPrice * 1.1),
          selectedPrice,
          factors: selectedEstimate ? [] : [],
          inventoryItems: inventory,
          estimatedBoxes,
          otherItems: otherItems
            .filter((r) => r.name.trim())
            .map((r) => ({
              name: r.name.trim(),
              qty: Math.max(1, r.qty || 1),
            })),
          specialHandling: specialHandling.trim() || null,
          comments: comments.trim() || null,
          recaptchaToken,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSubmitted(true);
        setLeadNumber(data.leadNumber || "");
      }
    } catch {
      /* silent */
    } finally {
      setSubmitting(false);
    }
  }, [
    name,
    email,
    phone,
    moveType,
    moveSize,
    officeSize,
    fromPostal,
    toPostal,
    buildingTypeFrom,
    buildingTypeTo,
    accessFrom,
    accessTo,
    selectedDate,
    moveDate,
    selectedTime,
    selectedPrice,
    selectedEstimate,
    inventory,
    estimatedBoxes,
    otherItems,
    specialHandling,
    comments,
    getRecaptchaToken,
  ]);

  /* ── Validation ── */
  const canProceedStep0 =
    moveType !== "" &&
    ((moveType === "residential" && moveSize !== "") ||
      (moveType === "office" && officeSize !== ""));
  const canProceedStep1 =
    fromPostal.replace(/\s/g, "").length >= 3 &&
    toPostal.replace(/\s/g, "").length >= 3;

  /* ── Formatting ── */
  const fmtCurrency = (n: number) => `$${n.toLocaleString()}`;

  const inputClass =
    "w-full px-4 py-3 rounded-xl border text-[var(--text-base)] outline-none transition-all duration-200 bg-white placeholder:text-[#8A9089]";
  const selectClass =
    "w-full px-4 py-3 rounded-xl border text-[var(--text-base)] outline-none transition-all duration-200 bg-white appearance-none cursor-pointer";
  const labelClass = `block ${QUOTE_EYEBROW_CLASS} mb-1.5`;

  return (
    <div className="w-full max-w-[960px] mx-auto">
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFFFF",
          boxShadow:
            "0 24px 80px rgba(92,26,51,0.08), 0 2px 8px rgba(92,26,51,0.04)",
          border: `1px solid rgba(92,26,51,0.08)`,
        }}
      >
        {/* ── Header ── */}
        <div className="px-6 sm:px-8 pt-6 pb-3 flex items-center justify-between">
          <YugoLogo size={18} variant="wine" onLightBackground />
          {step > 0 && !submitted && (
            <button
              onClick={goBack}
              className="flex items-center gap-1 text-[12px] font-semibold tracking-wide uppercase transition-opacity hover:opacity-70"
              style={{ color: FOREST_MUTED }}
            >
              <CaretLeft size={14} weight="regular" className="text-current" />
              Back
            </button>
          )}
        </div>

        {/* ── Progress ── */}
        {!submitted && (
          <div className="px-6 sm:px-8 pb-5">
            <div className="flex gap-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-0.5 rounded-full flex-1 transition-all duration-500"
                  style={{
                    backgroundColor: i <= step ? ACCENT : "rgba(92,26,51,0.08)",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── Steps ── */}
        <div className="relative overflow-hidden">
          {/* ═══════ Step 0: Move Type + Size ═══════ */}
          {step === 0 && (
            <StepContainer direction={direction}>
              <div className="px-6 sm:px-8 pb-8">
                <StepLabel n={1} />
                <h2 className="font-hero text-[22px] sm:text-[26px] font-bold leading-snug tracking-tight mb-1 text-[#5C1A33]">
                  Tell us about your move
                </h2>
                <p
                  className="text-[13px] mb-6 leading-relaxed"
                  style={{ color: FOREST_BODY }}
                >
                  Select the type and size of your move.
                </p>

                <div className="grid grid-cols-2 gap-3 mb-6">
                  {MOVE_TYPES.map((t) => {
                    const active = moveType === t.key;
                    return (
                      <button
                        key={t.key}
                        onClick={() => {
                          setMoveType(t.key);
                          setMoveSize("");
                          setOfficeSize("");
                        }}
                        className="p-4 rounded-xl border text-left transition-all duration-200 hover:border-[#5C1A33]/18"
                        style={{
                          borderColor: active ? ACCENT : "rgba(92,26,51,0.12)",
                          backgroundColor: active
                            ? "rgba(92,26,51,0.06)"
                            : "#FFFFFF",
                          boxShadow: active ? `0 0 0 1px ${ACCENT}` : "none",
                        }}
                      >
                        {t.icon === "house" ? (
                          <House
                            size={22}
                            color={active ? ACCENT : `${WINE}40`}
                            className="mb-2"
                          />
                        ) : (
                          <Buildings
                            size={22}
                            color={active ? ACCENT : `${WINE}40`}
                            className="mb-2"
                          />
                        )}
                        <div
                          className="text-[var(--text-base)] font-semibold"
                          style={{ color: active ? WINE : `${WINE}90` }}
                        >
                          {t.label}
                        </div>
                        <div
                          className="text-[11px] mt-0.5"
                          style={{ color: `${WINE}50` }}
                        >
                          {t.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {moveType === "residential" && (
                  <div>
                    <div className={labelClass} style={{ color: FOREST_MUTED }}>
                      Size of home
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      {HOME_SIZES.map((s) => {
                        const active = moveSize === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => setMoveSize(s.key)}
                            className="py-3 px-3 rounded-xl text-[13px] font-medium border transition-all duration-200 hover:border-[#5C1A33]/18"
                            style={{
                              borderColor: active
                                ? ACCENT
                                : "rgba(92,26,51,0.12)",
                              backgroundColor: active
                                ? "rgba(92,26,51,0.06)"
                                : "#FFFFFF",
                              color: active ? WINE : FOREST_MUTED,
                              boxShadow: active
                                ? `0 0 0 1px ${ACCENT}`
                                : "none",
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {moveType === "office" && (
                  <div>
                    <div className={labelClass} style={{ color: FOREST_MUTED }}>
                      Office size
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {OFFICE_SIZES.map((s) => {
                        const active = officeSize === s.key;
                        return (
                          <button
                            key={s.key}
                            onClick={() => setOfficeSize(s.key)}
                            className="py-3 px-4 rounded-xl text-[13px] font-medium border transition-all duration-200 hover:border-[#5C1A33]/18"
                            style={{
                              borderColor: active
                                ? ACCENT
                                : "rgba(92,26,51,0.12)",
                              backgroundColor: active
                                ? "rgba(92,26,51,0.06)"
                                : "#FFFFFF",
                              color: active ? WINE : FOREST_MUTED,
                              boxShadow: active
                                ? `0 0 0 1px ${ACCENT}`
                                : "none",
                            }}
                          >
                            {s.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <button
                  onClick={goNext}
                  disabled={!canProceedStep0}
                  className="w-full mt-6 py-3.5 rounded-xl text-[11px] font-bold text-white tracking-[0.12em] uppercase transition-all duration-200 disabled:opacity-30 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: WINE }}
                >
                  Continue
                  <CaretRight
                    size={16}
                    weight="bold"
                    className="shrink-0 opacity-95"
                  />
                </button>
              </div>
            </StepContainer>
          )}

          {/* ═══════ Step 1: Locations & Property ═══════ */}
          {step === 1 && (
            <StepContainer direction={direction}>
              <div className="px-6 sm:px-8 pb-8">
                <StepLabel n={2} />
                <h2 className="font-hero text-[22px] sm:text-[26px] font-bold leading-snug tracking-tight mb-1 text-[#5C1A33]">
                  Locations & property details
                </h2>
                <p
                  className="text-[13px] mb-6 leading-relaxed"
                  style={{ color: FOREST_BODY }}
                >
                  Postal codes and access details help us give you an accurate
                  estimate.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {/* From */}
                  <div className="space-y-3">
                    <div
                      className="text-[11px] font-bold tracking-[0.12em] uppercase px-1 pb-1 border-b"
                      style={{ color: WINE, borderColor: `${WINE}15` }}
                    >
                      Moving from
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Postal code
                      </div>
                      <input
                        type="text"
                        value={fromPostal}
                        onChange={(e) =>
                          setFromPostal(formatPostal(e.target.value))
                        }
                        placeholder="M4M 1A1"
                        maxLength={7}
                        className={inputClass}
                        style={{ borderColor: `${WINE}12`, color: WINE }}
                      />
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Building type
                      </div>
                      <SelectWrapper>
                        <select
                          value={buildingTypeFrom}
                          onChange={(e) => setBuildingTypeFrom(e.target.value)}
                          className={selectClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        >
                          {BUILDING_TYPES.map((b) => (
                            <option key={b.key} value={b.key}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Access
                      </div>
                      <SelectWrapper>
                        <select
                          value={accessFrom}
                          onChange={(e) => setAccessFrom(e.target.value)}
                          className={selectClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        >
                          {ACCESS_OPTIONS.map((a) => (
                            <option key={a.key} value={a.key}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>

                  {/* To */}
                  <div className="space-y-3">
                    <div
                      className="text-[11px] font-bold tracking-[0.12em] uppercase px-1 pb-1 border-b"
                      style={{ color: WINE, borderColor: `${WINE}15` }}
                    >
                      Moving to
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Postal code
                      </div>
                      <input
                        type="text"
                        value={toPostal}
                        onChange={(e) =>
                          setToPostal(formatPostal(e.target.value))
                        }
                        placeholder="M5V 2T6"
                        maxLength={7}
                        className={inputClass}
                        style={{ borderColor: `${WINE}12`, color: WINE }}
                      />
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Building type
                      </div>
                      <SelectWrapper>
                        <select
                          value={buildingTypeTo}
                          onChange={(e) => setBuildingTypeTo(e.target.value)}
                          className={selectClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        >
                          {BUILDING_TYPES.map((b) => (
                            <option key={b.key} value={b.key}>
                              {b.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                    <div>
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Access
                      </div>
                      <SelectWrapper>
                        <select
                          value={accessTo}
                          onChange={(e) => setAccessTo(e.target.value)}
                          className={selectClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        >
                          {ACCESS_OPTIONS.map((a) => (
                            <option key={a.key} value={a.key}>
                              {a.label}
                            </option>
                          ))}
                        </select>
                      </SelectWrapper>
                    </div>
                  </div>
                </div>

                <button
                  onClick={goNext}
                  disabled={!canProceedStep1}
                  className="w-full mt-6 py-3.5 rounded-xl text-[11px] font-bold text-white tracking-[0.12em] uppercase transition-all duration-200 disabled:opacity-30 inline-flex items-center justify-center gap-2"
                  style={{ backgroundColor: WINE }}
                >
                  Continue
                  <CaretRight
                    size={16}
                    weight="bold"
                    className="shrink-0 opacity-95"
                  />
                </button>
              </div>
            </StepContainer>
          )}

          {/* ═══════ Step 2: Inventory ═══════ */}
          {step === 2 && (
            <StepContainer direction={direction}>
              <div className="px-6 sm:px-8 pb-8">
                <StepLabel n={3} />
                <h2 className="font-hero text-[22px] sm:text-[26px] font-bold leading-snug tracking-tight mb-1 text-[#5C1A33]">
                  Your belongings
                </h2>
                <p
                  className="text-[13px] mb-5 leading-relaxed"
                  style={{ color: FOREST_BODY }}
                >
                  Add furniture items for a more accurate estimate, or skip to
                  continue.
                </p>

                {/* Summary bar */}
                <div
                  className="flex items-center justify-between rounded-xl p-4 mb-5 border"
                  style={{ backgroundColor: CREAM, borderColor: `${WINE}08` }}
                >
                  <div>
                    <div
                      className="text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: `${WINE}50` }}
                    >
                      Estimated boxes
                    </div>
                    <div
                      className="text-[20px] font-bold"
                      style={{ color: WINE }}
                    >
                      {estimatedBoxes}
                    </div>
                    <div className="text-[11px]" style={{ color: `${WINE}50` }}>
                      {moveType === "office"
                        ? "Based on office size"
                        : "Based on home size"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className="text-[11px] font-bold uppercase tracking-wide"
                      style={{ color: `${WINE}50` }}
                    >
                      Furniture items
                    </div>
                    <div
                      className="text-[20px] font-bold"
                      style={{ color: totalItems > 0 ? WINE : `${WINE}30` }}
                    >
                      {totalItems}
                    </div>
                    <div className="text-[11px]" style={{ color: `${WINE}50` }}>
                      Added so far
                    </div>
                  </div>
                </div>

                {/* Furniture catalog, residential vs office */}
                <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                  {Object.entries(
                    moveType === "office"
                      ? OFFICE_FURNITURE_CATALOG
                      : FURNITURE_CATALOG,
                  ).map(([room, items]) => {
                    const isExpanded = expandedRooms[room];
                    const roomCount = items.reduce(
                      (s, it) => s + getItemQty(it.id),
                      0,
                    );
                    return (
                      <div
                        key={room}
                        className="border rounded-xl overflow-hidden"
                        style={{ borderColor: `${WINE}10` }}
                      >
                        <button
                          onClick={() => toggleRoom(room)}
                          className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#EDE8E0]"
                        >
                          <span
                            className="text-[13px] font-semibold"
                            style={{ color: WINE }}
                          >
                            {room}
                          </span>
                          <span className="flex items-center gap-2">
                            {roomCount > 0 && (
                              <span
                                className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  backgroundColor: `${WINE}10`,
                                  color: WINE,
                                }}
                              >
                                {roomCount}
                              </span>
                            )}
                            <CaretDown
                              size={14}
                              color={`${WINE}40`}
                              className="transition-transform duration-200"
                              style={{
                                transform: isExpanded
                                  ? "rotate(180deg)"
                                  : "rotate(0deg)",
                              }}
                            />
                          </span>
                        </button>
                        {isExpanded && (
                          <div
                            className="px-4 pb-3 space-y-1.5 border-t"
                            style={{ borderColor: `${WINE}06` }}
                          >
                            {items.map((item) => {
                              const qty = getItemQty(item.id);
                              return (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between py-1.5"
                                >
                                  <div className="flex items-center gap-2">
                                    <span
                                      className="text-[13px]"
                                      style={{ color: `${WINE}90` }}
                                    >
                                      {item.name}
                                    </span>
                                    {item.fragile && (
                                      <span
                                        className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
                                        style={{
                                          backgroundColor: `${ACCENT}15`,
                                          color: ACCENT,
                                        }}
                                      >
                                        Fragile
                                      </span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1.5">
                                    <button
                                      onClick={() =>
                                        updateItem(
                                          item.id,
                                          item.name,
                                          item.fragile,
                                          -1,
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg border flex items-center justify-center text-[16px] font-medium transition-colors hover:bg-gray-50"
                                      style={{
                                        borderColor: `${WINE}15`,
                                        color: qty > 0 ? WINE : `${WINE}20`,
                                      }}
                                      disabled={qty === 0}
                                    >
                                      −
                                    </button>
                                    <span
                                      className="w-6 text-center text-[13px] font-semibold"
                                      style={{
                                        color: qty > 0 ? WINE : `${WINE}25`,
                                      }}
                                    >
                                      {qty}
                                    </span>
                                    <button
                                      onClick={() =>
                                        updateItem(
                                          item.id,
                                          item.name,
                                          item.fragile,
                                          1,
                                        )
                                      }
                                      className="w-7 h-7 rounded-lg border flex items-center justify-center text-[16px] font-medium transition-colors hover:bg-gray-50"
                                      style={{
                                        borderColor: `${WINE}15`,
                                        color: WINE,
                                      }}
                                    >
                                      +
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Other items (not on the list) */}
                <div
                  className="mt-4 border rounded-xl overflow-hidden"
                  style={{ borderColor: `${WINE}10` }}
                >
                  <button
                    onClick={() =>
                      setExpandedRooms((prev) => ({
                        ...prev,
                        "Other items": !prev["Other items"],
                      }))
                    }
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#EDE8E0]"
                  >
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: WINE }}
                    >
                      Other items
                    </span>
                    <span className="flex items-center gap-2">
                      {otherItems.length > 0 && (
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: `${WINE}10`, color: WINE }}
                        >
                          {otherItems.length}
                        </span>
                      )}
                      <CaretDown
                        size={14}
                        color={`${WINE}40`}
                        className="transition-transform duration-200"
                        style={{
                          transform: expandedRooms["Other items"]
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    </span>
                  </button>
                  {expandedRooms["Other items"] && (
                    <div
                      className="px-4 pb-3 pt-1 border-t space-y-2"
                      style={{ borderColor: `${WINE}06` }}
                    >
                      <p className="text-[11px]" style={{ color: `${WINE}70` }}>
                        Add items not in the list above (e.g. custom furniture,
                        specific pieces).
                      </p>
                      {otherItems.map((row, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) =>
                              setOtherItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? { ...r, name: e.target.value }
                                    : r,
                                ),
                              )
                            }
                            placeholder="Item name"
                            className="flex-1 px-3 py-2 rounded-lg border text-[13px]"
                            style={{ borderColor: `${WINE}15` }}
                          />
                          <input
                            type="number"
                            min={1}
                            value={row.qty || 1}
                            onChange={(e) =>
                              setOtherItems((prev) =>
                                prev.map((r, i) =>
                                  i === idx
                                    ? {
                                        ...r,
                                        qty: Math.max(
                                          1,
                                          parseInt(e.target.value, 10) || 1,
                                        ),
                                      }
                                    : r,
                                ),
                              )
                            }
                            className="w-14 px-2 py-2 rounded-lg border text-[13px] text-center"
                            style={{ borderColor: `${WINE}15` }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setOtherItems((prev) =>
                                prev.filter((_, i) => i !== idx),
                              )
                            }
                            className="p-2 rounded-lg border transition-colors hover:bg-gray-50"
                            style={{ borderColor: `${WINE}15` }}
                            aria-label="Remove"
                          >
                            <X
                              size={14}
                              weight="regular"
                              className="text-current"
                            />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={() =>
                          setOtherItems((prev) => [
                            ...prev,
                            { name: "", qty: 1 },
                          ])
                        }
                        className="text-[12px] font-semibold flex items-center gap-1"
                        style={{ color: WINE }}
                      >
                        <Plus
                          size={14}
                          weight="regular"
                          className="text-current"
                        />
                        Add item
                      </button>
                    </div>
                  )}
                </div>

                {/* Special handling (glass, marble, etc.) */}
                <div
                  className="mt-2 border rounded-xl overflow-hidden"
                  style={{ borderColor: `${WINE}10` }}
                >
                  <button
                    onClick={() =>
                      setExpandedRooms((prev) => ({
                        ...prev,
                        "Special handling": !prev["Special handling"],
                      }))
                    }
                    className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-[#EDE8E0]"
                  >
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: WINE }}
                    >
                      Special handling
                    </span>
                    <span className="flex items-center gap-2">
                      {specialHandling.trim() && (
                        <span
                          className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${ACCENT}15`,
                            color: ACCENT,
                          }}
                        >
                          Filled
                        </span>
                      )}
                      <CaretDown
                        size={14}
                        color={`${WINE}40`}
                        className="transition-transform duration-200"
                        style={{
                          transform: expandedRooms["Special handling"]
                            ? "rotate(180deg)"
                            : "rotate(0deg)",
                        }}
                      />
                    </span>
                  </button>
                  {expandedRooms["Special handling"] && (
                    <div
                      className="px-4 pb-3 pt-1 border-t"
                      style={{ borderColor: `${WINE}06` }}
                    >
                      <p
                        className="text-[11px] mb-2"
                        style={{ color: `${WINE}70` }}
                      >
                        List any items that need extra care (e.g. glass, marble,
                        antiques, artwork). We’ll factor this into your quote.
                      </p>
                      <textarea
                        value={specialHandling}
                        onChange={(e) => setSpecialHandling(e.target.value)}
                        placeholder="e.g. Glass dining table, marble top, large mirror..."
                        rows={3}
                        className="w-full px-3 py-2.5 rounded-lg border text-[13px] resize-y"
                        style={{ borderColor: `${WINE}15` }}
                      />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6">
                  <button
                    onClick={handleGoToResults}
                    className="py-3.5 rounded-xl text-[11px] font-bold tracking-[0.12em] uppercase transition-all duration-200 border border-[#5C1A33]/22 text-[#5C1A33] bg-white hover:bg-[#FAF7F2]"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleGoToResults}
                    className="py-3.5 rounded-xl text-[11px] font-bold text-white tracking-[0.12em] uppercase transition-all duration-200 inline-flex items-center justify-center gap-2"
                    style={{ backgroundColor: WINE }}
                  >
                    Continue
                    <CaretRight
                      size={16}
                      weight="bold"
                      className="shrink-0 opacity-95"
                    />
                  </button>
                </div>
              </div>
            </StepContainer>
          )}

          {/* ═══════ Step 3: Results + Lead Capture ═══════ */}
          {step === 3 && !submitted && (
            <StepContainer direction={direction}>
              <div className="px-6 sm:px-8 pb-8">
                {estimateLoading ? (
                  <div className="text-center py-16">
                    <div
                      className="w-12 h-12 border-2 border-t-transparent rounded-full animate-spin mx-auto mb-4"
                      style={{
                        borderColor: ACCENT,
                        borderTopColor: "transparent",
                      }}
                    />
                    <p
                      className="text-[15px] font-medium"
                      style={{ color: `${WINE}70` }}
                    >
                      Finding the best prices…
                    </p>
                  </div>
                ) : estimateError ? (
                  <div className="text-center py-16">
                    <div
                      className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                      style={{ backgroundColor: `${WINE}08` }}
                    >
                      <WarningCircle size={24} color={WINE} />
                    </div>
                    <p
                      className="text-[15px] font-semibold mb-2"
                      style={{ color: WINE }}
                    >
                      Unable to calculate estimate
                    </p>
                    {estimateErrorMessage && (
                      <p
                        className="text-[13px] mb-4 max-w-sm mx-auto"
                        style={{ color: `${WINE}99` }}
                      >
                        {estimateErrorMessage}
                      </p>
                    )}
                    <button
                      onClick={() => fetchEstimates()}
                      className="mt-2 px-5 py-2 rounded-lg text-[12px] font-bold uppercase tracking-wide transition-opacity hover:opacity-80"
                      style={{ backgroundColor: CREAM, color: WINE }}
                    >
                      Try Again
                    </button>
                  </div>
                ) : (
                  <>
                    <StepLabel n={4} />
                    <h2 className="font-hero text-[22px] sm:text-[26px] font-bold leading-snug tracking-tight mb-1 text-[#5C1A33]">
                      Choose your move date
                    </h2>
                    <p
                      className="text-[13px] mb-5 leading-relaxed"
                      style={{ color: FOREST_BODY }}
                    >
                      Prices vary by day and time. Select a date to see your
                      estimate.
                    </p>

                    {/* ── Date picker trigger ── */}
                    <div className="mb-5">
                      <div
                        className={labelClass}
                        style={{ color: FOREST_MUTED }}
                      >
                        Preferred move date
                      </div>
                      <div className="relative">
                        <input
                          ref={preferredMoveDateInputRef}
                          type="date"
                          value={moveDate}
                          onChange={(e) => {
                            setMoveDate(e.target.value);
                            setSelectedDate(e.target.value);
                            fetchEstimates(e.target.value);
                          }}
                          min={new Date().toISOString().split("T")[0]}
                          className={`${inputClass} quote-widget-date-input`}
                          style={{
                            borderColor: `${WINE}12`,
                            color: moveDate ? WINE : "#B5AFA5",
                            paddingRight: "44px",
                          }}
                        />
                        <button
                          type="button"
                          aria-label="Open calendar"
                          onClick={() => {
                            const el = preferredMoveDateInputRef.current;
                            if (!el) return;
                            if (typeof el.showPicker === "function") {
                              el.showPicker();
                            } else {
                              el.click();
                            }
                          }}
                          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg transition-colors hover:bg-black/4"
                        >
                          <CalendarBlank size={18} color={ACCENT} />
                        </button>
                      </div>
                    </div>

                    {/* ── Emirates-style calendar strip ── */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between mb-3">
                        <span
                          className="text-[12px] font-bold uppercase tracking-wide"
                          style={{ color: `${WINE}50` }}
                        >
                          Prices by date
                        </span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleCalendarNav(-1)}
                            disabled={calendarOffset === 0}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors disabled:opacity-20"
                            style={{ borderColor: `${WINE}12` }}
                          >
                            <CaretLeft
                              size={14}
                              weight="regular"
                              color={WINE}
                            />
                          </button>
                          <button
                            onClick={() => handleCalendarNav(1)}
                            className="w-8 h-8 rounded-lg border flex items-center justify-center transition-colors"
                            style={{ borderColor: `${WINE}12` }}
                          >
                            <CaretRight
                              size={14}
                              weight="regular"
                              color={WINE}
                            />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-7 gap-1.5">
                        {visibleDates.map((d) => {
                          const isSelected = d.date === selectedDate;
                          const isWeekend =
                            d.dayOfWeek === 0 || d.dayOfWeek === 6;
                          return (
                            <button
                              key={d.date}
                              onClick={() => {
                                setSelectedDate(d.date);
                                setMoveDate(d.date);
                              }}
                              className="rounded-xl p-2 sm:p-3 text-center transition-all duration-200 border"
                              style={{
                                borderColor: isSelected ? ACCENT : `${WINE}08`,
                                backgroundColor: isSelected
                                  ? `${ACCENT}10`
                                  : isWeekend
                                    ? `${WINE}04`
                                    : "white",
                                boxShadow: isSelected
                                  ? `0 0 0 2px ${ACCENT}`
                                  : "none",
                              }}
                            >
                              <div
                                className="text-[9px] sm:text-[10px] font-bold uppercase tracking-wide mb-0.5"
                                style={{
                                  color: isWeekend ? WINE : `${WINE}50`,
                                }}
                              >
                                {d.dayShort}
                              </div>
                              <div
                                className="text-[11px] sm:text-[12px] font-semibold mb-1.5"
                                style={{ color: WINE }}
                              >
                                {d.monthDay}
                              </div>
                              <div className="space-y-1">
                                <div
                                  className="text-[10px] sm:text-[9px] font-bold uppercase rounded-md py-0.5 cursor-pointer transition-colors"
                                  style={{
                                    backgroundColor:
                                      isSelected && selectedTime === "am"
                                        ? ACCENT
                                        : `${WINE}06`,
                                    color:
                                      isSelected && selectedTime === "am"
                                        ? "white"
                                        : `${WINE}60`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDate(d.date);
                                    setMoveDate(d.date);
                                    setSelectedTime("am");
                                  }}
                                >
                                  AM
                                  <div
                                    className="text-[10px] sm:text-[11px] font-bold"
                                    style={{
                                      color:
                                        isSelected && selectedTime === "am"
                                          ? "white"
                                          : WINE,
                                    }}
                                  >
                                    {fmtCurrency(d.am)}
                                  </div>
                                </div>
                                <div
                                  className="text-[10px] sm:text-[9px] font-bold uppercase rounded-md py-0.5 cursor-pointer transition-colors"
                                  style={{
                                    backgroundColor:
                                      isSelected && selectedTime === "pm"
                                        ? ACCENT
                                        : `${WINE}06`,
                                    color:
                                      isSelected && selectedTime === "pm"
                                        ? "white"
                                        : `${WINE}60`,
                                  }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDate(d.date);
                                    setMoveDate(d.date);
                                    setSelectedTime("pm");
                                  }}
                                >
                                  PM
                                  <div
                                    className="text-[10px] sm:text-[11px] font-bold"
                                    style={{
                                      color:
                                        isSelected && selectedTime === "pm"
                                          ? "white"
                                          : WINE,
                                    }}
                                  >
                                    {fmtCurrency(d.pm)}
                                  </div>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>

                      {/* Legend */}
                      <div className="flex items-center justify-center gap-4 mt-3">
                        <span
                          className="flex items-center gap-1.5 text-[10px]"
                          style={{ color: `${WINE}50` }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: ACCENT }}
                          />{" "}
                          Selected
                        </span>
                        <span
                          className="flex items-center gap-1.5 text-[10px]"
                          style={{ color: `${WINE}50` }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full border"
                            style={{ borderColor: `${WINE}20` }}
                          />{" "}
                          Available
                        </span>
                        <span
                          className="flex items-center gap-1.5 text-[10px]"
                          style={{ color: `${WINE}50` }}
                        >
                          <span
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: `${WINE}15` }}
                          />{" "}
                          Weekend
                        </span>
                      </div>
                    </div>

                    {/* ── Selected price display ── */}
                    {selectedEstimate && (
                      <div
                        className="rounded-xl p-5 mb-5 border text-center"
                        style={{
                          backgroundColor: CREAM,
                          borderColor: `${WINE}08`,
                        }}
                      >
                        <div
                          className="text-[10px] font-bold tracking-[0.14em] uppercase mb-1"
                          style={{ color: `${WINE}50` }}
                        >
                          Your estimated price
                        </div>
                        <div
                          className="text-[38px] sm:text-[44px] font-extrabold leading-none mb-1"
                          style={{ color: WINE }}
                        >
                          {fmtCurrency(selectedPrice)}
                        </div>
                        <div
                          className="text-[13px] font-medium mb-2"
                          style={{ color: `${WINE}70` }}
                        >
                          {selectedEstimate.monthDay} (
                          {selectedEstimate.dayName}) &middot;{" "}
                          {selectedTime.toUpperCase()} slot
                        </div>
                        <div
                          className="text-[11px]"
                          style={{ color: `${WINE}45` }}
                        >
                          Includes all standard protection, wrapping & road
                          charges
                        </div>
                        <p
                          className="text-[11px] mt-3 text-center leading-snug"
                          style={{ color: `${WINE}55` }}
                        >
                          Estimated{" "}
                          <strong style={{ color: WINE }}>Essential</strong>{" "}
                          tier. Signature and Estate options are available with
                          your coordinator&apos;s guaranteed quote.
                        </p>
                        <div
                          className="mt-3 space-y-1.5 text-[12px] text-left max-w-sm mx-auto"
                          style={{ color: WINE }}
                        >
                          <div className="flex justify-between gap-3">
                            <span style={{ color: `${WINE}70` }}>
                              Essential
                            </span>
                            <span className="font-medium tabular-nums">
                              {fmtCurrency(essentialPriceRounded)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span style={{ color: `${WINE}70` }}>
                              Signature
                            </span>
                            <span className="font-medium tabular-nums">
                              {fmtCurrency(signaturePriceRounded)}
                            </span>
                          </div>
                          <div className="flex justify-between gap-3">
                            <span style={{ color: `${WINE}70` }}>Estate</span>
                            <span className="font-medium tabular-nums">
                              {fmtCurrency(estatePriceRounded)}
                            </span>
                          </div>
                        </div>
                        <details
                          className="mt-4 text-left max-w-sm mx-auto text-[12px]"
                          style={{ color: `${WINE}80` }}
                        >
                          <summary
                            className="cursor-pointer font-semibold list-none [&::-webkit-details-marker]:hidden"
                            style={{ color: WINE }}
                          >
                            What&apos;s included (Essential)
                          </summary>
                          <div
                            className="mt-2 space-y-1 text-[11px] leading-relaxed"
                            style={{ color: `${WINE}65` }}
                          >
                            <p>Dedicated moving truck</p>
                            <p>Professional crew</p>
                            <p>Protective wrapping for key furniture</p>
                            <p>Basic disassembly and reassembly</p>
                            <p>Floor and entryway protection</p>
                            <p>All standard equipment</p>
                            <p>Standard valuation coverage</p>
                            <p>Real-time GPS tracking</p>
                          </div>
                        </details>
                      </div>
                    )}

                    {/* ── Seasonal pricing preview ── */}
                    <div className="mb-5">
                      <SeasonalPricingPreview
                        basePrice={selectedPrice || 1200}
                        selectedMonth={
                          selectedDate
                            ? new Date(selectedDate + "T12:00:00").getMonth() +
                              1
                            : undefined
                        }
                        compact
                      />
                    </div>

                    {/* ── Disclaimer ── */}
                    <div
                      className="rounded-xl p-4 mb-5 border"
                      style={{
                        backgroundColor: `${WINE}04`,
                        borderColor: `${WINE}08`,
                      }}
                    >
                      <p
                        className="text-[11px] leading-relaxed"
                        style={{ color: `${WINE}65` }}
                      >
                        <strong style={{ color: WINE }}>Disclaimer:</strong>{" "}
                        These are estimates based on the details you provided.
                        For the most accurate, guaranteed pricing, please fill
                        in your details below. A move coordinator will review
                        your information and reach out with an exact quote if
                        there are any differences or changes.
                      </p>
                    </div>

                    {/* ── Lead capture ── */}
                    <div className="space-y-2.5 mb-4">
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Full name"
                        className={inputClass}
                        style={{ borderColor: `${WINE}12`, color: WINE }}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="Email address"
                          className={inputClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        />
                        <input
                          ref={phoneInput.ref}
                          type="tel"
                          value={phone}
                          onChange={phoneInput.onChange}
                          placeholder={`${PHONE_PLACEHOLDER} (optional)`}
                          className={inputClass}
                          style={{ borderColor: `${WINE}12`, color: WINE }}
                        />
                      </div>
                      <textarea
                        value={comments}
                        onChange={(e) => setComments(e.target.value)}
                        placeholder="Additional comments or special requirements (optional)"
                        rows={3}
                        className={`${inputClass} resize-none`}
                        style={{ borderColor: `${WINE}12`, color: WINE }}
                      />
                    </div>

                    <button
                      onClick={handleSubmitLead}
                      disabled={!name.trim() || !email.trim() || submitting}
                      className="w-full py-3.5 rounded-xl text-[11px] font-bold tracking-[0.12em] uppercase transition-all duration-200 disabled:opacity-30 inline-flex items-center justify-center gap-2 text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {submitting ? (
                        "Submitting…"
                      ) : (
                        <>
                          Get My Guaranteed Quote
                          <CaretRight
                            size={16}
                            weight="bold"
                            className="shrink-0 opacity-95"
                          />
                        </>
                      )}
                    </button>

                    <p
                      className="text-center text-[10px] mt-3 flex items-center justify-center gap-1.5"
                      style={{ color: `${WINE}40` }}
                    >
                      <Lock size={11} className="text-current" />
                      No spam. Your exact guaranteed quote within 2 hours.
                    </p>
                    <p
                      className="text-center text-[9px] mt-2"
                      style={{ color: `${WINE}25` }}
                    >
                      Protected by reCAPTCHA
                    </p>
                  </>
                )}
              </div>
            </StepContainer>
          )}

          {/* ═══════ Submitted confirmation ═══════ */}
          {submitted && (
            <StepContainer direction="left">
              <div className="px-6 sm:px-8 pb-8 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: "rgba(92,26,51,0.08)" }}
                >
                  <Check size={30} color={WINE} weight="bold" />
                </div>
                <h2 className="font-hero text-[24px] font-bold leading-snug tracking-tight mb-2 text-[#5C1A33]">
                  You&rsquo;re all set!
                </h2>
                <p
                  className="text-[var(--text-base)] leading-relaxed mb-4"
                  style={{ color: FOREST_BODY }}
                >
                  We&rsquo;ll send your exact guaranteed price to{" "}
                  <strong style={{ color: WINE }}>{email}</strong> within 2
                  hours.
                </p>
                {leadNumber && (
                  <p
                    className="text-[11px] font-mono mb-4"
                    style={{ color: `${WINE}40` }}
                  >
                    Reference: {leadNumber}
                  </p>
                )}
                {selectedPrice > 0 && (
                  <div
                    className="rounded-xl p-5 border mx-auto max-w-sm"
                    style={{
                      backgroundColor: CREAM,
                      borderColor: `${WINE}08`,
                    }}
                  >
                    <div
                      className="text-[11px] font-semibold uppercase tracking-wide mb-1"
                      style={{ color: `${WINE}50` }}
                    >
                      Your estimated price
                    </div>
                    <div
                      className="text-[28px] font-bold mb-1"
                      style={{ color: WINE }}
                    >
                      {fmtCurrency(selectedPrice)}
                    </div>
                    {selectedEstimate && (
                      <div
                        className="text-[12px]"
                        style={{ color: `${WINE}60` }}
                      >
                        {selectedEstimate.monthDay} ({selectedEstimate.dayName})
                        &middot; {selectedTime.toUpperCase()}
                      </div>
                    )}
                  </div>
                )}
                <div
                  className="mt-6 rounded-xl p-4 border"
                  style={{
                    backgroundColor: `${WINE}04`,
                    borderColor: `${WINE}08`,
                  }}
                >
                  <p
                    className="text-[12px] leading-relaxed"
                    style={{ color: `${WINE}65` }}
                  >
                    A Yugo move coordinator will review your details and send a
                    detailed, guaranteed quote. No surprises, that&rsquo;s the
                    Yugo promise.
                  </p>
                </div>
              </div>
            </StepContainer>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-6 pb-5 pt-1">
          <YugoMarketingFooter
            contactEmail={
              process.env.NEXT_PUBLIC_YUGO_EMAIL || "support@helloyugo.com"
            }
            logoVariant="wine"
            onLightBackground
            logoSize={10}
            mutedColor={`${WINE}99`}
            linkColor={WINE}
            showTagline={false}
            taglineClassName="text-[9px] font-medium tracking-wide"
            navClassName="text-[9px]"
          />
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function StepLabel({ n }: { n: number }) {
  return (
    <div
      className={`${QUOTE_EYEBROW_CLASS} mb-1.5`}
      style={{ color: FOREST_MUTED }}
    >
      Step {n}
    </div>
  );
}

function StepContainer({
  children,
  direction,
}: {
  children: React.ReactNode;
  direction: "left" | "right";
}) {
  return (
    <div
      className="animate-widget-slide"
      style={{
        // @ts-expect-error -- CSS custom property for animation direction
        "--slide-from": direction === "left" ? "40px" : "-40px",
      }}
    >
      <style>{`
        @keyframes widgetSlideIn {
          from { opacity: 0; transform: translateX(var(--slide-from)); }
          to { opacity: 1; transform: translateX(0); }
        }
        .animate-widget-slide {
          animation: widgetSlideIn 0.35s cubic-bezier(0.16,1,0.3,1) forwards;
        }
      `}</style>
      {children}
    </div>
  );
}

function SelectWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative">
      {children}
      <CaretDown
        size={14}
        color="#5C1A3370"
        className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
        aria-hidden
      />
    </div>
  );
}

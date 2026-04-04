"use client";// Design and palette (wine, forest, cream) are the source of truth for all client-facing UI. Do not change.

import React, { useState, useMemo, useCallback, useRef, useEffect, Fragment } from "react";
import SchedulingAlternativesCard from "./SchedulingAlternativesCard";
import SeasonalPricingPreview from "@/components/SeasonalPricingPreview";
import {
  Check,
  Clock,
  CaretDown as ChevronDown,
  CaretUp as ChevronUp,
  Plus,
  X,
  Calendar,
} from "@phosphor-icons/react";
import {
  type Quote,
  type Addon,
  type AddonSelection,
  type TierData,
  type TierFeature,
  type ValuationTier,
  type ValuationUpgrade,
  type HighValueDeclaration,
  TAX_RATE,
  WINE,
  FOREST,
  FOREST_BODY,
  FOREST_MUTED,
  CREAM,
  HERO_SUBTITLE,
  HERO_META_LABEL,
  HERO_META_VALUE,
  QUOTE_EYEBROW_CLASS,
  QUOTE_SECTION_H2_CLASS,
  type ResidentialQuoteTierMetaMap,
  HERO_CONFIG,
  SERVICE_LABEL,
  MOVE_SIZE_LABELS,
  fmtPrice,
  fmtPricePerLb,
  fmtDate,
  quoteArrivalTimeWindowLabel,
  expiresLabel,
  expiresValue,
  calculateDeposit,
  calculateTieredDeposit,
} from "./quote-shared";

import YugoLogo from "@/components/YugoLogo";
import { isQuoteExpiredForBooking } from "@/lib/quote-expiry";

/* ── Packing kit: move-size → tier index → contents ────────────────────── */
const PACKING_KIT_TIER_IDX: Record<string, number> = {
  studio: 0, "1br": 1, "2br": 2, "3br": 3, "4br": 4, "5br_plus": 5, partial: 0,
};
const PACKING_KIT_CONTENTS: Record<number, string> = {
  0: "5 small, 5 medium, 5 large boxes · 2 wardrobe boxes (rental) · 4 tape rolls · 12.5 lbs packing paper",
  1: "8 small, 15 medium, 7 large boxes · 3 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  2: "15 small, 25 medium, 10 large boxes · 4 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  3: "25 small, 40 medium, 15 large boxes · 6 wardrobe boxes (rental) · 6 tape rolls · 12.5 lbs packing paper",
  4: "35 small, 55 medium, 20 large boxes · 8 wardrobe boxes (rental) · 8 tape rolls · 25 lbs packing paper",
  5: "45 small, 70 medium, 25 large boxes · 10 wardrobe boxes (rental) · 10 tape rolls · 25 lbs packing paper",
};
import SquarePaymentForm from "@/components/payments/SquarePaymentForm";
import ContractSign, {
  type ContractQuoteData,
  type ContractAddon,
} from "@/components/booking/ContractSign";
import ResidentialLayout from "./layouts/ResidentialLayout";
import ProgressBar from "./ProgressBar";
import LongDistanceLayout from "./layouts/LongDistanceLayout";
import OfficeLayout from "./layouts/OfficeLayout";
import SingleItemLayout from "./layouts/SingleItemLayout";
import WhiteGloveLayout from "./layouts/WhiteGloveLayout";
import SpecialtyLayout from "./layouts/SpecialtyLayout";
import B2BOneOffLayout from "./layouts/B2BOneOffLayout";
import EventLayout from "./layouts/EventLayout";
import LabourOnlyLayout from "./layouts/LabourOnlyLayout";
import BinRentalLayout from "./layouts/BinRentalLayout";
import { abbreviateAddressRegions } from "@/lib/address-abbrev";
import {
  pickupLocationsFromQuote,
  dropoffLocationsFromQuote,
  abbreviateLocationRows,
  accessLabel,
} from "@/lib/quotes/quote-address-display";
import { getVisibleAddons, isAddonHiddenForTier, ESTATE_ADDON_UI_LINES } from "@/lib/quotes/addon-visibility";
import { formatAddressForDisplay } from "@/lib/format-text";
import { getDisplayLabel, VALUATION_TIER_LABELS } from "@/lib/displayLabels";
import { SafeText } from "@/components/SafeText";
import {
  getB2BQuoteHero,
  getLogisticsLoadingUnloadingFeature,
  isB2BDeliveryQuoteServiceType,
  isB2BInvoiceQuote,
  b2bVerticalUsesPackageLeadIcon,
  isClientLogisticsDeliveryServiceType,
} from "@/lib/quotes/b2b-quote-copy";
import { getResolvedMoveIncludes, mergeTierFeatureListsPreferLater } from "@/lib/quotes/residential-tier-quote-display";

/* ═══════════════════════════════════════════════════
   Main Client Component
   ═══════════════════════════════════════════════════ */

const TRUCK_LUXURY: Record<string, string> = {
  sprinter: "Dedicated Sprinter van",
  "16ft": "16ft climate-protected moving truck",
  "20ft": "20ft dedicated moving truck",
  "24ft": "24ft full-capacity moving truck",
  "26ft": "26ft maximum-capacity moving truck",
};

/** Client delivery / B2B — replaces residential "Your Move Includes" copy. */
const LOGISTICS_INCLUSION_FEATURES: TierFeature[] = [
  {
    card: "Dedicated delivery vehicle",
    title: "Dedicated delivery vehicle",
    desc: "Climate-controlled transport, sized for your shipment",
    iconName: "Truck",
  },
  {
    card: "Professional crew",
    title: "Professional crew",
    desc: "Licensed, insured logistics professionals",
    iconName: "Users",
  },
  {
    card: "Protective wrapping",
    title: "Protective wrapping for freight",
    desc: "Blankets and pads to protect items in transit",
    iconName: "Armchair",
  },
  {
    card: "Loading & unloading",
    title: "Trained loading & unloading",
    desc: "Careful handling at pickup and delivery",
    iconName: "Wrench",
  },
  {
    card: "Site protection",
    title: "Floor & entryway protection",
    desc: "Runners, booties, and corner guards where needed",
    iconName: "Home",
  },
  {
    card: "Equipment included",
    title: "Standard equipment included",
    desc: "Dollies, straps, and tools as required",
    iconName: "Toolbox",
  },
  {
    card: "Valuation",
    title: "Valuation per your selection",
    desc: "Coverage as shown in Your Protection below",
    iconName: "Shield",
  },
  {
    card: "Tracking",
    title: "Shipment visibility",
    desc: "Track your delivery status from your device",
    iconName: "MapPin",
  },
];

const UNIVERSAL_LOGISTICS_FEATURES: TierFeature[] = [
  {
    key: "price",
    card: "Guaranteed flat price",
    title: "Guaranteed flat price",
    desc: "The price you see is the price you pay",
    iconName: "DollarSign",
  },
  {
    key: "accountability",
    card: "Accountability",
    title: "Professional accountability",
    desc: "Your shipment, protected and documented",
    iconName: "EggCrack",
  },
];

const LOGISTICS_VEHICLE_LABELS: Record<string, string> = {
  sprinter: "Dedicated Sprinter cargo van",
  "16ft": "16ft climate-controlled box truck",
  "20ft": "20ft dedicated delivery truck",
  "24ft": "24ft delivery truck",
  "26ft": "26ft delivery truck",
};

export default function QuotePageClient({
  quote,
  addons: allAddons,
  contactEmail,
  slotsRemaining,
  valuationTiers = [],
  valuationUpgrades = [],
  branding,
  eventFeatures = null,
  residentialTierFeatures,
  residentialTierCardAdditions = { signature: [], estate: [] },
  residentialTierUseAdditiveCards = { signature: false, estate: false },
  residentialTierMeta,
}: {
  quote: Quote;
  addons: Addon[];
  contactEmail?: string | null;
  slotsRemaining?: number;
  valuationTiers?: ValuationTier[];
  valuationUpgrades?: ValuationUpgrade[];
  branding: { companyLegal: string; brand: string; email: string };
  eventFeatures?: TierFeature[] | null;
  residentialTierFeatures: Record<string, TierFeature[]>;
  residentialTierCardAdditions?: { signature: TierFeature[]; estate: TierFeature[] };
  residentialTierUseAdditiveCards?: { signature: boolean; estate: boolean };
  residentialTierMeta: ResidentialQuoteTierMetaMap;
}) {
  const isResidential = quote.service_type === "local_move" && !!quote.tiers;
  const tiers = quote.tiers as Record<string, TierData> | null;

  const quoteForDisplay = useMemo(
    () => ({
      ...quote,
      from_address: abbreviateAddressRegions(quote.from_address || ""),
      to_address: abbreviateAddressRegions(quote.to_address || ""),
    }),
    [quote],
  );

  const b2bVerticalCodeNorm = useMemo(() => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    const c = typeof fa?.b2b_vertical_code === "string" ? fa.b2b_vertical_code.trim().toLowerCase() : null;
    return c;
  }, [quote.factors_applied]);
  const b2bVerticalDisplayName = useMemo(() => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    return typeof fa?.b2b_vertical_name === "string" ? fa.b2b_vertical_name : null;
  }, [quote.factors_applied]);
  const b2bPackageLeadIcon = b2bVerticalUsesPackageLeadIcon(b2bVerticalCodeNorm, b2bVerticalDisplayName);
  const valuationJourneyCopy: "move" | "delivery" = isClientLogisticsDeliveryServiceType(quote.service_type)
    ? "delivery"
    : "move";

  const clientPickupRows = useMemo(() => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    return abbreviateLocationRows(
      pickupLocationsFromQuote(fa, quote.from_address, quote.from_access),
    );
  }, [quote.factors_applied, quote.from_address, quote.from_access]);

  const clientDropoffRows = useMemo(() => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    return abbreviateLocationRows(
      dropoffLocationsFromQuote(fa, quote.to_address, quote.to_access),
    );
  }, [quote.factors_applied, quote.to_address, quote.to_access]);

  const recommendedTierNorm = useMemo(() => {
    const r = (quote.recommended_tier ?? "signature").toString().toLowerCase().trim();
    return r === "essential" || r === "signature" || r === "estate" ? r : "signature";
  }, [quote.recommended_tier]);

  const quoteBookingLocked = useMemo(() => isQuoteExpiredForBooking(quote), [quote]);

  /* ── State ── */
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(quote.status === "accepted");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(new Map());
  const [signedName, setSignedName] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [booked, setBooked] = useState(quote.status === "accepted");
  const [paymentMoveId, setPaymentMoveId] = useState<string | null>(null);
  /** B2B delivery live tracking (absolute URL). Moves use SchedulingAlternativesCard + move_id instead. */
  const [deliveryTrackingUrl, setDeliveryTrackingUrl] = useState<string | null>(null);
  const [invoiceConfirmLoading, setInvoiceConfirmLoading] = useState(false);
  const [invoiceConfirmError, setInvoiceConfirmError] = useState<string | null>(null);
  const [valuationUpgradeSelected, setValuationUpgradeSelected] = useState(!!quote.valuation_upgraded);
  const [declarations, setDeclarations] = useState<HighValueDeclaration[]>([]);

  // Referral code state
  const [referralCode, setReferralCode] = useState(
    typeof quote === "object" && (quote as { referral_code?: string }).referral_code
      ? (quote as { referral_code?: string }).referral_code!
      : ""
  );
  const [referralVerified, setReferralVerified] = useState(false);
  const [referralMsg, setReferralMsg] = useState("");
  const [referralDiscount, setReferralDiscount] = useState(0);
  const [referralId, setReferralId] = useState<string | null>((quote as { referral_id?: string }).referral_id ?? null);

  const verifyReferral = useCallback(async () => {
    if (!referralCode.trim()) return;
    try {
      const res = await fetch("/api/referrals/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: referralCode }),
      });
      const data = await res.json();
      if (data.valid) {
        setReferralVerified(true);
        setReferralId(data.referral_id);
        setReferralDiscount(data.discount || 75);
        setReferralMsg(`✓ Applied! $${data.discount || 75} off, referred by ${data.referrer_name}.`);
        // Persist referral_id on the quote
        await fetch(`/api/quotes/${quote.quote_id}/referral`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ referral_id: data.referral_id }),
        }).catch(() => {});
      } else {
        setReferralVerified(false);
        setReferralMsg(data.error || "Invalid code");
      }
    } catch {
      setReferralMsg("Verification failed");
    }
  }, [referralCode, quote.quote_id]);

  const contractRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
  const tiersRef = useRef<HTMLElement>(null);
  const addonsRef = useRef<HTMLElement>(null);
  const protectionRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLElement>(null);
  const paymentRef = useRef<HTMLElement>(null);
  const pageStartTime = useRef(Date.now());

  const trackEngagement = useCallback(
    (event_type: string, event_data?: Record<string, unknown>) => {
      const elapsed = Math.round((Date.now() - pageStartTime.current) / 1000);
      const device = typeof window !== "undefined" && window.innerWidth < 768 ? "mobile" : "desktop";
      fetch("/api/quotes/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_id: quote.quote_id,
          event_type,
          event_data: event_data ?? {},
          session_duration_seconds: elapsed,
          device_type: device,
        }),
        keepalive: true,
      }).catch(() => {});
    },
    [quote.quote_id],
  );

  const trackEvent = useCallback(
    (event_type: string, metadata?: Record<string, unknown>) => {
      fetch("/api/quotes/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote_id: quote.quote_id, event_type, metadata }),
        keepalive: true,
      }).catch(() => {});
    },
    [quote.quote_id],
  );

  // Track page view once on mount
  useEffect(() => {
    if (quote.status !== "accepted") {
      trackEvent("quote_viewed", { source: "client", service_type: quote.service_type });
      trackEngagement("page_view", { service_type: quote.service_type });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track page exit + abandonment
  useEffect(() => {
    const handleBeforeUnload = () => {
      trackEngagement("page_exit", {
        selected_tier: selectedTier,
        addons_selected: selectedAddons.size,
        contract_signed: contractSigned,
      });
      if (!booked) {
        trackEvent("quote_abandoned", {
          selected_tier: selectedTier,
          addons_selected: selectedAddons.size,
          contract_signed: contractSigned,
        });
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [booked, selectedTier, selectedAddons.size, contractSigned, trackEvent, trackEngagement]);

  // Track comparison section visibility
  useEffect(() => {
    const el = comparisonRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEngagement("comparison_viewed");
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [trackEngagement]);

  // Track contract section visibility
  useEffect(() => {
    const el = contractRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          trackEngagement("contract_viewed");
          obs.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [trackEngagement]);

  /* ── Base price ── */
  const basePrice = useMemo(() => {
    if (isResidential && selectedTier && tiers?.[selectedTier]) {
      return tiers[selectedTier].price;
    }
    return quote.custom_price ?? 0;
  }, [isResidential, selectedTier, tiers, quote.custom_price]);

  /* ── Package label (for contract) ── */
  const packageLabel = useMemo(() => {
    if (isResidential && selectedTier)
      return residentialTierMeta[selectedTier]?.label ?? getDisplayLabel(selectedTier, "tier");
    return (
      SERVICE_LABEL[quote.service_type] ??
      getDisplayLabel(quote.service_type, "service_type") ??
      "Standard"
    );
  }, [isResidential, selectedTier, quote.service_type, residentialTierMeta]);

  /* ── Applicable add-ons (tier bundles: Estate/Signature hide kits & included services — see addon-visibility) ── */
  const applicableAddons = useMemo(() => {
    const serviceOk = (a: (typeof allAddons)[number]) =>
      !a.applicable_service_types?.length || a.applicable_service_types.includes(quote.service_type);
    const base = allAddons.filter(serviceOk);
    if (!selectedTier) return base;
    if (quote.service_type === "local_move" || quote.service_type === "long_distance") {
      return getVisibleAddons(base, selectedTier);
    }
    return base.filter((a) => !a.excluded_tiers?.includes(selectedTier));
  }, [allAddons, selectedTier, quote.service_type]);

  /* ── Add-on helpers ── */
  const toggleAddon = useCallback(
    (addon: Addon) => {
      setSelectedAddons((prev) => {
        const next = new Map(prev);
        const toggled = next.has(addon.id);
        if (toggled) {
          next.delete(addon.id);
        } else {
          const tierIndex = 0;
          next.set(addon.id, { addon_id: addon.id, slug: addon.slug, quantity: 1, tier_index: tierIndex });
        }
        trackEvent("addon_toggled", { addon: addon.slug, enabled: !toggled });
        trackEngagement("addon_toggled", { addon: addon.slug, action: toggled ? "off" : "on" });
        return next;
      });
    },
    [quote.move_size, trackEvent, trackEngagement],
  );

  const updateQty = useCallback((id: string, qty: number) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, quantity: Math.max(1, qty) });
      return next;
    });
  }, []);

  const updateTierIdx = useCallback((id: string, idx: number) => {
    setSelectedAddons((prev) => {
      const next = new Map(prev);
      const cur = next.get(id);
      if (cur) next.set(id, { ...cur, tier_index: idx });
      return next;
    });
  }, []);

  /* ── Add-on total ── */
  const addonTotal = useMemo(() => {
    let sum = 0;
    for (const [id, sel] of selectedAddons) {
      const addon = allAddons.find((a) => a.id === id);
      if (!addon) continue;
      switch (addon.price_type) {
        case "flat":
          sum += addon.price;
          break;
        case "per_unit":
          sum += addon.price * (sel.quantity || 1);
          break;
        case "tiered":
          sum += addon.tiers?.[sel.tier_index ?? 0]?.price ?? 0;
          break;
        case "percent":
          sum += Math.round(basePrice * Math.min(Math.max(addon.percent_value ?? 0, 0), 1));
          break;
      }
    }
    return sum;
  }, [selectedAddons, allAddons, basePrice]);

  /* ── Valuation costs ── */
  const INCLUDED_VALUATION: Record<string, string> = {
    essential: "released",
    signature: "enhanced",
    estate: "full_replacement",
  };
  const currentPackage = isResidential && selectedTier ? selectedTier : "essential";
  const includedValuation = INCLUDED_VALUATION[currentPackage] ?? "released";

  const activeUpgrade = useMemo(() => {
    if (!valuationUpgradeSelected) return null;
    return valuationUpgrades.find((u) => u.from_package === currentPackage) ?? null;
  }, [valuationUpgradeSelected, valuationUpgrades, currentPackage]);

  const declarationFeeTotal = useMemo(
    () => declarations.reduce((sum, d) => sum + d.fee, 0),
    [declarations],
  );

  const valuationCost = (activeUpgrade?.price ?? 0) + declarationFeeTotal;

  /* ── Computed totals ── */
  const totalBeforeTax = basePrice + addonTotal + valuationCost;
  const referralDiscountAmt = referralVerified ? referralDiscount : 0;
  const tax = Math.round((totalBeforeTax - referralDiscountAmt) * TAX_RATE);
  const grandTotal = totalBeforeTax - referralDiscountAmt + tax;
  const deposit = useMemo(() => {
    const faEarly = quote.factors_applied as Record<string, unknown> | null;
    if (isB2BInvoiceQuote(faEarly, quote.service_type)) {
      return 0;
    }
    const b2bCardFullPay =
      isB2BDeliveryQuoteServiceType(quote.service_type) &&
      !isB2BInvoiceQuote(faEarly, quote.service_type);
    if (b2bCardFullPay) {
      return grandTotal;
    }
    if (quote.service_type === "bin_rental") {
      return grandTotal;
    }
    if (isResidential && selectedTier) {
      return calculateTieredDeposit(selectedTier, totalBeforeTax);
    }
    const stored = quote.deposit_amount != null ? Number(quote.deposit_amount) : null;
    if (stored != null && stored > 0) {
      return stored;
    }
    return calculateDeposit(quote.service_type, totalBeforeTax);
  }, [
    isResidential,
    selectedTier,
    quote.service_type,
    quote.deposit_amount,
    quote.factors_applied,
    totalBeforeTax,
    grandTotal,
  ]);

  /* ── Contract data for ContractSign component ── */
  const contractAddonsList = useMemo((): ContractAddon[] => {
    const list: ContractAddon[] = [];
    for (const [id, sel] of selectedAddons) {
      const addon = allAddons.find((a) => a.id === id);
      if (!addon) continue;
      let cost = 0;
      switch (addon.price_type) {
        case "flat":
          cost = addon.price;
          break;
        case "per_unit":
          cost = addon.price * (sel.quantity || 1);
          break;
        case "tiered":
          cost = addon.tiers?.[sel.tier_index ?? 0]?.price ?? 0;
          break;
        case "percent":
          cost = Math.round(basePrice * Math.min(Math.max(addon.percent_value ?? 0, 0), 1));
          break;
      }
      list.push({ name: addon.name, price: cost, quantity: sel.quantity ?? 1 });
    }
    return list;
  }, [selectedAddons, allAddons, basePrice]);

  const contractData = useMemo((): ContractQuoteData => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    const isEvMulti =
      quote.service_type === "event" && fa?.event_mode === "multi" && Array.isArray(fa.event_legs);
    const fmtLeg = (d: string | null | undefined) =>
      !d
        ? "-"
        : new Date(d + "T00:00:00").toLocaleDateString("en-CA", { month: "short", day: "numeric" });
    const eventLegs =
      isEvMulti && fa
        ? (fa.event_legs as Array<Record<string, unknown>>).map((leg, idx) => ({
            label: String(leg.label ?? `Event ${idx + 1}`),
            fromAddress: abbreviateAddressRegions(String(leg.from_address ?? quote.from_address ?? "")),
            toAddress: abbreviateAddressRegions(String(leg.to_address ?? "")),
            deliveryDate: fmtLeg(leg.delivery_date as string),
            returnDate: fmtLeg(leg.return_date as string),
          }))
        : undefined;

    const fromTrim = (quoteForDisplay.from_address ?? "").trim();
    const toAddr = quoteForDisplay.to_address ?? "";
    const binRentalSchedule =
      quote.service_type === "bin_rental"
        ? {
            deliveryDate: (fa?.bin_drop_off_date as string | null) ?? null,
            deliveryAddress: abbreviateAddressRegions(toAddr),
            moveDate: (fa?.bin_move_date as string | null) ?? null,
            pickupDate: (fa?.bin_pickup_date as string | null) ?? null,
            pickupAddress: abbreviateAddressRegions(
              fromTrim && fromTrim !== toAddr.trim() ? fromTrim : toAddr,
            ),
            cycleDays:
              typeof fa?.bin_rental_cycle_days === "number" ? fa.bin_rental_cycle_days : 12,
          }
        : undefined;

    return {
      quoteId: quote.quote_id,
      serviceType: quote.service_type,
      residentialTier: isResidential && selectedTier ? selectedTier : null,
      packageLabel,
      fromAddress: quoteForDisplay.from_address,
      toAddress: quoteForDisplay.to_address,
      fromAccess: quote.from_access,
      toAccess: quote.to_access,
      moveDate: quote.move_date,
      preferredTime: quote.preferred_time ?? null,
      arrivalTimeWindow: quoteArrivalTimeWindowLabel(quote),
      moveSize: quote.move_size,
      distanceKm: quote.distance_km,
      driveTimeMin: quote.drive_time_min,
      basePrice,
      addons: contractAddonsList,
      addonTotal,
      totalBeforeTax,
      tax,
      grandTotal,
      deposit,
      eventLegs,
      binRentalSchedule,
      ...(clientPickupRows.length > 1
        ? {
            pickupStops: clientPickupRows.map((r) => ({
              address: r.address,
              accessLine: accessLabel(r.access),
            })),
          }
        : {}),
      ...(clientDropoffRows.length > 1
        ? {
            dropoffStops: clientDropoffRows.map((r) => ({
              address: r.address,
              accessLine: accessLabel(r.access),
            })),
          }
        : {}),
      ...(quote.service_type === "b2b_oneoff" || quote.service_type === "b2b_delivery"
        ? {
            b2bNet30Invoice:
              (quote.factors_applied as Record<string, unknown> | null)?.b2b_payment_method ===
              "invoice",
          }
        : {}),
    };
  }, [
    isResidential,
    selectedTier,
    quote.quote_id,
    quote.service_type,
    quote.factors_applied,
    quote.from_address,
    quoteForDisplay.from_address,
    quoteForDisplay.to_address,
    quote.from_access,
    quote.to_access,
    quote.move_date,
    quote.preferred_time,
    quote.arrival_window,
    quote.move_size,
    quote.distance_km,
    quote.drive_time_min,
    packageLabel,
    basePrice,
    contractAddonsList,
    addonTotal,
    totalBeforeTax,
    tax,
    grandTotal,
    deposit,
    clientPickupRows,
    clientDropoffRows,
  ]);

  /* ── Handlers ── */
  const scrollToSection = useCallback((ref: React.RefObject<HTMLElement | null>) => {
    setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
  }, []);

  const scrollToContract = useCallback(() => {
    setTimeout(
      () => contractRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      300,
    );
  }, []);

  const handleSelectTier = useCallback(
    (tierKey: string) => {
      setSelectedTier(tierKey);
      setConfirmed(true);
      setSelectedAddons((prev) => {
        const next = new Map(prev);
        for (const [id] of next) {
          const addon = allAddons.find((a) => a.id === id);
          if (addon?.excluded_tiers?.includes(tierKey)) next.delete(id);
          if (addon && isAddonHiddenForTier(addon.slug, tierKey)) next.delete(id);
        }
        return next;
      });
      trackEvent("tier_selected", { tier: tierKey });
      trackEngagement("tier_clicked", { tier: tierKey });
      if (isResidential) {
        const base = allAddons.filter(
          (a) => !a.applicable_service_types?.length || a.applicable_service_types.includes(quote.service_type),
        );
        const visible =
          quote.service_type === "local_move" || quote.service_type === "long_distance"
            ? getVisibleAddons(base, tierKey)
            : base.filter((a) => !a.excluded_tiers?.includes(tierKey));
        const hasAddons = visible.length > 0 || tierKey === "estate";
        const nextStep = hasAddons ? 2 : 3;
        setCurrentStep(nextStep);
        const targetRef = nextStep === 2 ? addonsRef : protectionRef;
        scrollToSection(targetRef);
      } else {
        scrollToContract();
      }
    },
    [allAddons, isResidential, quote.service_type, scrollToContract, scrollToSection, trackEvent, trackEngagement],
  );

  // Sync currentStep when addons section is skipped (no applicable addons)
  useEffect(() => {
    if (
      isResidential &&
      selectedTier &&
      currentStep === 2 &&
      applicableAddons.length === 0
    ) {
      setCurrentStep(3);
    }
  }, [isResidential, selectedTier, currentStep, applicableAddons.length]);

  const handleAddonsComplete = useCallback(() => {
    setCurrentStep(3);
    scrollToSection(protectionRef);
  }, [scrollToSection]);

  const handleProtectionComplete = useCallback(() => {
    setCurrentStep(4);
    scrollToSection(confirmRef);
  }, [scrollToSection]);

  const handleConfirmComplete = useCallback(() => {
    setCurrentStep(5);
    scrollToSection(paymentRef);
  }, [scrollToSection]);

  const handleStepClick = useCallback(
    (stepNum: number) => {
      if (!isResidential || stepNum > currentStep) return;
      // When no addons, step 2 (Customize) is skipped — treat as step 3
      const effectiveStep = stepNum === 2 && applicableAddons.length === 0 ? 3 : stepNum;
      setCurrentStep(effectiveStep);
      const refs: React.RefObject<HTMLElement | null>[] = [tiersRef, addonsRef, protectionRef, confirmRef, paymentRef];
      const ref = refs[effectiveStep - 1];
      if (ref) scrollToSection(ref);
    },
    [currentStep, isResidential, applicableAddons.length, scrollToSection],
  );

  const getBackStep = useCallback(() => {
    if (currentStep === 2) return 1;
    if (currentStep === 3) return applicableAddons.length > 0 ? 2 : 1;
    if (currentStep === 4) return 3;
    return null;
  }, [currentStep, applicableAddons.length]);

  const handleBack = useCallback(() => {
    const backStep = getBackStep();
    if (backStep) handleStepClick(backStep);
  }, [getBackStep, handleStepClick]);

  const handleConfirm = useCallback(() => {
    setSelectedTier("custom");
    setConfirmed(true);
    scrollToContract();
  }, [scrollToContract]);

  const isConfirmed = confirmed && selectedTier != null;

  const factorsApplied = useMemo(
    () => (quote.factors_applied ?? null) as Record<string, unknown> | null,
    [quote.factors_applied],
  );

  /** Truck surcharge is included in the total; never show as a priced line to clients. */
  const truckBreakdownClientNote = useMemo(() => null as string | null, []);

  const b2bInvoiceBooking = useMemo(
    () => isB2BInvoiceQuote(factorsApplied, quote.service_type),
    [quote.service_type, factorsApplied],
  );

  const binRentalBooking = quote.service_type === "bin_rental";

  const handleB2bInvoiceConfirm = useCallback(async () => {
    setInvoiceConfirmError(null);
    setInvoiceConfirmLoading(true);
    try {
      const res = await fetch("/api/quotes/accept-b2b-invoice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteId: quote.quote_id,
          clientName: signedName,
          clientEmail: contactEmail ?? "",
          selectedTier: selectedTier ?? "custom",
          selectedAddons: Array.from(selectedAddons.values()),
        }),
      });
      const data = (await res.json()) as { error?: string; tracking_url?: string | null };
      if (!res.ok) {
        setInvoiceConfirmError(data.error ?? "Could not confirm booking");
        return;
      }
      const tu = typeof data.tracking_url === "string" ? data.tracking_url.trim() : "";
      if (tu) {
        setDeliveryTrackingUrl(tu.startsWith("http") ? tu : `${typeof window !== "undefined" ? window.location.origin : ""}${tu.startsWith("/") ? tu : `/${tu}`}`);
      }
      setBooked(true);
    } catch {
      setInvoiceConfirmError("Something went wrong. Please try again.");
    } finally {
      setInvoiceConfirmLoading(false);
    }
  }, [quote.quote_id, signedName, contactEmail, selectedTier, selectedAddons]);

  /* ── Hero config ── */
  const hero = useMemo(() => {
    const fa = quote.factors_applied as Record<string, unknown> | null;
    if (fa?.specialty_b2b_transport === true) {
      return {
        headline: "Your Specialty Transport Quote",
        subtitle:
          "Custom one-off logistics with coordinator-built pricing. Review scope and confirm to secure your date.",
      };
    }
    const base = HERO_CONFIG[quote.service_type] ?? HERO_CONFIG.local_move;
    if (isB2BDeliveryQuoteServiceType(quote.service_type)) {
      const code = typeof fa?.b2b_vertical_code === "string" ? fa.b2b_vertical_code : null;
      const handling =
        typeof fa?.b2b_handling_type === "string" && fa.b2b_handling_type.trim()
          ? fa.b2b_handling_type
          : undefined;
      return getB2BQuoteHero(code, handling);
    }
    return base;
  }, [quote.service_type, quote.factors_applied]);
  const dateLabel =
    quote.service_type === "single_item" ||
    quote.service_type === "white_glove" ||
    quote.service_type === "b2b_oneoff" ||
    quote.service_type === "b2b_delivery"
      ? "Delivery Date"
      : quote.service_type === "office_move"
        ? "Relocation Date"
        : "Move Date";

  /* ── Expiry check ── */
  const expiringSoon = useMemo(() => {
    if (!quote.expires_at || booked) return false;
    const hoursLeft = (new Date(quote.expires_at).getTime() - Date.now()) / 3_600_000;
    return hoursLeft > 0 && hoursLeft <= 48;
  }, [quote.expires_at, booked]);

  const expiryDateStr = useMemo(() => {
    if (!quote.expires_at) return "";
    return new Date(quote.expires_at).toLocaleDateString("en-CA", {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  }, [quote.expires_at]);

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }} data-theme="light">
      {expiringSoon && (
        <div
          className="sticky top-0 z-50 px-4 py-2.5 text-center text-[13px] font-medium"
          style={{ backgroundColor: "#FFF8E1", color: "#8B6914", borderBottom: `1px solid ${FOREST}33` }}
        >
          <Clock className="inline w-3.5 h-3.5 mr-1.5 -mt-0.5" />
          This quote expires on {expiryDateStr}. Book now to secure your rate.
        </div>
      )}
      {/* ═══ HERO ═══ */}
      <header className="relative overflow-hidden" style={{ backgroundColor: WINE }}>
        <div
          className="absolute inset-0 opacity-10"
            style={{
            backgroundImage:
              "radial-gradient(circle at 20% 50%, rgba(255,255,255,0.14) 0%, transparent 50%), radial-gradient(circle at 80% 50%, rgba(255,255,255,0.12) 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-5 py-12 md:py-16 text-center">
          <div className="flex justify-center mb-2">
            <YugoLogo size={36} variant="cream" />
          </div>
          <div className="w-12 h-px mx-auto mb-6 bg-white/30" />
          <h1 className="font-hero text-[30px] md:text-[36px] text-white leading-snug mb-3">
            {hero.headline}
          </h1>
          <p
            className="max-w-md mx-auto text-[15px] md:text-[16px] leading-relaxed font-medium"
            style={{ color: HERO_SUBTITLE }}
          >
            {hero.subtitle}
          </p>

          {/* Quote meta (no chrome box) */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: HERO_META_LABEL }}>
                Your quote
              </p>
              <p className="text-[14px] font-semibold" style={{ color: HERO_META_VALUE }}>
                {SERVICE_LABEL[quote.service_type] ??
                  getDisplayLabel(quote.service_type, "service_type") ??
                  "Personalized estimate"}
              </p>
            </div>
            <div className="hidden sm:block w-px h-8 shrink-0 bg-white/20" aria-hidden />
            <div className="text-left min-w-0">
              <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: HERO_META_LABEL }}>
                {dateLabel}
              </p>
              <p className="text-[14px] font-semibold" style={{ color: HERO_META_VALUE }}>
                {quote.move_date
                  ? new Date(quote.move_date + "T00:00:00").toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })
                  : "TBD"}
              </p>
            </div>
            {quote.expires_at && (
              <>
                <div className="hidden sm:block w-px h-8 shrink-0 bg-white/20" aria-hidden />
                <div className="text-left min-w-0">
                  <p className="text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: HERO_META_LABEL }}>
                    Valid
                  </p>
                  <p className="text-[14px] font-semibold" style={{ color: HERO_META_VALUE }}>
                    {expiresValue(quote.expires_at)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {currentStep >= 2 && !booked && (
        <ProgressBar currentStep={currentStep} onStepClick={handleStepClick} />
      )}

      <div className="max-w-4xl md:max-w-5xl lg:max-w-7xl mx-auto px-5 md:px-6">
        {/* ═══ GUARANTEED PRICE BADGE ═══ */}
        <div
          className={`mb-8 py-3 ${currentStep >= 2 && !booked ? "mt-3" : "mt-4"}`}
          style={{ backgroundColor: CREAM }}
        >
          <div className="w-full min-w-0 px-1 sm:px-0">
            <div
              className="box-border w-full min-w-0 max-w-full rounded-none px-4 py-3.5 text-center sm:px-5 border-t-2"
              style={{
                backgroundColor: `${FOREST}05`,
                borderTopColor: FOREST,
              }}
            >
              <div className="min-w-0 max-w-2xl mx-auto">
                <p className="text-[12px] font-bold tracking-wider uppercase sm:text-[13px]" style={{ color: FOREST }}>
                  Guaranteed Price
                </p>
                <p className="text-[11px] leading-snug sm:text-[12px]" style={{ color: FOREST }}>
                  The price you see is the price you pay. No hourly surprises. No hidden fees.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ═══ SEASONAL PRICING BANNER ═══ */}
        {(() => {
          if (booked || !quote.move_date) return null;
          const moveMonth = new Date(quote.move_date + "T00:00:00").getMonth() + 1;
          const PEAK_MODS: Record<number, number> = { 6: 1.1, 7: 1.15, 8: 1.15 };
          const peakMod = PEAK_MODS[moveMonth];
          if (!peakMod) return null;
          const savings = Math.round(grandTotal * (1 - 1 / peakMod));
          if (savings <= 75) return null;
          return (
            <div className="mb-6">
              <SeasonalPricingPreview
                basePrice={Math.round(grandTotal / peakMod)}
                selectedMonth={moveMonth}
                compact
              />
            </div>
          );
        })()}

        {/* ═══ LAYOUT DISPATCH ═══ */}
        {isResidential && tiers ? (
          <section ref={tiersRef} className="scroll-mt-6">
            <ResidentialLayout
              quote={quoteForDisplay}
              tiers={tiers}
              selectedTier={selectedTier}
              onSelectTier={handleSelectTier}
              recommendedTier={recommendedTierNorm}
              hasSelection={false}
              tierFeaturesConfig={residentialTierFeatures}
              tierCardAdditions={residentialTierCardAdditions}
              useAdditiveTierCards={residentialTierUseAdditiveCards}
              tierMetaMap={residentialTierMeta}
            />
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
          </section>
        ) : quote.service_type === "long_distance" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
            <LongDistanceLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "office_move" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
            <OfficeLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "single_item" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              variant="logistics"
              truckPricingNote={truckBreakdownClientNote}
            />
            <SingleItemLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "white_glove" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              variant="logistics"
              truckPricingNote={truckBreakdownClientNote}
            />
            <WhiteGloveLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "specialty" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
            <SpecialtyLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : (quote.service_type === "b2b_oneoff" || quote.service_type === "b2b_delivery") ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              variant="logistics"
              logisticsLeadPackage={b2bPackageLeadIcon}
              logisticsB2bHandling={
                typeof (quote.factors_applied as Record<string, unknown> | null)?.b2b_handling_type ===
                "string"
                  ? String(
                      (quote.factors_applied as Record<string, unknown>).b2b_handling_type,
                    ).trim() || null
                  : null
              }
              truckPricingNote={truckBreakdownClientNote}
            />
            <B2BOneOffLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "event" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              variant="event"
              eventFeatures={eventFeatures}
              showEventSetupFeature={
                Number((quote.factors_applied as Record<string, unknown> | null)?.setup_fee) > 0
              }
              truckPricingNote={truckBreakdownClientNote}
            />
            <EventLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "labour_only" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
            <LabourOnlyLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "bin_rental" ? (
          <BinRentalLayout quote={quoteForDisplay} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.custom_price != null ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              residentialTierFeatures={residentialTierFeatures}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
              truckPricingNote={truckBreakdownClientNote}
            />
            <FallbackPrice
              price={quote.custom_price}
              onConfirm={handleConfirm}
              confirmed={confirmed}
            />
          </>
        ) : null}

        {/* ═══ SECTION 2: ADD-ONS ═══ */}
        {((isResidential && currentStep >= 2) || (!isResidential && isConfirmed)) &&
          quote.service_type !== "bin_rental" &&
          (applicableAddons.length > 0 || (isResidential && selectedTier === "estate")) &&
          !booked && (
            <section ref={addonsRef} className="scroll-mt-6">
              {isResidential && currentStep >= 2 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-[12px] font-medium mb-4 transition-opacity hover:opacity-70 flex items-center gap-1"
                  style={{ color: FOREST_BODY }}
                >
                  ← Back
                </button>
              )}
              {isResidential && selectedTier === "estate" && (
                <div
                  className="mb-4 rounded-none px-4 py-3.5 space-y-1.5 text-[11px] leading-snug text-center border-t-2 max-w-2xl mx-auto"
                  style={{ color: FOREST, backgroundColor: `${FOREST}04`, borderTopColor: FOREST }}
                >
                  <p className="font-bold text-[12px]" style={{ color: FOREST }}>
                    {ESTATE_ADDON_UI_LINES[0]}
                  </p>
                  <p>{ESTATE_ADDON_UI_LINES[1]}</p>
                  <p className="font-semibold pt-0.5" style={{ color: FOREST }}>
                    {ESTATE_ADDON_UI_LINES[2]}
                  </p>
                </div>
              )}
              <AddOnsSection
                addons={applicableAddons}
                allAddons={allAddons}
                selectedAddons={selectedAddons}
                basePrice={basePrice}
                addonTotal={addonTotal}
                valuationCost={valuationCost}
                tax={tax}
                grandTotal={grandTotal}
                deposit={deposit}
                selectedTierData={
                  isResidential && selectedTier && tiers?.[selectedTier] ? tiers[selectedTier] : null
                }
                moveSize={quote.move_size}
                toggleAddon={toggleAddon}
                updateQty={updateQty}
                updateTierIdx={updateTierIdx}
                isProgressive={isResidential}
                onContinue={handleAddonsComplete}
                showContinueButton={isResidential && currentStep === 2}
              />
            </section>
          )}

        {/* ═══ SECTION 3: VALUATION PROTECTION ═══ */}
        {((isResidential && currentStep >= 3) || (!isResidential && isConfirmed)) &&
          quote.service_type !== "bin_rental" &&
          !booked && (
          <section ref={protectionRef} className="scroll-mt-6">
            {isResidential && currentStep >= 3 && (
              <button
                type="button"
                onClick={handleBack}
                className="text-[12px] font-medium mb-4 transition-opacity hover:opacity-70 flex items-center gap-1"
                style={{ color: FOREST_BODY }}
              >
                ← Back
              </button>
            )}
            <ValuationProtectionCard
              includedValuation={includedValuation}
              currentPackage={currentPackage}
              valuationTiers={valuationTiers}
              valuationUpgrades={valuationUpgrades}
              upgradeSelected={valuationUpgradeSelected}
              onToggleUpgrade={() => setValuationUpgradeSelected((p) => !p)}
              declarations={declarations}
              onAddDeclaration={(d) => setDeclarations((prev) => [...prev, d])}
              onRemoveDeclaration={(idx) => setDeclarations((prev) => prev.filter((_, i) => i !== idx))}
              journeyCopy={valuationJourneyCopy}
            />
            {isResidential && currentStep === 3 && (
              <div className="mt-6 pb-10 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleProtectionComplete}
                  className="w-full max-w-md py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: FOREST }}
                >
                  Continue
                </button>
              </div>
            )}
          </section>
        )}

        {/* ═══ SECTION 4: CONFIRM DETAILS ═══ */}
        {((isResidential && currentStep >= 4) || (!isResidential && isConfirmed)) && !booked && (
          <section ref={confirmRef} className="scroll-mt-6">
            {isResidential && currentStep >= 4 && (
              <button
                type="button"
                onClick={handleBack}
                className="text-[12px] font-medium mb-4 transition-opacity hover:opacity-70 flex items-center gap-1"
                style={{ color: FOREST_BODY }}
              >
                ← Back
              </button>
            )}
            {isResidential && selectedTier && tiers?.[selectedTier] && (
              <ConfirmDetailsSection
                quote={quoteForDisplay}
                selectedTier={selectedTier}
                packageLabel={packageLabel}
                contractAddonsList={contractAddonsList}
                addonTotal={addonTotal}
                valuationUpgradeSelected={valuationUpgradeSelected}
                includedValuation={includedValuation}
                selectedAddons={selectedAddons}
                pickupRows={clientPickupRows}
                dropoffRows={clientDropoffRows}
              />
            )}
            {/* Referral code, for residential, inside confirm; for non-residential, standalone */}
            {(!isResidential || currentStep >= 4) && (
              <div className="mb-6 px-4 py-3.5" style={{ backgroundColor: `${FOREST}06` }}>
                <p className={`${QUOTE_EYEBROW_CLASS} mb-3`} style={{ color: FOREST_MUTED }}>
                  Have a referral code?
                </p>
                <div className="flex gap-2 flex-wrap sm:flex-nowrap">
                  <input
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralMsg(""); }}
                    placeholder="YUGO-NAME-XXXX"
                    disabled={referralVerified}
                    className="flex-1 min-w-[12rem] px-3 py-2.5 rounded-none border text-[12px] font-mono focus:outline-none text-[#2C3E2D] placeholder:text-[#5D6B5E]"
                    style={{ borderColor: referralVerified ? "#2D9F5A" : `${FOREST}20`, background: referralVerified ? "#F0FFF4" : "white" }}
                  />
                  {!referralVerified && (
                    <button
                      type="button"
                      onClick={verifyReferral}
                      disabled={!referralCode.trim()}
                      className="px-5 py-2.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] disabled:opacity-50 transition-opacity"
                      style={{ background: FOREST, color: "white" }}
                    >
                      Apply
                    </button>
                  )}
                </div>
                {referralMsg && (
                  <p className={`mt-1.5 text-[11px] font-medium ${referralVerified ? "text-[#2D9F5A]" : "text-red-500"}`}>
                    <SafeText fallback="We couldn&apos;t process that code. Try again or contact us.">
                      {referralMsg}
                    </SafeText>
                  </p>
                )}
              </div>
            )}
            {isResidential && currentStep === 4 && (
              <div className="mb-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  className="w-full max-w-md py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: FOREST }}
                >
                  Proceed to payment
                </button>
              </div>
            )}
          </section>
        )}

        {/* ═══ SOCIAL PROOF + TRUST BAR ═══ */}
        <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">
          <div>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  360+ Reviews
                </p>
                <p className="text-[12px] leading-snug" style={{ color: FOREST_BODY }}>
                  5-star rated on Google
                </p>
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  $2M Insurance
                </p>
                <p className="text-[12px] leading-snug" style={{ color: FOREST_BODY }}>
                  Full cargo coverage
                </p>
              </div>
              <div>
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  Flat-Rate Guarantee
                </p>
                <p className="text-[12px] leading-snug" style={{ color: FOREST_BODY }}>
                  No hidden fees on quoted scope.
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 text-center border-t border-[var(--brd)]/30">
              <p className="text-[11px] font-medium" style={{ color: FOREST_BODY }}>
                {isB2BDeliveryQuoteServiceType(quote.service_type)
                  ? "Trusted By Leading Toronto Businesses"
                  : "Trusted By Leading Toronto Businesses And Homeowners"}
              </p>
            </div>
          </div>
        </section>

        {/* ═══ DATE AVAILABILITY ═══ */}
        {slotsRemaining != null && slotsRemaining <= 2 && slotsRemaining > 0 && quote.move_date && !booked && (
          <section className="mb-6 pt-6 border-t border-[var(--brd)]/30">
            <div className="px-5 py-3.5" style={{ backgroundColor: "#FFF8E1" }}>
              <p className="text-[12px] font-medium leading-snug" style={{ color: "#8B6914" }}>
                High demand - only {slotsRemaining} slot{slotsRemaining > 1 ? "s" : ""} remaining for{" "}
                {new Date(quote.move_date + "T00:00:00").toLocaleDateString("en-CA", {
                  month: "long",
                  day: "numeric",
                })}
              </p>
            </div>
          </section>
        )}

        {/* ═══ SECTION 5: AGREEMENT + PAYMENT ═══ */}
        {((isResidential && currentStep >= 5) || (!isResidential && isConfirmed)) && !booked && (
          <section ref={paymentRef} className="mb-10 pt-6 border-t border-[var(--brd)]/30 scroll-mt-6">
            <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-2 text-center`} style={{ color: WINE }}>
              Review &amp; book
            </h2>
            <p className="text-[12px] leading-relaxed mb-6 max-w-xl mx-auto text-center" style={{ color: FOREST_BODY }}>
              Review the agreement below and sign with your full legal name. Payment or invoice confirmation is the next step when your quote requires it.
            </p>
            <div ref={contractRef}>
            <ContractSign
              quoteData={contractData}
              companyLegalName={branding.companyLegal}
              companyDisplayName={branding.brand}
              onSigned={(data) => {
                setSignedName(data.typed_name);
                setContractSigned(true);
                trackEvent("payment_started", {
                  tier: selectedTier,
                  total: grandTotal,
                  deposit,
                  addon_count: selectedAddons.size,
                });
                trackEngagement("payment_started", {
                  tier: selectedTier,
                  total: grandTotal,
                  deposit,
                });
              }}
              onContractStarted={() => trackEvent("contract_started")}
            />
            </div>
          </section>
        )}

        {/* ═══ PAYMENT (inside Section 5, after contract signed) ═══ */}
        {((isResidential && currentStep >= 5) || (!isResidential && isConfirmed)) && contractSigned && !booked && (
          <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">
            {quoteBookingLocked && (
              <div className="mb-5 px-4 py-3 text-[12px] font-medium" style={{ backgroundColor: "#FFF4E5", color: "#8B4513" }} role="status">
                This quote has expired. Refresh the page or contact us for a new quote — payment is disabled.
              </div>
            )}
            <div className="mb-6">
              <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-2 text-center`} style={{ color: WINE }}>
                {b2bInvoiceBooking ? "Invoice (Net 30)" : "Payment"}
              </h2>
              <p className="text-[12px] leading-relaxed max-w-xl mx-auto text-center" style={{ color: FOREST_BODY }}>
                {b2bInvoiceBooking
                  ? "No card required. We will email an invoice; payment is due within 30 days of the invoice date."
                  : binRentalBooking
                    ? "Full payment confirms your rental. Your card stays on file for any late or missing-item fees."
                    : isB2BDeliveryQuoteServiceType(quote.service_type)
                      ? "Full payment (including HST) is required to confirm this commercial delivery booking."
                      : "Complete your booking with a secure deposit payment."}
              </p>
            </div>
            <div>
                {b2bInvoiceBooking ? (
                  <div className="space-y-4">
                    <div className="text-[12px] leading-relaxed space-y-2 pb-2" style={{ color: FOREST_BODY }}>
                      <p className="font-semibold text-[11px] uppercase tracking-[0.1em]" style={{ color: FOREST_MUTED }}>
                        Payment terms
                      </p>
                      <ul className="list-disc pl-4 space-y-1">
                        <li>Net 30, balance due within 30 days of invoice date.</li>
                        <li>Your delivery is confirmed; our coordinator may reach out with invoice details.</li>
                        <li>Taxes and quoted add-ons are included in your quote total unless noted otherwise.</li>
                      </ul>
                    </div>
                    {invoiceConfirmError ? (
                      <p className="text-[12px] font-medium" style={{ color: WINE }}>
                        <SafeText fallback="We couldn&apos;t confirm your booking. Please try again or contact us.">
                          {invoiceConfirmError}
                        </SafeText>
                      </p>
                    ) : null}
                    <button
                      type="button"
                      disabled={
                        quoteBookingLocked ||
                        invoiceConfirmLoading ||
                        !signedName.trim() ||
                        !(contactEmail ?? "").trim()
                      }
                      onClick={() => void handleB2bInvoiceConfirm()}
                      className="w-full py-3.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-opacity disabled:opacity-50"
                      style={{ backgroundColor: FOREST }}
                    >
                      {invoiceConfirmLoading ? "Confirming…" : "Confirm booking (invoice)"}
                    </button>
                  </div>
                ) : (
                  <SquarePaymentForm
                    amount={deposit}
                    quoteId={quote.quote_id}
                    clientName={signedName}
                    clientEmail={contactEmail ?? ""}
                    selectedTier={selectedTier}
                    selectedAddons={Array.from(selectedAddons.values())}
                    disabled={quoteBookingLocked}
                    amountHeading={
                      isB2BDeliveryQuoteServiceType(quote.service_type) && !binRentalBooking
                        ? "TOTAL DUE NOW"
                        : binRentalBooking
                          ? "TOTAL DUE NOW"
                          : "DEPOSIT AMOUNT"
                    }
                    submitLabel={
                      binRentalBooking
                        ? `PAY ${fmtPrice(deposit)} & BOOK`
                        : isB2BDeliveryQuoteServiceType(quote.service_type)
                          ? `PAY ${fmtPrice(deposit)} & CONFIRM DELIVERY`
                          : `PAY ${fmtPrice(deposit)} & BOOK MY MOVE`
                    }
                    onSuccess={(result) => {
                      if (isB2BDeliveryQuoteServiceType(quote.service_type) && result.tracking_url) {
                        const tu = result.tracking_url.trim();
                        setDeliveryTrackingUrl(
                          tu.startsWith("http")
                            ? tu
                            : `${typeof window !== "undefined" ? window.location.origin : ""}${tu.startsWith("/") ? tu : `/${tu}`}`,
                        );
                      }
                      if (result.move_id) setPaymentMoveId(result.move_id);
                      setBooked(true);
                    }}
                    onError={(err) => {
                      console.error("Payment error:", err);
                    }}
                  />
                )}
            </div>
          </section>
        )}

        {/* ═══ SUCCESS STATE ═══ */}
        {booked && (
          <section className="mb-10 pt-8 text-center border-t border-[var(--brd)]/25">
              <Check className="w-7 h-7 mx-auto mb-4 block" style={{ color: FOREST }} aria-hidden />
              <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-2`} style={{ color: WINE }}>
                You&apos;re All Set!
              </h2>
              <p
                className="text-[var(--text-base)] max-w-sm mx-auto leading-relaxed"
                style={{ color: FOREST }}
              >
                {b2bInvoiceBooking ? (
                  <>
                    Your B2B delivery is confirmed on invoice terms (Net 30). We&apos;ll follow up with
                    invoice and scheduling details by email.
                  </>
                ) : quote.service_type === "bin_rental" ? (
                  <>
                    Your bin rental is booked. We&apos;ll send a confirmation with delivery and pickup
                    details. Our team will reach out before each visit.
                  </>
                ) : (
                  <>
                    Your{" "}
                    {quote.service_type === "office_move"
                      ? "relocation"
                      : quote.service_type === "b2b_oneoff" ||
                          quote.service_type === "b2b_delivery" ||
                          quote.service_type === "single_item" ||
                          quote.service_type === "white_glove"
                        ? "delivery"
                        : "move"}{" "}
                    is booked. We&apos;ll send a confirmation email with all the details. Our team will
                    reach out closer to your{" "}
                    {quote.service_type === "office_move"
                      ? "relocation"
                      : quote.service_type === "b2b_oneoff" ||
                          quote.service_type === "b2b_delivery" ||
                          quote.service_type === "single_item" ||
                          quote.service_type === "white_glove"
                        ? "delivery"
                        : "move"}{" "}
                    date.
                  </>
                )}
              </p>
              <div
                className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
                style={{ backgroundColor: `${FOREST}08` }}
              >
                <span className="text-[11px] font-semibold" style={{ color: FOREST }}>
                  Quote {quote.quote_id}
                </span>
                <span className="text-[11px]" style={{ color: FOREST_MUTED }}>
                  &middot;
                </span>
                <span className="text-[11px]" style={{ color: FOREST }}>
                  {fmtDate(quote.move_date)}
                </span>
              </div>
              {(paymentMoveId || deliveryTrackingUrl || b2bInvoiceBooking) && (
                <p className="text-[12px] mt-4" style={{ color: FOREST_BODY }}>
                  A confirmation email is on its way.
                  {(paymentMoveId || deliveryTrackingUrl) && !b2bInvoiceBooking
                    ? ` You can track your ${
                        quote.service_type === "office_move"
                          ? "relocation"
                          : quote.service_type === "b2b_oneoff" ||
                              quote.service_type === "b2b_delivery" ||
                              quote.service_type === "single_item" ||
                              quote.service_type === "white_glove"
                            ? "delivery"
                            : "move"
                      } status anytime.`
                    : b2bInvoiceBooking && deliveryTrackingUrl
                      ? " Use the link below to follow your delivery status."
                      : null}
                </p>
              )}
              {deliveryTrackingUrl && (
                <div className="mt-5">
                  <a
                    href={deliveryTrackingUrl}
                    className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90 min-h-[48px]"
                    style={{ backgroundColor: FOREST }}
                  >
                    Open live delivery tracking
                  </a>
                </div>
              )}
              {paymentMoveId && !deliveryTrackingUrl && (
                <SchedulingAlternativesCard
                  moveId={paymentMoveId}
                  accentColor={FOREST}
                  forestColor={FOREST}
                />
              )}
          </section>
        )}

        <footer className="py-5 text-center border-t border-[var(--brd)]/20">
          <div className="flex justify-center mb-1">
            <YugoLogo size={14} variant="wine" onLightBackground />
          </div>
          <p className="text-[11px] font-medium tracking-wide" style={{ color: FOREST_MUTED }}>
            The Art of Moving
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: FOREST_MUTED }}>
            <a
              href={`mailto:${branding.email}`}
              style={{ color: FOREST_BODY }}
              className="hover:underline min-h-[44px] inline-flex items-center justify-center"
            >
              {branding.email}
            </a>
          </p>
        </footer>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Sub-components (kept in same file for simplicity)
   ═══════════════════════════════════════════════════ */

const InclusionsShowcase = React.forwardRef<
  HTMLElement,
  {
    selectedTier: string | null;
    isResidential: boolean;
    residentialTierFeatures: Record<string, TierFeature[]>;
    truckPrimary: string | null;
    truckSecondary: string | null;
    crewSize: number | null;
    variant?: "residential" | "event" | "logistics";
    /** Custom / Other B2B vertical: neutral package icon instead of truck. */
    logisticsLeadPackage?: boolean;
    /** When set, loading/unloading row matches `factors_applied.b2b_handling_type`. */
    logisticsB2bHandling?: string | null;
    eventFeatures?: TierFeature[] | null;
    showEventSetupFeature?: boolean;
    /** e.g. Truck: 20ft (+$150) from factors_applied */
    truckPricingNote?: string | null;
  }
>(function InclusionsShowcase(
  {
    selectedTier,
    isResidential,
    residentialTierFeatures,
    truckPrimary,
    truckSecondary,
    crewSize,
    variant = "residential",
    logisticsLeadPackage = false,
    logisticsB2bHandling = null,
    eventFeatures = null,
    showEventSetupFeature = false,
    truckPricingNote = null,
  },
  ref,
) {
  const INITIAL_VISIBLE = 6;
  const [expanded, setExpanded] = React.useState(false);

  const tier = (isResidential ? (selectedTier ?? "essential") : "essential") as string;

  const truckLabel = truckPrimary
    ? truckSecondary
      ? `${TRUCK_LUXURY[truckPrimary] ?? truckPrimary} + support van`
      : TRUCK_LUXURY[truckPrimary] ?? truckPrimary
    : "Your dedicated moving truck";

  const logisticsVehicleTitle = truckPrimary
    ? truckSecondary
      ? `${LOGISTICS_VEHICLE_LABELS[truckPrimary] ?? truckPrimary} + support vehicle`
      : LOGISTICS_VEHICLE_LABELS[truckPrimary] ?? `Delivery vehicle (${truckPrimary})`
    : "Dedicated delivery vehicle";

  const crewDesc = crewSize
    ? `${crewSize} licensed, insured, background-checked movers`
    : "Licensed, insured, background-checked movers";

  const logisticsCrewDesc = crewSize
    ? `${crewSize} licensed, insured logistics professionals`
    : "Licensed, insured logistics professionals";

  const baseFeatures =
    variant === "logistics"
      ? LOGISTICS_INCLUSION_FEATURES
      : variant === "event" && eventFeatures && eventFeatures.length > 0
        ? eventFeatures.filter(
            (feat) => feat.title !== "On-site setup and arrangement" || showEventSetupFeature,
          )
        : variant === "residential"
          ? getResolvedMoveIncludes(tier, truckLabel, crewSize)
          : (residentialTierFeatures[tier] ?? residentialTierFeatures.essential);

  // Hydrate dynamic truck & crew entries (residential “Your Move Includes” is fully resolved in getResolvedMoveIncludes)
  const hydratedFeatures =
    variant === "event"
      ? baseFeatures.map((f) => ({ ...f }))
      : variant === "logistics"
        ? baseFeatures.map((f, i) => {
            if (logisticsLeadPackage && i === 0) {
              return {
                ...f,
                iconName: "Package",
                title: "Right-sized vehicle for your shipment",
                desc: "Climate-controlled transport, assigned to this delivery",
              };
            }
            if (i === 0) {
              return {
                ...f,
                title: logisticsVehicleTitle,
                desc: "Climate-controlled transport, equipped for your shipment",
              };
            }
            if (i === 1) {
              return {
                ...f,
                title: crewSize ? `Professional crew of ${crewSize}` : "Professional crew",
                desc: logisticsCrewDesc,
              };
            }
            if (i === 3 && logisticsB2bHandling?.trim()) {
              const lu = getLogisticsLoadingUnloadingFeature(logisticsB2bHandling);
              return {
                ...f,
                title: lu.title,
                desc: lu.desc,
              };
            }
            return { ...f };
          })
        : variant === "residential"
          ? baseFeatures.map((f) => ({ ...f }))
          : baseFeatures.map((f, i) => {
            if (i === 0) return { ...f, title: truckLabel };
            if (i === 1) {
              return {
                ...f,
                title: crewSize ? `Professional crew of ${crewSize}` : "Professional crew",
                desc: crewDesc,
              };
            }
            return f;
          });

  const allItems =
    variant === "logistics"
      ? mergeTierFeatureListsPreferLater(hydratedFeatures, UNIVERSAL_LOGISTICS_FEATURES)
      : hydratedFeatures;
  const hasMore = allItems.length > INITIAL_VISIBLE;
  const visibleItems = expanded || !hasMore ? allItems : allItems.slice(0, INITIAL_VISIBLE);

  const sectionTitle =
    variant === "event"
      ? "What's Included"
      : variant === "logistics"
        ? "Your Delivery Includes"
        : "Your Move Includes";
  const sectionSub =
    variant === "event"
      ? "Event logistics, fully covered."
      : variant === "logistics"
        ? "Commercial logistics, handled end to end."
        : "Every detail, handled.";

  return (
    <section ref={ref} className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div className="text-center mb-6 max-w-xl mx-auto">
        <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST_MUTED }}>
          {variant === "logistics" ? "Delivery" : variant === "event" ? "Event" : "Move"} inclusions
        </p>
        <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-2`} style={{ color: WINE }}>
          {sectionTitle}
        </h2>
        <p className="text-[12px] leading-relaxed" style={{ color: FOREST_BODY }}>
          {sectionSub}
        </p>
      </div>

      <hr className="border-0 h-px max-w-xs mx-auto mb-8" style={{ backgroundColor: `${FOREST}12` }} />

      {truckPricingNote ? (
        <p
          className="text-center text-[11px] font-semibold max-w-lg mx-auto mb-6 px-2"
          style={{ color: FOREST }}
        >
          {truckPricingNote}
        </p>
      ) : null}

      <div className="grid md:grid-cols-2 gap-x-5 gap-y-4 max-w-4xl mx-auto min-w-0 px-2">
        {visibleItems.map((item, i) => (
          <div key={i} className="py-3 px-6 md:px-0.5">
            <div className="min-w-0">
              <p className="text-[13px] font-semibold leading-snug" style={{ color: FOREST }}>
                {item.title}
              </p>
              <p className="text-[11px] mt-0.5 leading-snug" style={{ color: FOREST_BODY }}>
                {item.desc}
              </p>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className={`flex w-fit mx-auto mt-6 items-center gap-2 ${QUOTE_EYEBROW_CLASS} py-1 transition-opacity hover:opacity-70`}
          style={{ color: FOREST }}
        >
          {expanded ? (
            <>
              Show less
              <ChevronUp className="w-3.5 h-3.5 shrink-0" aria-hidden />
            </>
          ) : (
            <>
              View all {allItems.length} features
              <ChevronDown className="w-3.5 h-3.5 shrink-0" aria-hidden />
            </>
          )}
        </button>
      )}
    </section>
  );
});

/* ═══════════════════════════════════════════════════
   Inventory Collapsible, Grouped by Room
   ═══════════════════════════════════════════════════ */

const INV_SERVICE_TYPES = new Set(["local_move", "long_distance", "office_move"]);
const ROOM_TRUNCATE = 5;

const ROOM_ORDER = [
  "living_room", "primary_bedroom", "bedroom", "bedroom_2", "bedroom_3",
  "dining_room", "kitchen", "office", "kids", "outdoor", "garage", "specialty", "other",
];

const ROOM_LABELS: Record<string, string> = {
  living_room: "Living Room",
  primary_bedroom: "Primary Bedroom",
  bedroom: "Bedroom",
  bedroom_2: "Bedroom 2",
  bedroom_3: "Bedroom 3",
  dining_room: "Dining Room",
  kitchen: "Kitchen",
  office: "Office",
  kids: "Kids Room",
  outdoor: "Outdoor",
  garage: "Garage",
  specialty: "Specialty Items",
  other: "Other",
};

function getRoomLabel(room: string): string {
  return ROOM_LABELS[room] || room.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface InvItem { name: string; quantity: number; isSpecialty: boolean }
interface InvRoom { room: string; label: string; items: InvItem[] }

function RoomSection({ room, defaultOpen }: { room: InvRoom; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [showAll, setShowAll] = useState(false);
  const visible = open ? (showAll ? room.items : room.items.slice(0, ROOM_TRUNCATE)) : [];
  const hasMore = room.items.length > ROOM_TRUNCATE;

  return (
    <div style={{ borderBottom: `1px solid ${FOREST}10` }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between w-full py-2 text-left group"
      >
        <span className="text-[12px] font-bold" style={{ color: FOREST }}>
          {room.label}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold" style={{ color: FOREST_MUTED }}>
            Qty
          </span>
          <ChevronDown
            className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
            style={{ color: FOREST_MUTED }}
          />
        </div>
      </button>

      {open && (
        <div className="pb-1.5">
          {visible.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-0.5 pl-2">
              <span
                className="text-[12px] flex-1 leading-snug"
                style={{ color: item.isSpecialty ? FOREST : FOREST_BODY }}
              >
                {item.name}
                {item.isSpecialty && (
                  <span className="ml-1 text-[11px] font-semibold" style={{ color: FOREST }}>
                    (specialty handling)
                  </span>
                )}
              </span>
              <span className="text-[12px] font-semibold shrink-0 ml-4" style={{ color: FOREST }}>
                {item.quantity}
              </span>
            </div>
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="mt-1 pl-2 text-[11px] font-semibold"
              style={{ color: FOREST }}
            >
              {showAll
                ? "Show less"
                : `Show ${room.items.length - ROOM_TRUNCATE} more items`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function WalkthroughDetails({
  quote,
  embedded = false,
}: {
  quote: Quote;
  /** Used under a parent “Your inventory” heading — no duplicate title or top rule */
  embedded?: boolean;
}) {
  const fmtDate = quote.walkthrough_date
    ? new Date(quote.walkthrough_date + "T12:00:00").toLocaleDateString("en-CA", {
        month: "long", day: "numeric", year: "numeric",
      })
    : null;

  const body = (
      <div className="space-y-1 pl-1">
        {fmtDate && (
          <p className="text-[11px]" style={{ color: FOREST_BODY }}>
            A pre-move walkthrough was conducted on{" "}
            <span className="font-semibold">{fmtDate}</span>.
            Your quote is based on the walkthrough assessment.
          </p>
        )}
        {quote.move_size && (
          <p className="text-[11px]" style={{ color: FOREST_BODY }}>
            Move Size:{" "}
            <span className="font-semibold">
              {MOVE_SIZE_LABELS[quote.move_size] ?? getDisplayLabel(quote.move_size)}
            </span>
          </p>
        )}
        {quote.walkthrough_special_items && (
          <p className="text-[11px]" style={{ color: FOREST_BODY }}>
            Special Items Noted:{" "}
            <span className="font-semibold">
              <SafeText fallback="See your coordinator for details.">{quote.walkthrough_special_items}</SafeText>
            </span>
          </p>
        )}
        {quote.walkthrough_notes && (
          <p className="text-[11px] mt-1" style={{ color: FOREST_BODY }}>
            <SafeText fallback="Notes from your walkthrough are available from your coordinator.">
              {quote.walkthrough_notes}
            </SafeText>
          </p>
        )}
      </div>
  );

  if (embedded) {
    return body;
  }

  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${FOREST}18` }}>
      <p className="text-[12px] font-bold mb-2" style={{ color: FOREST }}>
        Your Move Details
      </p>
      {body}
    </div>
  );
}

function InventoryCollapsible({
  quote,
  selectedAddons,
  omitOuterChrome = false,
}: {
  quote: Quote;
  selectedAddons?: Map<string, AddonSelection>;
  /** Parent supplies section border + “Your inventory” label */
  omitOuterChrome?: boolean;
}) {
  if (!INV_SERVICE_TYPES.has(quote.service_type)) return null;

  // Walkthrough-based quote: show walkthrough details instead
  if (quote.walkthrough_based) {
    return <WalkthroughDetails quote={quote} embedded={omitOuterChrome} />;
  }

  const rawItems = (quote.inventory_items ?? []) as {
    name?: string; slug?: string; quantity?: number; room?: string; weight_score?: number;
  }[];
  const boxCount = quote.client_box_count ?? 0;
  const itemCount = rawItems.reduce((s, i) => s + (i.quantity ?? 1), 0);
  if (itemCount === 0 && boxCount === 0) {
    const emptyCopy = (
      <p className="text-[12px] leading-relaxed" style={{ color: FOREST_BODY }}>
        No room-by-room inventory is listed on this quote yet. Your coordinator can add or update items
        anytime.
      </p>
    );
    if (omitOuterChrome) {
      return emptyCopy;
    }
    return (
      <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${FOREST}18` }}>
        <p className="text-[13px] font-semibold tracking-tight mb-2" style={{ color: FOREST }}>
          Your inventory
        </p>
        {emptyCopy}
      </div>
    );
  }

  // Group items by room
  const roomMap: Record<string, InvItem[]> = {};
  for (const item of rawItems) {
    const room = item.room || "other";
    const name = (item.name || item.slug || "Item").trim();
    const isSpecialty = room === "specialty" || (item.weight_score ?? 0) >= 10;
    if (!roomMap[room]) roomMap[room] = [];
    roomMap[room]!.push({ name, quantity: item.quantity ?? 1, isSpecialty });
  }

  // Sort rooms by ROOM_ORDER
  const rooms: InvRoom[] = Object.keys(roomMap)
    .sort((a, b) => {
      const ai = ROOM_ORDER.indexOf(a);
      const bi = ROOM_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b);
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    })
    .map((room) => ({ room, label: getRoomLabel(room), items: roomMap[room]! }));

  const isLargeMove = itemCount >= 50 || rooms.length >= 5;

  const labelParts: string[] = [];
  if (itemCount > 0) labelParts.push(`${itemCount} item${itemCount === 1 ? "" : "s"}`);
  if (boxCount > 0) labelParts.push(`${boxCount} box${boxCount === 1 ? "" : "es"}`);

  const listBody = (
    <>
      {!omitOuterChrome && (
        <p className="text-[13px] font-semibold tracking-tight mb-2" style={{ color: FOREST }}>
          Your inventory
        </p>
      )}
      {isLargeMove && (
        <p className="text-[11px] mb-2" style={{ color: FOREST_BODY }}>
          {labelParts.join(" + ")}
        </p>
      )}

      {/* Boxes row */}
      {boxCount > 0 && (
        <div className="mb-1" style={{ borderBottom: `1px solid ${FOREST}10` }}>
          <div className="flex items-center justify-between py-1.5">
            <span className="text-[12px] font-bold" style={{ color: FOREST }}>
              Containers / Boxes / Bins
            </span>
            <span className="text-[11px] font-semibold" style={{ color: FOREST_MUTED }}>Qty</span>
          </div>
          <div className="flex items-center justify-between py-0.5 pl-2 pb-1.5">
            <span className="text-[12px]" style={{ color: FOREST_BODY }}>
              {(() => {
                const packingSelected = selectedAddons
                  ? [...selectedAddons.values()].some((s) => s.slug === "packing_materials")
                  : false;
                return packingSelected
                  ? "Boxes packed & supplied by Yugo"
                  : "Boxes packed & supplied by owner";
              })()}
            </span>
            <span className="text-[12px] font-semibold ml-4" style={{ color: FOREST }}>
              {boxCount}
            </span>
          </div>
        </div>
      )}

      {/* Room sections */}
      <div>
        {rooms.map((room, i) => (
          <RoomSection
            key={room.room}
            room={room}
            defaultOpen={!isLargeMove || i < 2}
          />
        ))}
      </div>

      {/* Total */}
      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold" style={{ color: FOREST_BODY }}>
          Total: {labelParts.join(" + ")}
        </span>
      </div>

      <p className="text-[11px] mt-2 leading-relaxed" style={{ color: FOREST_BODY }}>
        Not right? Contact your coordinator to update.
      </p>
    </>
  );

  if (omitOuterChrome) {
    return listBody;
  }

  return (
    <div className="mt-2 pt-2" style={{ borderTop: `1px dashed ${FOREST}18` }}>
      {listBody}
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Confirm Details Section (Step 4)
   ═══════════════════════════════════════════════════ */

function ConfirmDetailsSection({
  quote,
  selectedTier,
  packageLabel,
  contractAddonsList,
  addonTotal,
  valuationUpgradeSelected,
  includedValuation,
  selectedAddons,
  pickupRows,
  dropoffRows,
}: {
  quote: Quote;
  selectedTier: string;
  packageLabel: string;
  contractAddonsList: ContractAddon[];
  addonTotal: number;
  valuationUpgradeSelected: boolean;
  includedValuation: string;
  selectedAddons: Map<string, AddonSelection>;
  pickupRows: { address: string; access: string | null }[];
  dropoffRows: { address: string; access: string | null }[];
}) {
  const protectionKey = valuationUpgradeSelected
    ? selectedTier === "essential"
      ? "enhanced"
      : selectedTier === "signature"
        ? "full_replacement"
        : includedValuation
    : includedValuation;
  const protectionLabel =
    VALUATION_TIER_LABELS[protectionKey] ?? getDisplayLabel(includedValuation, "valuation");
  const truckLine = quote.truck_primary
    ? (TRUCK_LUXURY[quote.truck_primary] ?? quote.truck_primary)
    : "Moving truck";
  const faConfirm = quote.factors_applied as Record<string, unknown> | null;
  const truckPricingLine: string | null = null;
  const moveSummarySegments: { key: string; node: React.ReactNode }[] = [
    {
      key: "plan",
      node: (
        <span>
          <strong>Plan:</strong> {packageLabel}
        </span>
      ),
    },
    {
      key: "crew",
      node: (
        <span>
          <strong>Crew:</strong> {quote.est_crew_size ?? 3} professional movers
        </span>
      ),
    },
    {
      key: "truck",
      node: (
        <span>
          <strong>Truck:</strong> {truckLine}
        </span>
      ),
    },
  ];
  if (truckPricingLine) {
    moveSummarySegments.push({
      key: "pricing",
      node: (
        <span className="text-[12px]" style={{ color: FOREST_BODY }}>
          <strong>Pricing:</strong> {truckPricingLine}
        </span>
      ),
    });
  }
  moveSummarySegments.push({
    key: "protection",
    node: (
      <span>
        <strong>Protection:</strong> {protectionLabel}
      </span>
    ),
  });
  return (
    <div className="mb-6">
      <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-6 text-center`} style={{ color: WINE }}>
        Confirm Your Move
      </h2>
      <div className="space-y-6">
        <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST_MUTED }}>
          Move details
        </p>
        <div className="space-y-1 text-[13px]" style={{ color: FOREST }}>
            <div className="flex flex-wrap items-center justify-center gap-y-1 text-center">
              <span>
                <strong>Date:</strong> {fmtDate(quote.move_date)}
              </span>
              <span
                aria-hidden
                className="hidden sm:block w-px h-3.5 shrink-0 mx-3 sm:mx-4 self-center rounded-full"
                style={{ backgroundColor: `${FOREST}22` }}
              />
              <span>
                <strong>Arrival time window:</strong>{" "}
                {quoteArrivalTimeWindowLabel(quote) ?? "To be confirmed with you"}
              </span>
            </div>
            <div className="space-y-1.5">
              <p className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: FOREST_BODY }}>
                Pickup locations
              </p>
              <ul className="space-y-1 pl-0 list-none">
                {pickupRows.map((row, i) => (
                  <li key={i}>
                    <span>
                      {formatAddressForDisplay(row.address)}
                      {accessLabel(row.access) ? (
                        <span className="block text-[11px] mt-0.5" style={{ color: FOREST_BODY }}>
                          Access: {accessLabel(row.access)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
              {pickupRows.length > 1 && (
                <p className="text-[11px]" style={{ color: FOREST_BODY }}>
                  {pickupRows.length} pickup locations — crew will visit each stop.
                </p>
              )}
            </div>
            <div className="space-y-1.5 pt-1">
              <p className="font-semibold text-[11px] uppercase tracking-wide" style={{ color: FOREST_BODY }}>
                Destination
              </p>
              <ul className="space-y-1 pl-0 list-none">
                {dropoffRows.map((row, i) => (
                  <li key={i}>
                    <span>
                      {formatAddressForDisplay(row.address)}
                      {accessLabel(row.access) ? (
                        <span className="block text-[11px] mt-0.5" style={{ color: FOREST_BODY }}>
                          Access: {accessLabel(row.access)}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {selectedTier === "estate" &&
              (() => {
                const plan = faConfirm?.estate_day_plan as { days?: number } | undefined;
                const lines = faConfirm?.estate_schedule_lines as string[] | undefined;
                const head = faConfirm?.estate_schedule_headline as string | undefined;
                if (!plan || (plan.days ?? 0) <= 1 || !lines?.length || !head?.trim()) return null;
                return (
                  <div className="my-4 pt-4 border-t-2 text-center max-w-xl mx-auto" style={{ borderColor: FOREST }}>
                    <Calendar
                      className="w-4 h-4 shrink-0 mx-auto mb-2"
                      style={{ color: FOREST_MUTED }}
                      weight="duotone"
                      aria-hidden
                    />
                    <div className="min-w-0 space-y-2.5">
                      <p className={`${QUOTE_EYEBROW_CLASS}`} style={{ color: FOREST_MUTED }}>
                        Schedule overview
                      </p>
                      <p className="text-[13px] font-semibold leading-snug tracking-tight" style={{ color: FOREST }}>
                        {head.trim()}
                      </p>
                      <div className="space-y-2.5 text-left max-w-md mx-auto">
                        {lines.map((ln, i) => (
                          <p
                            key={i}
                            className="text-[12px] leading-relaxed pl-3 border-l-2"
                            style={{
                              borderColor: `${FOREST}45`,
                              color: FOREST,
                            }}
                          >
                            {ln}
                          </p>
                        ))}
                      </div>
                      <p className="text-[12px] leading-snug pt-0.5" style={{ color: FOREST_BODY }}>
                        Pack day is usually the day before your move unless your coordinator sets a different plan.
                      </p>
                    </div>
                  </div>
                );
              })()}
        </div>

        <hr
          className="border-0 h-px w-full my-5 max-w-md mx-auto"
          style={{ backgroundColor: `${FOREST}18` }}
          aria-hidden
        />

        <div
          className="flex flex-wrap items-center justify-center gap-y-2 text-[13px] text-center"
          style={{ color: FOREST }}
        >
          {moveSummarySegments.map((seg, i) => (
            <Fragment key={seg.key}>
              {i > 0 ? (
                <span
                  aria-hidden
                  className="hidden sm:block w-px h-3.5 shrink-0 mx-3 sm:mx-4 self-center rounded-full"
                  style={{ backgroundColor: `${FOREST}22` }}
                />
              ) : null}
              {seg.node}
            </Fragment>
          ))}
        </div>

        {INV_SERVICE_TYPES.has(quote.service_type) && (
          <div className="border-t pt-5 mt-6" style={{ borderColor: `${FOREST}12` }}>
            <p className={`${QUOTE_EYEBROW_CLASS} mb-3`} style={{ color: FOREST_MUTED }}>
              Your inventory
            </p>
            <InventoryCollapsible quote={quote} selectedAddons={selectedAddons} omitOuterChrome />
          </div>
        )}

        {contractAddonsList.length > 0 && (
          <div className="border-t pt-4" style={{ borderColor: `${FOREST}10` }}>
            <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST_MUTED }}>
              Add-ons
            </p>
            <ul className="space-y-1 text-[13px]" style={{ color: FOREST }}>
              {contractAddonsList.map((a, i) => (
                <li key={i}>
                  {a.name}: {fmtPrice(a.price * (a.quantity ?? 1))}
                </li>
              ))}
            </ul>
            <p className="text-[12px] font-semibold mt-2" style={{ color: FOREST }}>
              Add-ons subtotal: {fmtPrice(addonTotal)}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Valuation Protection Card
   ═══════════════════════════════════════════════════ */

const VALUATION_DISPLAY: Record<string, { label: string; shortLabel: string }> = {
  released: { label: "Released Value Protection", shortLabel: "Released Value" },
  enhanced: { label: "Enhanced Value Protection", shortLabel: "Enhanced Value" },
  full_replacement: { label: "Full Replacement Value Protection", shortLabel: "Full Replacement" },
};

const UPGRADE_TARGET: Record<string, string | null> = {
  essential: "enhanced",
  signature: "full_replacement",
  estate: null,
};

function ValuationProtectionCard({
  includedValuation,
  currentPackage,
  valuationTiers,
  valuationUpgrades,
  upgradeSelected,
  onToggleUpgrade,
  declarations,
  onAddDeclaration,
  onRemoveDeclaration,
  journeyCopy = "move",
}: {
  includedValuation: string;
  currentPackage: string;
  valuationTiers: ValuationTier[];
  valuationUpgrades: ValuationUpgrade[];
  upgradeSelected: boolean;
  onToggleUpgrade: () => void;
  declarations: HighValueDeclaration[];
  onAddDeclaration: (d: HighValueDeclaration) => void;
  onRemoveDeclaration: (idx: number) => void;
  /** Delivery / logistics quotes use shipment wording instead of "move". */
  journeyCopy?: "move" | "delivery";
}) {
  const [coversOpen, setCoversOpen] = useState(false);
  const [excludesOpen, setExcludesOpen] = useState(false);
  const [declFormOpen, setDeclFormOpen] = useState(false);
  const [declName, setDeclName] = useState("");
  const [declValue, setDeclValue] = useState("");

  const activeTierSlug = upgradeSelected ? (UPGRADE_TARGET[currentPackage] ?? includedValuation) : includedValuation;
  const tierData = valuationTiers.find((t) => t.tier_slug === activeTierSlug);
  const upgradeTarget = UPGRADE_TARGET[currentPackage];
  const upgradeData = upgradeTarget ? valuationUpgrades.find((u) => u.from_package === currentPackage && u.to_tier === upgradeTarget) : null;
  const upgradeTierData = upgradeTarget ? valuationTiers.find((t) => t.tier_slug === upgradeTarget) : null;
  const isHighest = currentPackage === "estate" || (upgradeSelected && activeTierSlug === "full_replacement");

  const declThreshold = tierData?.max_per_item ?? 2500;

  const calcFee = (val: number) => Math.max(val * 0.02, 50);

  const handleAddDeclaration = () => {
    const val = parseFloat(declValue);
    if (!declName.trim() || isNaN(val) || val <= 0) return;
    onAddDeclaration({
      item_name: declName.trim(),
      declared_value: val,
      fee: calcFee(val),
    });
    setDeclName("");
    setDeclValue("");
    setDeclFormOpen(false);
  };

  if (!tierData) return null;

  const dispActive = VALUATION_DISPLAY[activeTierSlug] ?? { label: activeTierSlug, shortLabel: activeTierSlug };
  const dispUpgrade = upgradeTarget ? (VALUATION_DISPLAY[upgradeTarget] ?? null) : null;

  const hasRatePerPound = tierData.rate_per_pound != null;
  /** Released valuation is always $0.60/lb (must match `damage_process` / legal copy). */
  const RELEASED_RATE_PER_LB = 0.6;
  const displayRatePerPound =
    activeTierSlug === "released"
      ? RELEASED_RATE_PER_LB
      : Number(tierData.rate_per_pound ?? 0);

  return (
    <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">

      <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-6 text-center`} style={{ color: WINE }}>
        Your Protection
      </h2>

      {/* Active protection — open layout, label / value rows */}
      <div>
        <div className="flex items-start justify-between gap-4 pb-5">
          <div className="flex-1 min-w-0">
            <div className="text-[15px] md:text-[var(--text-base)] font-semibold tracking-tight" style={{ color: FOREST }}>{dispActive.shortLabel}</div>
            <div className="text-[11px] mt-1" style={{ color: FOREST_MUTED }}>
              {upgradeSelected
                ? "Upgraded"
                : journeyCopy === "delivery"
                  ? "Included with your delivery"
                  : "Included with your move"}
            </div>
          </div>
          {isHighest && (
            <span className={`shrink-0 ${QUOTE_EYEBROW_CLASS}`} style={{ color: FOREST }}>
              Highest
            </span>
          )}
        </div>

        <hr className="border-0 h-px w-full" style={{ backgroundColor: `${FOREST}10` }} />

        <div className="py-5 space-y-2.5">
          {hasRatePerPound ? (
            <>
              <div className="flex justify-between items-baseline gap-6 text-[13px]">
                <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Coverage rate</span>
                <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>
                  {fmtPricePerLb(displayRatePerPound)}<span className="text-[11px] font-semibold" style={{ color: FOREST_MUTED }}>/lb</span>
                </span>
              </div>
              {tierData.deductible === 0 && (
                <div className="flex justify-between items-baseline gap-6 text-[13px]">
                  <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Deductible</span>
                  <span className="font-bold tabular-nums" style={{ color: FOREST }}>$0</span>
                </div>
              )}
              {tierData.max_per_item != null && (
                <div className="flex justify-between items-baseline gap-6 text-[13px]">
                  <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Per item</span>
                  <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item)}</span>
                </div>
              )}
              {tierData.max_per_shipment != null && (
                <div className="flex justify-between items-baseline gap-6 text-[13px]">
                  <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Per shipment</span>
                  <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment)}</span>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="flex justify-between items-baseline gap-6 text-[13px]">
                <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Per item</span>
                <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item ?? 10000)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-6 text-[13px]">
                <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Per shipment</span>
                <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment ?? 100000)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-6 text-[13px]">
                <span className={`${QUOTE_EYEBROW_CLASS} shrink-0`} style={{ color: FOREST_MUTED }}>Deductible</span>
                <span className="font-bold tabular-nums text-right" style={{ color: FOREST }}>$0</span>
              </div>
            </>
          )}
        </div>

        <p className="text-[12px] leading-relaxed pb-5" style={{ color: FOREST_BODY }}>
          {tierData.damage_process}
        </p>

        <hr className="border-0 h-px w-full" style={{ backgroundColor: `${FOREST}10` }} />

        <div className="pt-1 space-y-0.5">
          <button
            type="button"
            onClick={() => setCoversOpen((p) => !p)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-[12px] font-semibold" style={{ color: FOREST }}>What&apos;s covered</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${coversOpen ? "rotate-180" : ""}`} style={{ color: FOREST }} />
          </button>
          {coversOpen && (
            <ul className="pb-3 space-y-2">
              {tierData.covers.map((c, i) => (
                <li key={i} className="text-[12px] leading-relaxed" style={{ color: FOREST_BODY }}>
                  {c}
                </li>
              ))}
            </ul>
          )}

          <hr className="border-0 h-px w-full" style={{ backgroundColor: `${FOREST}08` }} />

          <button
            type="button"
            onClick={() => setExcludesOpen((p) => !p)}
            className="flex items-center justify-between w-full py-3 text-left"
          >
            <span className="text-[12px] font-semibold" style={{ color: FOREST }}>Exclusions</span>
            <ChevronDown className={`w-4 h-4 shrink-0 transition-transform duration-200 ${excludesOpen ? "rotate-180" : ""}`} style={{ color: FOREST }} />
          </button>
          {excludesOpen && (
            <ul className="pb-1 space-y-2">
              {tierData.excludes.map((e, i) => (
                <li key={i} className="text-[12px] leading-relaxed" style={{ color: FOREST_MUTED }}>
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {!isHighest && upgradeData && upgradeTierData && dispUpgrade && (
        <div className="mt-10 pt-6 border-t border-[var(--brd)]/25">
          <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST }}>
            {upgradeSelected ? "Upgrade added" : "Upgrade available"}
          </p>
          <div className="text-[15px] font-semibold tracking-tight mb-1" style={{ color: FOREST }}>{dispUpgrade.label}</div>
          <p className="text-[12px] leading-snug mb-2" style={{ color: FOREST_BODY }}>
            {upgradeTierData.rate_description}
          </p>
          {upgradeData.assumed_shipment_value > 0 && (
            <p className="text-[11px]" style={{ color: FOREST_MUTED }}>
              Covers up to {fmtPrice(upgradeData.assumed_shipment_value)} total shipment value
            </p>
          )}

          <hr className="border-0 h-px w-full my-5" style={{ backgroundColor: `${FOREST}10` }} />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[20px] font-bold tabular-nums tracking-tight" style={{ color: FOREST }}>
              {fmtPrice(upgradeData.price)}
            </div>
            <button
              type="button"
              onClick={onToggleUpgrade}
              className="w-full sm:w-auto px-6 py-3 rounded-none text-[11px] font-bold uppercase tracking-[0.14em] transition-opacity hover:opacity-90"
              style={{
                backgroundColor: upgradeSelected ? "transparent" : FOREST,
                color: upgradeSelected ? FOREST : "white",
                border: upgradeSelected ? `1px solid ${FOREST}35` : "1px solid transparent",
              }}
            >
              {upgradeSelected
                ? "Remove upgrade"
                : journeyCopy === "delivery"
                  ? "Add to delivery"
                  : "Add to move"}
            </button>
          </div>
        </div>
      )}

      <div className="mt-10 pt-6 border-t border-[var(--brd)]/25">
        <div className="text-[12px] font-semibold tracking-tight mb-1" style={{ color: FOREST }}>High-value items</div>
        <p className="text-[11px] mb-4 leading-relaxed" style={{ color: FOREST_MUTED }}>
          Items valued over {fmtPrice(declThreshold)} can be individually declared for additional coverage.
        </p>

        {declarations.length > 0 && (
          <div className="mb-4">
            {declarations.map((d, i) => (
              <div
                key={i}
                className="flex items-center justify-between gap-3 py-3 border-b last:border-b-0"
                style={{ borderColor: `${FOREST}10` }}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="text-[12px] font-semibold truncate" style={{ color: FOREST }}>{d.item_name}</div>
                  <div className="text-[11px] shrink-0 tabular-nums" style={{ color: FOREST_MUTED }}>{fmtPrice(d.declared_value)}</div>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: FOREST }}>{fmtPrice(d.fee)}</span>
                  <button type="button" onClick={() => onRemoveDeclaration(i)} className="p-1.5 rounded-none hover:bg-black/[0.04] transition-colors" aria-label={`Remove ${d.item_name}`}>
                    <X className="w-3.5 h-3.5" style={{ color: FOREST_MUTED }} />
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between items-baseline pt-3 text-[11px] font-semibold" style={{ color: FOREST }}>
              <span className={`${QUOTE_EYEBROW_CLASS} tracking-[0.1em]`} style={{ color: FOREST_MUTED }}>Declaration fees</span>
              <span className="tabular-nums">{fmtPrice(declarations.reduce((s, d) => s + d.fee, 0))}</span>
            </div>
          </div>
        )}

        {!declFormOpen ? (
          <button
            type="button"
            onClick={() => setDeclFormOpen(true)}
            className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] transition-opacity hover:opacity-70"
            style={{ color: FOREST }}
          >
            <Plus className="w-3.5 h-3.5 shrink-0" weight="bold" aria-hidden />
            Declare an item
          </button>
        ) : (
          <div className="space-y-4 pt-1">
            <div>
              <label className={`block ${QUOTE_EYEBROW_CLASS} mb-1.5`} style={{ color: FOREST_MUTED }}>Item name</label>
              <input
                value={declName}
                onChange={(e) => setDeclName(e.target.value)}
                placeholder="e.g. Steinway Piano"
                className="w-full px-3 py-2.5 rounded-none border text-[13px] outline-none transition-colors"
                style={{ borderColor: `${FOREST}18`, color: FOREST }}
                onFocus={(e) => (e.target.style.borderColor = FOREST)}
                onBlur={(e) => (e.target.style.borderColor = `${FOREST}18`)}
              />
            </div>
            <div>
              <label className={`block ${QUOTE_EYEBROW_CLASS} mb-1.5`} style={{ color: FOREST_MUTED }}>Estimated value (CAD)</label>
              <input
                value={declValue}
                onChange={(e) => setDeclValue(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="15,000"
                className="w-full px-3 py-2.5 rounded-none border text-[13px] outline-none transition-colors"
                style={{ borderColor: `${FOREST}18`, color: FOREST }}
                onFocus={(e) => (e.target.style.borderColor = FOREST)}
                onBlur={(e) => (e.target.style.borderColor = `${FOREST}18`)}
              />
              {declValue && parseFloat(declValue) > 0 && parseFloat(declValue) < 50000 && (
                <p className="text-[11px] mt-1.5 font-medium" style={{ color: FOREST }}>
                  Coverage fee: {fmtPrice(calcFee(parseFloat(declValue)))}
                </p>
              )}
              {declValue && parseFloat(declValue) >= 50000 && (
                <p className="text-[11px] mt-1.5 font-medium" style={{ color: WINE }}>
                  For items over $50,000, contact Yugo directly for custom coverage.
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2 pt-1">
              <button
                type="button"
                onClick={() => { setDeclFormOpen(false); setDeclName(""); setDeclValue(""); }}
                className="px-5 py-2.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] border transition-colors"
                style={{ borderColor: `${FOREST}25`, color: FOREST_BODY }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddDeclaration}
                disabled={!declName.trim() || !declValue || parseFloat(declValue) <= 0 || parseFloat(declValue) >= 50000}
                className="px-6 py-2.5 rounded-none text-[11px] font-bold uppercase tracking-[0.12em] text-white disabled:opacity-30 transition-opacity"
                style={{ backgroundColor: FOREST }}
              >
                Add
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function FallbackPrice({
  price,
  onConfirm,
  confirmed,
}: {
  price: number;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  return (
    <section className="mb-10 pt-2">
      <div className="text-center mb-6 max-w-sm mx-auto">
        <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST_MUTED }}>
          Your quote
        </p>
        <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-4`} style={{ color: WINE }}>
          {fmtPrice(price)}
        </h2>
        <p className="text-[12px] mb-6" style={{ color: FOREST_BODY }}>
          +{fmtPrice(Math.round(price * TAX_RATE))} HST
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full max-w-md mx-auto py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: FOREST }}
        >
          {confirmed ? "Selected" : "Continue"}
        </button>
      </div>
    </section>
  );
}

function AddOnsSection({
  addons,
  allAddons,
  selectedAddons,
  basePrice,
  addonTotal,
  valuationCost,
  tax,
  grandTotal,
  deposit,
  selectedTierData,
  toggleAddon,
  updateQty,
  updateTierIdx,
  isProgressive,
  onContinue,
  showContinueButton = false,
  moveSize,
}: {
  addons: Addon[];
  allAddons: Addon[];
  selectedAddons: Map<string, AddonSelection>;
  basePrice: number;
  addonTotal: number;
  valuationCost: number;
  tax: number;
  grandTotal: number;
  deposit: number;
  selectedTierData: TierData | null;
  moveSize?: string | null;
  toggleAddon: (addon: Addon) => void;
  updateQty: (id: string, qty: number) => void;
  updateTierIdx: (id: string, idx: number) => void;
  isProgressive?: boolean;
  onContinue?: () => void;
  showContinueButton?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const [expandedContents, setExpandedContents] = useState<Set<string>>(new Set());
  const toggleContents = (id: string) =>
    setExpandedContents((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  const KEY_COUNT = 3;
  const keyAddons = addons.filter((a) => a.is_popular || selectedAddons.has(a.id)).slice(0, KEY_COUNT);
  const hasMore = addons.length > keyAddons.length;
  const visibleAddons = showAll ? addons : (keyAddons.length > 0 ? keyAddons : addons.slice(0, KEY_COUNT));

  return (
    <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div className="text-center mb-6 max-w-xl mx-auto">
        <p className={`${QUOTE_EYEBROW_CLASS} mb-2`} style={{ color: FOREST_MUTED }}>
          Add-ons
        </p>
        <h2 className={`${QUOTE_SECTION_H2_CLASS} mb-2`} style={{ color: WINE }}>
          Customize your move
        </h2>
        <p className="text-[12px] leading-relaxed" style={{ color: FOREST_BODY }}>
          Optional extras—toggle only what you need.
        </p>
      </div>

      <div className="divide-y divide-[#2C3E2D]/10">
        {visibleAddons.map((addon) => {
          const sel = selectedAddons.get(addon.id);
          const isOn = !!sel;

          let priceLabel = "";
          let computedCost = 0;
          switch (addon.price_type) {
            case "flat":
              priceLabel = fmtPrice(addon.price);
              computedCost = addon.price;
              break;
            case "per_unit":
              priceLabel = `${fmtPrice(addon.price)} ${addon.unit_label ?? "each"}`;
              computedCost = addon.price * (sel?.quantity ?? 1);
              break;
            case "tiered":
              priceLabel = "varies";
              computedCost = addon.tiers?.[sel?.tier_index ?? 0]?.price ?? 0;
              break;
            case "percent":
              computedCost = Math.round(basePrice * Math.min(Math.max(addon.percent_value ?? 0, 0), 1));
              priceLabel = `${((addon.percent_value ?? 0) * 100).toFixed(0)}% (${fmtPrice(computedCost)})`;
              break;
          }

          return (
            <div
              key={addon.id}
              className={`py-4 first:pt-0 transition-colors ${isOn ? "bg-[#FFFCF6]/80" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => toggleAddon(addon)}
                  data-no-min-height
                  className="relative w-11 h-6 rounded-full transition-colors shrink-0 mt-0.5 flex-shrink-0"
                  style={{ backgroundColor: isOn ? FOREST : "#D5D0C8" }}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                      isOn ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className="text-[13px] font-semibold"
                      style={{ color: isOn ? WINE : FOREST }}
                    >
                      {addon.name}
                    </span>
                    {addon.is_popular && (
                      <span className={QUOTE_EYEBROW_CLASS} style={{ color: FOREST_MUTED }}>
                        Popular
                      </span>
                    )}
                    {addon.slug === "packing_materials" && (
                      <span className={QUOTE_EYEBROW_CLASS} style={{ color: "#2C7A4B" }}>
                        Free delivery
                      </span>
                    )}
                  </div>
                  {addon.description && (
                    <p
                      className="text-[11px] mt-0.5 leading-snug"
                      style={{ color: FOREST_BODY }}
                    >
                      {addon.description}
                    </p>
                  )}

                  {/* Packing kit contents expand */}
                  {addon.slug === "packing_materials" && moveSize && (
                    <div className="mt-1.5">
                      <button
                        type="button"
                        data-no-min-height
                        onClick={() => toggleContents(addon.id)}
                        className={`${QUOTE_EYEBROW_CLASS} transition-opacity hover:opacity-70 inline-flex items-center gap-1.5`}
                        style={{ color: FOREST }}
                      >
                        {expandedContents.has(addon.id) ? (
                          <>Hide contents <ChevronUp className="w-3 h-3 shrink-0" aria-hidden /></>
                        ) : (
                          <>What&apos;s included <ChevronDown className="w-3 h-3 shrink-0" aria-hidden /></>
                        )}
                      </button>
                      {expandedContents.has(addon.id) && (
                        <p
                          className="mt-2 text-[11px] leading-relaxed px-3 py-2.5 rounded-none border"
                          style={{ color: FOREST_BODY, backgroundColor: "#FAFAF8", borderColor: `${FOREST}15` }}
                        >
                          {PACKING_KIT_CONTENTS[PACKING_KIT_TIER_IDX[moveSize] ?? 0]}
                        </p>
                      )}
                    </div>
                  )}

                  {isOn && addon.price_type === "per_unit" && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => updateQty(addon.id, (sel?.quantity ?? 1) - 1)}
                        className="w-7 h-7 rounded-none border text-[var(--text-base)] font-bold flex items-center justify-center"
                        style={{ borderColor: "#D5D0C8", color: FOREST }}
                      >
                        &minus;
                      </button>
                      <span
                        className="text-[13px] font-semibold w-6 text-center"
                        style={{ color: FOREST }}
                      >
                        {sel?.quantity ?? 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateQty(addon.id, (sel?.quantity ?? 1) + 1)}
                        className="w-7 h-7 rounded-none border text-[var(--text-base)] font-bold flex items-center justify-center"
                        style={{ borderColor: "#D5D0C8", color: FOREST }}
                      >
                        +
                      </button>
                      <span className="text-[11px] ml-1" style={{ color: FOREST_BODY }}>
                        {addon.unit_label ?? "units"}
                      </span>
                    </div>
                  )}

                  {isOn && addon.price_type === "tiered" && addon.tiers && (
                    <div className="mt-2">
                      <select
                        value={sel?.tier_index ?? 0}
                        onChange={(e) => updateTierIdx(addon.id, parseInt(e.target.value))}
                        className="text-[12px] rounded-none border px-3 py-2"
                        style={{
                          borderColor: "#D5D0C8",
                          color: FOREST,
                          backgroundColor: "#FFFFFF",
                        }}
                      >
                        {addon.tiers.map((t, i) => (
                          <option key={i} value={i}>
                            {t.label} - {fmtPrice(t.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: isOn ? WINE : FOREST_MUTED }}
                  >
                    {isOn ? fmtPrice(computedCost) : priceLabel}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMore && (
        <button
          type="button"
          onClick={() => setShowAll((p) => !p)}
          className={`w-full mt-4 py-3 ${QUOTE_EYEBROW_CLASS} transition-opacity rounded-none hover:opacity-70 border-t border-[#2C3E2D]/10`}
          style={{ color: FOREST }}
        >
          {showAll ? "Show less" : `View all ${addons.length} add-ons`}
          <ChevronDown
            size={12}
            className="inline ml-1.5 transition-transform text-current"
            style={{ transform: showAll ? "rotate(180deg)" : "rotate(0deg)" }}
            aria-hidden
          />
        </button>
      )}

      {/* Running total bar */}
      {(addonTotal > 0 || valuationCost > 0) && (selectedTierData || basePrice > 0) && (
        <div className="mt-6 pt-5 border-t border-[var(--brd)]/30">
          <p className={`${QUOTE_EYEBROW_CLASS} mb-3`} style={{ color: FOREST_MUTED }}>
            Summary
          </p>
          <div className="space-y-2 mb-3">
            <div className="flex items-baseline justify-between gap-4 text-[12px]" style={{ color: FOREST }}>
              <span>Base price</span>
              <span className="font-bold tabular-nums">{fmtPrice(basePrice)}</span>
            </div>
            {addonTotal > 0 && (
              <div className="flex items-baseline justify-between gap-4 text-[12px]" style={{ color: FOREST }}>
                <span>Add-ons</span>
                <span className="font-bold tabular-nums" style={{ color: FOREST }}>{fmtPrice(addonTotal)}</span>
              </div>
            )}
            {valuationCost > 0 && (
              <div className="flex items-baseline justify-between gap-4 text-[12px]" style={{ color: FOREST }}>
                <span>Protection upgrade</span>
                <span className="font-bold tabular-nums" style={{ color: WINE }}>{fmtPrice(valuationCost)}</span>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-4 text-[12px]" style={{ color: FOREST_BODY }}>
              <span>HST (13%)</span>
              <span className="tabular-nums">{fmtPrice(tax)}</span>
            </div>
            <hr className="border-0 h-px w-full my-2" style={{ backgroundColor: `${FOREST}10` }} />
            <div className="flex items-baseline justify-between gap-4 text-[13px] font-bold" style={{ color: WINE }}>
              <span>Total</span>
              <span className="tabular-nums text-[15px]">{fmtPrice(grandTotal)}</span>
            </div>
          </div>
          <p className="text-[11px] leading-snug" style={{ color: FOREST_BODY }}>
            <span className="font-semibold" style={{ color: FOREST }}>{fmtPrice(deposit)}</span>
            {" "}deposit to confirm · Balance due on move day
          </p>
        </div>
      )}

      {showContinueButton && onContinue && (
        <div className="mt-6 pb-10 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="w-full max-w-md py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: FOREST }}
          >
            Continue
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="text-[12px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "#4F4B47" }}
          >
            Skip, no add-ons needed
          </button>
        </div>
      )}
    </section>
  );
}


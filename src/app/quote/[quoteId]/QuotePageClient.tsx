"use client";// Design and palette (wine, forest, gold, cream) are the source of truth for all client-facing UI. Do not change.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Check,
  Ruler,
  Shield,
  ShieldCheck,
  Star,
  Clock,
  Lock,
  Zap,
  Truck,
  Users,
  Wrench,
  Radar,
  Camera,
  Hand,
  Trash2,
  Home,
  ChevronDown,
  Plus,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  type Quote,
  type Addon,
  type AddonSelection,
  type TierData,
  type ValuationTier,
  type ValuationUpgrade,
  type HighValueDeclaration,
  TAX_RATE,
  WINE,
  FOREST,
  GOLD,
  CREAM,
  TIER_META,
  HERO_CONFIG,
  SERVICE_LABEL,
  fmtPrice,
  fmtDate,
  expiresLabel,
  expiresValue,
  calculateDeposit,
  calculateTieredDeposit,
} from "./quote-shared";

import YugoLogo from "@/components/YugoLogo";
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

interface Inclusion {
  icon: LucideIcon;
  label: string;
  description: string;
}

const INCLUSIONS_ESSENTIALS: Inclusion[] = [
  { icon: Shield, label: "Premium moving blankets", description: "Quilted blankets for every piece of furniture" },
  { icon: Ruler, label: "Floor & doorway protection", description: "Runners, booties, and corner guards throughout" },
  { icon: Wrench, label: "All equipment included", description: "Dollies, straps, tools — nothing extra to rent" },
  { icon: Radar, label: "Real-time GPS tracking", description: "Follow your move live from any device" },
  { icon: Lock, label: "Guaranteed flat price", description: "The price you see is the price you pay" },
  { icon: ShieldCheck, label: "Zero-damage commitment", description: "Your belongings, protected and insured" },
];

const INCLUSIONS_PREMIER: Inclusion[] = [
  { icon: Wrench, label: "Furniture disassembly & reassembly", description: "We take it apart and put it back together" },
  { icon: Trash2, label: "Debris & packaging removal", description: "We clear away all packing materials and debris post-move" },
];

const INCLUSIONS_ESTATE: Inclusion[] = [
  { icon: Camera, label: "Pre-move inventory walkthrough", description: "Documented inventory before we touch anything" },
  { icon: Hand, label: "Premium gloves handling", description: "Art, antiques, and fragile items individually wrapped" },
  { icon: Users, label: "Dedicated move coordinator", description: "One point of contact from quote to completion" },
  { icon: Home, label: "Post-move property restoration", description: "Removal of all packaging, debris, and unwanted materials from both locations" },
];

export default function QuotePageClient({
  quote,
  addons: allAddons,
  contactEmail,
  slotsRemaining,
  valuationTiers = [],
  valuationUpgrades = [],
}: {
  quote: Quote;
  addons: Addon[];
  contactEmail?: string | null;
  slotsRemaining?: number;
  valuationTiers?: ValuationTier[];
  valuationUpgrades?: ValuationUpgrade[];
}) {
  const isResidential = quote.service_type === "local_move" && !!quote.tiers;
  const tiers = quote.tiers as Record<string, TierData> | null;

  /* ── State ── */
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(quote.status === "accepted");
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(new Map());
  const [signedName, setSignedName] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [booked, setBooked] = useState(quote.status === "accepted");
  const [paymentMoveId, setPaymentMoveId] = useState<string | null>(null);
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
        setReferralMsg(`✓ Applied! $${data.discount || 75} off — referred by ${data.referrer_name}.`);
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
    if (isResidential && selectedTier) return TIER_META[selectedTier]?.label ?? selectedTier;
    return SERVICE_LABEL[quote.service_type] ?? "Standard";
  }, [isResidential, selectedTier, quote.service_type]);

  /* ── Applicable add-ons (exclude those included in tier) ── */
  const applicableAddons = useMemo(() => {
    if (!selectedTier) return allAddons;
    return allAddons.filter((a) => {
      if (!a.excluded_tiers) return true;
      return !a.excluded_tiers.includes(selectedTier);
    });
  }, [allAddons, selectedTier]);

  /* ── Add-on helpers ── */
  const toggleAddon = useCallback(
    (addon: Addon) => {
      setSelectedAddons((prev) => {
        const next = new Map(prev);
        const toggled = next.has(addon.id);
        if (toggled) {
          next.delete(addon.id);
        } else {
          next.set(addon.id, { addon_id: addon.id, slug: addon.slug, quantity: 1, tier_index: 0 });
        }
        trackEvent("addon_toggled", { addon: addon.slug, enabled: !toggled });
        trackEngagement("addon_toggled", { addon: addon.slug, action: toggled ? "off" : "on" });
        return next;
      });
    },
    [trackEvent, trackEngagement],
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
          sum += Math.round(basePrice * (addon.percent_value ?? 0));
          break;
      }
    }
    return sum;
  }, [selectedAddons, allAddons, basePrice]);

  /* ── Valuation costs ── */
  const INCLUDED_VALUATION: Record<string, string> = {
    curated: "released",
    signature: "enhanced",
    estate: "full_replacement",
  };
  const currentPackage = isResidential && selectedTier ? selectedTier : "curated";
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
    if (isResidential && selectedTier) {
      return calculateTieredDeposit(selectedTier, totalBeforeTax);
    }
    return calculateDeposit(quote.service_type, totalBeforeTax);
  }, [isResidential, selectedTier, quote.service_type, totalBeforeTax]);

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
          cost = Math.round(basePrice * (addon.percent_value ?? 0));
          break;
      }
      list.push({ name: addon.name, price: cost, quantity: sel.quantity ?? 1 });
    }
    return list;
  }, [selectedAddons, allAddons, basePrice]);

  const contractData = useMemo(
    (): ContractQuoteData => ({
      quoteId: quote.quote_id,
      serviceType: quote.service_type,
      packageLabel,
      fromAddress: quote.from_address,
      toAddress: quote.to_address,
      fromAccess: quote.from_access,
      toAccess: quote.to_access,
      moveDate: quote.move_date,
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
    }),
    [
      quote.quote_id,
      quote.service_type,
      quote.from_address,
      quote.to_address,
      quote.from_access,
      quote.to_access,
      quote.move_date,
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
    ],
  );

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
        }
        return next;
      });
      trackEvent("tier_selected", { tier: tierKey });
      trackEngagement("tier_clicked", { tier: tierKey });
      if (isResidential) {
        const hasAddons = allAddons.some((a) => !a.excluded_tiers?.includes(tierKey));
        const nextStep = hasAddons ? 2 : 3;
        setCurrentStep(nextStep);
        const targetRef = nextStep === 2 ? addonsRef : protectionRef;
        scrollToSection(targetRef);
      } else {
        scrollToContract();
      }
    },
    [allAddons, isResidential, scrollToContract, scrollToSection, trackEvent, trackEngagement],
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

  /* ── Hero config ── */
  const hero = HERO_CONFIG[quote.service_type] ?? HERO_CONFIG.local_move;
  const dateLabel =
    quote.service_type === "single_item" ||
    quote.service_type === "white_glove" ||
    quote.service_type === "b2b_oneoff"
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
          style={{ backgroundColor: "#FFF8E1", color: "#8B6914", borderBottom: `1px solid ${GOLD}33` }}
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
              "radial-gradient(circle at 20% 50%, #B8962E 0%, transparent 50%), radial-gradient(circle at 80% 50%, #B8962E 0%, transparent 50%)",
          }}
        />
        <div className="relative max-w-3xl mx-auto px-5 py-12 md:py-16 text-center">
          <div className="flex justify-center mb-2">
            <YugoLogo size={36} variant="cream" />
          </div>
          <div className="w-12 h-px mx-auto mb-6" style={{ backgroundColor: GOLD }} />
          <h1 className="font-hero text-[30px] md:text-[36px] text-white leading-snug mb-3">
            {hero.headline}
          </h1>
          <p className="text-[14px] text-white/70 max-w-md mx-auto leading-relaxed">
            {hero.subtitle}
          </p>

          {/* Quote badge */}
          <div className="mt-8 inline-flex items-center gap-4 px-6 py-3 rounded-full border border-white/20 bg-white/10 backdrop-blur-sm">
            <div className="text-left">
              <p className="text-[9px] font-semibold tracking-widest uppercase text-white/50">
                Quote
              </p>
              <p className="text-[14px] font-mono font-bold text-white">{quote.quote_id}</p>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="text-left">
              <p className="text-[9px] font-semibold tracking-widest uppercase text-white/50">
                {dateLabel}
              </p>
              <p className="text-[13px] font-semibold text-white">
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
                <div className="w-px h-8 bg-white/20" />
                <div className="text-left">
                  <p className="text-[9px] font-semibold tracking-widest uppercase text-white/50">
                    Valid
                  </p>
                  <p className="text-[13px] font-semibold text-white">
                    {expiresValue(quote.expires_at)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {isResidential && currentStep >= 2 && !booked && (
        <ProgressBar currentStep={currentStep} onStepClick={handleStepClick} />
      )}

      <div className="max-w-4xl md:max-w-5xl lg:max-w-7xl mx-auto px-5 md:px-6">
        {/* ═══ GUARANTEED PRICE BADGE ═══ */}
        <div
          className={`relative z-10 mb-8 ${isResidential && currentStep >= 2 && !booked ? "mt-3" : "-mt-5"}`}
        >
          <div
            className="rounded-xl px-5 py-3.5 flex items-center gap-3"
            style={{
              backgroundColor: "#FFFDF8",
              border: `1px solid ${GOLD}40`,
            }}
          >
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${GOLD}15` }}
            >
              <Lock className="w-4 h-4" style={{ color: GOLD }} />
            </div>
            <div>
              <p className="text-[12px] font-bold tracking-wider uppercase" style={{ color: GOLD }}>
                Guaranteed Price
              </p>
              <p className="text-[11px] leading-snug" style={{ color: `${FOREST}70` }}>
                The price you see is the price you pay. No hourly surprises. No hidden fees.
              </p>
            </div>
          </div>
        </div>

        {/* ═══ LAYOUT DISPATCH ═══ */}
        {isResidential && tiers ? (
          <section ref={tiersRef} className="scroll-mt-6">
            <ResidentialLayout
              quote={quote}
              tiers={tiers}
              selectedTier={selectedTier}
              onSelectTier={handleSelectTier}
              recommendedTier={(() => {
                const r = (quote.recommended_tier ?? "signature").toString().toLowerCase().trim();
                return ["curated", "signature", "estate"].includes(r) ? r : "signature";
              })()}
              hasSelection={!!selectedTier}
            />
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
          </section>
        ) : quote.service_type === "long_distance" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <LongDistanceLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "office_move" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <OfficeLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "single_item" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <SingleItemLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "white_glove" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <WhiteGloveLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "specialty" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <SpecialtyLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.service_type === "b2b_oneoff" ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
            />
            <B2BOneOffLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
          </>
        ) : quote.custom_price != null ? (
          <>
            <InclusionsShowcase
              ref={comparisonRef}
              selectedTier={selectedTier}
              isResidential={isResidential}
              truckPrimary={quote.truck_primary}
              truckSecondary={quote.truck_secondary}
              crewSize={quote.est_crew_size}
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
          applicableAddons.length > 0 &&
          !booked && (
            <section ref={addonsRef} className="scroll-mt-6">
              {isResidential && currentStep >= 2 && (
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-[12px] font-medium mb-4 transition-opacity hover:opacity-70 flex items-center gap-1"
                  style={{ color: `${FOREST}60` }}
                >
                  ← Back
                </button>
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
        {((isResidential && currentStep >= 3) || (!isResidential && isConfirmed)) && !booked && (
          <section ref={protectionRef} className="scroll-mt-6">
            {isResidential && currentStep >= 3 && (
              <button
                type="button"
                onClick={handleBack}
                className="text-[12px] font-medium mb-4 transition-opacity hover:opacity-70 flex items-center gap-1"
                style={{ color: `${FOREST}60` }}
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
            />
            {isResidential && currentStep === 3 && (
              <div className="mt-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleProtectionComplete}
                  className="w-full md:w-auto px-8 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ backgroundColor: GOLD }}
                >
                  Continue →
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
                style={{ color: `${FOREST}60` }}
              >
                ← Back
              </button>
            )}
            {isResidential && selectedTier && tiers?.[selectedTier] && (
              <ConfirmDetailsSection
                quote={quote}
                selectedTier={selectedTier}
                packageLabel={packageLabel}
                basePrice={basePrice}
                addonTotal={addonTotal}
                contractAddonsList={contractAddonsList}
                valuationCost={valuationCost}
                tax={tax}
                grandTotal={grandTotal}
                deposit={deposit}
                referralDiscountAmt={referralDiscountAmt}
                valuationUpgradeSelected={valuationUpgradeSelected}
                includedValuation={includedValuation}
                onProceedToPayment={handleConfirmComplete}
                isProgressive={isResidential}
                currentStep={currentStep}
              />
            )}
            {/* Referral code — for residential, inside confirm; for non-residential, standalone */}
            {(!isResidential || currentStep >= 4) && (
              <div className="mb-6 rounded-xl p-5 border" style={{ borderColor: `${GOLD}40`, backgroundColor: "#FFFDF8" }}>
                <p className="text-[12px] font-bold uppercase tracking-wide mb-3" style={{ color: FOREST }}>
                  Have a referral code?
                </p>
                <div className="flex gap-2">
                  <input
                    value={referralCode}
                    onChange={(e) => { setReferralCode(e.target.value.toUpperCase()); setReferralMsg(""); }}
                    placeholder="YUGO-NAME-XXXX"
                    disabled={referralVerified}
                    className="flex-1 px-3 py-2 rounded-lg border text-[12px] font-mono focus:outline-none"
                    style={{ borderColor: referralVerified ? "#2D9F5A" : `${GOLD}60`, background: referralVerified ? "#F0FFF4" : "white" }}
                  />
                  {!referralVerified && (
                    <button
                      type="button"
                      onClick={verifyReferral}
                      disabled={!referralCode.trim()}
                      className="px-4 py-2 rounded-lg text-[11px] font-semibold disabled:opacity-50"
                      style={{ background: GOLD, color: "#1A1714" }}
                    >
                      Apply
                    </button>
                  )}
                </div>
                {referralMsg && (
                  <p className={`mt-1.5 text-[11px] font-medium ${referralVerified ? "text-[#2D9F5A]" : "text-red-500"}`}>
                    {referralMsg}
                  </p>
                )}
              </div>
            )}
            {isResidential && currentStep === 4 && (
              <div className="mb-6 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={handleConfirmComplete}
                  className="w-full md:w-auto px-8 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
                  style={{ backgroundColor: GOLD }}
                >
                  Proceed to Payment →
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
                <Star className="w-5 h-5 mx-auto mb-1.5" style={{ color: GOLD }} />
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  360+ Reviews
                </p>
                <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                  5-star rated on Google
                </p>
              </div>
              <div>
                <Shield className="w-5 h-5 mx-auto mb-1.5" style={{ color: GOLD }} />
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  $2M Insurance
                </p>
                <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                  Full cargo coverage
                </p>
              </div>
              <div>
                <Check className="w-5 h-5 mx-auto mb-1.5" style={{ color: GOLD }} />
                <p className="text-[13px] font-bold" style={{ color: FOREST }}>
                  Flat-Rate
                </p>
                <p className="text-[10px]" style={{ color: `${FOREST}60` }}>
                  No hidden fees, guaranteed
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 text-center border-t border-[var(--brd)]/30">
              <p className="text-[11px] font-medium" style={{ color: `${FOREST}60` }}>
                Trusted by leading Toronto businesses &amp; homeowners
              </p>
            </div>
          </div>
        </section>

        {/* ═══ DATE AVAILABILITY ═══ */}
        {slotsRemaining != null && slotsRemaining <= 2 && slotsRemaining > 0 && quote.move_date && !booked && (
          <section className="mb-6 pt-6 border-t border-[var(--brd)]/30">
            <div
              className="px-5 py-3 flex items-center gap-2.5"
              style={{ backgroundColor: "#FFF8E1" }}
            >
              <Zap className="w-4 h-4 shrink-0" style={{ color: GOLD }} />
              <p className="text-[12px] font-medium" style={{ color: "#8B6914" }}>
                High demand &mdash; only {slotsRemaining} slot{slotsRemaining > 1 ? "s" : ""} remaining for{" "}
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
            <h2 className="font-hero text-[26px] md:text-[30px] mb-4" style={{ color: FOREST }}>
              Review &amp; Book
            </h2>
            <div ref={contractRef}>
            <ContractSign
              quoteData={contractData}
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
          <section className="mb-10">
            <div className="bg-white rounded-2xl border border-[#E2DDD5] shadow-sm overflow-hidden">
              <div
                className="px-5 py-4 border-b border-[#E2DDD5]"
                style={{ backgroundColor: `${FOREST}06` }}
              >
                <h2
                  className="font-heading text-[14px] font-bold tracking-wider uppercase"
                  style={{ color: FOREST }}
                >
                  Payment
                </h2>
                <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}70` }}>
                  Complete your booking with a secure deposit payment
                </p>
              </div>
              <div className="p-5 md:p-6">
                <SquarePaymentForm
                  amount={deposit}
                  quoteId={quote.quote_id}
                  clientName={signedName}
                  clientEmail={contactEmail ?? ""}
                  selectedTier={selectedTier}
                  selectedAddons={Array.from(selectedAddons.values())}
                  disabled={false}
                  submitLabel={`Pay ${fmtPrice(deposit)} & Book My Move`}
                  onSuccess={(result) => {
                    setPaymentMoveId(result.move_id);
                    setBooked(true);
                  }}
                  onError={(err) => {
                    console.error("Payment error:", err);
                  }}
                />
              </div>
            </div>
          </section>
        )}

        {/* ═══ SUCCESS STATE ═══ */}
        {booked && (
          <section className="mb-10">
            <div
              className="rounded-2xl border-2 p-8 md:p-10 text-center"
              style={{ borderColor: GOLD, backgroundColor: "#FFFDF8" }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                style={{ backgroundColor: `${GOLD}20` }}
              >
                <Check className="w-7 h-7" style={{ color: GOLD }} />
              </div>
              <h2 className="font-hero text-[30px] mb-2" style={{ color: WINE }}>
                You&apos;re All Set!
              </h2>
              <p
                className="text-[14px] max-w-sm mx-auto leading-relaxed"
                style={{ color: `${FOREST}80` }}
              >
                Your{" "}
                {quote.service_type === "office_move"
                  ? "relocation"
                  : quote.service_type === "b2b_oneoff" ||
                      quote.service_type === "single_item" ||
                      quote.service_type === "white_glove"
                    ? "delivery"
                    : "move"}{" "}
                is booked. We&apos;ll send a confirmation email with all the details. Our team will
                reach out closer to your{" "}
                {quote.service_type === "office_move" ? "relocation" : "move"} date.
              </p>
              <div
                className="mt-6 inline-flex items-center gap-3 px-5 py-2.5 rounded-full"
                style={{ backgroundColor: `${FOREST}08` }}
              >
                <span className="text-[11px] font-semibold" style={{ color: FOREST }}>
                  Quote {quote.quote_id}
                </span>
                <span className="text-[11px]" style={{ color: `${FOREST}50` }}>
                  &middot;
                </span>
                <span className="text-[11px]" style={{ color: FOREST }}>
                  {fmtDate(quote.move_date)}
                </span>
              </div>
              {paymentMoveId && (
                <p className="text-[12px] mt-4" style={{ color: `${FOREST}60` }}>
                  A confirmation email is on its way. You can track your{" "}
                  {quote.service_type === "office_move" ? "relocation" : "move"} status anytime.
                </p>
              )}
            </div>
          </section>
        )}

        <footer className="py-5 text-center border-t border-[var(--brd)]/20">
          <div className="flex justify-center mb-1">
            <YugoLogo size={14} variant="gold" onLightBackground />
          </div>
          <p className="text-[7px]" style={{ color: `${FOREST}40` }}>
            The Art of Moving
          </p>
          <p className="text-[7px] mt-0.5" style={{ color: `${FOREST}30` }}>
            <a href="mailto:info@helloyugo.com" style={{ color: `${FOREST}30` }} className="hover:underline">
              info@helloyugo.com
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
    truckPrimary: string | null;
    truckSecondary: string | null;
    crewSize: number | null;
  }
>(function InclusionsShowcase({ selectedTier, isResidential, truckPrimary, truckSecondary, crewSize }, ref) {
  const tier = selectedTier ?? "curated";

  const truckLine = truckPrimary
    ? truckSecondary
      ? `${TRUCK_LUXURY[truckPrimary] ?? truckPrimary} + support van`
      : TRUCK_LUXURY[truckPrimary] ?? truckPrimary
    : "Your dedicated moving truck";

  const crewLine = crewSize
    ? `${crewSize} licensed, insured, background-checked movers`
    : "Licensed, insured, background-checked movers";

  const dynamicItems: Inclusion[] = [
    { icon: Truck, label: truckLine, description: "Climate-protected, equipped for your move" },
    { icon: Users, label: `Professional crew${crewSize ? ` of ${crewSize}` : ""}`, description: crewLine },
  ];

  const items = [...dynamicItems, ...INCLUSIONS_ESSENTIALS];

  if (isResidential && (tier === "signature" || tier === "estate")) {
    items.push(...INCLUSIONS_PREMIER);
  }
  if (isResidential && tier === "estate") {
    items.push(...INCLUSIONS_ESTATE);
  }

  return (
    <section ref={ref} className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div className="text-center mb-6">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">
          Your Move Includes
        </h2>
        <p className="font-hero text-[15px] italic" style={{ color: `${FOREST}60` }}>
          Every detail, handled.
        </p>
      </div>

      <div className="w-10 h-px mx-auto mb-8" style={{ backgroundColor: GOLD }} />

      <div className="grid md:grid-cols-2 gap-x-5 gap-y-4 max-w-4xl mx-auto">
        {items.map((item, i) => {
          const Icon = item.icon;
          return (
            <div key={i} className="flex items-start gap-3.5 py-3 px-1">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: `${GOLD}10` }}
              >
                <Icon className="w-[18px] h-[18px]" style={{ color: GOLD }} />
              </div>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold leading-snug" style={{ color: FOREST }}>
                  {item.label}
                </p>
                <p className="text-[11px] mt-0.5 leading-snug" style={{ color: `${FOREST}55` }}>
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
});

/* ═══════════════════════════════════════════════════
   Confirm Details Section (Step 4)
   ═══════════════════════════════════════════════════ */

const CONFIRM_VALUATION_LABELS: Record<string, string> = {
  released: "Released Value",
  enhanced: "Enhanced Value",
  full_replacement: "Full Replacement",
};

function ConfirmDetailsSection({
  quote,
  selectedTier,
  packageLabel,
  basePrice,
  addonTotal,
  contractAddonsList,
  valuationCost,
  tax,
  grandTotal,
  deposit,
  referralDiscountAmt,
  valuationUpgradeSelected,
  includedValuation,
}: {
  quote: Quote;
  selectedTier: string;
  packageLabel: string;
  basePrice: number;
  addonTotal: number;
  contractAddonsList: ContractAddon[];
  valuationCost: number;
  tax: number;
  grandTotal: number;
  deposit: number;
  referralDiscountAmt: number;
  valuationUpgradeSelected: boolean;
  includedValuation: string;
  onProceedToPayment: () => void;
  isProgressive: boolean;
  currentStep: number;
}) {
  const protectionLabel =
    CONFIRM_VALUATION_LABELS[valuationUpgradeSelected ? (selectedTier === "curated" ? "enhanced" : selectedTier === "signature" ? "full_replacement" : includedValuation) : includedValuation] ??
    includedValuation;
  const truckLine = quote.truck_primary
    ? (TRUCK_LUXURY[quote.truck_primary] ?? quote.truck_primary)
    : "Moving truck";
  const balanceDue = grandTotal - deposit;

  return (
    <div className="mb-6">
      <h2 className="font-hero text-[26px] md:text-[30px] mb-4" style={{ color: FOREST }}>
        Confirm Your Move
      </h2>
      <div
        className="rounded-2xl border p-5 md:p-6 space-y-5"
        style={{ borderColor: "#E2DDD5", backgroundColor: "white" }}
      >
        <div>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: `${FOREST}50` }}>
            Move Details
          </p>
          <div className="space-y-1 text-[13px]" style={{ color: FOREST }}>
            <p><strong>Date:</strong> {fmtDate(quote.move_date)}</p>
            <p><strong>From:</strong> {quote.from_address}</p>
            <p><strong>To:</strong> {quote.to_address}</p>
          </div>
        </div>

        <div className="border-t pt-4" style={{ borderColor: `${FOREST}10` }}>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: `${FOREST}50` }}>
            Your Package
          </p>
          <div className="space-y-1 text-[13px]" style={{ color: FOREST }}>
            <p><strong>Package:</strong> {packageLabel} ✓</p>
            <p><strong>Crew:</strong> {quote.est_crew_size ?? 3} professional movers</p>
            <p><strong>Truck:</strong> {truckLine}</p>
            <p><strong>Protection:</strong> {protectionLabel}</p>
          </div>
        </div>

        {contractAddonsList.length > 0 && (
          <div className="border-t pt-4" style={{ borderColor: `${FOREST}10` }}>
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: `${FOREST}50` }}>
              Add-ons
            </p>
            <ul className="space-y-1 text-[13px]" style={{ color: FOREST }}>
              {contractAddonsList.map((a, i) => (
                <li key={i}>
                  {a.name}: {fmtPrice(a.price * (a.quantity ?? 1))}
                </li>
              ))}
            </ul>
            <p className="text-[12px] font-semibold mt-2" style={{ color: GOLD }}>
              Add-ons subtotal: {fmtPrice(addonTotal)}
            </p>
          </div>
        )}

        <div className="border-t pt-4" style={{ borderColor: `${FOREST}10` }}>
          <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: `${FOREST}50` }}>
            Pricing
          </p>
          <div className="space-y-1.5 text-[13px]" style={{ color: FOREST }}>
            <div className="flex justify-between">
              <span>{packageLabel} package</span>
              <span>{fmtPrice(basePrice)}</span>
            </div>
            {addonTotal > 0 && (
              <div className="flex justify-between">
                <span>Add-ons</span>
                <span>{fmtPrice(addonTotal)}</span>
              </div>
            )}
            {valuationCost > 0 && (
              <div className="flex justify-between">
                <span>Protection upgrade</span>
                <span>{fmtPrice(valuationCost)}</span>
              </div>
            )}
            {referralDiscountAmt > 0 && (
              <div className="flex justify-between" style={{ color: GOLD }}>
                <span>Referral discount</span>
                <span>-{fmtPrice(referralDiscountAmt)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{fmtPrice(basePrice + addonTotal + valuationCost - referralDiscountAmt)}</span>
            </div>
            <div className="flex justify-between">
              <span>HST (13%)</span>
              <span>{fmtPrice(tax)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t font-bold text-[15px]" style={{ borderColor: `${FOREST}10`, color: WINE }}>
              <span>Total</span>
              <span>{fmtPrice(grandTotal)}</span>
            </div>
            <div className="flex justify-between pt-2" style={{ color: GOLD }}>
              <span className="font-bold">Deposit due today</span>
              <span className="font-bold">{fmtPrice(deposit)}</span>
            </div>
            <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
              Balance due on move day: {fmtPrice(balanceDue)}
            </p>
          </div>
        </div>
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
  curated: "enhanced",
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

  return (
    <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">

      {/* Section header */}
      <h2 className="text-[10px] font-bold tracking-[0.16em] uppercase mb-5" style={{ color: WINE }}>
        Your Protection
      </h2>

      {/* Active protection card */}
      <div className="rounded-2xl border overflow-hidden" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>

        {/* Shield badge header */}
        <div className="px-5 py-4 flex items-center gap-3.5" style={{ borderBottom: `1px solid ${FOREST}08` }}>
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${GOLD}10` }}>
            <Shield className="w-[18px] h-[18px]" style={{ color: GOLD }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[14px] font-semibold" style={{ color: FOREST }}>{dispActive.shortLabel}</div>
            <div className="text-[11px]" style={{ color: `${FOREST}50` }}>
              {upgradeSelected ? "Upgraded" : "Included with your move"}
            </div>
          </div>
          {isHighest && (
            <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ backgroundColor: `${GOLD}10`, color: GOLD }}>
              <Check className="w-3 h-3" /> Highest
            </span>
          )}
        </div>

        {/* Coverage highlights — clean grid */}
        <div className="px-5 py-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {hasRatePerPound ? (
              <>
                <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${FOREST}04` }}>
                  <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Coverage Rate</div>
                  <div className="text-[15px] font-bold" style={{ color: FOREST }}>{fmtPrice(tierData.rate_per_pound ?? 0)}<span className="text-[11px] font-semibold" style={{ color: `${FOREST}50` }}>/lb</span></div>
                </div>
                {tierData.deductible === 0 && (
                  <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${GOLD}06` }}>
                    <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Deductible</div>
                    <div className="text-[15px] font-bold" style={{ color: GOLD }}>$0</div>
                  </div>
                )}
                {tierData.max_per_item && (
                  <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${FOREST}04` }}>
                    <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Per Item</div>
                    <div className="text-[15px] font-bold" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item)}</div>
                  </div>
                )}
                {tierData.max_per_shipment && (
                  <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${FOREST}04` }}>
                    <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Per Shipment</div>
                    <div className="text-[15px] font-bold" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment)}</div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${FOREST}04` }}>
                  <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Per Item</div>
                  <div className="text-[15px] font-bold" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item ?? 10000)}</div>
                </div>
                <div className="rounded-xl px-3.5 py-3" style={{ backgroundColor: `${FOREST}04` }}>
                  <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Per Shipment</div>
                  <div className="text-[15px] font-bold" style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment ?? 100000)}</div>
                </div>
                <div className="rounded-xl px-3.5 py-3 col-span-2" style={{ backgroundColor: `${GOLD}06` }}>
                  <div className="text-[9px] font-bold tracking-[0.1em] uppercase mb-1" style={{ color: `${FOREST}40` }}>Deductible</div>
                  <div className="text-[15px] font-bold" style={{ color: GOLD }}>$0 — Zero deductible</div>
                </div>
              </>
            )}
          </div>

          {/* How it works — one clear sentence */}
          <p className="text-[12px] leading-relaxed" style={{ color: `${FOREST}60` }}>
            {tierData.damage_process}
          </p>
        </div>

        {/* Expandable details */}
        <div className="px-5 pb-4 space-y-0.5">
          <button
            onClick={() => setCoversOpen((p) => !p)}
            className="flex items-center justify-between w-full py-2.5 text-left group"
          >
            <span className="text-[12px] font-semibold" style={{ color: FOREST }}>What&apos;s covered</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${coversOpen ? "rotate-180" : ""}`} style={{ color: `${FOREST}30` }} />
          </button>
          {coversOpen && (
            <ul className="pb-3 space-y-2 pl-1">
              {tierData.covers.map((c, i) => (
                <li key={i} className="text-[12px] flex items-start gap-2.5" style={{ color: `${FOREST}70` }}>
                  <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: GOLD }} />
                  {c}
                </li>
              ))}
            </ul>
          )}

          <div className="h-px" style={{ backgroundColor: `${FOREST}06` }} />

          <button
            onClick={() => setExcludesOpen((p) => !p)}
            className="flex items-center justify-between w-full py-2.5 text-left"
          >
            <span className="text-[12px] font-semibold" style={{ color: FOREST }}>Exclusions</span>
            <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${excludesOpen ? "rotate-180" : ""}`} style={{ color: `${FOREST}30` }} />
          </button>
          {excludesOpen && (
            <ul className="pb-3 space-y-2 pl-1">
              {tierData.excludes.map((e, i) => (
                <li key={i} className="text-[12px] flex items-start gap-2.5" style={{ color: `${FOREST}50` }}>
                  <X className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: `${FOREST}25` }} />
                  {e}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Upgrade card */}
      {!isHighest && upgradeData && upgradeTierData && dispUpgrade && (
        <div
          className="mt-4 rounded-2xl border overflow-hidden transition-colors duration-200"
          style={{
            borderColor: upgradeSelected ? GOLD : `${FOREST}12`,
            backgroundColor: upgradeSelected ? `${GOLD}04` : "white",
          }}
        >
          <div className="px-5 py-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: upgradeSelected ? `${GOLD}15` : `${WINE}08` }}>
                <Shield className="w-[18px] h-[18px]" style={{ color: upgradeSelected ? GOLD : WINE }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[9px] font-bold tracking-[0.14em] uppercase mb-1" style={{ color: GOLD }}>
                  {upgradeSelected ? "Upgrade Added" : "Upgrade Available"}
                </div>
                <div className="text-[14px] font-semibold mb-0.5" style={{ color: FOREST }}>
                  {dispUpgrade.label}
                </div>
                <div className="text-[12px] mb-2" style={{ color: `${FOREST}60` }}>
                  {upgradeTierData.rate_description}
                </div>
                {upgradeData.assumed_shipment_value > 0 && (
                  <div className="text-[11px]" style={{ color: `${FOREST}45` }}>
                    Covers up to {fmtPrice(upgradeData.assumed_shipment_value)} total shipment value
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-4 pt-3 border-t" style={{ borderColor: `${FOREST}08` }}>
              <div className="text-[18px] font-bold" style={{ color: FOREST }}>
                {fmtPrice(upgradeData.price)}
              </div>
              <button
                onClick={onToggleUpgrade}
                className="px-5 py-2.5 rounded-xl text-[12px] font-bold transition-all"
                style={{
                  backgroundColor: upgradeSelected ? "white" : GOLD,
                  color: upgradeSelected ? FOREST : "white",
                  border: upgradeSelected ? `1px solid ${FOREST}20` : "1px solid transparent",
                }}
              >
                {upgradeSelected ? "Remove upgrade" : "Add to my move"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* High-value item declarations */}
      <div className="mt-4 rounded-2xl border overflow-hidden" style={{ borderColor: `${FOREST}10`, backgroundColor: "white" }}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="text-[13px] font-semibold" style={{ color: FOREST }}>High-Value Items</div>
          </div>
          <p className="text-[11px] mb-3" style={{ color: `${FOREST}50` }}>
            Items valued over {fmtPrice(declThreshold)} can be individually declared for additional coverage.
          </p>

          {declarations.length > 0 && (
            <div className="space-y-2 mb-3">
              {declarations.map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl px-3.5 py-2.5" style={{ backgroundColor: `${FOREST}04` }}>
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="text-[12px] font-semibold truncate" style={{ color: FOREST }}>{d.item_name}</div>
                    <div className="text-[11px] shrink-0" style={{ color: `${FOREST}45` }}>{fmtPrice(d.declared_value)}</div>
                  </div>
                  <div className="flex items-center gap-2.5 shrink-0">
                    <span className="text-[11px] font-semibold" style={{ color: GOLD }}>{fmtPrice(d.fee)}</span>
                    <button onClick={() => onRemoveDeclaration(i)} className="p-1 rounded-lg hover:bg-black/5 transition-colors">
                      <X className="w-3.5 h-3.5" style={{ color: `${FOREST}30` }} />
                    </button>
                  </div>
                </div>
              ))}
              <div className="text-right text-[11px] font-semibold pt-1" style={{ color: GOLD }}>
                Total declaration fees: {fmtPrice(declarations.reduce((s, d) => s + d.fee, 0))}
              </div>
            </div>
          )}

          {!declFormOpen ? (
            <button
              onClick={() => setDeclFormOpen(true)}
              className="flex items-center gap-2 text-[12px] font-semibold transition-opacity hover:opacity-70"
              style={{ color: GOLD }}
            >
              <div className="w-6 h-6 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${GOLD}10` }}>
                <Plus className="w-3.5 h-3.5" />
              </div>
              Declare an item
            </button>
          ) : (
            <div className="space-y-3 rounded-xl border p-4" style={{ borderColor: `${FOREST}12` }}>
              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5" style={{ color: `${FOREST}50` }}>Item name</label>
                <input
                  value={declName}
                  onChange={(e) => setDeclName(e.target.value)}
                  placeholder="e.g. Steinway Piano"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13px] outline-none transition-colors"
                  style={{ borderColor: `${FOREST}15`, color: FOREST }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = `${FOREST}15`)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-[0.1em] uppercase mb-1.5" style={{ color: `${FOREST}50` }}>Estimated value (CAD)</label>
                <input
                  value={declValue}
                  onChange={(e) => setDeclValue(e.target.value.replace(/[^0-9.]/g, ""))}
                  placeholder="15,000"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13px] outline-none transition-colors"
                  style={{ borderColor: `${FOREST}15`, color: FOREST }}
                  onFocus={(e) => (e.target.style.borderColor = GOLD)}
                  onBlur={(e) => (e.target.style.borderColor = `${FOREST}15`)}
                />
                {declValue && parseFloat(declValue) > 0 && parseFloat(declValue) < 50000 && (
                  <p className="text-[11px] mt-1.5 font-medium" style={{ color: GOLD }}>
                    Coverage fee: {fmtPrice(calcFee(parseFloat(declValue)))}
                  </p>
                )}
                {declValue && parseFloat(declValue) >= 50000 && (
                  <p className="text-[11px] mt-1.5 font-medium" style={{ color: WINE }}>
                    For items over $50,000, contact Yugo directly for custom coverage.
                  </p>
                )}
              </div>
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => { setDeclFormOpen(false); setDeclName(""); setDeclValue(""); }}
                  className="px-4 py-2 rounded-xl text-[12px] font-medium border transition-colors"
                  style={{ borderColor: `${FOREST}15`, color: `${FOREST}60` }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddDeclaration}
                  disabled={!declName.trim() || !declValue || parseFloat(declValue) <= 0 || parseFloat(declValue) >= 50000}
                  className="px-5 py-2 rounded-xl text-[12px] font-bold text-white disabled:opacity-30 transition-colors"
                  style={{ backgroundColor: GOLD }}
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
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
    <section className="mb-10">
      <div className="text-center mb-8">
        <h2 className="font-hero text-[26px] md:text-[30px] mb-2" style={{ color: WINE }}>
          Your Quote
        </h2>
      </div>
      <div
        className="max-w-sm mx-auto bg-white rounded-2xl border-2 p-6 text-center"
        style={{ borderColor: GOLD }}
      >
        <p className="font-hero text-[36px]" style={{ color: WINE }}>
          {fmtPrice(price)}
        </p>
        <p className="text-[12px] mt-1 mb-4" style={{ color: `${FOREST}70` }}>
          +{fmtPrice(Math.round(price * TAX_RATE))} HST
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="w-full py-3 rounded-xl text-[13px] font-bold text-white transition-all"
          style={{ backgroundColor: GOLD }}
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
  toggleAddon: (addon: Addon) => void;
  updateQty: (id: string, qty: number) => void;
  updateTierIdx: (id: string, idx: number) => void;
  isProgressive?: boolean;
  onContinue?: () => void;
  showContinueButton?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const KEY_COUNT = 3;
  const keyAddons = addons.filter((a) => a.is_popular || selectedAddons.has(a.id)).slice(0, KEY_COUNT);
  const hasMore = addons.length > keyAddons.length;
  const visibleAddons = showAll ? addons : (keyAddons.length > 0 ? keyAddons : addons.slice(0, KEY_COUNT));

  return (
    <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div className="text-center mb-6">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">
          Customize Your Move
        </h2>
        <p className="text-[13px]" style={{ color: `${FOREST}80` }}>
          Add optional extras to make your move even smoother
        </p>
      </div>

      <div className="space-y-3">
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
              priceLabel = "from " + fmtPrice(addon.tiers?.[0]?.price ?? 0);
              computedCost = addon.tiers?.[sel?.tier_index ?? 0]?.price ?? 0;
              break;
            case "percent":
              computedCost = Math.round(basePrice * (addon.percent_value ?? 0));
              priceLabel = `${((addon.percent_value ?? 0) * 100).toFixed(0)}% (${fmtPrice(computedCost)})`;
              break;
          }

          return (
            <div
              key={addon.id}
              className={`p-4 transition-all border-b border-[var(--brd)]/30 last:border-b-0 ${isOn ? "bg-[#FFFDF8]" : ""}`}
            >
              <div className="flex items-start gap-3">
                <button
                  type="button"
                  role="switch"
                  aria-checked={isOn}
                  onClick={() => toggleAddon(addon)}
                  className="relative w-10 h-[22px] rounded-full transition-colors shrink-0 mt-0.5"
                  style={{ backgroundColor: isOn ? GOLD : "#D5D0C8" }}
                >
                  <span
                    className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow transition-transform ${
                      isOn ? "translate-x-[18px]" : ""
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
                      <span
                        className="text-[8px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${GOLD}18`, color: GOLD }}
                      >
                        Popular
                      </span>
                    )}
                  </div>
                  {addon.description && (
                    <p
                      className="text-[11px] mt-0.5 leading-snug"
                      style={{ color: `${FOREST}70` }}
                    >
                      {addon.description}
                    </p>
                  )}

                  {isOn && addon.price_type === "per_unit" && (
                    <div className="flex items-center gap-2 mt-2">
                      <button
                        type="button"
                        onClick={() => updateQty(addon.id, (sel?.quantity ?? 1) - 1)}
                        className="w-7 h-7 rounded-lg border text-[14px] font-bold flex items-center justify-center"
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
                        className="w-7 h-7 rounded-lg border text-[14px] font-bold flex items-center justify-center"
                        style={{ borderColor: "#D5D0C8", color: FOREST }}
                      >
                        +
                      </button>
                      <span className="text-[11px] ml-1" style={{ color: `${FOREST}60` }}>
                        {addon.unit_label ?? "units"}
                      </span>
                    </div>
                  )}

                  {isOn && addon.price_type === "tiered" && addon.tiers && (
                    <div className="mt-2">
                      <select
                        value={sel?.tier_index ?? 0}
                        onChange={(e) => updateTierIdx(addon.id, parseInt(e.target.value))}
                        className="text-[12px] rounded-lg border px-3 py-1.5"
                        style={{
                          borderColor: "#D5D0C8",
                          color: FOREST,
                          backgroundColor: "#FAFAF8",
                        }}
                      >
                        {addon.tiers.map((t, i) => (
                          <option key={i} value={i}>
                            {t.label} &mdash; {fmtPrice(t.price)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="text-right shrink-0">
                  <span
                    className="text-[13px] font-bold"
                    style={{ color: isOn ? WINE : `${FOREST}50` }}
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
          className="w-full mt-3 py-2.5 text-[11px] font-semibold tracking-wider uppercase transition-colors rounded-lg hover:bg-[#FAF8F5]"
          style={{ color: GOLD }}
        >
          {showAll ? "Show less" : `View all ${addons.length} add-ons`}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="inline ml-1.5 transition-transform"
            style={{ transform: showAll ? "rotate(180deg)" : "rotate(0deg)" }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>
      )}

      {/* Running total bar */}
      {(addonTotal > 0 || valuationCost > 0) && (selectedTierData || basePrice > 0) && (
        <div
          className="mt-5 p-4 rounded-xl border"
          style={{ borderColor: GOLD, backgroundColor: "#FFFDF8" }}
        >
          <div className="space-y-1.5 mb-2">
            <div className="flex items-center justify-between text-[12px]" style={{ color: FOREST }}>
              <span>Base price</span>
              <b>{fmtPrice(basePrice)}</b>
            </div>
            {addonTotal > 0 && (
              <div className="flex items-center justify-between text-[12px]" style={{ color: FOREST }}>
                <span>Add-ons</span>
                <b style={{ color: GOLD }}>{fmtPrice(addonTotal)}</b>
              </div>
            )}
            {valuationCost > 0 && (
              <div className="flex items-center justify-between text-[12px]" style={{ color: FOREST }}>
                <span>Protection upgrade</span>
                <b style={{ color: WINE }}>{fmtPrice(valuationCost)}</b>
              </div>
            )}
            <div className="flex items-center justify-between text-[12px]" style={{ color: `${FOREST}70` }}>
              <span>HST (13%)</span>
              <span>{fmtPrice(tax)}</span>
            </div>
            <div className="flex items-center justify-between pt-1.5 border-t" style={{ borderColor: `${FOREST}10` }}>
              <span className="text-[13px] font-bold" style={{ color: FOREST }}>Total</span>
              <span className="text-[15px] font-bold" style={{ color: WINE }}>{fmtPrice(grandTotal)}</span>
            </div>
          </div>
          <p className="text-[11px] text-center pt-1 border-t" style={{ color: GOLD, borderColor: `${GOLD}20` }}>
            {fmtPrice(deposit)} deposit to confirm · Balance due on move day
          </p>
        </div>
      )}

      {showContinueButton && onContinue && (
        <div className="mt-6 flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onContinue}
            className="w-full md:w-auto px-8 py-3 rounded-xl text-[13px] font-bold text-white transition-all"
            style={{ backgroundColor: GOLD }}
          >
            Continue →
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="text-[12px] font-medium transition-opacity hover:opacity-70"
            style={{ color: "#888" }}
          >
            Skip — no add-ons needed
          </button>
        </div>
      )}
    </section>
  );
}


"use client";// Design and palette (wine, forest, gold, cream) are the source of truth for all client-facing UI. Do not change.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Check,
  MapPin,
  Calendar,
  Ruler,
  Shield,
  Star,
  Clock,
  Lock,
  Zap,
  Truck,
  Users,
  Sparkles,
  Wrench,
  Radar,
  Camera,
  Shirt,
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
  MOVE_SIZE_LABELS,
  TIER_META,
  HERO_CONFIG,
  SERVICE_LABEL,
  fmtPrice,
  fmtDate,
  fmtAccess,
  expiresLabel,
  calculateDeposit,
} from "./quote-shared";

import YugoLogo from "@/components/YugoLogo";
import SquarePaymentForm from "@/components/payments/SquarePaymentForm";
import ContractSign, {
  type ContractQuoteData,
  type ContractAddon,
} from "@/components/booking/ContractSign";
import ResidentialLayout from "./layouts/ResidentialLayout";
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
  { icon: Sparkles, label: "Zero-damage commitment", description: "Your belongings, protected and insured" },
];

const INCLUSIONS_PREMIER: Inclusion[] = [
  { icon: Wrench, label: "Furniture disassembly & reassembly", description: "We take it apart and put it back together" },
  { icon: Sparkles, label: "Basic cleaning of origin", description: "We leave your old place move-out ready" },
];

const INCLUSIONS_ESTATE: Inclusion[] = [
  { icon: Camera, label: "Pre-move inventory walkthrough", description: "Documented inventory before we touch anything" },
  { icon: Shirt, label: "White glove item handling", description: "Art, antiques, and fragile items individually wrapped" },
  { icon: Users, label: "Dedicated move coordinator", description: "One point of contact from quote to completion" },
  { icon: Sparkles, label: "Full cleaning of both properties", description: "Professional clean at origin and destination" },
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
  const [selectedAddons, setSelectedAddons] = useState<Map<string, AddonSelection>>(new Map());
  const [signedName, setSignedName] = useState("");
  const [contractSigned, setContractSigned] = useState(false);
  const [booked, setBooked] = useState(quote.status === "accepted");
  const [paymentMoveId, setPaymentMoveId] = useState<string | null>(null);
  const [valuationUpgradeSelected, setValuationUpgradeSelected] = useState(!!quote.valuation_upgraded);
  const [declarations, setDeclarations] = useState<HighValueDeclaration[]>([]);

  const contractRef = useRef<HTMLDivElement>(null);
  const comparisonRef = useRef<HTMLDivElement>(null);
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
    essentials: "released",
    premier: "enhanced",
    estate: "full_replacement",
  };
  const currentPackage = isResidential && selectedTier ? selectedTier : "essentials";
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
  const tax = Math.round(totalBeforeTax * TAX_RATE);
  const grandTotal = totalBeforeTax + tax;
  const deposit = useMemo(
    () => calculateDeposit(quote.service_type, totalBeforeTax),
    [quote.service_type, totalBeforeTax],
  );

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
      scrollToContract();
    },
    [allAddons, scrollToContract, trackEvent, trackEngagement],
  );

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
                    {expiresLabel(quote.expires_at)}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-5 md:px-6">
        {/* ═══ GUARANTEED PRICE BADGE ═══ */}
        <div className="-mt-5 relative z-10 mb-8">
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

        {/* ═══ MOVE DETAILS (Residential only) ═══ */}
        {isResidential && (
          <section className="-mt-6 relative z-10 pt-6 border-t border-[var(--brd)]/30 mb-10">
            <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-4">
              Move Details
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <DetailRow icon={MapPin} label="From" color={WINE}>
                <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                  {quote.from_address}
                </p>
                {fmtAccess(quote.from_access) && (
                  <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}70` }}>
                    {fmtAccess(quote.from_access)}
                  </p>
                )}
              </DetailRow>
              <DetailRow icon={MapPin} label="To" color={FOREST}>
                <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                  {quote.to_address}
                </p>
                {fmtAccess(quote.to_access) && (
                  <p className="text-[11px] mt-0.5" style={{ color: `${FOREST}70` }}>
                    {fmtAccess(quote.to_access)}
                  </p>
                )}
              </DetailRow>
              <DetailRow icon={Calendar} label="Move Date" color={GOLD}>
                <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                  {fmtDate(quote.move_date)}
                </p>
              </DetailRow>
              {quote.move_size && (
                <DetailRow icon={Ruler} label="Move Size" color={GOLD}>
                  <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                    {MOVE_SIZE_LABELS[quote.move_size] ?? quote.move_size}
                  </p>
                </DetailRow>
              )}
              {quote.distance_km != null && (
                <DetailRow icon={Clock} label="Distance" color={FOREST}>
                  <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                    {quote.distance_km} km
                    {quote.drive_time_min ? ` \u00b7 ~${quote.drive_time_min} min drive` : ""}
                  </p>
                </DetailRow>
              )}
            </div>
          </section>
        )}

        {/* Non-residential spacer */}
        {!isResidential && <div className="pt-8" />}

        {/* ═══ LAYOUT DISPATCH ═══ */}
        {isResidential && tiers ? (
          <ResidentialLayout
            quote={quote}
            tiers={tiers}
            selectedTier={selectedTier}
            onSelectTier={handleSelectTier}
          />
        ) : quote.service_type === "long_distance" ? (
          <LongDistanceLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.service_type === "office_move" ? (
          <OfficeLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.service_type === "single_item" ? (
          <SingleItemLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.service_type === "white_glove" ? (
          <WhiteGloveLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.service_type === "specialty" ? (
          <SpecialtyLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.service_type === "b2b_oneoff" ? (
          <B2BOneOffLayout quote={quote} onConfirm={handleConfirm} confirmed={confirmed} />
        ) : quote.custom_price != null ? (
          <FallbackPrice
            price={quote.custom_price}
            onConfirm={handleConfirm}
            confirmed={confirmed}
          />
        ) : null}

        {/* ═══ ADD-ONS ═══ */}
        {isConfirmed && applicableAddons.length > 0 && !booked && (
          <AddOnsSection
            addons={applicableAddons}
            allAddons={allAddons}
            selectedAddons={selectedAddons}
            basePrice={basePrice}
            addonTotal={addonTotal}
            tax={tax}
            grandTotal={grandTotal}
            deposit={deposit}
            selectedTierData={
              isResidential && selectedTier && tiers?.[selectedTier] ? tiers[selectedTier] : null
            }
            toggleAddon={toggleAddon}
            updateQty={updateQty}
            updateTierIdx={updateTierIdx}
          />
        )}

        {/* ═══ PREMIUM INCLUSIONS SHOWCASE ═══ */}
        <InclusionsShowcase
          ref={comparisonRef}
          selectedTier={selectedTier}
          isResidential={isResidential}
          truckPrimary={quote.truck_primary}
          truckSecondary={quote.truck_secondary}
          crewSize={quote.est_crew_size}
        />

        {/* ═══ VALUATION PROTECTION ═══ */}
        {isConfirmed && !booked && (
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

        {/* ═══ CONTRACT / E-SIGN ═══ */}
        {isConfirmed && !booked && (
          <section ref={contractRef} className="mb-10 pt-6 border-t border-[var(--brd)]/30 scroll-mt-6">
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
          </section>
        )}

        {/* ═══ PAYMENT ═══ */}
        {isConfirmed && contractSigned && !booked && (
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
  const tier = selectedTier ?? "essentials";

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

  if (isResidential && (tier === "premier" || tier === "estate")) {
    items.push(...INCLUSIONS_PREMIER);
  }
  if (isResidential && tier === "estate") {
    items.push(...INCLUSIONS_ESTATE);
  }

  const showUpgradeHint = isResidential && tier === "essentials" && !selectedTier;

  return (
    <section ref={ref} className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div className="text-center mb-6">
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1.5">
          Your Move Includes
        </h2>
        <p className="font-serif text-[15px] italic" style={{ color: `${FOREST}60` }}>
          Every detail, handled.
        </p>
      </div>

      <div className="w-10 h-px mx-auto mb-8" style={{ backgroundColor: GOLD }} />

      <div className="grid md:grid-cols-2 gap-x-5 gap-y-4">
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

      {showUpgradeHint && (
        <p className="text-center text-[11px] mt-6" style={{ color: `${FOREST}50` }}>
          Upgrade to <span style={{ color: GOLD }} className="font-semibold">Premier</span> or{" "}
          <span style={{ color: WINE }} className="font-semibold">Estate</span> for even more.
        </p>
      )}
    </section>
  );
});

/* ═══════════════════════════════════════════════════
   Valuation Protection Card
   ═══════════════════════════════════════════════════ */

const VALUATION_DISPLAY: Record<string, { label: string; shortLabel: string }> = {
  released: { label: "Released Value Protection", shortLabel: "Released Value" },
  enhanced: { label: "Enhanced Value Protection", shortLabel: "Enhanced Value" },
  full_replacement: { label: "Full Replacement Value Protection", shortLabel: "Full Replacement" },
};

const UPGRADE_TARGET: Record<string, string | null> = {
  essentials: "enhanced",
  premier: "full_replacement",
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

  return (
    <section className="mb-10 pt-6 border-t border-[var(--brd)]/30">
      <div>
        <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">
          Your Protection
        </h2>
        <p className="text-[11px] mb-4" style={{ color: `${FOREST}55` }}>
          {dispActive.label} &mdash; {upgradeSelected ? "Upgraded" : "Included"}
        </p>

        <div className="space-y-5">
          {/* Description */}
          <p className="text-[12px] leading-relaxed" style={{ color: `${FOREST}85` }}>
            {tierData.damage_process}
          </p>

          {tierData.rate_per_pound != null && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]" style={{ color: `${FOREST}70` }}>
              <span>Rate: <b style={{ color: FOREST }}>{fmtPrice(tierData.rate_per_pound)}/lb</b></span>
              {tierData.max_per_item && <span>Per item: <b style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item)}</b></span>}
              {tierData.max_per_shipment && <span>Per shipment: <b style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment)}</b></span>}
              {tierData.deductible === 0 && <span style={{ color: GOLD }}>Zero deductible</span>}
            </div>
          )}

          {!tierData.rate_per_pound && (
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[11px]" style={{ color: `${FOREST}70` }}>
              <span>Per item: <b style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_item ?? 10000)}</b></span>
              <span>Per shipment: <b style={{ color: FOREST }}>up to {fmtPrice(tierData.max_per_shipment ?? 100000)}</b></span>
              <span style={{ color: GOLD }}>Zero deductible</span>
            </div>
          )}

          {/* Expandable: What's covered */}
          <div>
            <button
              onClick={() => setCoversOpen((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] font-semibold w-full text-left"
              style={{ color: FOREST }}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${coversOpen ? "rotate-180" : ""}`} style={{ color: GOLD }} />
              What&apos;s covered
            </button>
            {coversOpen && (
              <ul className="mt-2 space-y-1.5 pl-5">
                {tierData.covers.map((c, i) => (
                  <li key={i} className="text-[11px] flex items-start gap-2" style={{ color: `${FOREST}75` }}>
                    <Check className="w-3 h-3 mt-0.5 shrink-0" style={{ color: GOLD }} />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Expandable: What's not covered */}
          <div>
            <button
              onClick={() => setExcludesOpen((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] font-semibold w-full text-left"
              style={{ color: FOREST }}
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${excludesOpen ? "rotate-180" : ""}`} style={{ color: GOLD }} />
              What&apos;s not covered
            </button>
            {excludesOpen && (
              <ul className="mt-2 space-y-1.5 pl-5">
                {tierData.excludes.map((e, i) => (
                  <li key={i} className="text-[11px] flex items-start gap-2" style={{ color: `${FOREST}55` }}>
                    <span className="w-3 text-center shrink-0 text-[10px]" style={{ color: `${FOREST}35` }}>&ndash;</span>
                    {e}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Highest level confirmation */}
          {isHighest && (
            <div className="flex items-center gap-2 pt-1">
              <Check className="w-4 h-4" style={{ color: GOLD }} />
              <p className="text-[11px] font-semibold" style={{ color: GOLD }}>
                You have the highest level of protection.
              </p>
            </div>
          )}

          {/* Upgrade card */}
          {!isHighest && upgradeData && upgradeTierData && dispUpgrade && (
            <div
              className="rounded-xl border p-4"
              style={{
                borderColor: upgradeSelected ? GOLD : `${FOREST}15`,
                backgroundColor: upgradeSelected ? `${GOLD}06` : `${FOREST}03`,
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-[9px] font-bold tracking-wider uppercase mb-1" style={{ color: GOLD }}>
                    Upgrade Your Protection
                  </p>
                  <p className="text-[13px] font-semibold" style={{ color: FOREST }}>
                    {dispUpgrade.label} &mdash; {fmtPrice(upgradeData.price)}
                  </p>
                  <p className="text-[11px] mt-1" style={{ color: `${FOREST}60` }}>
                    {upgradeTierData.rate_description}
                  </p>
                  {upgradeData.assumed_shipment_value > 0 && (
                    <p className="text-[10px] mt-0.5" style={{ color: `${FOREST}45` }}>
                      Covers up to {fmtPrice(upgradeData.assumed_shipment_value)} total shipment value
                    </p>
                  )}
                </div>
                <button
                  onClick={onToggleUpgrade}
                  className="shrink-0 px-4 py-2 rounded-lg text-[11px] font-bold transition-colors"
                  style={{
                    backgroundColor: upgradeSelected ? FOREST : GOLD,
                    color: "#FFFFFF",
                  }}
                >
                  {upgradeSelected ? "Remove" : "Add to my move"}
                </button>
              </div>
            </div>
          )}

          {/* High-value item declarations */}
          <div className="pt-2 border-t" style={{ borderColor: `${FOREST}10` }}>
            <p className="text-[11px] font-semibold mb-1" style={{ color: FOREST }}>
              Have a high-value item?
            </p>
            <p className="text-[10px] mb-3" style={{ color: `${FOREST}55` }}>
              Items over {fmtPrice(declThreshold)} need individual coverage.
            </p>

            {declarations.length > 0 && (
              <div className="space-y-2 mb-3">
                {declarations.map((d, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 text-[11px]" style={{ backgroundColor: `${FOREST}05` }}>
                    <div>
                      <span className="font-medium" style={{ color: FOREST }}>{d.item_name}</span>
                      <span className="mx-1.5" style={{ color: `${FOREST}35` }}>&mdash;</span>
                      <span style={{ color: `${FOREST}70` }}>{fmtPrice(d.declared_value)}</span>
                      <span className="mx-1.5" style={{ color: `${FOREST}35` }}>&rarr;</span>
                      <span style={{ color: GOLD }}>Fee: {fmtPrice(d.fee)}</span>
                    </div>
                    <button onClick={() => onRemoveDeclaration(i)} className="p-1 rounded hover:bg-black/5">
                      <X className="w-3 h-3" style={{ color: `${FOREST}40` }} />
                    </button>
                  </div>
                ))}
                <div className="text-right text-[11px] font-semibold" style={{ color: GOLD }}>
                  Declaration fees: {fmtPrice(declarations.reduce((s, d) => s + d.fee, 0))}
                </div>
              </div>
            )}

            {!declFormOpen ? (
              <button
                onClick={() => setDeclFormOpen(true)}
                className="flex items-center gap-1.5 text-[11px] font-semibold"
                style={{ color: GOLD }}
              >
                <Plus className="w-3.5 h-3.5" />
                Declare a high-value item
              </button>
            ) : (
              <div className="space-y-3 rounded-lg border p-3" style={{ borderColor: `${FOREST}15` }}>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: `${FOREST}70` }}>Item name</label>
                  <input
                    value={declName}
                    onChange={(e) => setDeclName(e.target.value)}
                    placeholder="e.g. Steinway Piano"
                    className="w-full px-3 py-2 rounded-lg border text-[12px]"
                    style={{ borderColor: `${FOREST}20`, color: FOREST }}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold mb-1" style={{ color: `${FOREST}70` }}>Estimated value (CAD)</label>
                  <input
                    value={declValue}
                    onChange={(e) => setDeclValue(e.target.value.replace(/[^0-9.]/g, ""))}
                    placeholder="15000"
                    className="w-full px-3 py-2 rounded-lg border text-[12px]"
                    style={{ borderColor: `${FOREST}20`, color: FOREST }}
                  />
                  {declValue && parseFloat(declValue) > 0 && (
                    <p className="text-[10px] mt-1" style={{ color: GOLD }}>
                      Coverage fee: {fmtPrice(calcFee(parseFloat(declValue)))}
                    </p>
                  )}
                  {declValue && parseFloat(declValue) >= 50000 && (
                    <p className="text-[10px] mt-1 font-medium" style={{ color: WINE }}>
                      For items over $50,000, contact Yugo directly for custom coverage arrangements.
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setDeclFormOpen(false); setDeclName(""); setDeclValue(""); }}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-medium border"
                    style={{ borderColor: `${FOREST}20`, color: `${FOREST}60` }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddDeclaration}
                    disabled={!declName.trim() || !declValue || parseFloat(declValue) <= 0 || parseFloat(declValue) >= 50000}
                    className="px-4 py-1.5 rounded-lg text-[11px] font-bold text-white disabled:opacity-40"
                    style={{ backgroundColor: GOLD }}
                  >
                    Add declaration
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function DetailRow({
  icon: Icon,
  label,
  color,
  children,
}: {
  icon: typeof MapPin;
  label: string;
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: `${color}12` }}
      >
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <div>
        <p
          className="text-[10px] font-semibold tracking-wider uppercase"
          style={{ color: `${FOREST}80` }}
        >
          {label}
        </p>
        {children}
      </div>
    </div>
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
  tax,
  grandTotal,
  deposit,
  selectedTierData,
  toggleAddon,
  updateQty,
  updateTierIdx,
}: {
  addons: Addon[];
  allAddons: Addon[];
  selectedAddons: Map<string, AddonSelection>;
  basePrice: number;
  addonTotal: number;
  tax: number;
  grandTotal: number;
  deposit: number;
  selectedTierData: TierData | null;
  toggleAddon: (addon: Addon) => void;
  updateQty: (id: string, qty: number) => void;
  updateTierIdx: (id: string, idx: number) => void;
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
      {addonTotal > 0 && (selectedTierData || basePrice > 0) && (
        <div
          className="mt-5 p-4 rounded-xl border text-center"
          style={{ borderColor: GOLD, backgroundColor: "#FFFDF8" }}
        >
          <div
            className="flex items-center justify-center flex-wrap gap-x-3 gap-y-1 text-[12px]"
            style={{ color: FOREST }}
          >
            <span>
              Base: <b>{fmtPrice(basePrice)}</b>
            </span>
            <span style={{ color: `${FOREST}40` }}>+</span>
            <span>
              Add-ons: <b style={{ color: GOLD }}>{fmtPrice(addonTotal)}</b>
            </span>
            <span style={{ color: `${FOREST}40` }}>+</span>
            <span>
              HST: <b>{fmtPrice(tax)}</b>
            </span>
            <span style={{ color: `${FOREST}40` }}>=</span>
            <span className="text-[14px] font-bold" style={{ color: WINE }}>
              Total: {fmtPrice(grandTotal)}
            </span>
          </div>
          <p className="text-[11px] mt-1" style={{ color: GOLD }}>
            {fmtPrice(deposit)} deposit to book
          </p>
        </div>
      )}
    </section>
  );
}


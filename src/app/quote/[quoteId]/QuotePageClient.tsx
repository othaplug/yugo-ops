"use client";// Design and palette (wine, forest, gold, cream) are the source of truth for all client-facing UI. Do not change.

import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { Check, MapPin, Calendar, Ruler, Shield, Star, Clock } from "lucide-react";
import {
  type Quote,
  type Addon,
  type AddonSelection,
  type TierData,
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

export default function QuotePageClient({
  quote,
  addons: allAddons,
  contactEmail,
}: {
  quote: Quote;
  addons: Addon[];
  contactEmail?: string | null;
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

  const contractRef = useRef<HTMLDivElement>(null);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track abandonment — re-registers so handler always reads latest state
  useEffect(() => {
    const handleBeforeUnload = () => {
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
  }, [booked, selectedTier, selectedAddons.size, contractSigned, trackEvent]);

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
        return next;
      });
    },
    [trackEvent],
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

  /* ── Computed totals ── */
  const totalBeforeTax = basePrice + addonTotal;
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
      scrollToContract();
    },
    [allAddons, scrollToContract, trackEvent],
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

  /* ══════════════════════════════════════════════
     RENDER
     ══════════════════════════════════════════════ */
  return (
    <div className="min-h-screen" style={{ backgroundColor: CREAM }}>
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
          <h1 className="font-hero text-[22px] md:text-[28px] text-white leading-snug mb-3">
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
        {/* ═══ MOVE DETAILS CARD (Residential only) ═══ */}
        {isResidential && (
          <section className="-mt-6 relative z-10 bg-white rounded-2xl border border-[#E2DDD5] shadow-sm p-5 md:p-7 mb-10">
            <h2
              className="font-heading text-[13px] font-bold tracking-wider uppercase mb-4"
              style={{ color: FOREST }}
            >
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

        {/* ═══ TRUST BAR ═══ */}
        <section className="mb-10">
          <div
            className="rounded-2xl p-5 md:p-6"
            style={{ backgroundColor: `${FOREST}08`, border: `1px solid ${FOREST}15` }}
          >
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
          </div>
        </section>

        {/* ═══ CONTRACT / E-SIGN ═══ */}
        {isConfirmed && !booked && (
          <section ref={contractRef} className="mb-10 scroll-mt-6">
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
              <h2 className="font-hero text-[24px] mb-2" style={{ color: WINE }}>
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

        {/* ═══ FOOTER ═══ */}
        <footer className="py-10 text-center border-t" style={{ borderColor: "#E2DDD5" }}>
          <div className="flex justify-center mb-2">
            <YugoLogo size={20} variant="gold" onLightBackground />
          </div>
          <p className="text-[11px]" style={{ color: `${FOREST}60` }}>
            Premium Moving &middot; Toronto &amp; GTA
          </p>
          <p className="text-[10px] mt-1" style={{ color: `${FOREST}40` }}>
            Questions? Email us at{" "}
            <a href="mailto:info@helloyugo.com" style={{ color: GOLD }} className="hover:underline">
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
        <h2 className="font-hero text-[22px] md:text-[26px] mb-2" style={{ color: WINE }}>
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
  return (
    <section className="mb-10">
      <div className="text-center mb-6">
        <h2 className="font-hero text-[20px] md:text-[24px] mb-2" style={{ color: WINE }}>
          Customize Your Move
        </h2>
        <p className="text-[13px]" style={{ color: `${FOREST}80` }}>
          Add optional extras to make your move even smoother
        </p>
      </div>

      <div className="space-y-3">
        {addons.map((addon) => {
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
              className={`rounded-xl border p-4 transition-all ${isOn ? "border-2 shadow-sm" : "bg-white"}`}
              style={{
                borderColor: isOn ? GOLD : "#E2DDD5",
                backgroundColor: isOn ? "#FFFDF8" : "#FFFFFF",
              }}
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


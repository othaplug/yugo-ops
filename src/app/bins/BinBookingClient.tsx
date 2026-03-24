"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import Script from "next/script";
import Link from "next/link";
import {
  Package,
  CheckCircle,
  ArrowRight,
  Leaf,
  Truck,
  CalendarBlank,
  Lock,
  Phone,
  ArrowLeft,
  House,
  Bell,
} from "@phosphor-icons/react";

const HST_RATE = 0.13;
const GTA_POSTALS = ["L4", "L5", "L6", "L3", "L1"];
const GTA_SURCHARGE = 35;
const YUGO_PHONE = "(647) 370-4525";

const BUNDLES = [
  { key: "studio", label: "Studio", bins: 15, price: 109, description: "Perfect for 1 room or bachelor" },
  { key: "1br", label: "1 Bedroom", bins: 30, price: 189, description: "Ideal for a 1-bedroom home" },
  { key: "2br", label: "2 Bedroom", bins: 50, price: 289, description: "Most popular for 2BR homes" },
  { key: "3br", label: "3 Bedroom", bins: 75, price: 429, description: "Great for larger families" },
  { key: "4br_plus", label: "4 Bedroom+", bins: 100, price: 579, description: "For bigger homes" },
  { key: "individual", label: "Custom", bins: null, price: 6, description: "$6/bin, minimum 5 bins" },
] as const;

const ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground", label: "Ground Floor" },
  { value: "walkup", label: "Walk-up" },
  { value: "concierge", label: "Concierge" },
];

const BUNDLE_LABELS: Record<string, string> = {
  studio: "Studio", "1br": "1 Bedroom", "2br": "2 Bedroom",
  "3br": "3 Bedroom", "4br_plus": "4 Bedroom+", individual: "Custom",
};

type SquareCard = {
  attach: (selector: string) => Promise<void>;
  tokenize: () => Promise<{ status: string; token?: string; errors?: { message: string }[] }>;
  destroy: () => void;
};

declare global {
  interface Window {
    Square?: {
      payments: (appId: string, locationId: string) => {
        card: (opts?: object) => Promise<SquareCard>;
      };
    };
  }
}

interface ConfirmationData {
  orderNumber: string;
  dropOffDate: string;
  moveDate: string;
  pickupDate: string;
  total: number;
  bundleType: string;
  binCount: number;
  clientName: string;
}

export default function BinBookingClient({
  squareAppId,
  squareLocationId,
  useSandbox,
}: {
  squareAppId: string;
  squareLocationId: string;
  useSandbox: boolean;
}) {
  const [step, setStep] = useState<"bundle" | "details" | "payment" | "confirmed">("bundle");
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [customBinCount, setCustomBinCount] = useState(10);

  // Details form
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryPostal, setDeliveryPostal] = useState("");
  const [deliveryAccess, setDeliveryAccess] = useState("elevator");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [moveDate, setMoveDate] = useState("");

  // Square
  const [sdkReady, setSdkReady] = useState(false);
  const [cardReady, setCardReady] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const cardRef = useRef<SquareCard | null>(null);
  const initRef = useRef(false);

  // Confirmation
  const [confirmation, setConfirmation] = useState<ConfirmationData | null>(null);

  const bundle = BUNDLES.find((b) => b.key === selectedBundle);
  const binCount = selectedBundle === "individual" ? customBinCount : (bundle?.bins ?? 0);
  const bundlePrice = selectedBundle === "individual"
    ? customBinCount * 6
    : (bundle?.price ?? 0);

  const postal = deliveryPostal.toUpperCase().replace(/\s/g, "");
  const isGTA = GTA_POSTALS.some((p) => postal.startsWith(p));
  const surcharge = isGTA ? GTA_SURCHARGE : 0;
  const subtotal = bundlePrice + surcharge;
  const hst = Math.round(subtotal * HST_RATE * 100) / 100;
  const total = Math.round((subtotal + hst) * 100) / 100;

  const dropOffDate = moveDate
    ? (() => { const d = new Date(moveDate); d.setDate(d.getDate() - 7); return d; })()
    : null;
  const pickupDate = moveDate
    ? (() => { const d = new Date(moveDate); d.setDate(d.getDate() + 5); return d; })()
    : null;

  const fmt = (d: Date | null) =>
    d
      ? d.toLocaleDateString("en-CA", { weekday: "short", month: "short", day: "numeric" })
      : "—";

  const fmtPrice = (n: number) =>
    n.toLocaleString("en-CA", { style: "currency", currency: "CAD" });

  // Square init
  const initSquare = useCallback(async (appId: string, locId: string) => {
    if (initRef.current || !window.Square) return;
    initRef.current = true;
    try {
      const payments = window.Square.payments(appId, locId);
      const card = await payments.card();
      await card.attach("#bin-sq-card");
      cardRef.current = card;
      setCardReady(true);
    } catch (e) {
      console.error("Square init failed:", e);
      setPayError("Unable to load payment form. Please refresh.");
    }
  }, []);

  useEffect(() => {
    if (!sdkReady || step !== "payment" || initRef.current) return;
    const appId = squareAppId;
    const locId = squareLocationId;
    if (appId && locId) {
      initSquare(appId, locId);
      return;
    }
    fetch("/api/payments/config")
      .then((r) => r.json())
      .then((d) => { if (d.appId && d.locationId) initSquare(d.appId, d.locationId); })
      .catch(() => setPayError("Payment not configured. Please contact support."));
  }, [sdkReady, step, squareAppId, squareLocationId, initSquare]);

  useEffect(() => {
    return () => { cardRef.current?.destroy(); };
  }, []);

  const handlePay = async () => {
    if (!cardRef.current || processing) return;
    setProcessing(true);
    setPayError(null);

    try {
      const tokenResult = await cardRef.current.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setPayError(tokenResult.errors?.[0]?.message ?? "Card verification failed.");
        setProcessing(false);
        return;
      }

      const res = await fetch("/api/bin-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceId: tokenResult.token,
          clientName,
          clientEmail,
          clientPhone,
          deliveryAddress,
          deliveryPostal,
          deliveryAccess,
          deliveryNotes,
          bundleType: selectedBundle,
          binCount,
          moveDate,
          includesPaper: true,
          includesZipTies: true,
          source: "standalone",
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setPayError(data.error ?? "Payment failed. Please try again.");
        setProcessing(false);
        return;
      }

      setConfirmation({
        orderNumber: data.orderNumber,
        dropOffDate: data.dropOffDate,
        moveDate: data.moveDate,
        pickupDate: data.pickupDate,
        total: data.total,
        bundleType: selectedBundle!,
        binCount,
        clientName,
      });
      setStep("confirmed");
    } catch (e) {
      setPayError(e instanceof Error ? e.message : "An unexpected error occurred.");
      setProcessing(false);
    }
  };

  const squareSrc = useSandbox
    ? "https://sandbox.web.squarecdn.com/v1/square.js"
    : "https://web.squarecdn.com/v1/square.js";

  const minDate = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 10); // need at least 10 days (7 drop-off + 3 buffer)
    return d.toISOString().split("T")[0];
  })();

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-[#E5E0D8]">
      {step === "payment" && (
        <Script
          src={squareSrc}
          strategy="afterInteractive"
          onLoad={() => setSdkReady(true)}
          onError={() => setPayError("Payment script failed to load.")}
        />
      )}

      {/* Header */}
      <header className="border-b border-[#2a2a2a] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#C9A962]/15 flex items-center justify-center">
              <Package size={18} color="#C9A962" weight="fill" />
            </div>
            <div>
              <span className="font-bold text-[#E5E0D8] text-[15px]">Yugo</span>
              <span className="ml-1.5 text-[11px] text-[#9ca3af] font-medium tracking-wide uppercase">Bin Rentals</span>
            </div>
          </div>
          <a href={`tel:${YUGO_PHONE}`} className="flex items-center gap-1.5 text-[13px] text-[#9ca3af] hover:text-[#C9A962] transition-colors">
            <Phone size={14} />
            {YUGO_PHONE}
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10">
        {/* ── CONFIRMED STEP ── */}
        {step === "confirmed" && confirmation && (
          <div className="space-y-6">
            <div className="text-center space-y-3">
              <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle size={36} color="#22c55e" weight="fill" />
              </div>
              <h1 className="text-2xl font-bold text-[#E5E0D8]">Your bin order is confirmed!</h1>
              <p className="text-[#9ca3af] text-[15px]">Order <span className="text-[#C9A962] font-bold">{confirmation.orderNumber}</span></p>
            </div>

            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-3">
              <h2 className="text-[13px] font-bold tracking-widest uppercase text-[#9ca3af]">Your schedule</h2>
              <div className="grid gap-3">
                <ScheduleRow icon={<Package size={18} color="#C9A962" weight="fill" />} label="Bins arrive" date={formatConfirmDate(confirmation.dropOffDate)} note="We'll deliver between 9 AM–5 PM" />
                <ScheduleRow icon={<House size={18} color="#C9A962" weight="fill" />} label="Move date" date={formatConfirmDate(confirmation.moveDate)} note="Pack at your pace — bins are ready" />
                <ScheduleRow icon={<Truck size={18} color="#C9A962" weight="fill" />} label="Bins picked up" date={formatConfirmDate(confirmation.pickupDate)} note="Leave bins stacked by the door" />
              </div>
            </div>

            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-6 space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#9ca3af]">Bundle</span>
                <span>{BUNDLE_LABELS[confirmation.bundleType]} ({confirmation.binCount} bins)</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#9ca3af]">Includes</span>
                <span>Packing paper + zip ties</span>
              </div>
              <div className="flex justify-between text-[15px] font-bold pt-2 border-t border-[#2a2a2a] mt-2">
                <span className="text-[#C9A962]">Total charged</span>
                <span className="text-[#C9A962]">{fmtPrice(confirmation.total)}</span>
              </div>
            </div>

            <div className="bg-[#1a1a1a] rounded-xl p-5 text-[13px] text-[#9ca3af] space-y-2">
              <p className="flex items-start gap-2">
                <Bell size={14} className="shrink-0 mt-0.5 text-[#C9A962]" />
                You&apos;ll receive an SMS confirmation and a day-before reminder for each delivery and pickup.
              </p>
              <p>Questions? Call <a href={`tel:${YUGO_PHONE}`} className="text-[#C9A962]">{YUGO_PHONE}</a></p>
            </div>

            <div className="border border-[#C9A962]/30 rounded-xl p-5 bg-[#C9A962]/5 text-center space-y-2">
              <p className="text-[15px] font-semibold text-[#C9A962]">Need movers too?</p>
              <p className="text-[13px] text-[#9ca3af]">Your bins are ready — get a full moving quote in 60 seconds.</p>
              <Link href="/widget/quote" className="inline-flex items-center gap-2 mt-2 px-5 py-2.5 rounded-lg bg-[#C9A962] text-[#0A0A0A] font-bold text-[14px] hover:bg-[#B8962E] transition-colors">
                Get a Moving Quote <ArrowRight size={16} />
              </Link>
            </div>
          </div>
        )}

        {/* ── BUNDLE SELECTION STEP ── */}
        {step === "bundle" && (
          <div className="space-y-8">
            {/* Hero */}
            <div className="text-center space-y-3">
              <div className="flex items-center justify-center gap-2 text-[#C9A962] text-[12px] font-bold tracking-widest uppercase mb-2">
                <Leaf size={14} weight="fill" />
                <span>Eco-Friendly Moving Bins</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#E5E0D8] leading-tight">
                Bin rentals delivered to your door
              </h1>
              <p className="text-[#9ca3af] text-[16px] max-w-lg mx-auto">
                Pack at your pace. We deliver 7 days before your move and pick up 5 days after.
                No cardboard waste.
              </p>
            </div>

            {/* How it works */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { icon: <CalendarBlank size={20} color="#C9A962" />, label: "Choose bundle" },
                { icon: <Truck size={20} color="#C9A962" />, label: "Bins delivered 7 days before" },
                { icon: <Package size={20} color="#C9A962" />, label: "Pack at your pace" },
                { icon: <CheckCircle size={20} color="#C9A962" />, label: "We pick up 5 days after" },
              ].map((item, i) => (
                <div key={i} className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-center space-y-2">
                  <div className="flex justify-center">{item.icon}</div>
                  <p className="text-[12px] text-[#9ca3af] font-medium">{item.label}</p>
                </div>
              ))}
            </div>

            {/* Bundle cards */}
            <div>
              <h2 className="text-[13px] font-bold tracking-widest uppercase text-[#9ca3af] mb-4">Select your bundle</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BUNDLES.map((b) => {
                  const isSelected = selectedBundle === b.key;
                  return (
                    <button
                      key={b.key}
                      onClick={() => setSelectedBundle(b.key)}
                      className={`relative text-left p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-[#C9A962] bg-[#C9A962]/8"
                          : "border-[#2a2a2a] bg-[#141414] hover:border-[#C9A962]/40"
                      }`}
                    >
                      {b.key === "2br" && (
                        <span className="absolute top-2 right-2 text-[9px] font-bold tracking-wide uppercase bg-[#C9A962] text-[#0A0A0A] px-1.5 py-0.5 rounded-full">
                          Popular
                        </span>
                      )}
                      <p className="font-bold text-[15px] text-[#E5E0D8]">{b.label}</p>
                      <p className="text-[12px] text-[#9ca3af] mt-0.5">
                        {b.key === "individual" ? "5+ bins" : `${b.bins} bins`}
                      </p>
                      <p className="text-[18px] font-bold text-[#C9A962] mt-2">
                        {b.key === "individual" ? "$6/bin" : `$${b.price}`}
                      </p>
                      <p className="text-[11px] text-[#6b7280] mt-1">{b.description}</p>
                      {b.key !== "individual" && (
                        <p className="text-[11px] text-[#9ca3af] mt-2">
                          + packing paper + zip ties
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Custom bin count */}
              {selectedBundle === "individual" && (
                <div className="mt-4 bg-[#141414] border border-[#2a2a2a] rounded-xl p-4">
                  <label className="block text-[13px] font-semibold text-[#9ca3af] mb-2">
                    How many bins? (minimum 5)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="number"
                      min={5}
                      max={200}
                      value={customBinCount}
                      onChange={(e) => setCustomBinCount(Math.max(5, parseInt(e.target.value) || 5))}
                      className="w-24 bg-[#0a0a0a] border border-[#3a3a3a] rounded-lg px-3 py-2 text-[#E5E0D8] text-center text-[16px] font-bold"
                    />
                    <span className="text-[#9ca3af] text-[14px]">
                      = <span className="text-[#C9A962] font-bold">${(customBinCount * 6).toFixed(0)}</span> + HST
                    </span>
                  </div>
                </div>
              )}

              <p className="text-[12px] text-[#6b7280] mt-3 text-center">
                All bundles include bins + packing paper + zip ties. Free delivery within Toronto.
              </p>
            </div>

            <button
              onClick={() => selectedBundle && setStep("details")}
              disabled={!selectedBundle}
              className="w-full py-4 rounded-xl font-bold text-[15px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: selectedBundle ? "#C9A962" : "#2a2a2a", color: selectedBundle ? "#0A0A0A" : "#6b7280" }}
            >
              Continue <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── DETAILS STEP ── */}
        {step === "details" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("bundle")} className="text-[#9ca3af] hover:text-[#E5E0D8] transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-[18px] font-bold text-[#E5E0D8]">Your details</h2>
                <p className="text-[13px] text-[#9ca3af]">
                  {BUNDLE_LABELS[selectedBundle!]} bundle — {binCount} bins — {fmtPrice(bundlePrice)}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <FormField label="Full name *">
                <input
                  type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
                  placeholder="Jane Smith"
                  className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Email *">
                  <input
                    type="email" value={clientEmail} onChange={(e) => setClientEmail(e.target.value)}
                    placeholder="jane@email.com"
                    className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors"
                  />
                </FormField>
                <FormField label="Phone *">
                  <input
                    type="tel" value={clientPhone} onChange={(e) => setClientPhone(e.target.value)}
                    placeholder="(416) 555-0123"
                    className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors"
                  />
                </FormField>
              </div>

              <FormField label="Delivery address *">
                <input
                  type="text" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)}
                  placeholder="123 Main St, Toronto, ON"
                  className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField label="Postal code">
                  <input
                    type="text" value={deliveryPostal} onChange={(e) => setDeliveryPostal(e.target.value)}
                    placeholder="M5V 2H1"
                    className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors"
                  />
                  {isGTA && (
                    <p className="text-[11px] text-amber-400 mt-1">GTA delivery surcharge: +$35</p>
                  )}
                </FormField>
                <FormField label="Building access">
                  <select
                    value={deliveryAccess} onChange={(e) => setDeliveryAccess(e.target.value)}
                    className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] focus:border-[#C9A962] focus:outline-none transition-colors"
                  >
                    {ACCESS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </FormField>
              </div>

              <FormField label="Delivery notes (unit #, gate code, etc.)">
                <textarea
                  value={deliveryNotes} onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Unit 1204, buzz #1204. Leave bins in lobby if no answer."
                  rows={2}
                  className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] placeholder:text-[#4a4a4a] focus:border-[#C9A962] focus:outline-none transition-colors resize-none"
                />
              </FormField>

              <FormField label="Your move date *">
                <input
                  type="date" value={moveDate} onChange={(e) => setMoveDate(e.target.value)}
                  min={minDate}
                  className="w-full bg-[#141414] border border-[#3a3a3a] rounded-lg px-4 py-3 text-[#E5E0D8] focus:border-[#C9A962] focus:outline-none transition-colors"
                />
              </FormField>

              {moveDate && (
                <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 space-y-2 text-[13px]">
                  <div className="flex justify-between items-center">
                    <span className="text-[#9ca3af] flex items-center gap-1.5"><Package size={13} /> Bins delivered</span>
                    <span className="font-semibold">{fmt(dropOffDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9ca3af] flex items-center gap-1.5"><House size={13} /> Move date</span>
                    <span className="font-semibold">{fmt(new Date(moveDate))}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#9ca3af] flex items-center gap-1.5"><Truck size={13} /> Bins picked up</span>
                    <span className="font-semibold">{fmt(pickupDate)}</span>
                  </div>
                  <p className="text-[11px] text-[#6b7280] pt-1 border-t border-[#2a2a2a]">12-day rental period included.</p>
                </div>
              )}
            </div>

            {/* Order summary */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-5 space-y-2 text-[14px]">
              <h3 className="text-[11px] font-bold tracking-widest uppercase text-[#9ca3af] mb-3">Order summary</h3>
              <SummaryRow label={`${BUNDLE_LABELS[selectedBundle!]} bundle (${binCount} bins)`} value={fmtPrice(bundlePrice)} />
              <SummaryRow
                label="Delivery"
                value={surcharge > 0 ? `+${fmtPrice(surcharge)}` : "Included ✓"}
                valueColor={surcharge > 0 ? "#E5E0D8" : "#22c55e"}
              />
              <SummaryRow label="HST (13%)" value={fmtPrice(hst)} />
              <div className="border-t border-[#2a2a2a] pt-2 mt-2 flex justify-between font-bold text-[16px]">
                <span className="text-[#C9A962]">Total</span>
                <span className="text-[#C9A962]">{fmtPrice(total)}</span>
              </div>
            </div>

            <button
              onClick={() => {
                if (!clientName || !clientEmail || !clientPhone || !deliveryAddress || !moveDate) return;
                setStep("payment");
              }}
              disabled={!clientName || !clientEmail || !clientPhone || !deliveryAddress || !moveDate}
              className="w-full py-4 rounded-xl font-bold text-[15px] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "#C9A962", color: "#0A0A0A" }}
            >
              Continue to Payment <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ── PAYMENT STEP ── */}
        {step === "payment" && (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("details")} className="text-[#9ca3af] hover:text-[#E5E0D8] transition-colors">
                <ArrowLeft size={20} />
              </button>
              <div>
                <h2 className="text-[18px] font-bold text-[#E5E0D8]">Payment</h2>
                <p className="text-[13px] text-[#9ca3af]">Card charged immediately. Full payment.</p>
              </div>
            </div>

            {/* Summary recap */}
            <div className="bg-[#141414] border border-[#2a2a2a] rounded-xl p-4 text-[13px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">{BUNDLE_LABELS[selectedBundle!]} bundle</span>
                <span>{binCount} bins</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#9ca3af]">Delivering to</span>
                <span className="max-w-[200px] text-right truncate">{deliveryAddress}</span>
              </div>
              {moveDate && (
                <div className="flex justify-between">
                  <span className="text-[#9ca3af]">Move date</span>
                  <span>{fmt(new Date(moveDate))}</span>
                </div>
              )}
              <div className="flex justify-between font-bold pt-1 border-t border-[#2a2a2a] mt-1 text-[15px]">
                <span className="text-[#C9A962]">Total due today</span>
                <span className="text-[#C9A962]">{fmtPrice(total)}</span>
              </div>
            </div>

            {/* Square card form */}
            <div>
              <div
                className="rounded-xl border-2 p-4 bg-white transition-colors"
                style={{ borderColor: cardReady ? "#C9A962" : "#e2ded5" }}
              >
                <div id="bin-sq-card" style={{ minHeight: 90 }} />
                {!sdkReady && !payError && (
                  <div className="flex items-center justify-center py-6 gap-2">
                    <div className="w-4 h-4 border-2 border-[#C9A962]/30 border-t-[#C9A962] rounded-full animate-spin" />
                    <span className="text-[12px] text-gray-400">Loading payment form…</span>
                  </div>
                )}
              </div>
              {payError && (
                <div className="mt-2 px-4 py-3 rounded-xl bg-red-900/20 border border-red-800/30 text-red-400 text-[12px]">
                  {payError}
                </div>
              )}
            </div>

            <button
              onClick={handlePay}
              disabled={!cardReady || processing}
              className="w-full py-4 rounded-xl font-bold text-[15px] text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ background: "#5C1A33" }}
            >
              {processing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Lock size={16} />
                  Pay {fmtPrice(total)} &amp; Confirm Bins
                </>
              )}
            </button>

            <div className="flex items-center justify-center gap-2 text-[11px] text-[#6b7280]">
              <Lock size={12} />
              Secured by Square · 256-bit encryption · Card stored for potential late fees
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold text-[#9ca3af] mb-1.5 tracking-wide">{label}</label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-[#9ca3af]">{label}</span>
      <span style={{ color: valueColor || "#E5E0D8" }}>{value}</span>
    </div>
  );
}

function ScheduleRow({ icon, label, date, note }: { icon: React.ReactNode; label: string; date: string; note: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="w-8 h-8 bg-[#C9A962]/10 rounded-lg flex items-center justify-center shrink-0 mt-0.5">{icon}</span>
      <div>
        <p className="font-semibold text-[14px] text-[#E5E0D8]">{label}</p>
        <p className="text-[#C9A962] font-bold text-[15px]">{date}</p>
        <p className="text-[12px] text-[#9ca3af]">{note}</p>
      </div>
    </div>
  );
}

function formatConfirmDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  const d = new Date(year, month - 1, day);
  return d.toLocaleDateString("en-CA", { weekday: "long", month: "long", day: "numeric" });
}

"use client";

import * as React from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import ResidentialLayout from "@/app/quote/[quoteId]/layouts/ResidentialLayout";
import {
  type Quote,
  type TierData,
  type ResidentialQuoteTierMetaMap,
} from "@/app/quote/[quoteId]/quote-shared";

/**
 * Mock 3BR Estate quote — enough fields populated for ResidentialLayout
 * to render. Real quote pages also carry inventory, addresses, etc., but
 * the tier-card layout only needs tiers + meta + a recommended tier.
 */
const MOCK_QUOTE: Quote = {
  id: "preview-uuid",
  quote_id: "YG-PREVIEW",
  service_type: "local_move",
  status: "sent",
  move_size: "3br",
  move_date: "2026-06-27",
  from_address: "665 Queen Street East, Toronto, ON M4M 1G6",
  to_address: "122 Bertmount Avenue, Toronto, ON M4M 2X9",
  from_access: "elevator",
  to_access: "ground",
  recommended_tier: "estate",
  truck_primary: "24ft",
  est_crew_size: 4,
  est_hours: 7,
  expires_at: "2026-06-09T20:00:00Z",
  // Required by Quote interface — minimal stub
  tiers: null,
  custom_price: null,
} as unknown as Quote;

const MOCK_TIERS: Record<string, TierData> = {
  essential: {
    price: 2850,
    deposit: 285,
    tax: 371,
    total: 3221,
    includes: [
      "Dedicated 24ft moving truck",
      "Professional crew of 4",
      "Protective wrapping for up to 3 furniture pieces",
      "Floor & entryway protection",
      "All standard equipment included",
      "Entry point placement",
      "Released value coverage — $0.60/lb per item",
      "Real-time GPS move tracking",
      "Guaranteed flat price",
    ],
  },
  signature: {
    price: 3600,
    deposit: 540,
    tax: 468,
    total: 4068,
    includes: [
      "Dedicated 24ft moving truck",
      "Professional crew of 4",
      "Enhanced declared value — full declared value up to $50,000",
      "Mattress and television protection bags",
      "Furniture disassembly and reassembly — beds, desks, standard furniture",
      "Room-of-choice placement throughout your home",
      "Wardrobe box for hanging clothes — returned after your move",
      "Debris and all packaging removed at completion",
      "Dedicated coordinator for scheduling and day-of communication",
    ],
  },
  estate: {
    price: 6700,
    deposit: 1675,
    tax: 871,
    total: 7571,
    includes: [
      "Dedicated 24ft moving truck",
      "Professional crew of 4",
      "Dedicated Estate Move Director — named, direct contact from booking to completion",
      "In-home walkthrough and room-by-room transition planning",
      "Full inventory documentation — every item photographed before loading",
      "Specialist white glove crew — four-point blanket wrap, no dragging, no stacking",
      "Fine art, antique, and fragile item handling under specialist protocol",
      "Complete professional packing — every room, every item",
      "Complete unpacking and room setup — shelves, closets, placement per your plan",
      "Full replacement value — up to $10,000 per item · $100,000 per move · zero deductible",
      "30-day post-move concierge — direct line to your Director",
      "Exclusive Yugo Circle access — partner benefits and priority scheduling",
    ],
  },
};

const MOCK_TIER_META: ResidentialQuoteTierMetaMap = {
  essential: {
    label: "Essential",
    tagline: "Precision, without the extras.",
    footer: "Best for: organized, prepared moves with minimal handling needs.",
    inclusionsIntro: null,
    bg: "#FAF7F2",
  },
  signature: {
    label: "Signature",
    tagline: "Everything protected. Nothing exposed.",
    footer:
      "Best for: full-home moves where protection, flow, and peace of mind matter.",
    inclusionsIntro: "Everything in Essential, plus:",
    bg: "#FAF7F2",
  },
  estate: {
    label: "Estate",
    tagline: "A fully managed home transition.",
    footer:
      "Best for: clients who expect every detail handled — high-value homes, art, antiques, complete transitions.",
    inclusionsIntro: "Everything in Signature, plus:",
    bg: "#5C1A33",
  },
  // Required by the map type even if unused on the preview
} as unknown as ResidentialQuoteTierMetaMap;

const MODES = [
  {
    value: "comparison",
    label: "Full comparison",
    desc: "All three tiers side-by-side (legacy default).",
  },
  {
    value: "estate_featured",
    label: "Estate featured",
    desc: "Estate as hero, Essential + Signature collapsed below.",
  },
  {
    value: "estate_only",
    label: "Estate only",
    desc: "Single-tier Estate render, no comparison.",
  },
] as const;

type Mode = (typeof MODES)[number]["value"];

export default function PreviewPresentationClient() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const rawMode = params.get("mode");
  const mode: Mode =
    rawMode === "estate_only" || rawMode === "estate_featured"
      ? rawMode
      : "comparison";
  const [selectedTier, setSelectedTier] = React.useState<string>("estate");

  const goMode = (m: Mode) => {
    const sp = new URLSearchParams(params.toString());
    sp.set("mode", m);
    router.push(`${pathname}?${sp.toString()}`);
  };

  return (
    <div className="min-h-screen bg-[#FAF7F2]">
      <div className="border-b border-[var(--brd)] bg-white">
        <div className="max-w-6xl mx-auto px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-[18px] font-semibold text-[var(--tx)]">
                Quote presentation preview
              </h1>
              <p className="text-[12px] text-[var(--tx2)] mt-0.5">
                Mock 3BR Estate quote — switch modes to see how the client
                quote page renders.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {MODES.map((m) => {
                const active = m.value === mode;
                return (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => goMode(m.value)}
                    className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition ${
                      active
                        ? "bg-[var(--wine)] text-white border-[var(--wine)]"
                        : "bg-white text-[var(--tx)] border-[var(--brd)] hover:border-[var(--wine)]"
                    }`}
                    title={m.desc}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
            <p className="text-[11px] text-amber-900">
              <strong>Preview only.</strong> Mock data; no quote is created or
              sent. The real client page renders the same layout based on{" "}
              <code className="px-1 bg-amber-100 rounded">
                quotes.presentation_mode
              </code>{" "}
              set by the admin form.
            </p>
          </div>
        </div>
      </div>

      <div className="py-10 px-2 md:px-5">
        <ResidentialLayout
          quote={MOCK_QUOTE}
          tiers={MOCK_TIERS}
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
          recommendedTier="estate"
          presentationMode={mode}
          hasSelection={false}
          tierMetaMap={MOCK_TIER_META}
        />
      </div>
    </div>
  );
}

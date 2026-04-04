"use client";

import React from "react";

/** Page / chrome */
export const ESTATE_PAGE_BG = "#2B0416";
export const ESTATE_BODY_TEXT = "#F9EDE4";
export const ESTATE_ROSE = "#66143D";
export const ESTATE_ROSE_HOVER = "#7A1847";
export const ESTATE_TIER_ISLAND_BG = "#FFFBF7";

/**
 * Text on wine (#2B0416) — tuned so 11–12px copy stays legible (avoid /50–/65 Tailwind on dark).
 * Use `kicker` for uppercase section labels (replaces rose #66143D text on wine).
 */
export const ESTATE_ON_WINE = {
  primary: "#F9EDE4",
  body: "rgba(249, 237, 228, 0.92)",
  secondary: "rgba(249, 237, 228, 0.86)",
  muted: "rgba(249, 237, 228, 0.8)",
  /** Large type or non-critical only */
  subtle: "rgba(249, 237, 228, 0.72)",
  /** Step labels not yet reached */
  faded: "rgba(249, 237, 228, 0.7)",
  kicker: "#F0D8E2",
  hairline: "rgba(249, 237, 228, 0.38)",
  borderSubtle: "rgba(249, 237, 228, 0.22)",
  borderDash: "rgba(249, 237, 228, 0.38)",
} as const;

export const estateCtaButtonClass =
  "w-full py-4 rounded-none border-0 text-lg font-serif tracking-wide transition-all bg-[#66143D] text-[#F9EDE4] hover:bg-[#7A1847]";

export const estateCtaButtonClassCompact =
  "w-full max-w-md py-3.5 rounded-none border-0 text-[10px] font-bold uppercase tracking-[0.12em] transition-all bg-[#66143D] text-[#F9EDE4] hover:bg-[#7A1847]";

export function EstateFeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="group">
      <h4 className="text-lg font-serif mb-1" style={{ color: ESTATE_ON_WINE.primary }}>
        {title}
      </h4>
      <p className="text-sm leading-relaxed" style={{ color: ESTATE_ON_WINE.secondary }}>
        {description}
      </p>
    </div>
  );
}

export const EstateExperienceSection = React.forwardRef<
  HTMLElement,
  {
    truckLabel: string;
    crewSize: number | null;
  }
>(function EstateExperienceSection({ truckLabel, crewSize }, ref) {
  const crewN = crewSize ?? 3;

  return (
    <section
      ref={ref}
      className="scroll-mt-24 py-16 px-6 md:px-12 mb-10 border-t border-[#66143D]/25"
    >
      <div className="max-w-4xl mx-auto">
        <p className="text-sm uppercase tracking-[0.2em] mb-2 font-semibold" style={{ color: ESTATE_ON_WINE.kicker }}>
          Estate
        </p>
        <h2 className="text-3xl md:text-4xl font-serif mb-2" style={{ color: ESTATE_ON_WINE.primary }}>
          Your Estate Experience
        </h2>
        <p className="text-lg mb-12" style={{ color: ESTATE_ON_WINE.secondary }}>
          Every detail, handled with intention.
        </p>

        <div className="space-y-12">
          <div>
            <h3
              className="text-sm uppercase tracking-[0.15em] mb-6 font-semibold"
              style={{ color: ESTATE_ON_WINE.kicker }}
            >
              Before Your Move
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <EstateFeatureCard
                title="Dedicated Move Coordinator"
                description="One point of contact from the moment you book through final placement in your new home."
              />
              <EstateFeatureCard
                title="Pre-Move Walkthrough"
                description="A documented room-by-room plan created before we touch anything. Every piece accounted for."
              />
              <EstateFeatureCard
                title="Pre-Move Inventory Planning"
                description="Full inventory documented, reviewed, and confirmed with you before move day."
              />
              <EstateFeatureCard
                title="Full Packing Service"
                description="Our team packs everything — china, books, wardrobes, art. You don't touch a box."
              />
            </div>
          </div>

          <div>
            <h3
              className="text-sm uppercase tracking-[0.15em] mb-6 font-semibold"
              style={{ color: ESTATE_ON_WINE.kicker }}
            >
              Move Day
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <EstateFeatureCard title={truckLabel} description="Climate-protected and equipped exclusively for your move." />
              <EstateFeatureCard
                title={`Professional Crew of ${crewN}`}
                description="Licensed, insured, background-checked. The same team from start to finish."
              />
              <EstateFeatureCard
                title="White Glove Handling"
                description="Specialist-level care for furniture, art, antiques, and high-value possessions."
              />
              <EstateFeatureCard
                title="Full Furniture Wrapping"
                description="Every piece individually wrapped, padded, and protected — no exceptions."
              />
              <EstateFeatureCard
                title="Complex Disassembly & Precision Reassembly"
                description="Complete furniture breakdown and expert reassembly at your new home."
              />
              <EstateFeatureCard
                title="Floor & Property Protection"
                description="Premium runners, booties, and corner guards at every touchpoint — both homes."
              />
              <EstateFeatureCard
                title="Premium Art & Antique Handling"
                description="Museum-grade care for fine art, antiques, and specialty pieces."
              />
              <EstateFeatureCard title="Real-Time GPS Tracking" description="Follow your move live from any device." />
            </div>
          </div>

          <div>
            <h3
              className="text-sm uppercase tracking-[0.15em] mb-6 font-semibold"
              style={{ color: ESTATE_ON_WINE.kicker }}
            >
              At Your New Home
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <EstateFeatureCard
                title="Precision Placement"
                description="Every piece positioned exactly where you envision it. We adjust until it's right."
              />
              <EstateFeatureCard
                title="Full Unpacking Service"
                description="Boxes opened, items placed, wardrobes hung. You're home, not still moving."
              />
              <EstateFeatureCard
                title="Debris & Packaging Removal"
                description="Every box, every wrapper, every piece of tape — gone before we leave."
              />
            </div>
          </div>

          <div>
            <h3
              className="text-sm uppercase tracking-[0.15em] mb-6 font-semibold"
              style={{ color: ESTATE_ON_WINE.kicker }}
            >
              Protection & Ongoing Support
            </h3>
            <div className="grid md:grid-cols-2 gap-6">
              <EstateFeatureCard
                title="Full Replacement Valuation"
                description="Up to $10,000 per item, $100,000 per shipment. Zero deductible."
              />
              <EstateFeatureCard
                title="All Packing Materials Included"
                description="Boxes, wrapping, 5 wardrobe boxes, mattress bags — everything provided."
              />
              <EstateFeatureCard
                title="30-Day Concierge Support"
                description="Questions, adjustments, and support for 30 days after your move."
              />
              <EstateFeatureCard
                title="Exclusive Partner Perks"
                description="Access to partner discounts and member benefits."
              />
            </div>
          </div>
        </div>

        <div className="mt-16 pt-8 border-t border-[#66143D]/30 flex flex-wrap gap-8 justify-center">
          <div className="text-center">
            <p className="text-lg font-serif" style={{ color: ESTATE_ON_WINE.primary }}>
              Guaranteed Flat Price
            </p>
            <p className="text-sm" style={{ color: ESTATE_ON_WINE.muted }}>
              The price you see is the price you pay
            </p>
          </div>
          <div className="text-center">
            <p className="text-lg font-serif" style={{ color: ESTATE_ON_WINE.primary }}>
              Zero-Damage Commitment
            </p>
            <p className="text-sm" style={{ color: ESTATE_ON_WINE.muted }}>
              Your belongings, protected and insured
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

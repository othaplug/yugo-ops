"use client";

import React from "react";

/** Page / chrome */
export const ESTATE_PAGE_BG = "#2B0416";
export const ESTATE_BODY_TEXT = "#F9EDE4";
export const ESTATE_ROSE = "#66143D";
export const ESTATE_ROSE_HOVER = "#7A1847";
export const ESTATE_TIER_ISLAND_BG = "#FFFBF7";

/**
 * Text on wine (#2B0416), tuned so 11–12px copy stays legible (avoid /50–/65 Tailwind on dark).
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

export function EstateFeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="group">
      <h4
        className="text-lg font-serif mb-1"
        style={{ color: ESTATE_ON_WINE.primary }}
      >
        {title}
      </h4>
      <p
        className="text-sm leading-relaxed"
        style={{ color: ESTATE_ON_WINE.secondary }}
      >
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
        <p
          className="text-sm uppercase tracking-[0.2em] mb-2 font-semibold"
          style={{ color: ESTATE_ON_WINE.kicker }}
        >
          Estate
        </p>
        <h2
          className="text-3xl md:text-4xl font-serif mb-2"
          style={{ color: ESTATE_ON_WINE.primary }}
        >
          Your Estate Experience
        </h2>
        <p
          className="text-lg mb-12"
          style={{ color: ESTATE_ON_WINE.secondary }}
        >
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
                description="Our team packs everything, china, books, wardrobes, art. You don't touch a box."
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
              <EstateFeatureCard
                title={truckLabel}
                description="Fully equipped and prepared exclusively for your move."
              />
              {/* Fix #2: Crew size is day-specific on multi-day Estate plans
                 (typically pack day uses crew-1, move day uses crew). Stating
                 a single number here contradicted the schedule below. Phrase
                 as a range so the schedule's per-day breakdown is the source
                 of truth, not this card. */}
              <EstateFeatureCard
                title={`Professional crew sized for your home (${Math.max(2, crewN - 1)}–${crewN} specialists across pack and move days)`}
                description="Licensed, insured, background-checked. The same team across pack day, move day, and unpacking."
              />
              <EstateFeatureCard
                title="White Glove Handling"
                description="Specialist-level care for furniture, art, antiques, and high-value possessions."
              />
              <EstateFeatureCard
                title="Full Furniture Wrapping"
                description="Every piece individually wrapped, padded, and protected, no exceptions."
              />
              <EstateFeatureCard
                title="Complex Disassembly & Precision Reassembly"
                description="Complete furniture breakdown and expert reassembly at your new home."
              />
              <EstateFeatureCard
                title="Floor & Property Protection"
                description="Premium runners, booties, and corner guards at every touchpoint, both homes."
              />
              <EstateFeatureCard
                title="Premium Art & Antique Handling"
                description="Museum-grade care for fine art, antiques, and specialty pieces."
              />
              <EstateFeatureCard
                title="Real-Time GPS Tracking"
                description="Follow your move live from any device."
              />
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
                description="Every box, every wrapper, every piece of tape, gone before we leave."
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
              {/* Fix #3: title held a headline that contradicted the per-item
                 cap below it. Either we promise "no caps" up front and remove
                 the dollar caps, or we state the caps in the headline. We
                 state the caps. The protection-detail page already does. */}
              <EstateFeatureCard
                title="Full replacement value, up to $10,000 per item · $100,000 per move"
                description="Items replaced at today's market value, zero deductible. Items over $10,000 can be individually declared for additional coverage."
              />
              <EstateFeatureCard
                title="All Packing Materials Included"
                description="Boxes, wrapping, 5 wardrobe boxes, mattress bags, everything provided."
              />
              <EstateFeatureCard
                title="30-Day Post-Move Concierge"
                description="Direct line to your coordinator for 30 days after your move, no support queues."
              />
              <EstateFeatureCard
                title="Exclusive Yugo Circle Partner Offers"
                description="Member-only partner discounts, settling-in services, and curated home offers."
              />
            </div>
          </div>
        </div>

        {/* Fix #3: "Zero-Damage Commitment" used to live here next to the
           valuation cards. It conflated two different claims: "zero
           deductible" (insurance term, no out-of-pocket on a claim) with
           a service promise ("we won't damage anything"). Clients reading
           both wondered: if something IS damaged, do you fix it for free
           or just promise it won't happen? Removing the standalone claim;
           the valuation coverage IS the commitment. One promise, not two. */}
      </div>
    </section>
  );
});

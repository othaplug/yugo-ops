import type { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";
import { CaretRight, Phone, EnvelopeSimple } from "@phosphor-icons/react/ssr";
import { formatPhone } from "@/lib/phone";
import { formatMoveDate } from "@/lib/date-format";
import EstateWelcomeFaq from "./[token]/EstateWelcomeFaq";
import { ESTATE_WELCOME_BG, ON_WINE } from "./estate-welcome-tokens";

function firstName(full: string | null | undefined): string {
  const t = (full || "").trim().split(/\s+/).filter(Boolean)[0];
  return t || "there";
}

/** Thin separator between narrative sections — fades at edges so it stays quiet on wine. */
function SubtleSectionDivider() {
  return (
    <div className="max-w-4xl mx-auto px-5 md:px-8" aria-hidden>
      <div
        className="h-px w-full"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${ON_WINE.rule} 14%, ${ON_WINE.rule} 86%, transparent 100%)`,
        }}
      />
    </div>
  );
}

function Kicker({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[11px] font-semibold tracking-[0.14em] uppercase mb-3"
      style={{ color: ON_WINE.kicker }}
    >
      {children}
    </p>
  );
}

function SectionTitle({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="font-hero text-[26px] md:text-[32px] leading-tight mb-4 md:mb-5"
      style={{ color: ON_WINE.primary }}
    >
      {children}
    </h2>
  );
}

function BodyP({ children }: { children: ReactNode }) {
  return (
    <p
      className="text-[15px] md:text-[16px] leading-relaxed max-w-2xl"
      style={{ color: ON_WINE.body }}
    >
      {children}
    </p>
  );
}

function FeatureGrid({
  items,
}: {
  items: { title: string; description: string }[];
}) {
  return (
    <div className="grid md:grid-cols-2 gap-8 md:gap-10 mt-8">
      {items.map((item) => (
        <div key={item.title}>
          <h3
            className="font-hero text-lg md:text-xl mb-2"
            style={{ color: ON_WINE.primary }}
          >
            {item.title}
          </h3>
          <p
            className="text-[14px] leading-relaxed"
            style={{ color: ON_WINE.secondary }}
          >
            {item.description}
          </p>
        </div>
      ))}
    </div>
  );
}

const TIMELINE_STEPS: { title: string; description: string }[] = [
  {
    title: "Coordinator intro call",
    description:
      "Within 24 hours of booking, your coordinator reaches out to introduce themselves and learn your priorities.",
  },
  {
    title: "Pre-move walkthrough scheduled",
    description:
      "We book an in-person or virtual walkthrough at a time that works for you.",
  },
  {
    title: "Walkthrough completed",
    description:
      "Room-by-room plan documented — every piece, access note, and special handling call-out on record.",
  },
  {
    title: "Packing materials delivered",
    description:
      "Everything we need arrives at your home before pack day, coordinated with your schedule.",
  },
  {
    title: "Move day confirmed",
    description:
      "Crew, vehicle, and window locked in. You receive your detailed itinerary ahead of the big day.",
  },
];

const PACK_DAY_FEATURES: { title: string; description: string }[] = [
  {
    title: "Professional packers",
    description:
      "Our team handles every box. You do not need to pack — that is the point of Estate.",
  },
  {
    title: "Every category covered",
    description:
      "China, books, wardrobes, art — each item wrapped and boxed with the right materials.",
  },
  {
    title: "Wardrobe boxes",
    description:
      "Hanging clothes move on racks, ready to go straight into your new closets.",
  },
  {
    title: "Mattress bags and TV protection",
    description:
      "Beds and screens protected for transit so they arrive as they left.",
  },
  {
    title: "Clean, organized handoff",
    description:
      "Your home is left tidy and ready for move day — calm, not chaotic.",
  },
];

const MOVE_DAY_FEATURES: { title: string; description: string }[] = [
  {
    title: "Dedicated truck and team",
    description:
      "Your crew and vehicle are reserved for you — not shared, not rushed.",
  },
  {
    title: "White glove handling",
    description:
      "Furniture, art, and antiques moved with intentional care and the right equipment.",
  },
  {
    title: "Property protection",
    description:
      "Floors, walls, and doorways protected at both homes from arrival to departure.",
  },
  {
    title: "Real-time GPS tracking",
    description:
      "Follow progress from any device while your coordinator stays a call away.",
  },
  {
    title: "Loaded with intention",
    description:
      "Sequencing and placement planned so unloading at your new home is efficient and careful.",
  },
];

const NEW_HOME_FEATURES: { title: string; description: string }[] = [
  {
    title: "Precision placement",
    description:
      "Every piece where you envision it — we adjust until it feels right.",
  },
  {
    title: "Full unpacking",
    description:
      "Boxes opened, items placed, wardrobes hung, kitchen unpacked, beds assembled.",
  },
  {
    title: "Debris removed",
    description:
      "All boxes, wrap, and packing materials cleared before we leave.",
  },
  {
    title: "When we leave, you are home",
    description: "Not still moving — settled, with space to breathe.",
  },
];

const PROTECTION_LINES: string[] = [
  "Repair by our verified professionals or full replacement valuation, per your Estate agreement.",
  "Up to $10,000 per item, $100,000 per move.",
  "Zero deductible.",
  "$2M commercial liability.",
];

const AFTER_MOVE_FEATURES: { title: string; description: string }[] = [
  {
    title: "30-day concierge",
    description:
      "The same relationship continues after move day — questions, tweaks, and coordination.",
  },
  {
    title: "Placement and adjustments",
    description:
      "Something need a small move or follow-up? We help arrange it.",
  },
  {
    title: "Partner perks",
    description:
      "Exclusive offers from partners we trust — part of the Estate experience.",
  },
];

const ESTATE_CONCIERGE_NETWORK: { service: string; desc: string }[] = [
  {
    service: "TV and Wall Art Mounting",
    desc: "Licensed installers for screens, mirrors, and artwork",
  },
  {
    service: "Professional Organization",
    desc: "Certified organizers for closets, kitchens, and storage systems",
  },
  {
    service: "Interior Design",
    desc: "Leading Toronto designers for styling and space planning",
  },
  {
    service: "Cleaning Services",
    desc: "Move-out deep cleans, move-in refreshes, ongoing housekeeping",
  },
  {
    service: "Electricians",
    desc: "Licensed professionals for chandeliers, fixtures, and outlets",
  },
  {
    service: "Plumbing and Gas",
    desc: "Licensed technicians for appliance reconnection and hookup",
  },
];

export type EstateWelcomeGuideViewProps = {
  moveCode: string;
  moveDateLabel: string | null;
  trackUrl: string;
  coordName: string | null;
  coordPhone: string | null;
  coordEmail: string | null;
  supportEmail: string;
  /** For hero: "Welcome …, [firstName]." */
  clientName: string | null;
  /** Show track CTA in footer when the move has a scheduled date */
  hasScheduledMove: boolean;
  previewBanner?: string | null;
  /** When set and more than 2 days, show full project timeline instead of pack/move/new-home story sections. */
  moveProjectSchedule?: {
    totalDays: number;
    days: { date: string; label: string; description?: string | null }[];
  } | null;
};

export default function EstateWelcomeGuideView({
  moveCode,
  moveDateLabel,
  trackUrl,
  coordName,
  coordPhone,
  coordEmail,
  supportEmail,
  clientName,
  hasScheduledMove,
  previewBanner,
  moveProjectSchedule = null,
}: EstateWelcomeGuideViewProps) {
  const greetingName = firstName(clientName);

  return (
    <div
      className="estate-welcome-root min-h-screen font-sans antialiased"
      style={{ backgroundColor: ESTATE_WELCOME_BG, color: ON_WINE.primary }}
    >
      {previewBanner ? (
        <div
          className="text-center text-[11px] font-semibold py-2.5 px-4"
          style={{
            backgroundColor: "rgba(249, 237, 228, 0.08)",
            color: ON_WINE.kicker,
            borderBottom: `1px solid ${ON_WINE.borderSubtle}`,
          }}
        >
          {previewBanner}
        </div>
      ) : null}

      {/* ── Hero ── */}
      <header className="relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-100"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 40%, rgba(255,255,255,0.1) 0%, transparent 45%), radial-gradient(circle at 85% 60%, rgba(255,255,255,0.08) 0%, transparent 42%)",
          }}
        />
        <div className="estate-welcome-hero-inner relative z-1 max-w-3xl mx-auto px-5 pt-12 pb-20 md:pt-16 md:pb-28 text-center">
          <div className="flex justify-center mb-4">
            <Image
              src="/images/yugo-logo-cream.png"
              alt="Yugo"
              width={112}
              height={32}
              className="h-8 w-auto opacity-95"
              priority
            />
          </div>
          <div
            className="w-12 h-px mx-auto mb-8"
            style={{ backgroundColor: ON_WINE.hairline }}
          />
          <Kicker>Estate</Kicker>
          <h1 className="font-hero text-[30px] md:text-[38px] leading-[1.15] mb-4 text-[#F9EDE4]">
            Welcome to your Estate experience, {greetingName}.
          </h1>
          <p
            className="text-[16px] md:text-[17px] leading-relaxed max-w-md mx-auto font-medium"
            style={{ color: ON_WINE.body }}
          >
            Everything from here is handled.
          </p>
          <p
            className="mt-10 text-[12px] tracking-wide"
            style={{ color: ON_WINE.muted }}
          >
            Reference{" "}
            <span className="font-semibold tabular-nums text-[#F9EDE4]">
              {moveCode}
            </span>
            {moveDateLabel ? <> · Scheduled {moveDateLabel}</> : null}
          </p>
        </div>
      </header>

      <SubtleSectionDivider />

      {/* ── Before your move (timeline) ── */}
      <section
        className="estate-welcome-story py-20 md:py-28"
        aria-labelledby="before-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Before your move</Kicker>
          <SectionTitle id="before-heading">
            What we handle in the days ahead
          </SectionTitle>
          <BodyP>
            In the days leading up to your move, here is what we handle — so you
            stay focused on life, not logistics.
          </BodyP>
          <ol className="mt-12 m-0 p-0 list-none">
            {TIMELINE_STEPS.map((step, i) => (
              <li
                key={step.title}
                className="relative pl-8 md:pl-10 pb-10 last:pb-0"
              >
                {i < TIMELINE_STEPS.length - 1 ? (
                  <span
                    className="absolute left-[7px] md:left-[9px] top-8 bottom-0 w-px"
                    style={{ backgroundColor: ON_WINE.hairline }}
                    aria-hidden
                  />
                ) : null}
                <span
                  className="absolute left-0 top-1.5 w-[15px] h-[15px] md:w-[19px] md:h-[19px] rounded-full border-2 shrink-0"
                  style={{
                    borderColor: ON_WINE.kicker,
                    backgroundColor: ESTATE_WELCOME_BG,
                  }}
                  aria-hidden
                />
                <p
                  className="font-hero text-lg md:text-xl mb-1.5"
                  style={{ color: ON_WINE.primary }}
                >
                  {step.title}
                </p>
                <p
                  className="text-[14px] leading-relaxed max-w-xl"
                  style={{ color: ON_WINE.secondary }}
                >
                  {step.description}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <SubtleSectionDivider />

      {moveProjectSchedule &&
      moveProjectSchedule.totalDays > 2 &&
      moveProjectSchedule.days.length > 0 ? (
        <>
          <section
            className="estate-welcome-story py-20 md:py-28"
            aria-labelledby="schedule-heading"
          >
            <div className="max-w-3xl mx-auto px-5 md:px-8">
              <p
                className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-2"
                style={{ color: "#66143D" }}
              >
                Your schedule
              </p>
              <h2
                id="schedule-heading"
                className="font-hero text-[28px] md:text-[34px] leading-tight mb-4 text-[#F9EDE4]"
              >
                {moveProjectSchedule.totalDays} days, one seamless experience
              </h2>
              <BodyP>
                Your move is planned as a multi-day project. Each day has a clear
                purpose, and your coordinator manages the full timeline.
              </BodyP>
              <div className="mt-10 space-y-8">
                {moveProjectSchedule.days.map((day, i) => (
                  <div key={`${day.date}-${i}`} className="flex gap-5">
                    <div className="flex flex-col items-center shrink-0 w-12">
                      <div
                        className="w-10 h-10 rounded-full border flex items-center justify-center"
                        style={{ borderColor: "#66143D" }}
                      >
                        <span className="text-sm font-serif text-[#F9EDE4]">{i + 1}</span>
                      </div>
                      {i < moveProjectSchedule.days.length - 1 ? (
                        <div
                          className="w-px flex-1 min-h-[3rem] mt-2"
                          style={{ backgroundColor: "rgba(102,20,61,0.35)" }}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="pt-1 pb-2 min-w-0">
                      <p
                        className="text-[11px] uppercase tracking-wider font-semibold"
                        style={{ color: "#66143D" }}
                      >
                        {formatMoveDate(day.date)}
                      </p>
                      <p
                        className="font-hero text-lg md:text-xl mt-1"
                        style={{ color: ON_WINE.primary }}
                      >
                        {day.label}
                      </p>
                      {day.description ? (
                        <p
                          className="text-[14px] leading-relaxed mt-1"
                          style={{ color: ON_WINE.secondary }}
                        >
                          {day.description}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          <SubtleSectionDivider />
        </>
      ) : (
        <>
          {/* ── Pack day ── */}
          <section
            className="estate-welcome-story py-20 md:py-28"
            aria-labelledby="pack-heading"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-8">
              <Kicker>Pack day</Kicker>
              <SectionTitle id="pack-heading">
                The day before your move, our packing team arrives
              </SectionTitle>
              <BodyP>
                Calm and thorough. You do not need to touch a box — we wrap,
                protect, and label everything with a documented plan behind it.
              </BodyP>
              <FeatureGrid items={PACK_DAY_FEATURES} />
            </div>
          </section>

          <SubtleSectionDivider />

          {/* ── Move day ── */}
          <section
            className="estate-welcome-story py-20 md:py-28"
            aria-labelledby="moveday-heading"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-8">
              <Kicker>Move day</Kicker>
              <SectionTitle id="moveday-heading">
                Your crew arrives in your window
              </SectionTitle>
              <BodyP>
                This is what we do — precise, insured, and communicated. You always
                know where things stand.
              </BodyP>
              <FeatureGrid items={MOVE_DAY_FEATURES} />
            </div>
          </section>

          <SubtleSectionDivider />

          {/* ── New home ── */}
          <section
            className="estate-welcome-story py-20 md:py-28"
            aria-labelledby="newhome-heading"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-8">
              <Kicker>At your new home</Kicker>
              <SectionTitle id="newhome-heading">
                When the truck arrives, the next chapter begins
              </SectionTitle>
              <BodyP>
                Unloading is not the end — it is the beginning of you actually
                living in your new space.
              </BodyP>
              <FeatureGrid items={NEW_HOME_FEATURES} />
            </div>
          </section>

          <SubtleSectionDivider />
        </>
      )}

      {/* ── Protection ── */}
      <section
        className="estate-welcome-story py-20 md:py-28"
        aria-labelledby="protect-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Your protection</Kicker>
          <SectionTitle id="protect-heading">
            Your belongings are fully covered
          </SectionTitle>
          <BodyP>
            Straightforward coverage — the details live in your agreement; here
            is the essence.
          </BodyP>
          <ul className="mt-8 space-y-3 max-w-xl">
            {PROTECTION_LINES.map((line) => (
              <li
                key={line}
                className="text-[15px] leading-relaxed pl-4 relative"
                style={{ color: ON_WINE.body }}
              >
                <span
                  className="absolute left-0 top-[0.55em] w-1.5 h-px"
                  style={{ backgroundColor: ON_WINE.kicker }}
                  aria-hidden
                />
                {line}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SubtleSectionDivider />

      {/* ── After your move ── */}
      <section
        className="estate-welcome-story py-20 md:py-28"
        aria-labelledby="after-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>After your move</Kicker>
          <SectionTitle id="after-heading">
            Our relationship does not end on move day
          </SectionTitle>
          <BodyP>
            Estate means support that continues — so small questions do not
            become big stress.
          </BodyP>
          <FeatureGrid items={AFTER_MOVE_FEATURES} />
        </div>
      </section>

      <SubtleSectionDivider />

      {/* ── FAQ ── */}
      <section
        className="estate-welcome-story py-20 md:py-28 pb-24 md:pb-32"
        aria-labelledby="faq-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Questions you might have</Kicker>
          <SectionTitle id="faq-heading">Answers, at a glance</SectionTitle>
          <div className="mt-8">
            <EstateWelcomeFaq />
          </div>
        </div>
      </section>

      {/* ── Concierge network ── */}
      <section
        className="estate-welcome-story py-12 md:py-16 border-t border-[#66143D]/20"
        aria-labelledby="concierge-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: "#66143D" }}
          >
            Beyond the Move
          </p>
          <h2
            id="concierge-heading"
            className="font-hero text-[22px] md:text-[26px] leading-tight mb-6"
            style={{ color: ON_WINE.primary }}
          >
            Our Network, at Your Service
          </h2>
          <p
            className="text-[14px] md:text-[15px] leading-relaxed mb-8 max-w-2xl"
            style={{ color: ON_WINE.secondary }}
          >
            We stay in our lane — moving is what we do, and we do it
            exceptionally well. For everything else, your coordinator can
            connect you with vetted professionals from our trusted partner
            network.
          </p>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {ESTATE_CONCIERGE_NETWORK.map((item) => (
              <div key={item.service}>
                <p
                  className="font-medium text-[14px]"
                  style={{ color: ON_WINE.primary }}
                >
                  {item.service}
                </p>
                <p
                  className="text-[12px] mt-1 leading-relaxed"
                  style={{ color: ON_WINE.muted }}
                >
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
          <p
            className="text-[11px] mt-8 leading-relaxed max-w-2xl"
            style={{ color: ON_WINE.subtle }}
          >
            Ask your coordinator about any of these services. Introductions are
            complimentary for Estate clients.
          </p>
        </div>
      </section>

      <SubtleSectionDivider />

      {/* ── Footer ── */}
      <footer
        className="estate-welcome-story py-16 md:py-20"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.12) 100%)",
        }}
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8 text-center space-y-8">
          {(coordName || coordPhone || coordEmail) && (
            <div className="space-y-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: ON_WINE.kicker }}
              >
                Your coordinator
              </p>
              {coordName ? (
                <p
                  className="font-hero text-lg"
                  style={{ color: ON_WINE.primary }}
                >
                  {coordName}
                </p>
              ) : null}
              <div className="flex flex-col sm:flex-row sm:items-center justify-center items-center gap-3 sm:gap-0 text-[14px]">
                {coordPhone ? (
                  <a
                    href={`tel:${coordPhone.replace(/\D/g, "")}`}
                    className="font-semibold underline-offset-4 hover:underline"
                    style={{ color: ON_WINE.primary }}
                  >
                    {formatPhone(coordPhone)}
                  </a>
                ) : null}
                {coordPhone && coordEmail ? (
                  <span
                    className="hidden sm:block w-px h-[1.1em] shrink-0 mx-5"
                    style={{ backgroundColor: ON_WINE.hairline }}
                    aria-hidden
                  />
                ) : null}
                {coordEmail ? (
                  <a
                    href={`mailto:${encodeURIComponent(coordEmail)}`}
                    className="font-semibold underline-offset-4 hover:underline break-all sm:max-w-none text-center sm:text-left"
                    style={{ color: ON_WINE.primary }}
                  >
                    {coordEmail}
                  </a>
                ) : null}
              </div>
            </div>
          )}

          {hasScheduledMove ? (
            <div className="pt-2">
              <Link
                href={trackUrl}
                className="inline-flex items-center gap-2 px-6 py-3.5 text-[10px] font-bold uppercase tracking-[0.14em] border transition-colors duration-300 ease-out hover:bg-[rgba(249,237,228,0.08)]"
                style={{
                  borderColor: ON_WINE.primary,
                  color: ON_WINE.primary,
                }}
              >
                Track your move
                <CaretRight size={16} weight="bold" aria-hidden />
              </Link>
            </div>
          ) : null}

          <p className="text-[13px] pt-4" style={{ color: ON_WINE.muted }}>
            Questions?{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-semibold underline-offset-4 hover:underline"
              style={{ color: ON_WINE.primary }}
            >
              {supportEmail}
            </a>
          </p>
          <p
            className="text-[11px] max-w-md mx-auto"
            style={{ color: ON_WINE.subtle }}
          >
            This page is private to your booking. Please do not share your link
            publicly.
          </p>
        </div>
      </footer>
    </div>
  );
}

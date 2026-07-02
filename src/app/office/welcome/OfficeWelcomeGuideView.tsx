import type { ReactNode } from "react";
import Link from "next/link";
import { CaretRight } from "@phosphor-icons/react/ssr";
import { formatPhone } from "@/lib/phone";
import { formatMoveDate } from "@/lib/date-format";
import YugoLogo from "@/components/YugoLogo";
import OfficeWelcomeFaq from "./[token]/OfficeWelcomeFaq";
import {
  ESTATE_WELCOME_BG as WINE_BG,
  ON_WINE,
} from "@/app/estate/welcome/estate-welcome-tokens";

function firstName(full: string | null | undefined): string {
  const t = (full || "").trim().split(/\s+/).filter(Boolean)[0];
  return t || "there";
}

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
    title: "Project manager introduction",
    description:
      "Within one business day of booking, your project manager reaches out to introduce themselves and set the shared plan.",
  },
  {
    title: "Site walkthrough at both offices",
    description:
      "In-person walkthroughs of the current and new spaces to document access, elevators, dock, floor plan, and any special-handling items.",
  },
  {
    title: "Building coordination filed",
    description:
      "Elevator, dock, and certificate-of-insurance reservations locked in with property management on both ends.",
  },
  {
    title: "IT scope call with your team",
    description:
      "Joint call with your IT lead to align on power-down, disconnection, transport, and reconnection at the workstation level.",
  },
  {
    title: "Floor plan signed off",
    description:
      "Room-by-room and desk-by-desk plan for the new office, approved by you before pack day.",
  },
  {
    title: "Move plan confirmed",
    description:
      "Detailed schedule for pack and move days delivered, crew and vehicles locked, everything ready to run.",
  },
];

const DAY_ONE_FEATURES: { title: string; description: string }[] = [
  {
    title: "After hours, no downtime",
    description:
      "Pack begins after your team logs off so nothing disrupts business hours or open decks.",
  },
  {
    title: "Workstation-level labeling",
    description:
      "Every desk contents bagged and labeled with the employee's name and destination in the new office.",
  },
  {
    title: "IT and monitors handled",
    description:
      "Screens, dock stations, and peripherals are disconnected, wrapped, and packed by our crew, coordinated with your IT lead.",
  },
  {
    title: "Files and shared spaces",
    description:
      "Filing cabinets, reception, kitchen, and meeting rooms packed with the same care and traceability as workstations.",
  },
  {
    title: "Furniture prepped for transit",
    description:
      "Desks, chairs, and casegoods disassembled where needed, wrapped in quilted blankets, and staged for a fast load-out.",
  },
];

const DAY_TWO_FEATURES: { title: string; description: string }[] = [
  {
    title: "Dedicated trucks and crew",
    description:
      "Vehicles and team reserved for your move, not shared, not rushed, protected floor to ceiling.",
  },
  {
    title: "Placed to the floor plan",
    description:
      "Every workstation, meeting room, and shared area assembled where it belongs, following the plan you signed off.",
  },
  {
    title: "IT reconnected at every desk",
    description:
      "Monitors, docks, and peripherals reconnected at the workstation level so employees plug in and go.",
  },
  {
    title: "Building protection at both ends",
    description:
      "Floor runners, corner guards, elevator pads, and doorway protection in place from arrival to departure.",
  },
  {
    title: "Real-time updates",
    description:
      "Your project manager keeps you posted through the day, and the tracking page shows live progress.",
  },
];

const AFTER_MOVE_FEATURES: { title: string; description: string }[] = [
  {
    title: "30-day project manager support",
    description:
      "Same person, same phone line. Need something adjusted after move day? A call handles it.",
  },
  {
    title: "Adjustments and re-placement",
    description:
      "Furniture moved to a different spot, workstation reshuffled, board room reset, we come back for the small stuff.",
  },
  {
    title: "Vendor introductions",
    description:
      "AV installers, cabling, signage, cleaning, we know the people, and introductions are complimentary.",
  },
];

const PROTECTION_LINES: string[] = [
  "Repair by our verified professionals or full replacement at current value.",
  "Up to $10,000 per item, $100,000 per move.",
  "Zero deductible.",
  "$5M commercial liability.",
];

const PARTNER_NETWORK: { service: string; desc: string }[] = [
  {
    service: "AV and Conference Room Install",
    desc: "Licensed integrators for wall-mounted displays, projectors, and custom AV",
  },
  {
    service: "Structured Cabling",
    desc: "Certified data and voice cabling teams for permanent runs",
  },
  {
    service: "Signage and Branding",
    desc: "Fabricators and installers for reception walls, lobby signage, and wayfinding",
  },
  {
    service: "Commercial Cleaning",
    desc: "Move-out deep cleans, move-in prep, and ongoing office housekeeping",
  },
  {
    service: "Furniture Disposal and Donation",
    desc: "Charity partners for reuse, e-waste recycling, and coordinated haul-away",
  },
  {
    service: "Interior and Space Planning",
    desc: "Commercial designers for reconfiguration, growth phases, and identity",
  },
];

export type OfficeWelcomeGuideViewProps = {
  moveCode: string;
  moveDateLabel: string | null;
  trackUrl: string;
  coordName: string | null;
  coordPhone: string | null;
  coordEmail: string | null;
  projectManagerName: string | null;
  projectManagerPhone: string | null;
  supportEmail: string;
  clientName: string | null;
  companyName: string | null;
  hasScheduledMove: boolean;
  previewBanner?: string | null;
  moveProjectSchedule?: {
    totalDays: number;
    days: { date: string; label: string; description?: string | null }[];
  } | null;
};

export default function OfficeWelcomeGuideView({
  moveCode,
  moveDateLabel,
  trackUrl,
  coordName,
  coordPhone,
  coordEmail,
  projectManagerName,
  projectManagerPhone,
  supportEmail,
  clientName,
  companyName,
  hasScheduledMove,
  previewBanner,
  moveProjectSchedule = null,
}: OfficeWelcomeGuideViewProps) {
  const greetingName = firstName(clientName);
  const displayCompany = (companyName ?? "").trim() || null;

  return (
    <div
      className="office-welcome-root min-h-screen font-sans antialiased"
      style={{ backgroundColor: WINE_BG, color: ON_WINE.primary }}
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
        <div className="office-welcome-hero-inner relative z-1 max-w-3xl mx-auto px-5 pt-12 pb-20 md:pt-16 md:pb-28 text-center">
          <div className="flex justify-center mb-4">
            <YugoLogo size={32} variant="cream" className="opacity-95" />
          </div>
          <div
            className="w-12 h-px mx-auto mb-8"
            style={{ backgroundColor: ON_WINE.hairline }}
          />
          <Kicker>Office · Priority</Kicker>
          <h1 className="font-hero text-[30px] md:text-[38px] leading-[1.15] mb-4 text-[#F9EDE4]">
            {displayCompany
              ? `Welcome to your Priority relocation, ${greetingName}.`
              : `Welcome to your Priority office move, ${greetingName}.`}
          </h1>
          <p
            className="text-[16px] md:text-[17px] leading-relaxed max-w-md mx-auto font-medium"
            style={{ color: ON_WINE.body }}
          >
            {displayCompany
              ? `${displayCompany}, handled end to end. Your team keeps working.`
              : "End to end, planned and run. Your team keeps working."}
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

      {/* ── Before your move ── */}
      <section
        className="office-welcome-story py-20 md:py-28"
        aria-labelledby="before-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Before your move</Kicker>
          <SectionTitle id="before-heading">
            What we run between now and move week
          </SectionTitle>
          <BodyP>
            Your project manager owns the full plan and coordinates with your
            team and building management directly. Here is the sequence.
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
                    backgroundColor: WINE_BG,
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
            className="office-welcome-story py-20 md:py-28"
            aria-labelledby="schedule-heading"
          >
            <div className="max-w-3xl mx-auto px-5 md:px-8">
              <p
                className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-2"
                style={{ color: ON_WINE.kicker }}
              >
                Your schedule
              </p>
              <h2
                id="schedule-heading"
                className="font-hero text-[28px] md:text-[34px] leading-tight mb-4 text-[#F9EDE4]"
              >
                {moveProjectSchedule.totalDays} days, one seamless move
              </h2>
              <BodyP>
                Your relocation is planned across multiple days. Each has a
                clear purpose and your project manager runs the full timeline.
              </BodyP>
              <div className="mt-10 space-y-8">
                {moveProjectSchedule.days.map((day, i) => (
                  <div key={`${day.date}-${i}`} className="flex gap-5">
                    <div className="flex flex-col items-center shrink-0 w-12">
                      <div
                        className="w-10 h-10 rounded-full border flex items-center justify-center"
                        style={{ borderColor: "#66143D" }}
                      >
                        <span className="text-sm font-serif text-[#F9EDE4]">
                          {i + 1}
                        </span>
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
                        style={{ color: ON_WINE.kicker }}
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
          {/* ── Day 1: Pack ── */}
          <section
            className="office-welcome-story py-20 md:py-28"
            aria-labelledby="day1-heading"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-8">
              <Kicker>Day one · Pack &amp; label</Kicker>
              <SectionTitle id="day1-heading">
                After hours, methodical, ready to move
              </SectionTitle>
              <BodyP>
                Once your team logs off, our crew begins. Every workstation
                packed and labeled, every shared space handled. You come back
                to a fully staged office ready for transit.
              </BodyP>
              <FeatureGrid items={DAY_ONE_FEATURES} />
            </div>
          </section>

          <SubtleSectionDivider />

          {/* ── Day 2: Move & set up ── */}
          <section
            className="office-welcome-story py-20 md:py-28"
            aria-labelledby="day2-heading"
          >
            <div className="max-w-4xl mx-auto px-5 md:px-8">
              <Kicker>Day two · Move &amp; setup</Kicker>
              <SectionTitle id="day2-heading">
                In the new office, laid out to plan
              </SectionTitle>
              <BodyP>
                Transport, place, assemble, reconnect. Your project manager is
                on site both days. When we hand off, employees walk in and
                sit down to work.
              </BodyP>
              <FeatureGrid items={DAY_TWO_FEATURES} />
            </div>
          </section>

          <SubtleSectionDivider />
        </>
      )}

      {/* ── Protection ── */}
      <section
        className="office-welcome-story py-20 md:py-28"
        aria-labelledby="protect-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Your protection</Kicker>
          <SectionTitle id="protect-heading">
            Business assets, fully covered
          </SectionTitle>
          <BodyP>
            The full detail lives in your agreement. Here is the essence.
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

      {/* ── After the move ── */}
      <section
        className="office-welcome-story py-20 md:py-28"
        aria-labelledby="after-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>After your move</Kicker>
          <SectionTitle id="after-heading">
            The relationship does not end on move day
          </SectionTitle>
          <BodyP>
            Priority means the same project manager stays with you for 30 days,
            so small fixes stay small.
          </BodyP>
          <FeatureGrid items={AFTER_MOVE_FEATURES} />
        </div>
      </section>

      <SubtleSectionDivider />

      {/* ── FAQ ── */}
      <section
        className="office-welcome-story py-20 md:py-28 pb-24 md:pb-32"
        aria-labelledby="faq-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <Kicker>Questions you might have</Kicker>
          <SectionTitle id="faq-heading">Answers, at a glance</SectionTitle>
          <div className="mt-8">
            <OfficeWelcomeFaq />
          </div>
        </div>
      </section>

      {/* ── Partner network ── */}
      <section
        className="office-welcome-story py-12 md:py-16 border-t border-[#66143D]/20"
        aria-labelledby="partners-heading"
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8">
          <p
            className="text-[11px] font-semibold tracking-[0.2em] uppercase mb-3"
            style={{ color: ON_WINE.kicker }}
          >
            Beyond the Move
          </p>
          <h2
            id="partners-heading"
            className="font-hero text-[22px] md:text-[26px] leading-tight mb-6"
            style={{ color: ON_WINE.primary }}
          >
            Our Network, at Your Service
          </h2>
          <p
            className="text-[14px] md:text-[15px] leading-relaxed mb-8 max-w-2xl"
            style={{ color: ON_WINE.secondary }}
          >
            Moving is what we do. For the finishing touches around your new
            office, your project manager can connect you with vetted
            professionals from our trusted network.
          </p>
          <div className="grid md:grid-cols-2 gap-6 md:gap-8">
            {PARTNER_NETWORK.map((item) => (
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
            Ask your project manager about any of these services. Introductions
            are complimentary for Priority clients.
          </p>
        </div>
      </section>

      <SubtleSectionDivider />

      {/* ── Footer ── */}
      <footer
        className="office-welcome-story py-16 md:py-20"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.12) 100%)",
        }}
      >
        <div className="max-w-4xl mx-auto px-5 md:px-8 text-center space-y-10">
          {(projectManagerName || projectManagerPhone) && (
            <div className="space-y-3">
              <p
                className="text-[11px] font-semibold uppercase tracking-[0.12em]"
                style={{ color: ON_WINE.kicker }}
              >
                Your project manager
              </p>
              {projectManagerName ? (
                <p
                  className="font-hero text-lg"
                  style={{ color: ON_WINE.primary }}
                >
                  {projectManagerName}
                </p>
              ) : null}
              {projectManagerPhone ? (
                <a
                  href={`tel:${projectManagerPhone.replace(/\D/g, "")}`}
                  className="inline-block font-semibold underline-offset-4 hover:underline text-[14px]"
                  style={{ color: ON_WINE.primary }}
                >
                  {formatPhone(projectManagerPhone)}
                </a>
              ) : null}
            </div>
          )}

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

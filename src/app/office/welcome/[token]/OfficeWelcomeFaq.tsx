import { ON_WINE } from "@/app/estate/welcome/estate-welcome-tokens";

const ROSE = "#66143D";

const OFFICE_FAQ: {
  category: string;
  questions: { q: string; a: string }[];
}[] = [
  {
    category: "Before Your Move",
    questions: [
      {
        q: "What do we need to do to prepare?",
        a: "Very little. Your project manager runs a pre-move walkthrough of both spaces, confirms elevator and dock reservations with building management, and coordinates directly with your IT lead on power-down and reconnection timing. Your team keeps working through the day before we arrive.",
      },
      {
        q: "What do employees need to pack themselves?",
        a: "Only personal items they want on their desk when they arrive at the new office, laptop bags, headphones, framed photos. Our team handles the rest, workstation contents, monitors, dock stations, files, kitchen, and reception. We label everything by destination so nothing lands in the wrong room.",
      },
      {
        q: "How much notice do we need for building access?",
        a: "Most buildings require 5 to 10 business days for elevator and dock reservations, and some require a certificate of insurance filed in advance. Your project manager handles the paperwork with property management on both ends, so you do not chase forms.",
      },
      {
        q: "Can we phase the move around business hours?",
        a: "Yes. Priority moves are commonly scheduled evenings and weekends to minimize downtime. Day one is typically pack and label after your team logs off, and day two is transport and setup so Monday morning starts in the new office. Your project manager will confirm the exact schedule with you and building management.",
      },
      {
        q: "Do you provide a floor plan for the new office?",
        a: "Yes. We work from a room-by-room and desk-by-desk plan you sign off on before pack day. Every workstation, meeting room, and shared area is mapped so our crew places things exactly where they need to be, and your employees walk into a fully arranged workspace.",
      },
    ],
  },
  {
    category: "IT and Equipment",
    questions: [
      {
        q: "Do you disconnect and reconnect our IT equipment?",
        a: "We disconnect and pack IT equipment, monitors, dock stations, PCs, printers, and reconnect it at the workstation level in the new office. For server room migration, network hand-off, and any structured cabling, we work in tandem with your IT team or vendor. Your project manager runs a joint call with your IT lead in the week before the move so everyone is clear on scope.",
      },
      {
        q: "How are cables and adapters kept organized?",
        a: "Every workstation is bagged and labeled with the employee's name and destination. Cables, adapters, and small peripherals stay with the monitor or dock they belong to, so reconnection at the new desk is straightforward and nothing goes missing.",
      },
      {
        q: "What about our server room?",
        a: "Server room migrations require coordination between our crew and your IT team or managed service provider. We handle physical transport with anti-static wrapping and secure racks in the truck. Your IT team handles the shutdown, network cutover, and startup sequence. Your project manager builds a joint checklist so the two efforts stay in sync.",
      },
      {
        q: "Do you handle AV and conference room equipment?",
        a: "We disconnect, pack, and reinstall standard AV equipment, TVs, projectors, conference phones, control panels. For custom AV integration or wall-mounted displays that require licensed installers, your project manager can connect you with vetted partners for same-day or next-day reinstall.",
      },
    ],
  },
  {
    category: "Move Day",
    questions: [
      {
        q: "Who is on site, and who runs the day?",
        a: "Your project manager is on site for both days as the single point of contact. Our dedicated crew is professionally trained, background-checked, and directly employed by Yugo, we do not use day labour or subcontractors. You get one team from pack to setup.",
      },
      {
        q: "How are floors, walls, and elevators protected?",
        a: "Full floor runners, corner protectors, elevator pads, and door frame guards at both buildings, coordinated with property management in advance. All included, no extra charge.",
      },
      {
        q: "What happens if a building overruns its window?",
        a: "Your project manager stays in contact with property management on both ends and adjusts on the fly. Priority moves are quoted with buffer built into the plan, so a delayed elevator does not become a schedule crisis. If a window is missed for reasons outside our control, we work with you and the building to find the next available slot.",
      },
      {
        q: "What about after-hours or weekend work?",
        a: "Priority includes evenings and weekends at no additional cost. This is often the right choice for offices that want zero downtime, we pack Friday evening, move Saturday, set up Sunday, and your team walks into the new office Monday morning.",
      },
    ],
  },
  {
    category: "Protection and Support",
    questions: [
      {
        q: "What happens if something is damaged?",
        a: "Priority includes enhanced valuation coverage, repair by verified professionals or full replacement at current value. Per-item coverage up to $10,000 and per-move up to $100,000 with zero deductible. We carry $5M commercial liability. Report any concern within 48 hours and we resolve claims within 10 business days.",
      },
      {
        q: "What is included in the 30-day support window?",
        a: "For 30 days after the move, your project manager remains your point of contact for any adjustments, workstation repositioning, small follow-ups, help sourcing partners for finishing touches. This is not a call center, it is the same person who ran your move.",
      },
      {
        q: "Do you handle disposal of old furniture?",
        a: "Yes. We coordinate donation pickup through our charity partners, recycling for e-waste, or disposal, whichever fits your situation. Your project manager can arrange this before, during, or after the move.",
      },
      {
        q: "Do you provide temporary storage?",
        a: "Yes. Our secure warehouse can hold office furniture and equipment for days, weeks, or months while your new space is finished. Storage is billed at a daily rate and items remain fully insured under your Priority coverage.",
      },
    ],
  },
  {
    category: "Billing and Scheduling",
    questions: [
      {
        q: "Can we change our move date?",
        a: "Yes. Contact your project manager. Reschedules with 5 or more business days notice are free. Inside that window, rescheduling fees may apply based on crew, truck, and building reservations. Your project manager will always discuss any fees before confirming.",
      },
      {
        q: "When is the balance due?",
        a: "Your deposit secures your dates. The remaining balance is charged to the card on file 48 hours before the first move day. You will receive a reminder before the charge is processed.",
      },
      {
        q: "What if scope changes between now and move day?",
        a: "Contact your project manager as soon as anything shifts, additional workstations, added floor, updated timing. If the change affects crew, trucks, or building windows, we will walk you through any pricing impact and confirm in writing before proceeding.",
      },
    ],
  },
];

export default function OfficeWelcomeFaq() {
  return (
    <>
      {OFFICE_FAQ.map((group) => (
        <div key={group.category} className="mb-10 last:mb-0">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4"
            style={{ color: ON_WINE.kicker }}
          >
            {group.category}
          </h3>
          <div className="space-y-2">
            {group.questions.map((item) => (
              <details
                key={item.q}
                className="group rounded-lg border overflow-hidden"
                style={{ borderColor: `${ROSE}33` }}
              >
                <summary
                  className="flex cursor-pointer list-none items-center justify-between gap-3 p-4 text-left select-none transition-colors rounded-lg hover:bg-[#66143D]/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#66143D]/40 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2B0416] [&::-webkit-details-marker]:hidden"
                  style={{ color: ON_WINE.primary }}
                >
                  <span className="font-semibold text-[14px] pr-4">
                    {item.q}
                  </span>
                  <span
                    className="shrink-0 text-xl leading-none transition-transform duration-200 group-open:rotate-45"
                    style={{ color: ON_WINE.kicker }}
                    aria-hidden
                  >
                    +
                  </span>
                </summary>
                <div className="px-4 pb-4">
                  <p
                    className="text-[13px] leading-relaxed max-w-2xl"
                    style={{ color: ON_WINE.secondary }}
                  >
                    {item.a}
                  </p>
                </div>
              </details>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

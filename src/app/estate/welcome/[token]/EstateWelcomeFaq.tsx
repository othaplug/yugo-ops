import { ON_WINE } from "../estate-welcome-tokens";

const ROSE = "#66143D";

const ESTATE_FAQ: { category: string; questions: { q: string; a: string }[] }[] =
  [
    {
      category: "Preparing for Your Move",
      questions: [
        {
          q: "What should I do to prepare?",
          a: "Nothing. That is the point of Estate. Our team handles packing, wrapping, and protection. If there are items you would prefer to keep with you — jewelry, medications, important documents — set those aside. Everything else is ours to handle.",
        },
        {
          q: "Do I need to be home on pack day?",
          a: "You are welcome to be present, but it is not required. Many clients prefer to step out and return to a fully packed home. If you will not be home, your coordinator will arrange secure access with you in advance and keep you updated throughout the day.",
        },
        {
          q: "How long does the packing take? How long is the move?",
          a: "Your Estate move is typically two days. Day one is packing — our team wraps, boxes, and labels every item in your home, usually in 5 to 7 hours depending on the size. Day two is the move itself — loading, transport, placement, unpacking, and debris removal, usually 6 to 8 hours. Your coordinator will provide a detailed schedule specific to your home.",
        },
        {
          q: "Can I add items after the quote is finalized?",
          a: "Yes. Contact your coordinator with the details and we will adjust the scope. If additional items affect the crew size, truck, or time required, your coordinator will walk you through any pricing changes and get your approval before proceeding. There are no surprises.",
        },
        {
          q: "What about my pets or plants?",
          a: "For the safety of your pets and our crew, we ask that pets are secured or cared for elsewhere on move day. We do not transport living animals or plants — but your coordinator can help arrange pet transport or plant care through our network if needed.",
        },
        {
          q: "What if I have items in multiple locations?",
          a: "We regularly handle multi-location moves — a main home, a storage unit, a second property. Each pickup location is built into your move plan with its own timeline. Your coordinator will map the most efficient route and schedule for your crew.",
        },
      ],
    },
    {
      category: "During Your Move",
      questions: [
        {
          q: "How are my belongings protected during transit?",
          a: "Every piece of furniture is individually wrapped in quilted moving blankets and secured with stretch wrap. Fragile items receive additional foam and corner protection. Mattresses and TVs get dedicated covers. Our trucks are clean, climate-protected, and equipped with air-ride suspension to minimize vibration. Floor runners and door frame guards protect both your homes.",
        },
        {
          q: "How do you handle fine art, antiques, and high-value pieces?",
          a: "Estate includes premium art and antique handling — museum-grade wrapping, custom padding, and careful transport by crew members trained in high-value item handling. For pieces requiring custom crating, your coordinator will arrange this in advance. We ask that you disclose all high-value items before move day so we can plan the appropriate handling and coverage.",
        },
        {
          q: "Can you move a wine collection?",
          a: "Yes. Wine collections require careful handling due to temperature sensitivity and fragility. We pack bottles individually, use insulated containers, and transport them upright. For large collections or rare vintages, your coordinator will plan dedicated handling. Please declare your collection during the pre-move walkthrough so we can prepare accordingly.",
        },
        {
          q: "What about my piano, safe, or pool table?",
          a: "Specialty items like pianos, safes, and pool tables require specific equipment and expertise. These are handled as part of your Estate move with dedicated crew members who specialize in heavy and complex items. Upright pianos, safes under 500 lbs, and standard items are included. Grand pianos, slate pool tables, and items requiring disassembly by a certified technician are quoted separately — your coordinator will confirm during the walkthrough.",
        },
        {
          q: "What about chandeliers and light fixtures?",
          a: "We carefully disconnect, wrap, and transport chandeliers and light fixtures. Reinstallation at your new home involves electrical work, which falls outside our scope for safety and licensing reasons. Your coordinator can connect you with a licensed electrician from our vetted partner network to have fixtures reinstalled on or shortly after move day.",
        },
        {
          q: "Do you disconnect and reconnect appliances?",
          a: "We disconnect standard appliances like washers, dryers, and dishwashers as part of your Estate move. Reconnection of water lines and gas connections requires a licensed plumber or gas fitter, which we do not perform for safety and regulatory reasons. Your coordinator can arrange a licensed technician from our network to handle reconnections at your new home.",
        },
        {
          q: "What happens if the move takes longer than expected?",
          a: "Your quoted price is guaranteed. Whether the move takes four hours or eight, the price does not change. Estate is a flat rate — not hourly. The only scenario where costs adjust is if the scope changes significantly from what was quoted, and any adjustment requires your written approval before proceeding.",
        },
        {
          q: "Who will be in my home? Are your crew vetted?",
          a: "Every Yugo crew member is professionally trained, fully insured, and background-checked. Your Estate move uses a dedicated team — the same people from start to finish. We do not use day labourers or subcontractors. Your coordinator will introduce your crew before move day so you know exactly who will be in your home.",
        },
      ],
    },
    {
      category: "At Your New Home",
      questions: [
        {
          q: "Do you mount TVs and wall art?",
          a: "Our focus is the move itself — transporting and placing your belongings with care. We do not mount TVs, mirrors, or wall art, as this requires specialized hardware, stud-finding, and carries liability for wall damage. However, your coordinator can arrange a professional installer from our vetted network, often for the same day or the day after your move. We will place your TV and art exactly where you want them so the installer simply mounts what is already in position.",
        },
        {
          q: "Do you organize closets, kitchens, and rooms?",
          a: "Estate includes thoughtful placement and light organization — your kitchen items go to the kitchen, books to the shelves, wardrobes are hung in closets. The goal is for you to feel settled, not still moving, when we leave. For full professional organization — drawer systems, closet design, pantry optimization — your coordinator can connect you with a certified professional organizer from our partner network.",
        },
        {
          q: "Do you offer interior design or styling services?",
          a: "We are movers, not designers — and we believe in staying in our lane. That said, we work closely with several of Toronto's leading interior designers and can make an introduction if you are looking for design support at your new home. Many of our Estate clients work with designers, and we coordinate directly with their teams for seamless furniture placement.",
        },
        {
          q: "Do you offer cleaning services?",
          a: "We do not provide cleaning services, but we understand that both your old and new home may need attention before and after the move. Your coordinator can connect you with trusted cleaning professionals in our network — whether you need a move-out deep clean, a pre-move-in refresh, or ongoing housekeeping at your new home.",
        },
        {
          q: "What happens with items that will not fit in my new home?",
          a: "If during the move we discover that certain pieces do not fit or you decide they are no longer needed, we can arrange temporary storage at our facility, coordinate donation pickup through our charity partners, or assist with disposal. Your coordinator will handle the logistics so you can focus on settling in.",
        },
        {
          q: "Can I request the same crew for future moves?",
          a: "Absolutely. Many of our Estate clients develop a preference for specific crew members. Let your coordinator know and we will do our best to assign the same team for any future services — whether that is another move, a delivery, or furniture rearrangement.",
        },
      ],
    },
    {
      category: "Protection and Support",
      questions: [
        {
          q: "What happens if something is damaged?",
          a: "Your Estate package includes full replacement valuation — repair by a verified professional, replacement with an equivalent item at current market value, or a full cash settlement. Per-item coverage up to $10,000 and per move up to $100,000 with zero deductible. Report any concern within 48 hours through your tracking page or by contacting your coordinator directly. We resolve all claims within 10 business days.",
        },
        {
          q: "What is included in the 30-day concierge support?",
          a: "For 30 days after your move, your coordinator remains available for questions, adjustments, and support. Need a piece of furniture moved to a different room? Want to rearrange the living room layout? Have a question about an item you cannot find? Your coordinator is a call or text away. This is not a call center — it is the same person who managed your move from day one.",
        },
        {
          q: "What if my new home is not ready on move day?",
          a: "If your new home is not ready — construction delays, closing issues, or other circumstances — your coordinator will work with you on options. We offer short-term storage at our facility, and your move can be rescheduled at no additional cost with adequate notice. Your belongings are fully insured while in our care.",
        },
        {
          q: "Do you provide temporary storage?",
          a: "Yes. Our secure, climate-controlled facility can hold your belongings for days, weeks, or months. Storage is billed at a daily rate and your items remain fully insured under your Estate coverage. Your coordinator can arrange pickup and delivery from storage when you are ready.",
        },
      ],
    },
    {
      category: "Pricing and Payment",
      questions: [
        {
          q: "Can I change my move date?",
          a: "Yes. Contact your coordinator directly. Reschedules with 48 or more hours notice are free. Within 48 hours, a rescheduling fee may apply depending on crew and truck availability. Your coordinator will always discuss any fees before confirming the change.",
        },
        {
          q: "What does the guaranteed flat price mean?",
          a: "The price on your quote is the price you pay — regardless of how long the move takes. We do not charge by the hour. If the move takes longer than we estimated, the cost to you does not change. The only scenario where the price adjusts is if the scope of the move differs significantly from what was quoted — additional items, different access conditions, or changes you request on move day. Any adjustment requires your written approval first.",
        },
        {
          q: "When is the balance due?",
          a: "Your deposit secures your date. The remaining balance is due 48 hours before your move date. We charge the card on file according to the payment terms in your agreement. You will receive a reminder before the charge is processed.",
        },
      ],
    },
  ];

export default function EstateWelcomeFaq() {
  return (
    <>
      {ESTATE_FAQ.map((group) => (
        <div key={group.category} className="mb-10 last:mb-0">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.15em] mb-4"
            style={{ color: ROSE }}
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
                  <span className="font-semibold text-[14px] pr-4">{item.q}</span>
                  <span
                    className="shrink-0 text-xl leading-none transition-transform duration-200 group-open:rotate-45"
                    style={{ color: ROSE }}
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

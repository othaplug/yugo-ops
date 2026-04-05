import { CaretDown } from "@phosphor-icons/react/ssr";
import { ON_WINE } from "../estate-welcome-tokens";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "What should I do to prepare?",
    a: "Nothing. That is the point of Estate. Our team handles packing, wrapping, and protection. If there are items you would prefer to keep with you — jewelry, medications, important documents — set those aside. Everything else is ours to handle.",
  },
  {
    q: "What happens if something is damaged?",
    a: "Your Estate package includes repair by our verified professionals or full replacement valuation, per your agreement. Report any concern within 48 hours — we resolve it through repair, replacement, or cash settlement.",
  },
  {
    q: "Can I change my move date?",
    a: "Yes. Contact your coordinator. Reschedules with 48+ hours notice are free. Within 48 hours, a rescheduling fee may apply.",
  },
  {
    q: "Do I need to be home on pack day?",
    a: "Not required, but many clients prefer to be present. Your coordinator will discuss access arrangements that work for you.",
  },
  {
    q: "What about my pets or plants?",
    a: "We do not transport living things, but your coordinator can help arrange care or transport through our partners.",
  },
];

const rule = ON_WINE.rule;

export default function EstateWelcomeFaq() {
  return (
    <>
      {ITEMS.map((item, i) => (
        <details
          key={item.q}
          className={`group py-4 md:py-5 border-b ${i === 0 ? "border-t" : ""}`}
          style={{ borderColor: rule }}
        >
          <summary
            className="flex cursor-pointer list-none items-center justify-between gap-3 text-left font-semibold text-[14px] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#2B0416] rounded-sm -mx-1 px-1"
            style={{ color: ON_WINE.primary }}
          >
            <span>{item.q}</span>
            <CaretDown
              className="shrink-0 transition-transform group-open:rotate-180"
              size={18}
              weight="bold"
              aria-hidden
            />
          </summary>
          <p
            className="mt-3 text-[13px] leading-relaxed max-w-2xl"
            style={{ color: ON_WINE.secondary }}
          >
            {item.a}
          </p>
        </details>
      ))}
    </>
  );
}

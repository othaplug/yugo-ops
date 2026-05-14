import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoveDate } from "@/lib/date-format";
import { TIER_LABELS } from "@/lib/displayLabels";
import { getCompanyPhone, getCompanyEmail } from "@/lib/config";
import YugoMarketingFooter from "@/components/YugoMarketingFooter";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ quoteId: string }>;
}) {
  const { quoteId } = await params;
  return { title: `Booking confirmed · ${quoteId}` };
}

/**
 * Standalone booking confirmation page.
 *
 * The quote page (/quote/[quoteId]) is for *choosing*. Once a deposit has been
 * paid, the client should land here — a dedicated confirmation surface that
 * shows the booked tier, the move date, addresses, and what happens next.
 *
 * Reached via:
 * 1. Client-side `router.replace()` from the quote page's payment onSuccess
 * 2. Direct revisit of the URL by the client (we serve from `accepted` status)
 *
 * If the quote isn't in an accepted/booked state, we either redirect to the
 * quote page (so the client can still book) or 404 if it doesn't exist.
 */
export default async function QuoteConfirmedPage({
  params,
  searchParams,
}: {
  params: Promise<{ quoteId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { quoteId } = await params;
  const sp = (await searchParams) ?? {};
  const tierFromQuery = Array.isArray(sp.tier) ? sp.tier[0] : sp.tier;

  const sb = createAdminClient();
  const { data: quote, error } = await sb
    .from("quotes")
    .select(
      "quote_id, status, service_type, move_date, from_address, to_address, recommended_tier, selected_tier, contact_id",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error || !quote) notFound();

  // Allow the page only for accepted bookings. If the quote isn't booked yet,
  // bounce back to the quote so the client can complete payment.
  if (quote.status !== "accepted") {
    redirect(`/quote/${quoteId}`);
  }

  // Pull client name from contacts. Quote rows hold contact_id, not name.
  let clientFirstName = "";
  if (quote.contact_id) {
    const { data: contact } = await sb
      .from("contacts")
      .select("name")
      .eq("id", quote.contact_id)
      .maybeSingle();
    const fullName = ((contact?.name as string | null) ?? "").trim();
    clientFirstName = fullName.split(/\s+/)[0] || "";
  }

  const tierKey = (
    tierFromQuery ||
    quote.selected_tier ||
    quote.recommended_tier ||
    ""
  )
    .toString()
    .toLowerCase();
  const tierLabel = TIER_LABELS[tierKey] ?? "";

  const moveDateStr = quote.move_date ? formatMoveDate(String(quote.move_date)) : "";
  const serviceVerb =
    quote.service_type === "office_move"
      ? "relocation"
      : quote.service_type === "b2b_delivery" ||
        quote.service_type === "b2b_oneoff" ||
        quote.service_type === "single_item" ||
        quote.service_type === "white_glove"
      ? "delivery"
      : "move";

  const [supportPhone, supportEmail] = await Promise.all([
    getCompanyPhone(),
    getCompanyEmail(),
  ]);

  return (
    <div className="min-h-screen bg-[#F9EDE4]">
      {/* Header */}
      <div className="bg-[#2B0416] px-6 py-12 text-center">
        <p className="text-[10px] tracking-[0.32em] text-[#F9EDE4]/55 uppercase mb-6 font-medium">
          Yugo
        </p>
        <div className="w-10 h-10 rounded-full bg-[#F9EDE4]/10 border border-[#F9EDE4]/20 flex items-center justify-center mx-auto mb-4">
          <svg
            viewBox="0 0 20 20"
            fill="none"
            className="w-5 h-5"
            aria-hidden
          >
            <path
              d="M4 10l4 4 8-8"
              stroke="#F9EDE4"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h1 className="font-serif text-[28px] md:text-[32px] text-[#F9EDE4] mb-2 leading-tight">
          You&apos;re booked.
        </h1>
        <p className="text-[13px] text-[#F9EDE4]/65 max-w-sm mx-auto">
          {clientFirstName ? `${clientFirstName}, your` : "Your"}
          {moveDateStr ? ` ${moveDateStr}` : ""} {serviceVerb} is confirmed.
        </p>
      </div>

      <div className="max-w-md mx-auto px-6 py-8 space-y-4">
        {/* Booking summary */}
        <div className="bg-white rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#2B0416]/45 mb-3 font-semibold">
            Booking summary
          </p>
          <div className="space-y-2.5 text-[13px]">
            <SummaryRow label="Quote" value={quote.quote_id} mono />
            {tierLabel && <SummaryRow label="Package" value={tierLabel} />}
            {moveDateStr && (
              <SummaryRow
                label={serviceVerb === "delivery" ? "Delivery date" : "Move date"}
                value={moveDateStr}
              />
            )}
            {quote.from_address && (
              <SummaryRow
                label="From"
                value={String(quote.from_address)}
                align="right"
              />
            )}
            {quote.to_address && (
              <SummaryRow
                label="To"
                value={String(quote.to_address)}
                align="right"
              />
            )}
          </div>
        </div>

        {/* What happens next */}
        <div className="bg-white rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#2B0416]/45 mb-4 font-semibold">
            What happens next
          </p>
          <div className="space-y-3.5">
            <NextStep
              step="1"
              title="Confirmation email on its way"
              body="Check your inbox for your booking details."
            />
            <NextStep
              step="2"
              title="Your coordinator will be in touch"
              body={
                moveDateStr
                  ? `Expect a message 48–72 hours before ${moveDateStr} to confirm the details.`
                  : "Expect a message a few days before to confirm the details."
              }
            />
            <NextStep
              step="3"
              title="Prepare your space"
              body="We may send a quick photo request to help us plan."
            />
          </div>
        </div>

        {/* Contact */}
        <div className="text-center pt-2 pb-1">
          <p className="text-[11px] text-[#2B0416]/55">
            Questions? Contact your coordinator
            {supportEmail ? (
              <>
                {" or "}
                <a
                  href={`mailto:${supportEmail}`}
                  className="text-[#66143D] underline underline-offset-2 hover:opacity-80"
                >
                  {supportEmail}
                </a>
              </>
            ) : null}
            {supportPhone ? (
              <>
                {" "}or{" "}
                <a
                  href={`tel:${supportPhone.replace(/\s+/g, "")}`}
                  className="text-[#66143D] underline underline-offset-2 hover:opacity-80"
                >
                  {supportPhone}
                </a>
              </>
            ) : null}
            .
          </p>
          <p className="text-[11px] text-[#2B0416]/40 mt-3">
            <Link
              href={`/quote/${quote.quote_id}?view=1`}
              className="underline underline-offset-2 hover:opacity-80"
            >
              View original quote
            </Link>
          </p>
        </div>

        <footer className="pt-4">
          <YugoMarketingFooter
            contactEmail={supportEmail}
            logoVariant="black"
            onLightBackground
            logoSize={14}
            mutedColor="rgba(43, 4, 22, 0.55)"
            linkColor="#66143D"
          />
        </footer>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  mono,
  align,
}: {
  label: string;
  value: string;
  mono?: boolean;
  align?: "right";
}) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-[#2B0416]/55 shrink-0">{label}</span>
      <span
        className={`text-[#2B0416] ${mono ? "font-mono" : ""} ${
          align === "right" ? "text-right max-w-[62%]" : ""
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function NextStep({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="flex gap-3">
      <div className="w-5 h-5 rounded-full bg-[#2B0416] text-[#F9EDE4] text-[10px] font-semibold flex items-center justify-center shrink-0 mt-0.5">
        {step}
      </div>
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#2B0416] leading-snug">
          {title}
        </p>
        <p className="text-[11px] text-[#2B0416]/55 mt-0.5 leading-relaxed">
          {body}
        </p>
      </div>
    </div>
  );
}

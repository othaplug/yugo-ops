import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMoveDate } from "@/lib/date-format";
import { getCompanyPhone, getCompanyEmail } from "@/lib/config";
import YugoLogo from "@/components/YugoLogo";

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
 * Booked-quote confirmation page — the "editorial reservation letter."
 *
 * Brand alignment (Yugo brandbook 2026):
 *   - Palette: Premium Wine (#2B0416) hero on Off White (#F9EDE4) page.
 *     Rose (#66143D) for accent eyebrows; Leather (#492A1D) for the
 *     coordinator-anchor block; Deep Green never on this surface.
 *   - Typography: Instrument Serif (font-hero) for editorial headlines,
 *     Brown (var(--font-body), inherited default) for paragraphs. No
 *     Google Font imports — everything is already wired.
 *   - Logo: real Yugo mark via <YugoLogo>. Never substitute a plain "Y".
 *   - Email: single support address from getCompanyEmail (info@helloyugo.com).
 *   - Coordinator: first name only (e.g. "Jon"), phone + email as
 *     inline typographic details; no italic pull-quote, no "A word
 *     from Jon" step in the days-ahead list.
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
      "quote_id, status, service_type, move_date, from_address, to_address, additional_origins, additional_destinations, recommended_tier, selected_tier, contact_id, custom_price",
    )
    .eq("quote_id", quoteId)
    .maybeSingle();

  if (error || !quote) notFound();

  if (quote.status !== "accepted") {
    redirect(`/quote/${quoteId}`);
  }

  // Client first name — used as the personal opening.
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

  // Coordinator lookup — the accepted quote should have a linked move row
  // with coordinator_name (backfill runs at booking). First name only per
  // brand voice: signed letters use given names, not full names.
  const { data: linkedMove } = await sb
    .from("moves")
    .select("coordinator_name, coordinator_phone, coordinator_email")
    .eq("quote_id", quote.quote_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const coordinatorFirstName =
    ((linkedMove?.coordinator_name as string | null) ?? "").trim().split(/\s+/)[0] || "";
  const coordinatorPhone =
    (linkedMove?.coordinator_phone as string | null) ?? null;
  const coordinatorEmail =
    (linkedMove?.coordinator_email as string | null) ?? null;

  const tierKey = (
    tierFromQuery ||
    quote.selected_tier ||
    quote.recommended_tier ||
    ""
  )
    .toString()
    .toLowerCase();

  const moveDateStr = quote.move_date
    ? formatMoveDate(String(quote.move_date))
    : "";
  const isDelivery =
    quote.service_type === "b2b_delivery" ||
    quote.service_type === "b2b_oneoff" ||
    quote.service_type === "single_item";
  const isOffice = quote.service_type === "office_move";
  const isWhiteGlove = quote.service_type === "white_glove";
  const serviceNoun = isOffice
    ? "relocation"
    : isWhiteGlove
      ? "white glove service"
      : isDelivery
        ? "delivery"
        : "move";
  const dateRowLabel = isDelivery
    ? "Delivery date"
    : isWhiteGlove
      ? "Service date"
      : isOffice
        ? "Move-in date"
        : "Move date";

  const [supportPhone, supportEmail] = await Promise.all([
    getCompanyPhone(),
    getCompanyEmail(),
  ]);

  const pickups: string[] = [];
  if (quote.from_address) pickups.push(String(quote.from_address));
  const extraPickups = Array.isArray(
    (quote as { additional_origins?: { address?: string }[] | null })
      .additional_origins,
  )
    ? ((quote as { additional_origins: { address?: string }[] })
        .additional_origins)
    : [];
  for (const s of extraPickups) {
    const a = (s?.address ?? "").trim();
    if (a) pickups.push(a);
  }
  const dropoffs: string[] = [];
  if (quote.to_address) dropoffs.push(String(quote.to_address));
  const extraDropoffs = Array.isArray(
    (quote as {
      additional_destinations?: { address?: string }[] | null;
    }).additional_destinations,
  )
    ? ((quote as { additional_destinations: { address?: string }[] })
        .additional_destinations)
    : [];
  for (const s of extraDropoffs) {
    const a = (s?.address ?? "").trim();
    if (a) dropoffs.push(a);
  }

  const eyebrowService = isOffice
    ? "Office relocation"
    : isWhiteGlove
      ? "White Glove"
      : isDelivery
        ? "Delivery"
        : tierKey
          ? `${tierKey[0].toUpperCase()}${tierKey.slice(1)} service`
          : "Reservation";

  const [addrPrimary1, addrPrimary2] = splitAddress(pickups[0] ?? "");
  const [addrSecondary1, addrSecondary2] = splitAddress(dropoffs[0] ?? "");

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F9EDE4" }}>
      {/* ═══════════ Wine hero — editorial ═══════════ */}
      <section
        className="text-center px-6 pt-16 pb-20 md:pt-20 md:pb-24"
        style={{ backgroundColor: "#2B0416", color: "#F9EDE4" }}
      >
        <div className="mx-auto max-w-[640px]">
          <div className="flex justify-center mb-10">
            <YugoLogo size={22} variant="cream" />
          </div>

          <p
            className="text-[10px] mb-6"
            style={{ letterSpacing: "0.32em", color: "rgba(249,237,228,0.55)" }}
          >
            RESERVED · {String(quote.quote_id).replace(/^YG-/, "NO. ")}
          </p>

          <h1
            className="font-hero mb-2"
            style={{
              fontSize: "clamp(44px, 8.5vw, 76px)",
              letterSpacing: "-0.02em",
              lineHeight: 1.02,
              color: "#F9EDE4",
            }}
          >
            {clientFirstName ? `${clientFirstName}, ` : ""}
            <span style={{ fontStyle: "italic", color: "#E0B4C6" }}>
              it is arranged.
            </span>
          </h1>

          <p
            className="mx-auto mt-8"
            style={{
              maxWidth: "480px",
              fontSize: "14.5px",
              color: "rgba(249,237,228,0.72)",
              lineHeight: 1.75,
              fontWeight: 300,
            }}
          >
            Your {moveDateStr ? <span style={{ color: "#E0B4C6" }}>{moveDateStr}</span> : "upcoming"} {serviceNoun} is on the calendar.
            Everything from this point onward rests with us.
          </p>
        </div>
      </section>

      {/* ═══════════ Reservation ═══════════ */}
      <section className="px-6 pt-20 md:pt-24">
        <div className="mx-auto max-w-[640px]">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-6 mb-12">
            <span
              className="h-px block"
              style={{ backgroundColor: "rgba(102,20,61,0.35)" }}
            />
            <span
              className="text-[10px]"
              style={{ letterSpacing: "0.28em", color: "#66143D" }}
            >
              THE RESERVATION
            </span>
            <span
              className="h-px block"
              style={{ backgroundColor: "rgba(102,20,61,0.35)" }}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-y-12 gap-x-16">
            <ResRow label="Service" head={eyebrowService} sub={serviceCopy(quote.service_type, tierKey)} />
            {moveDateStr && (
              <ResRow
                label={dateRowLabel}
                head={moveDateStr}
                sub="Arrival window shared soon"
              />
            )}
            {pickups[0] && (
              <ResRow
                label={pickups.length > 1 ? `From · 1 of ${pickups.length}` : "From"}
                head={addrPrimary1 || pickups[0]}
                sub={addrPrimary2 || undefined}
              />
            )}
            {dropoffs[0] && (
              <ResRow
                label={dropoffs.length > 1 ? `To · 1 of ${dropoffs.length}` : "To"}
                head={addrSecondary1 || dropoffs[0]}
                sub={addrSecondary2 || undefined}
              />
            )}
            {pickups.slice(1).map((addr, i) => {
              const [p1, p2] = splitAddress(addr);
              return (
                <ResRow
                  key={`p-${i}`}
                  label={`Pickup ${i + 2}`}
                  head={p1 || addr}
                  sub={p2 || undefined}
                />
              );
            })}
            {dropoffs.slice(1).map((addr, i) => {
              const [d1, d2] = splitAddress(addr);
              return (
                <ResRow
                  key={`d-${i}`}
                  label={`Drop-off ${i + 2}`}
                  head={d1 || addr}
                  sub={d2 || undefined}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════ Managed by (coordinator) ═══════════ */}
      {(coordinatorFirstName || coordinatorPhone || coordinatorEmail) && (
        <section className="px-6 pt-24">
          <div
            className="mx-auto max-w-[640px] relative rounded-[2px] pt-10 pb-9 px-10"
            style={{
              backgroundColor: "#FFFDF8",
              border: "1px solid rgba(43,4,22,0.10)",
            }}
          >
            <span
              className="absolute top-[-11px] left-10 px-3 text-[10px]"
              style={{
                backgroundColor: "#F9EDE4",
                letterSpacing: "0.28em",
                color: "#66143D",
              }}
            >
              MANAGED BY
            </span>
            <div className="flex gap-6 items-start">
              <div
                className="shrink-0 flex items-center justify-center font-hero"
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  backgroundColor: "#2B0416",
                  color: "#E0B4C6",
                  fontSize: 22,
                }}
              >
                {(coordinatorFirstName || "Y").charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="font-hero"
                  style={{ fontSize: 26, color: "#2B0416", letterSpacing: "-0.01em" }}
                >
                  {coordinatorFirstName || "Your coordinator"}
                </div>
                <div
                  className="mt-1 text-[12px]"
                  style={{ color: "rgba(43,4,22,0.6)", letterSpacing: "0.01em" }}
                >
                  Your coordinator
                </div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mt-5 text-[12.5px]">
                  {(coordinatorEmail || supportEmail) && (
                    <a
                      href={`mailto:${coordinatorEmail || supportEmail}`}
                      style={{
                        color: "#66143D",
                        borderBottom: "0.5px solid rgba(102,20,61,0.35)",
                        textDecoration: "none",
                        paddingBottom: 1,
                      }}
                    >
                      {coordinatorEmail || supportEmail}
                    </a>
                  )}
                  {(coordinatorPhone || supportPhone) && (
                    <a
                      href={`tel:${(coordinatorPhone || supportPhone || "").replace(/\s+/g, "")}`}
                      style={{
                        color: "#66143D",
                        borderBottom: "0.5px solid rgba(102,20,61,0.35)",
                        textDecoration: "none",
                        paddingBottom: 1,
                      }}
                    >
                      {coordinatorPhone || supportPhone}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════ The days ahead ═══════════ */}
      <section className="px-6 pt-24 pb-16">
        <div className="mx-auto max-w-[560px]">
          <p
            className="text-[10px] text-center mb-10"
            style={{ letterSpacing: "0.28em", color: "#66143D" }}
          >
            THE DAYS AHEAD
          </p>

          <div className="grid grid-cols-[auto_1fr] gap-x-8 gap-y-7 items-baseline">
            <StepNum roman="i." />
            <StepBody
              title="Confirmation on its way"
              body="Your reservation letter and receipt land in your inbox within the hour."
            />
            <hr
              className="col-span-2 border-0 h-px"
              style={{ backgroundColor: "rgba(43,4,22,0.10)" }}
            />
            <StepNum roman="ii." />
            <StepBody
              title="Prepare the pieces"
              body="A quiet photo request may follow so our team plans the pathways in advance."
            />
          </div>
        </div>
      </section>

      {/* ═══════════ Footer ═══════════ */}
      <section
        className="text-center px-6 pt-14 pb-12"
        style={{ borderTop: "0.5px solid rgba(43,4,22,0.10)" }}
      >
        <p
          className="font-hero italic"
          style={{ fontSize: 15, color: "rgba(43,4,22,0.55)" }}
        >
          {moveDateStr ? `Until ${firstWord(moveDateStr)}.` : "Until soon."}
        </p>
        <div className="mt-6">
          <Link
            href={`/quote/${quote.quote_id}?view=1`}
            className="text-[11px] hover:opacity-70"
            style={{
              color: "#66143D",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              textDecoration: "none",
              borderBottom: "0.5px solid rgba(102,20,61,0.4)",
              paddingBottom: 3,
            }}
          >
            Review your original quote
          </Link>
        </div>
        <p
          className="mt-8 text-[10px]"
          style={{
            color: "rgba(43,4,22,0.35)",
            letterSpacing: "0.14em",
            textTransform: "uppercase",
          }}
        >
          Yugo · Toronto
        </p>
      </section>
    </div>
  );
}

/* ── Editorial primitives ─────────────────────────────────────────── */

function ResRow({
  label,
  head,
  sub,
}: {
  label: string;
  head: string;
  sub?: string;
}) {
  return (
    <div>
      <div
        className="text-[10px] mb-2"
        style={{
          letterSpacing: "0.28em",
          color: "rgba(43,4,22,0.42)",
          textTransform: "uppercase",
        }}
      >
        {label}
      </div>
      <div
        className="font-hero"
        style={{ fontSize: 22, color: "#2B0416", letterSpacing: "-0.01em", lineHeight: 1.2 }}
      >
        {head}
      </div>
      {sub && (
        <div
          className="mt-1 text-[12.5px]"
          style={{ color: "rgba(43,4,22,0.6)", fontWeight: 300 }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function StepNum({ roman }: { roman: string }) {
  return (
    <div
      className="font-hero"
      style={{ fontSize: 18, color: "#492A1D", letterSpacing: "0.02em" }}
    >
      {roman}
    </div>
  );
}

function StepBody({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <div
        className="text-[15px] mb-1"
        style={{ color: "#2B0416", fontWeight: 400 }}
      >
        {title}
      </div>
      <div
        className="text-[13px]"
        style={{ color: "rgba(43,4,22,0.6)", fontWeight: 300, lineHeight: 1.6 }}
      >
        {body}
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────────── */

/** Split a Canadian address at the first comma so line 1 is the street
 * and line 2 is the city + postal (renders more like a printed address). */
function splitAddress(raw: string): [string, string] {
  const s = (raw || "").trim();
  if (!s) return ["", ""];
  const idx = s.indexOf(",");
  if (idx < 0) return [s, ""];
  return [s.slice(0, idx).trim(), s.slice(idx + 1).trim()];
}

/** First word (e.g. "Thursday, July 10" → "Thursday") for the sign-off. */
function firstWord(s: string): string {
  const m = String(s).trim().match(/^[^\s,]+/);
  return m ? m[0] : s;
}

/** Sub-copy for the Service row — brand voice, one line, no filler. */
function serviceCopy(serviceType: string | null, tierKey: string): string {
  const svc = String(serviceType ?? "").toLowerCase();
  if (svc === "white_glove") return "A tailored single-day service";
  if (svc === "office_move") return "Curated office relocation";
  if (svc === "b2b_delivery" || svc === "b2b_oneoff") return "Dedicated commercial delivery";
  if (svc === "single_item") return "Handled single-item transport";
  if (svc === "event") return "Event logistics, end to end";
  if (svc === "specialty") return "Specialty handling and transport";
  if (svc === "long_distance") return "Long-distance move, one flat rate";
  if (svc === "labour_only") return "Professional crew for the day";
  if (svc === "bin_rental") return "Rental bins, delivered to your door";
  if (tierKey === "estate") return "Estate service, concierge-led";
  if (tierKey === "signature") return "Signature service, coordinator-led";
  return "Move service, coordinator-led";
}

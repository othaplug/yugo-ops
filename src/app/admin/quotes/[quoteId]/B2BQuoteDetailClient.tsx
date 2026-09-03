"use client";

import { useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { formatPhone } from "@/lib/phone";
import { displayLabel, serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { formatPlatformDisplay } from "@/lib/date-format";
import QuoteEngagementFeed, {
  type EngagementEvent,
  type LegacyEvent,
} from "./QuoteEngagementFeed";

/**
 * Admin detail page for a B2B commercial-delivery quote (b2b_oneoff /
 * b2b_delivery). A distinct surface from the residential move quote: framed
 * around approval + invoice-after-completion, not deposit/payment. Same data
 * and logic, and Edit routes to the shared /edit page (reuses the quote
 * creation form), exactly like move quotes.
 */

type QuoteRow = Record<string, unknown> & {
  id: string;
  quote_id: string;
  status?: string | null;
  service_type?: string | null;
  custom_price?: number | null;
  factors_applied?: Record<string, unknown> | null;
  from_address?: string | null;
  to_address?: string | null;
  from_postal?: string | null;
  to_postal?: string | null;
  move_date?: string | null;
  distance_km?: number | null;
  est_truck_size?: string | null;
  truck_primary?: string | null;
  est_crew_size?: number | null;
  est_hours?: number | null;
  created_at?: string | null;
  sent_at?: string | null;
  viewed_at?: string | null;
  accepted_at?: string | null;
  expires_at?: string | null;
  tiers?: unknown;
  contacts?: { name?: string | null; email?: string | null; phone?: string | null } | null;
};

const STEPS = ["sent", "viewed", "approved", "scheduled", "completed", "invoiced"] as const;
const STEP_LABEL: Record<(typeof STEPS)[number], string> = {
  sent: "Sent",
  viewed: "Viewed",
  approved: "Approved",
  scheduled: "Scheduled",
  completed: "Completed",
  invoiced: "Invoiced",
};

function statusBadge(status: string, booked: boolean): { label: string; cls: string } {
  const s = status.toLowerCase();
  if (booked || s === "accepted") return { label: "Approved", cls: "bg-green-500/10 text-green-600 dark:text-green-400" };
  if (s === "viewed") return { label: "Viewed", cls: "bg-[var(--admin-primary-fill)]/10 text-[var(--admin-primary-fill)]" };
  if (s === "sent") return { label: "Sent", cls: "bg-[var(--admin-primary-fill)]/10 text-[var(--admin-primary-fill)]" };
  if (s === "expired") return { label: "Expired", cls: "bg-amber-500/12 text-amber-600 dark:text-amber-400" };
  if (s === "declined" || s === "lost") return { label: "Declined", cls: "bg-red-500/10 text-red-600 dark:text-red-400" };
  return { label: "Draft", cls: "bg-[var(--tx3)]/12 text-[var(--tx3)]" };
}

function fmt(d: string | null | undefined): string {
  if (!d) return "-";
  return formatPlatformDisplay(d, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtDate(d: string | null | undefined): string {
  if (!d) return "-";
  return formatPlatformDisplay(d, { month: "short", day: "numeric" });
}

export default function B2BQuoteDetailClient({
  quote,
  engagement,
  legacyEvents,
  isSuperAdmin,
  linkedDeliveryId,
  linkedDeliveryNumber,
  hubspotDealId,
  crews = [],
}: {
  quote: QuoteRow;
  engagement: EngagementEvent[];
  legacyEvents: LegacyEvent[];
  isSuperAdmin: boolean;
  linkedDeliveryId: string | null;
  linkedDeliveryNumber: string | null;
  hubspotDealId: string | null;
  crews?: { id: string; name: string }[];
}) {
  const router = useRouter();
  const factors = (quote.factors_applied ?? {}) as Record<string, unknown>;
  const contact = quote.contacts ?? null;
  const booked = Boolean(linkedDeliveryNumber);
  const status = String(quote.status ?? "draft").toLowerCase();

  const [sendBusy, setSendBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [crewId, setCrewId] = useState("");
  const [onsiteName, setOnsiteName] = useState("");
  const [onsitePhone, setOnsitePhone] = useState("");

  const business = typeof factors.b2b_business_name === "string" ? factors.b2b_business_name : null;
  const vertical =
    (factors.b2b_vertical_name as string) ||
    displayLabel(String(factors.b2b_vertical_code || "")) ||
    null;
  const handling = displayLabel(String(factors.b2b_handling_type || "")) || null;
  const windowLabel = factors.b2b_delivery_window ? String(factors.b2b_delivery_window) : null;
  const lineItems = Array.isArray(factors.b2b_line_items)
    ? (factors.b2b_line_items as { description?: string; quantity?: number }[])
    : null;
  const itemsFallback = factors.b2b_items
    ? Array.isArray(factors.b2b_items)
      ? (factors.b2b_items as string[]).join(", ")
      : String(factors.b2b_items)
    : null;

  const preTax = Number(quote.custom_price ?? 0) || 0;
  const hst = Math.round(preTax * 0.13 * 100) / 100;
  const total = Math.round((preTax + hst) * 100) / 100;
  const money = (n: number) => `$${n.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const currentStep = useMemo(() => {
    if (booked) return "scheduled";
    if (status === "accepted") return "approved";
    if (quote.viewed_at) return "viewed";
    if (quote.sent_at || status === "sent") return "sent";
    return null;
  }, [booked, status, quote.viewed_at, quote.sent_at]);
  const stepIdx = currentStep ? STEPS.indexOf(currentStep as (typeof STEPS)[number]) : -1;

  const badge = statusBadge(status, booked);

  async function handleSend() {
    if (sendBusy) return;
    setSendBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/quotes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ quoteId: quote.quote_id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error ?? "Failed to send quote");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to send");
    } finally {
      setSendBusy(false);
    }
  }

  async function handleConfirm() {
    if (confirmBusy) return;
    setConfirmBusy(true);
    setErr(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${encodeURIComponent(quote.quote_id)}/confirm-b2b-booking`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            crew_id: crewId || null,
            onsite_name: onsiteName || null,
            onsite_phone: onsitePhone || null,
          }),
        },
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.success === false) throw new Error(data.error ?? "Could not confirm the booking");
      // Delivery created, go straight to its detail page (the confirmation
      // notice to the client is sent by the route).
      if (data.delivery_id) {
        router.push(`/admin/deliveries/${data.delivery_id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not confirm the booking");
    } finally {
      setConfirmBusy(false);
    }
  }

  const btnBase =
    "inline-flex items-center gap-2 rounded-lg text-[13px] font-medium px-3.5 py-2 transition-colors disabled:opacity-50";
  const btnPrimary = `${btnBase} bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent,#f9ede4)] hover:opacity-90 border border-[var(--admin-primary-fill)]`;
  const btnGhost = `${btnBase} bg-transparent text-[var(--tx2)] hover:bg-[var(--hover)] border border-[var(--brd)]/60`;
  const btnSubtle = `${btnBase} bg-transparent text-[var(--tx2)] hover:bg-[var(--hover)] border border-transparent`;
  const card = "rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] p-4";

  return (
    <div className="w-full min-w-0 max-w-[1040px] mx-auto px-4 sm:px-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <button
            type="button"
            onClick={() => router.push("/admin/quotes")}
            className="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.1em] uppercase text-[var(--tx3)] hover:text-[var(--tx)] transition-colors mb-2.5"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
            Sales &middot; Commercial delivery
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-[26px] font-bold tracking-tight text-[var(--tx)]">{quote.quote_id}</h1>
            <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${badge.cls}`}>
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
              {badge.label}
            </span>
          </div>
          <p className="text-[13px] text-[var(--tx3)] mt-1.5">
            {business ? <span className="text-[var(--tx2)] font-semibold">{business}</span> : null}
            {business ? " · " : ""}
            {contact?.name ?? "-"} &middot; {serviceTypeDisplayLabel(quote.service_type as string)} &middot; Created {fmtDate(quote.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => router.push(`/admin/quotes/${encodeURIComponent(quote.quote_id)}/edit`)}
            className={btnSubtle}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
            Edit all details
          </button>
          <a href={`/quote/${encodeURIComponent(quote.quote_id)}`} target="_blank" rel="noreferrer" className={btnSubtle}>
            Client view
          </a>
        </div>
      </div>

      {/* Approval & Booking */}
      <section className={`${card} mt-6 !p-0 overflow-hidden`} aria-label="Approval and booking">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-[var(--brd)]/50">
          <h2 className="admin-section-h2 !mb-0">Approval &amp; Booking</h2>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            Invoice after completion &middot; Net-30
          </span>
        </div>

        {/* progress track */}
        <div className="flex items-center px-4 pt-4 pb-1">
          {STEPS.map((s, i) => {
            const done = i < stepIdx;
            const now = i === stepIdx;
            return (
              <div key={s} className="flex-1 flex flex-col items-center gap-1.5 relative">
                {i > 0 && (
                  <span
                    className="absolute top-[5px] right-1/2 w-full h-0.5 z-0"
                    style={{ background: i <= stepIdx ? "var(--admin-primary-fill)" : "var(--brd)" }}
                  />
                )}
                <span
                  className="w-3 h-3 rounded-full z-[1] border-2"
                  style={{
                    background: done || now ? "var(--admin-primary-fill)" : "var(--card)",
                    borderColor: done || now ? "var(--admin-primary-fill)" : "var(--brd)",
                    boxShadow: now ? "0 0 0 4px color-mix(in srgb, var(--admin-primary-fill) 16%, transparent)" : "none",
                  }}
                />
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${done || now ? "text-[var(--tx)]" : "text-[var(--tx3)]"}`}>
                  {STEP_LABEL[s]}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-4 px-4 py-4 flex-wrap">
          {booked ? (
            <p className="text-[13px] text-[var(--tx3)] max-w-[48ch] leading-relaxed">
              Booked. A delivery is scheduled and the quote is marked{" "}
              <span className="text-[var(--tx)] font-semibold">invoiced</span>. The invoice is raised automatically after the job is completed.
            </p>
          ) : (
            <p className="text-[13px] text-[var(--tx3)] max-w-[48ch] leading-relaxed">
              <span className="text-[var(--tx)] font-semibold">Confirm booking</span> approves on{" "}
              {business ?? "the client"}&rsquo;s behalf and schedules the delivery, no card taken. The quote is marked invoiced, and the invoice is raised after the job is completed.
            </p>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {booked ? (
              linkedDeliveryId ? (
                <button type="button" onClick={() => router.push(`/admin/deliveries/${linkedDeliveryId}`)} className={btnGhost}>
                  Open delivery {linkedDeliveryNumber}
                </button>
              ) : (
                <span className="text-[12px] text-[var(--tx3)]">Delivery {linkedDeliveryNumber}</span>
              )
            ) : (
              <>
                {crews.length > 0 && (
                  <select
                    value={crewId}
                    onChange={(e) => setCrewId(e.target.value)}
                    aria-label="Assign crew"
                    className="rounded-lg border border-[var(--brd)]/60 bg-[var(--card)] text-[13px] text-[var(--tx)] px-3 py-2"
                  >
                    <option value="">Assign crew (optional)…</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                )}
                <input
                  type="text"
                  value={onsiteName}
                  onChange={(e) => setOnsiteName(e.target.value)}
                  placeholder="On-site contact (optional)"
                  aria-label="On-site contact name"
                  className="rounded-lg border border-[var(--brd)]/60 bg-[var(--card)] text-[13px] text-[var(--tx)] px-3 py-2 w-[10rem]"
                />
                <input
                  type="tel"
                  value={onsitePhone}
                  onChange={(e) => setOnsitePhone(e.target.value)}
                  placeholder="On-site phone"
                  aria-label="On-site contact phone"
                  className="rounded-lg border border-[var(--brd)]/60 bg-[var(--card)] text-[13px] text-[var(--tx)] px-3 py-2 w-[9rem]"
                />
                {status === "draft" && (
                  <button type="button" onClick={handleSend} disabled={sendBusy} className={btnGhost}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                    {sendBusy ? "Sending…" : "Send for approval"}
                  </button>
                )}
                <button type="button" onClick={handleConfirm} disabled={confirmBusy} className={btnPrimary}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                  {confirmBusy ? "Confirming…" : "Confirm booking (invoice)"}
                </button>
              </>
            )}
          </div>
        </div>
        {err && (
          <div className="px-4 pb-4 -mt-1 text-[12px] text-red-500">{err}</div>
        )}
      </section>

      {/* Grid */}
      <div className="grid lg:grid-cols-[1.5fr_1fr] gap-5 mt-5 items-start">
        {/* Left column */}
        <div className="flex flex-col gap-5 min-w-0">
          <div className={card}>
            <h2 className="admin-section-h2 mb-3">Delivery Summary</h2>
            <dl className="text-[13px]">
              <Row k="Business" v={business ?? "-"} />
              <Row k="Contact" v={contact?.name ?? "-"} />
              <Row k="Email" v={contact?.email ? <a className="text-[var(--admin-primary-fill)] hover:underline" href={`mailto:${contact.email}`}>{contact.email}</a> : "-"} />
              {contact?.phone ? <Row k="Phone" v={formatPhone(contact.phone)} /> : null}
              <Row k="Vertical" v={vertical ?? "-"} />
              <Row k="Handling" v={handling ?? "-"} />
              {windowLabel ? <Row k="Window" v={windowLabel} /> : null}
              <Row
                k="Manifest"
                v={
                  lineItems && lineItems.length > 0
                    ? lineItems.map((li) => `${Math.max(1, Number(li.quantity) || 1)}× ${li.description || "Item"}`).join(", ")
                    : itemsFallback ?? "-"
                }
              />
              <Row k="Delivery date" v={fmtDate(quote.move_date)} />
            </dl>

            {/* route */}
            <div className="grid grid-cols-[18px_1fr] gap-x-3 pt-3 mt-1">
              <div className="flex flex-col items-center pt-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--admin-primary-fill)" }} />
                <span className="w-0.5 flex-1 min-h-[22px] my-1" style={{ background: "repeating-linear-gradient(var(--brd) 0 3px, transparent 3px 7px)" }} />
                <span className="w-2.5 h-2.5 rounded-full border-2" style={{ borderColor: "var(--admin-primary-fill)", background: "var(--card)" }} />
              </div>
              <div className="flex flex-col gap-3.5">
                <div>
                  <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Pickup</div>
                  <div className="text-[13px] font-medium text-[var(--tx)] mt-0.5">{quote.from_address ?? "-"}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">Dropoff</div>
                  <div className="text-[13px] font-medium text-[var(--tx)] mt-0.5">{quote.to_address ?? "-"}</div>
                  {quote.distance_km ? <div className="text-[11px] text-[var(--tx3)] mt-1 tabular-nums">{Number(quote.distance_km).toFixed(1)} km &middot; single leg</div> : null}
                </div>
              </div>
            </div>

            {/* amount */}
            <div className="flex items-baseline justify-between gap-3 mt-4 pt-3 border-t border-[var(--brd)]/50">
              <div>
                <div className="text-[24px] font-bold tracking-tight tabular-nums text-[var(--tx)]">{money(preTax)}</div>
                <div className="text-[12px] text-[var(--tx3)] mt-0.5 tabular-nums">+ {money(hst)} HST (13%) &middot; total {money(total)} invoiced</div>
              </div>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-green-500/10 text-green-600 dark:text-green-400">
                <span className="w-1.5 h-1.5 rounded-full bg-current" />Net-30
              </span>
            </div>
          </div>

          <div className={card}>
            <QuoteEngagementFeed
              engagement={engagement}
              legacyEvents={legacyEvents}
              sentAt={(quote.sent_at as string | null) ?? null}
              tiers={quote.tiers}
              isSuperAdmin={isSuperAdmin}
            />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5 min-w-0">
          <div className={card}>
            <h2 className="admin-section-h2 mb-3">Timeline</h2>
            <div className="flex flex-col">
              <TL label="Created" time={fmt(quote.created_at)} done />
              {quote.sent_at ? <TL label="Sent" time={fmt(quote.sent_at)} done /> : null}
              {quote.viewed_at ? <TL label="First viewed" time={fmt(quote.viewed_at)} live /> : null}
              {quote.accepted_at ? <TL label="Approved" time={fmt(quote.accepted_at)} done /> : null}
              {quote.expires_at ? <TL label="Expires" time={fmtDate(quote.expires_at)} /> : null}
            </div>
          </div>

          <div className={card}>
            <h2 className="admin-section-h2 mb-3">Job Spec</h2>
            <dl className="text-[13px]">
              <Row k="Service" v={serviceTypeDisplayLabel(quote.service_type as string)} />
              {quote.est_truck_size || quote.truck_primary ? (
                <Row k="Vehicle" v={displayLabel(String(quote.est_truck_size || quote.truck_primary))} />
              ) : null}
              {quote.est_crew_size ? <Row k="Crew" v={`${quote.est_crew_size}-person`} /> : null}
              {quote.est_hours ? <Row k="Est. hours" v={`~${quote.est_hours}h`} mono /> : null}
              {quote.distance_km ? <Row k="Distance" v={`${Number(quote.distance_km).toFixed(1)} km`} mono /> : null}
              {hubspotDealId ? <Row k="Deal" v={`HubSpot ${hubspotDealId}`} mono /> : null}
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-x-4 gap-y-1 items-baseline py-2 border-b border-[var(--brd)]/40 last:border-b-0">
      <dt className="text-[12.5px] text-[var(--tx3)] font-medium">{k}</dt>
      <dd className={`text-[13.5px] font-medium text-[var(--tx)] m-0 ${mono ? "tabular-nums" : ""}`}>{v}</dd>
    </div>
  );
}

function TL({ label, time, done, live }: { label: string; time: string; done?: boolean; live?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2.5">
      <span className="flex items-center gap-2.5 text-[12.5px]">
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: done ? "var(--admin-primary-fill)" : live ? "#3b82f6" : "var(--tx3)" }}
        />
        <span className={done || live ? "text-[var(--tx2)]" : "text-[var(--tx3)]"}>{label}</span>
      </span>
      <span className={`text-[12px] font-medium tabular-nums ${live ? "text-blue-500" : "text-[var(--tx)]"}`}>{time}</span>
    </div>
  );
}

"use client";

import React from "react";
import { formatCurrency } from "@/lib/format-currency";

/* Yugo brand palette — wine / cream / rose / deep green. No off-brand purple. */
const WINE = "#2B0416";
const FOREST = "#2B3927";
const ROSE = "#66143D";
const INK = "#3A2A24";
const MUTED = "#8B7A70";
const CARD = "#FFFBF7";
const SUNKEN = "#F4E7DC";
const LINE = "rgba(43,4,22,0.12)";
const LINE2 = "rgba(43,4,22,0.07)";
const GOLD = "#8A6A24";
const GOLD_SOFT = "#F1E7CF";
const ROSE_SOFT = "#F1E0E7";
const GREEN_SOFT = "#E4EBE3";

type EventSibling = {
  trackUrl?: string | null;
  phase?: string | null;
  scheduledDate?: string | null;
  status?: string | null;
} | null;

type MoveLike = {
  move_code?: string | null;
  event_name?: string | null;
  event_phase?: string | null;
  scheduled_date?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  est_crew_size?: number | null;
  deposit_amount?: number | null;
  status?: string | null;
  factors_applied?: unknown;
  truck_primary?: string | null;
};

export interface EventTrackDashboardProps {
  move: MoveLike;
  eventSibling: EventSibling;
  clientFirstName: string;
  coordinatorName: string | null;
  coordinatorPhone: string | null;
  totalBalance: number;
  daysUntil: number | null;
  arrivalWindow: string | null;
  hasCardOnFile: boolean;
  onAddCard: () => void;
  /** Jump to the Files tab (receipts, photos, documents). */
  onViewFiles: () => void;
  /** Jump to the Live Tracking tab (crew map on delivery / return day). */
  onViewTracking: () => void;
}

const fmtDate = (d?: string | null) => {
  if (!d) return null;
  const dt = new Date(`${String(d).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
};

export default function EventTrackDashboard({
  move,
  eventSibling,
  clientFirstName,
  coordinatorName,
  coordinatorPhone,
  totalBalance,
  daysUntil,
  arrivalWindow,
  hasCardOnFile,
  onAddCard,
  onViewFiles,
  onViewTracking,
}: EventTrackDashboardProps) {
  const factors =
    move.factors_applied && typeof move.factors_applied === "object" && !Array.isArray(move.factors_applied)
      ? (move.factors_applied as Record<string, unknown>)
      : {};
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

  const eventName = str(move.event_name) || "Your event";
  const isDeliveryLeg = (move.event_phase || "delivery") !== "return";
  // Normalise the two legs regardless of which one we're viewing.
  const deliveryDate = isDeliveryLeg ? move.scheduled_date : eventSibling?.scheduledDate ?? null;
  const returnDate = isDeliveryLeg ? eventSibling?.scheduledDate ?? null : move.scheduled_date;
  const deliveryDone = isDeliveryLeg
    ? move.status === "completed"
    : eventSibling?.status === "completed";
  const returnDone = isDeliveryLeg
    ? eventSibling?.status === "completed"
    : move.status === "completed";

  const origin = str(move.from_address);
  const venueAddr = str(move.to_address);
  const venueName =
    str(factors.event_venue) ||
    str(factors.venue_name) ||
    str(factors.venue) ||
    (venueAddr ? venueAddr.split(",")[0] : null);
  const crew = Number(move.est_crew_size) > 0 ? Math.round(Number(move.est_crew_size)) : null;
  const truck = str(move.truck_primary);
  const depositPaid = Number(move.deposit_amount || 0);
  const contractTotal = depositPaid + Math.max(0, totalBalance);
  const balanceDue = Math.max(0, totalBalance);
  const settled = balanceDue < 2;
  // Balance is collected 48h before delivery, per the event deposit policy.
  const dueLabel = (() => {
    if (!deliveryDate) return null;
    const dt = new Date(`${String(deliveryDate).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(dt.getTime())) return null;
    dt.setDate(dt.getDate() - 2);
    return dt.toLocaleDateString("en-CA", { month: "short", day: "numeric" });
  })();

  const statusLabel =
    daysUntil != null && daysUntil > 0
      ? `Confirmed · ${daysUntil} ${daysUntil === 1 ? "day" : "days"} out`
      : daysUntil === 0
        ? "Confirmed · today"
        : "Confirmed";

  const telHref = coordinatorPhone ? `tel:${coordinatorPhone.replace(/[^\d+]/g, "")}` : null;
  const returnUrl = str(eventSibling?.trackUrl);

  // ── shared bits ──
  const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
    <section
      style={{
        background: CARD,
        border: `1px solid ${LINE}`,
        borderRadius: 18,
        boxShadow: "0 1px 2px rgba(43,4,22,.04), 0 10px 26px -14px rgba(43,4,22,.16)",
        padding: 22,
        ...style,
      }}
    >
      {children}
    </section>
  );
  const Eyebrow: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color }) => (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.15em",
        textTransform: "uppercase",
        color: color || MUTED,
      }}
    >
      {children}
    </div>
  );
  const SHead: React.FC<{ title: string; meta?: string }> = ({ title, meta }) => (
    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 14 }}>
      <h3 className="font-hero" style={{ margin: 0, fontSize: 19, color: WINE, fontWeight: 600 }}>
        {title}
      </h3>
      {meta ? <span style={{ fontSize: 12, color: MUTED }}>{meta}</span> : null}
    </div>
  );

  const tlDot = (state: "done" | "now" | "next") => (
    <span
      style={{
        position: "absolute",
        left: 0,
        top: 2,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: state === "done" ? FOREST : CARD,
        border: `2px solid ${state === "done" ? FOREST : state === "now" ? ROSE : LINE}`,
        boxShadow: state === "now" ? `0 0 0 4px ${ROSE_SOFT}` : "none",
        zIndex: 1,
        display: "grid",
        placeItems: "center",
      }}
    >
      {state === "done" ? (
        <span
          style={{
            width: 4,
            height: 8,
            marginTop: -1,
            border: "solid #F9EDE4",
            borderWidth: "0 2px 2px 0",
            transform: "rotate(45deg)",
          }}
        />
      ) : state === "now" ? (
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: ROSE }} />
      ) : null}
    </span>
  );

  const Tag: React.FC<{ children: React.ReactNode; tone: "now" | "soon" | "done" }> = ({ children, tone }) => (
    <span
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 999,
        marginLeft: 8,
        verticalAlign: 1,
        background: tone === "now" ? ROSE_SOFT : tone === "done" ? GREEN_SOFT : SUNKEN,
        color: tone === "now" ? ROSE : tone === "done" ? FOREST : MUTED,
      }}
    >
      {children}
    </span>
  );

  const LegNode: React.FC<{
    kicker: string;
    title: string;
    route: React.ReactNode;
    badge: string;
    href?: string | null;
  }> = ({ kicker, title, route, badge, href }) => {
    const inner = (
      <div
        style={{
          marginTop: 8,
          background: SUNKEN,
          border: `1px solid ${LINE2}`,
          borderRadius: 14,
          padding: "13px 15px",
          display: "grid",
          gridTemplateColumns: "1fr auto",
          gap: "6px 12px",
          alignItems: "center",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: ROSE }}>
            {kicker}
          </div>
          <div className="font-hero" style={{ color: WINE, fontSize: 17 }}>
            {title}
          </div>
        </div>
        <span
          style={{
            justifySelf: "end",
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: GOLD,
            background: GOLD_SOFT,
            padding: "4px 9px",
            borderRadius: 999,
            whiteSpace: "nowrap",
          }}
        >
          {badge}
        </span>
        <div style={{ gridColumn: "1 / -1", fontSize: 12.5, color: INK, lineHeight: 1.5 }}>{route}</div>
      </div>
    );
    return href ? (
      <a href={href} style={{ textDecoration: "none", display: "block" }}>
        {inner}
      </a>
    ) : (
      inner
    );
  };

  return (
    <div className="font-sans" style={{ color: INK, maxWidth: 660, margin: "0 auto", width: "100%" }}>
      {/* HERO */}
      <header style={{ paddingTop: 12, paddingBottom: 4 }}>
        <Eyebrow>
          Event Logistics · #{str(move.move_code) || ""}
        </Eyebrow>
        <h1 className="font-hero" style={{ margin: "10px 0 0", fontSize: 36, lineHeight: 1.04, color: WINE, fontWeight: 600 }}>
          {eventName}
        </h1>
        <p style={{ margin: "8px 0 0", fontSize: 15, color: INK }}>
          {clientFirstName ? `${clientFirstName}, ` : ""}
          your delivery, setup and return
          {venueName ? (
            <>
              {" "}
              at <b style={{ color: WINE }}>{venueName}</b>
            </>
          ) : null}{" "}
          are handled end to end by Yugo.
        </p>
        <div style={{ marginTop: 14 }}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              padding: "5px 11px",
              borderRadius: 999,
              background: GREEN_SOFT,
              color: FOREST,
              border: `1px solid ${FOREST}30`,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
            {statusLabel}
          </span>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 18 }}>
          {[
            { k: "Delivery", v: fmtDate(deliveryDate) || "TBD", s: arrivalWindow ? `Arrival ${arrivalWindow}` : null },
            returnDate ? { k: "Teardown & return", v: fmtDate(returnDate) || "TBD", s: "Items returned to origin" } : null,
            { k: "Your team", v: crew ? `${crew} crew` : "Dedicated crew", s: truck ? `Dedicated · ${truck}` : "Dedicated" },
          ]
            .filter(Boolean)
            .map((f, i) => {
              const fact = f as { k: string; v: string; s: string | null };
              return (
                <div
                  key={i}
                  style={{
                    flex: "1 1 150px",
                    background: SUNKEN,
                    border: `1px solid ${LINE2}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                  }}
                >
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: MUTED }}>
                    {fact.k}
                  </div>
                  <div className="font-hero" style={{ color: WINE, fontSize: 18, marginTop: 3 }}>
                    {fact.v}
                  </div>
                  {fact.s ? <div style={{ fontSize: 11, color: MUTED, marginTop: 1 }}>{fact.s}</div> : null}
                </div>
              );
            })}
        </div>
      </header>

      <div style={{ display: "flex", flexDirection: "column", gap: 16, marginTop: 22 }}>
        {/* UNIFIED EVENT TIMELINE — both legs in one view */}
        <Card>
          <SHead
            title="Your event timeline"
            meta={
              deliveryDate && returnDate
                ? `${fmtDate(deliveryDate)}, ${fmtDate(returnDate)}`
                : fmtDate(deliveryDate) || undefined
            }
          />
          <ol style={{ listStyle: "none", margin: 0, padding: 0, position: "relative" }}>
            <span style={{ position: "absolute", left: 8, top: 6, bottom: 6, width: 2, background: LINE }} />
            {/* Booked */}
            <li style={{ position: "relative", padding: "0 0 20px 34px" }}>
              {tlDot("done")}
              <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>Booked</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>Your event is reserved</div>
            </li>
            {/* Deposit */}
            <li style={{ position: "relative", padding: "0 0 20px 34px" }}>
              {tlDot("done")}
              <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>
                Deposit paid{depositPaid > 0 ? <span style={{ fontVariantNumeric: "tabular-nums" }}> · {formatCurrency(depositPaid)}</span> : null}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>Balance due 48h before delivery</div>
            </li>
            {/* Pre-event actions */}
            {!settled || !deliveryDone ? (
              <li style={{ position: "relative", padding: "0 0 20px 34px" }}>
                {tlDot("now")}
                <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>
                  Insurance &amp; venue access <Tag tone="now">Action needed</Tag>
                </div>
                <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>A few details before load-in, see the checklist below</div>
              </li>
            ) : null}
            {/* Delivery leg */}
            <li style={{ position: "relative", padding: "0 0 20px 34px" }}>
              {tlDot(deliveryDone ? "done" : "next")}
              <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>
                Delivery &amp; setup
                {deliveryDate ? <Tag tone={deliveryDone ? "done" : "soon"}>{fmtDate(deliveryDate)}</Tag> : null}
              </div>
              <LegNode
                kicker={isDeliveryLeg ? "This booking" : "Delivery leg"}
                title={`Delivery, ${fmtDate(deliveryDate) || "TBD"}`}
                badge={deliveryDone ? "Complete" : "Live on the day"}
                href={isDeliveryLeg ? null : returnUrl}
                route={
                  <>
                    {origin || "Origin"} <span style={{ color: MUTED }}>→</span>{" "}
                    <b style={{ color: WINE }}>{venueName || "Venue"}</b>
                    {arrivalWindow ? ` · arrival ${arrivalWindow}` : ""}
                  </>
                }
              />
            </li>
            {/* Return leg */}
            {returnDate ? (
              <li style={{ position: "relative", padding: "0 0 20px 34px" }}>
                {tlDot(returnDone ? "done" : "next")}
                <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>
                  Teardown &amp; return <Tag tone={returnDone ? "done" : "soon"}>{fmtDate(returnDate)}</Tag>
                </div>
                <LegNode
                  kicker={isDeliveryLeg ? "Return leg" : "This booking"}
                  title={`Return, ${fmtDate(returnDate) || "TBD"}`}
                  badge="Same crew"
                  href={isDeliveryLeg ? returnUrl : null}
                  route={
                    <>
                      <b style={{ color: WINE }}>{venueName || "Venue"}</b> <span style={{ color: MUTED }}>→</span>{" "}
                      {origin || "Origin"} · teardown &amp; return
                    </>
                  }
                />
              </li>
            ) : null}
            {/* Complete */}
            <li style={{ position: "relative", padding: "0 0 0 34px" }}>
              {tlDot(returnDone || (settled && deliveryDone && !returnDate) ? "done" : "next")}
              <div style={{ fontWeight: 650, color: INK, fontSize: 14.5 }}>Complete</div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 1 }}>Final receipt and recap after return</div>
            </li>
          </ol>
        </Card>

        {/* WHAT WE NEED FROM YOU — only genuinely client-side items. Yugo
            provides the venue's COI, so it is NOT requested here (that reassurance
            is stated below instead of asked for). */}
        <Card>
          <SHead title="What we need from you" meta="Before load-in" />
          {(() => {
            const items = [
              { t: "Venue load-in contact & dock access", s: "Who lets the crew in, and where the dock or elevator is" },
              { t: `On-site contact for delivery day${deliveryDate ? ` (${fmtDate(deliveryDate)})` : ""}`, s: "A name and number we can reach on the day" },
              { t: "Final item list & setup layout", s: "Confirm what's coming and where it goes, so the crew places everything right" },
            ];
            return (
              <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" }}>
                {items.map((it, i) => (
                  <li
                    key={i}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-start",
                      padding: "11px 0",
                      borderBottom: i < items.length - 1 ? `1px solid ${LINE2}` : "none",
                    }}
                  >
                    <span
                      style={{
                        flex: "none",
                        width: 19,
                        height: 19,
                        borderRadius: 6,
                        border: `2px solid ${LINE}`,
                        marginTop: 1,
                      }}
                    />
                    <div>
                      <div style={{ fontWeight: 600, color: WINE, fontSize: 14 }}>{it.t}</div>
                      <div style={{ fontSize: 12, color: MUTED, marginTop: 1 }}>{it.s}</div>
                    </div>
                  </li>
                ))}
              </ul>
            );
          })()}
          <div
            style={{
              marginTop: 12,
              padding: "10px 13px",
              background: GREEN_SOFT,
              border: `1px solid ${FOREST}22`,
              borderRadius: 10,
              fontSize: 12.5,
              color: FOREST,
              display: "flex",
              gap: 8,
              alignItems: "flex-start",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flex: "none", marginTop: 1 }} aria-hidden>
              <path d="M5 12.5 10 17.5 19 6.5" stroke={FOREST} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span>
              <b>We handle the venue&rsquo;s certificate of insurance.</b> Yugo carries full
              commercial coverage and provides the COI directly to your venue, nothing needed from you.
            </span>
          </div>
          {telHref ? (
            <a
              href={telHref}
              style={{
                display: "inline-flex",
                marginTop: 14,
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: "0.03em",
                color: ROSE,
                border: `1px solid ${ROSE}55`,
                padding: "8px 14px",
                borderRadius: 999,
                textDecoration: "none",
              }}
            >
              Share these with {coordinatorName?.split(/\s+/)[0] || "your coordinator"} →
            </a>
          ) : null}
        </Card>

        {/* BALANCE */}
        <Card>
          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <Eyebrow>Balance</Eyebrow>
              <div className="font-hero" style={{ fontSize: 34, color: settled ? FOREST : WINE, lineHeight: 1, marginTop: 8, fontVariantNumeric: "tabular-nums" }}>
                {settled ? "Paid in full" : formatCurrency(balanceDue)}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED, marginTop: 6 }}>
                {settled ? (
                  "Thank you, nothing further due."
                ) : (
                  <>
                    {dueLabel ? (
                      <>
                        Due <b style={{ color: WINE }}>{dueLabel}</b> (48h before delivery) ·{" "}
                      </>
                    ) : null}
                    all taxes included
                  </>
                )}
              </div>
            </div>
            {!settled ? (
              <button
                type="button"
                onClick={onAddCard}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  background: FOREST,
                  color: "#F9EDE4",
                  fontWeight: 650,
                  fontSize: 14,
                  padding: "12px 20px",
                  borderRadius: 12,
                  border: 0,
                  cursor: "pointer",
                }}
              >
                {hasCardOnFile ? "Use a different card" : "Save a card to auto-pay"}
              </button>
            ) : null}
          </div>
          {depositPaid > 0 ? (
            <div
              style={{
                marginTop: 14,
                paddingTop: 14,
                borderTop: `1px solid ${LINE2}`,
                fontSize: 12.5,
                color: MUTED,
                display: "flex",
                justifyContent: "space-between",
              }}
            >
              <span>Deposit received</span>
              <b style={{ color: INK, fontVariantNumeric: "tabular-nums" }}>
                {formatCurrency(depositPaid)} of {formatCurrency(contractTotal)}
              </b>
            </div>
          ) : null}
        </Card>

        {/* FILES + LIVE TRACKING — the two things a client comes back for.
            These route to the existing Files (receipts/photos/documents) and
            Live Tracking (crew map) tabs, so the ops record is never buried. */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <button
            type="button"
            onClick={onViewFiles}
            style={{
              textAlign: "left",
              background: CARD,
              border: `1px solid ${LINE}`,
              borderRadius: 16,
              padding: "16px 16px 15px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(43,4,22,.04)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8, display: "block" }} aria-hidden>
              <path d="M6 3.5h12v17l-2.4-1.5L13.2 20l-2.4-1.5L8.4 20 6 20.5V3.5Z" stroke={ROSE} strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M9 8h6M9 11.5h6M9 15h3.5" stroke={ROSE} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <div className="font-hero" style={{ fontSize: 16, color: WINE }}>
              Receipts &amp; documents
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>
              Deposit &amp; balance receipts, photos and paperwork
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ROSE, marginTop: 10 }}>Open files →</div>
          </button>
          <button
            type="button"
            onClick={onViewTracking}
            style={{
              textAlign: "left",
              background: CARD,
              border: `1px solid ${LINE}`,
              borderRadius: 16,
              padding: "16px 16px 15px",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(43,4,22,.04)",
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8, display: "block" }} aria-hidden>
              <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z" stroke={ROSE} strokeWidth="1.5" strokeLinejoin="round" />
              <circle cx="12" cy="11" r="2.2" stroke={ROSE} strokeWidth="1.5" />
            </svg>
            <div className="font-hero" style={{ fontSize: 16, color: WINE }}>
              Live tracking
            </div>
            <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.45 }}>
              Follow the crew on the map on delivery &amp; return day
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ROSE, marginTop: 10 }}>
              {daysUntil != null && daysUntil <= 1 ? "Track now →" : "View tracking →"}
            </div>
          </button>
        </div>

        {/* EVENT TEAM */}
        <Card>
          <SHead title="Your event team" />
          <div style={{ padding: "12px 0" }}>
            <div>
              <div style={{ fontWeight: 650, color: WINE, fontSize: 14.5 }}>
                {coordinatorName || "Yugo Operations"} · Coordinator
              </div>
              <div style={{ fontSize: 12.5, color: MUTED }}>
                Your point of contact
                {coordinatorPhone ? (
                  <>
                    {" "}·{" "}
                    <a href={telHref || undefined} style={{ color: ROSE, textDecoration: "none", fontWeight: 600 }}>
                      {coordinatorPhone}
                    </a>
                  </>
                ) : null}
              </div>
            </div>
          </div>
          <div style={{ padding: "12px 0", borderTop: `1px solid ${LINE2}` }}>
            <div>
              <div style={{ fontWeight: 650, color: WINE, fontSize: 14.5 }}>
                On-site crew{crew ? ` of ${crew}` : ""}
              </div>
              <div style={{ fontSize: 12.5, color: MUTED }}>
                Names shared about a week before{deliveryDate ? ` ${fmtDate(deliveryDate)}` : " delivery"}
              </div>
            </div>
          </div>
        </Card>

        {/* LOGISTICS DETAIL */}
        <Card>
          <details open>
            <summary
              style={{
                cursor: "pointer",
                listStyle: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <h3 className="font-hero" style={{ margin: 0, fontSize: 19, color: WINE, fontWeight: 600 }}>
                Logistics detail
              </h3>
              <span style={{ color: MUTED }}>▾</span>
            </summary>
            <div style={{ marginTop: 14 }}>
              {[
                venueName ? { l: "Venue", v: venueAddr ? `${venueName}, ${venueAddr.replace(`${venueName}, `, "")}` : venueName } : null,
                origin ? { l: "Origin", v: origin } : null,
                deliveryDate ? { l: "Delivery window", v: `${fmtDate(deliveryDate)}${arrivalWindow ? ` · ${arrivalWindow}` : ""}` } : null,
                returnDate ? { l: "Return", v: `${fmtDate(returnDate)} · teardown & return` } : null,
                truck ? { l: "Fleet", v: truck } : null,
                crew ? { l: "Crew", v: `${crew}-person dedicated team` } : null,
              ]
                .filter(Boolean)
                .map((r, i, arr) => {
                  const row = r as { l: string; v: string };
                  return (
                    <div
                      key={i}
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: 16,
                        padding: "11px 0",
                        borderBottom: i < arr.length - 1 ? `1px solid ${LINE2}` : "none",
                        fontSize: 13.5,
                      }}
                    >
                      <span style={{ color: MUTED }}>{row.l}</span>
                      <span style={{ color: WINE, textAlign: "right", fontWeight: 550 }}>{row.v}</span>
                    </div>
                  );
                })}
            </div>
          </details>
        </Card>

        {/* SUPPORT */}
        <Card style={{ textAlign: "center", padding: "28px 22px" }}>
          <h3 className="font-hero" style={{ margin: 0, fontSize: 20, color: WINE, fontWeight: 600 }}>
            Need to change your event details?
          </h3>
          <p style={{ color: MUTED, fontSize: 13, margin: "8px 0 16px" }}>
            Timing, access, or the item list, your coordinator reviews every change before delivery day.
          </p>
          {telHref ? (
            <a
              href={telHref}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                border: `1px solid ${LINE}`,
                background: CARD,
                color: WINE,
                fontWeight: 600,
                fontSize: 13.5,
                padding: "11px 20px",
                borderRadius: 12,
                textDecoration: "none",
              }}
            >
              Call {coordinatorName?.split(/\s+/)[0] || "your coordinator"}
            </a>
          ) : null}
        </Card>
      </div>
    </div>
  );
}

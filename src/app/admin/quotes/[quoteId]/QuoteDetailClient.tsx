"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  PencilSimple as Pencil,
  ArrowSquareOut as ExternalLink,
  Eye,
  CursorClick as MousePointerClick,
  ToggleRight,
  FileText,
  CreditCard,
  SignOut as LogOut,
  ChartBar as BarChart3,
  Monitor,
  DeviceMobile as Smartphone,
  Trash as Trash2,
  CaretDown as ChevronDown,
} from "@phosphor-icons/react";
import { toTitleCase } from "@/lib/format-text";
import { formatPhone } from "@/lib/phone";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface EngagementEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  session_duration_seconds: number | null;
  device_type: string | null;
  created_at: string;
}

interface LegacyEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface Props {
  quote: any;
  engagement: EngagementEvent[];
  legacyEvents: LegacyEvent[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-[var(--brd)] text-[var(--tx3)]",
  sent: "bg-amber-500/15 text-amber-400",
  viewed: "bg-blue-500/15 text-blue-400",
  accepted: "bg-green-500/15 text-green-400",
  expired: "bg-red-500/15 text-red-400",
  declined: "bg-red-500/15 text-red-400",
};

const EVENT_CONFIG: Record<string, { icon: typeof Eye; label: string; color: string }> = {
  page_view: { icon: Eye, label: "Viewed quote page", color: "text-blue-400" },
  tier_clicked: { icon: MousePointerClick, label: "Clicked tier", color: "text-[var(--gold)]" },
  tier_hovered: { icon: MousePointerClick, label: "Hovered tier", color: "text-[var(--tx3)]" },
  addon_toggled: { icon: ToggleRight, label: "Toggled add-on", color: "text-purple-400" },
  contract_viewed: { icon: FileText, label: "Viewed contract section", color: "text-emerald-400" },
  payment_started: { icon: CreditCard, label: "Started payment", color: "text-green-400" },
  payment_abandoned: { icon: CreditCard, label: "Abandoned payment", color: "text-red-400" },
  comparison_viewed: { icon: BarChart3, label: "Viewed comparison", color: "text-cyan-400" },
  call_crew_clicked: { icon: ExternalLink, label: "Clicked contact", color: "text-[var(--gold)]" },
  page_exit: { icon: LogOut, label: "Left page", color: "text-[var(--tx3)]" },
  quote_viewed: { icon: Eye, label: "Viewed quote", color: "text-blue-400" },
  tier_selected: { icon: MousePointerClick, label: "Selected tier", color: "text-[var(--gold)]" },
  contract_started: { icon: FileText, label: "Started contract", color: "text-emerald-400" },
  contract_signed: { icon: FileText, label: "Signed contract", color: "text-green-400" },
  quote_abandoned: { icon: LogOut, label: "Abandoned quote", color: "text-red-400" },
};

function fmtCurrency(n: number): string {
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function engagementSignal(events: EngagementEvent[]): { label: string; color: string } {
  const types = new Set(events.map((e) => e.event_type));
  if (types.has("payment_started")) return { label: "Hot — started payment", color: "text-green-400" };
  if (types.has("contract_viewed") && types.has("tier_clicked"))
    return { label: "Warm — reviewed contract", color: "text-emerald-400" };
  if (types.has("tier_clicked")) return { label: "Engaged — exploring tiers", color: "text-blue-400" };
  if (types.has("page_view")) {
    const maxDur = Math.max(...events.map((e) => e.session_duration_seconds ?? 0));
    if (maxDur < 30) return { label: "Cold — quick glance", color: "text-red-400" };
    return { label: "Lukewarm — browsed briefly", color: "text-amber-400" };
  }
  return { label: "No engagement", color: "text-[var(--tx3)]" };
}

export default function QuoteDetailClient({ quote, engagement, legacyEvents }: Props) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [recoveringMove, setRecoveringMove] = useState(false);

  async function handleRecoverMove() {
    if (!window.confirm("Create a move record from this accepted quote?")) return;
    setRecoveringMove(true);
    try {
      const res = await fetch("/api/admin/quotes/recover-move", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.quote_id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      if (data.move_code) {
        router.push(`/admin/moves/${data.move_code}`);
      } else {
        alert("Move created. Check the Moves page.");
        router.push("/admin/moves");
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create move");
    } finally {
      setRecoveringMove(false);
    }
  }
  const contact = Array.isArray(quote.contacts) ? quote.contacts[0] : quote.contacts;

  async function handleDeleteDraft() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to delete");
      } else {
        router.push("/admin/quotes");
      }
    } catch {
      alert("Failed to delete quote");
    } finally {
      setDeleting(false);
    }
  }
  const factors = quote.factors_applied as Record<string, unknown> | null;
  const signal = engagementSignal(engagement);

  const allEvents = [
    ...engagement.map((e) => ({
      id: e.id,
      type: e.event_type,
      data: e.event_data,
      duration: e.session_duration_seconds,
      device: e.device_type,
      at: e.created_at,
      source: "engagement" as const,
    })),
    ...legacyEvents
      .filter((e) => !engagement.some((eg) => Math.abs(new Date(eg.created_at).getTime() - new Date(e.created_at).getTime()) < 5000 && eg.event_type.includes(e.event_type.replace("quote_", ""))))
      .map((e) => ({
        id: e.id,
        type: e.event_type,
        data: e.metadata,
        duration: null as number | null,
        device: null as string | null,
        at: e.created_at,
        source: "legacy" as const,
      })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3">
        <div>
          <button
            type="button"
            onClick={() => router.back()}
            className="p-1.5 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)]"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/60 mb-1.5">Sales · Quote</p>
            <h1 className="text-[22px] md:text-[24px] font-bold text-[var(--tx)] tracking-tight">
              {quote.quote_id}
            </h1>
            <p className="text-[11px] text-[var(--tx3)] mt-1">
              {toTitleCase(quote.service_type?.replace(/_/g, " "))} &middot; Created{" "}
              {new Date(quote.created_at).toLocaleDateString("en-CA", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
          <span
            className={`text-[10px] font-bold tracking-wider uppercase px-2.5 py-1 rounded-full ${STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft}`}
          >
            {toTitleCase(quote.status)}
          </span>
          {quote.status === "draft" && !showDeleteConfirm && (
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--red)] px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:border-[var(--red)]/40 transition-colors"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          )}
          {showDeleteConfirm && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleDeleteDraft}
                disabled={deleting}
                className="flex items-center gap-1.5 text-[11px] font-bold text-[var(--red)] bg-[var(--red)]/10 hover:bg-[var(--red)]/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Confirm Delete"}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)] px-2 py-1.5 transition-colors"
              >
                Cancel
              </button>
            </div>
          )}
          {quote.status === "accepted" && (
            <button
              type="button"
              onClick={handleRecoverMove}
              disabled={recoveringMove}
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--grn)] hover:text-[var(--grn)]/80 px-3 py-1.5 rounded-lg border border-[var(--grn)]/40 hover:border-[var(--grn)] bg-[var(--grn)]/10 disabled:opacity-50 transition-colors"
            >
              {recoveringMove ? "Creating…" : "Create Move"}
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/admin/quotes/${quote.quote_id}/edit`)}
            className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--gold)] hover:text-[var(--gold)]/80 px-3 py-1.5 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)]/40"
          >
            <Pencil className="w-3 h-3" /> Edit All Details
          </button>
          {quote.quote_url && (
            <a
              href={quote.quote_url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tx3)] hover:text-[var(--tx)] px-3 py-1.5 rounded-lg border border-[var(--brd)]"
            >
              <ExternalLink className="w-3 h-3" /> Client View
            </a>
          )}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Quote Details */}
        <div className="lg:col-span-2 space-y-0">
          {/* Quote Summary */}
          <div className="pb-6">
            <h2 className="admin-section-h2 mb-4">
              Quote Summary
            </h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                  Client
                </span>
                <p className="text-[13px] font-medium text-[var(--tx)]">
                  {contact?.name ?? "—"}
                </p>
                <p className="text-[11px] text-[var(--tx3)]">{contact?.email ?? "—"}</p>
                {contact?.phone && (
                  <p className="text-[11px] text-[var(--tx3)]">{formatPhone(contact.phone)}</p>
                )}
              </div>
              <div>
                <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                  Move Date
                </span>
                <p className="text-[13px] font-medium text-[var(--tx)]">
                  {quote.move_date
                    ? new Date(quote.move_date + "T00:00:00").toLocaleDateString("en-CA", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "TBD"}
                </p>
              </div>
              <div>
                <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                  Route
                </span>
                <p className="text-[11px] text-[var(--tx)]">{quote.from_address}</p>
                <p className="text-[11px] text-[var(--tx3)]">→ {quote.to_address}</p>
                {quote.distance_km && (
                  <p className="text-[10px] text-[var(--tx3)]/60 mt-0.5">
                    {quote.distance_km} km
                  </p>
                )}
              </div>
              <div>
                <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                  Amount
                </span>
                {(() => {
                  const HST = 0.13;
                  if (quote.tiers) {
                    const t = quote.tiers as Record<string, any>;
                    const prices = Object.values(t).map((v: any) => v.price as number);
                    const lo = Math.min(...prices);
                    const hi = Math.max(...prices);
                    return (
                      <>
                        <p className="text-[18px] font-bold text-[var(--gold)] font-heading">
                          {fmtCurrency(lo)}–{fmtCurrency(hi)}
                        </p>
                        <span className="text-[9px] text-[var(--tx3)]">
                          +{fmtCurrency(Math.round(lo * HST))}–{fmtCurrency(Math.round(hi * HST))} HST (13%)
                        </span>
                      </>
                    );
                  }
                  const base = quote.custom_price ?? 0;
                  return (
                    <>
                      <p className="text-[18px] font-bold text-[var(--gold)] font-heading">
                        {fmtCurrency(base)}
                      </p>
                      <span className="text-[9px] text-[var(--tx3)]">
                        +{fmtCurrency(Math.round(base * HST))} HST (13%)
                      </span>
                    </>
                  );
                })()}
              </div>
            </div>
            {/* Truck + Crew */}
            {(quote.truck_primary || factors?.est_crew_size || quote.est_crew_size) && (
              <div className="border-t border-[var(--brd)]/30 pt-3 flex flex-wrap gap-4">
                {quote.truck_primary && (
                  <div>
                    <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                      Vehicle
                    </span>
                    <p className="text-[11px] font-medium text-[var(--tx)]">
                      {toTitleCase(quote.truck_primary)}
                      {quote.truck_secondary ? ` + ${toTitleCase(quote.truck_secondary)}` : ""}
                    </p>
                  </div>
                )}
                {(quote.est_crew_size ?? factors?.est_crew_size) && (
                  <div>
                    <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                      Crew
                    </span>
                    <p className="text-[11px] font-medium text-[var(--tx)]">
                      {quote.est_crew_size ?? factors?.est_crew_size} movers
                    </p>
                  </div>
                )}
                {quote.est_hours && (
                  <div>
                    <span className="text-[9px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">
                      Est. Hours
                    </span>
                    <p className="text-[11px] font-medium text-[var(--tx)]">
                      ~{quote.est_hours}h
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Client Engagement */}
          <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="admin-section-h2">
                Client Engagement
              </h2>
              <span className={`text-[10px] font-bold ${signal.color}`}>{signal.label}</span>
            </div>

            {engagement.length === 0 && legacyEvents.length === 0 ? (
              <p className="text-[11px] text-[var(--tx3)] italic">
                No engagement recorded yet. The client has not opened this quote.
              </p>
            ) : (() => {
              const COLLAPSED_LIMIT = 4;
              const visibleEvents = engagementExpanded ? allEvents : allEvents.slice(0, COLLAPSED_LIMIT);
              const hasMore = allEvents.length > COLLAPSED_LIMIT;

              return (
                <div className="space-y-0">
                  {visibleEvents.map((ev, i) => {
                    const cfg = EVENT_CONFIG[ev.type] ?? {
                      icon: Eye,
                      label: toTitleCase(ev.type),
                      color: "text-[var(--tx3)]",
                    };
                    const Icon = cfg.icon;
                    const detail = ev.data
                      ? Object.entries(ev.data)
                          .filter(([, v]) => v != null && v !== "")
                          .map(([k, v]) => `${k}: ${v}`)
                          .join(", ")
                      : "";

                    return (
                      <div key={ev.id} className="flex items-start gap-3 py-2">
                        <div className="relative flex flex-col items-center">
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cfg.color} bg-[var(--bg)]`}
                          >
                            <Icon className="w-3 h-3" />
                          </div>
                          {i < visibleEvents.length - 1 && (
                            <div className="w-px flex-1 min-h-[16px] bg-[var(--brd)]/50" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0 -mt-0.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[11px] font-medium text-[var(--tx)]">
                              {cfg.label}
                            </span>
                            {detail && (
                              <span className="text-[10px] text-[var(--tx3)]">
                                ({detail})
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[9px] text-[var(--tx3)]/60">
                              {timeAgo(ev.at)}
                            </span>
                            {ev.duration != null && (
                              <span className="text-[9px] text-[var(--tx3)]/60">
                                · {fmtDuration(ev.duration)} on page
                              </span>
                            )}
                            {ev.device && (
                              <span className="text-[var(--tx3)]/40">
                                {ev.device === "mobile" ? (
                                  <Smartphone className="w-2.5 h-2.5 inline" />
                                ) : (
                                  <Monitor className="w-2.5 h-2.5 inline" />
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {hasMore && (
                    <button
                      type="button"
                      onClick={() => setEngagementExpanded((prev) => !prev)}
                      className="flex items-center gap-1.5 mt-2 py-1.5 px-2.5 rounded-lg text-[10px] font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors"
                    >
                      <ChevronDown
                        className={`w-3 h-3 transition-transform ${engagementExpanded ? "rotate-180" : ""}`}
                      />
                      {engagementExpanded
                        ? "Show less"
                        : `View all ${allEvents.length} events`}
                    </button>
                  )}
                </div>
              );
            })()}
          </div>
        </div>

        {/* Right: Quick Stats */}
        <div className="space-y-0">
          {/* Timeline — card treatment for prominence */}
          <div className="rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] p-4 mb-5">
            <h2 className="admin-section-h2 text-[var(--gold)] mb-3">
              Timeline
            </h2>
            <div className="space-y-2.5 text-[11px]">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--tx3)]" />
                <span className="text-[var(--tx3)] flex-1">Created</span>
                <span className="text-[var(--tx)] font-medium">
                  {new Date(quote.created_at).toLocaleDateString("en-CA", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {quote.sent_at && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
                  <span className="text-[var(--tx3)] flex-1">Sent</span>
                  <span className="text-[var(--tx)] font-medium">
                    {new Date(quote.sent_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {quote.viewed_at && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                  <span className="text-[var(--tx3)] flex-1">First Viewed</span>
                  <span className="text-blue-400 font-medium">
                    {new Date(quote.viewed_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {quote.accepted_at && (
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span className="text-[var(--tx3)] flex-1">Accepted</span>
                  <span className="text-green-400 font-medium">
                    {new Date(quote.accepted_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              )}
              {quote.expires_at && (
                <div className="flex items-center gap-2.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${new Date(quote.expires_at) < new Date() ? "bg-red-400" : "bg-[var(--tx3)]"}`} />
                  <span className="text-[var(--tx3)] flex-1">Expires</span>
                  <span
                    className={`font-medium ${new Date(quote.expires_at) < new Date() ? "text-red-400" : "text-[var(--tx)]"}`}
                  >
                    {new Date(quote.expires_at).toLocaleDateString("en-CA", {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Move Details */}
          <div className="pb-5">
            <h2 className="admin-section-h2 mb-3">Move Details</h2>
            <div className="space-y-2 text-[11px]">
              <div className="flex justify-between">
                <span className="text-[var(--tx3)]">Service</span>
                <span className="text-[var(--tx)] font-medium">{toTitleCase(quote.service_type?.replace(/_/g, " "))}</span>
              </div>
              {quote.move_size && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Size</span>
                  <span className="text-[var(--tx)] font-medium">{quote.move_size}</span>
                </div>
              )}
              {quote.truck_primary && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Vehicle</span>
                  <span className="text-[var(--tx)] font-medium">{toTitleCase(quote.truck_primary)}</span>
                </div>
              )}
              {(quote.est_crew_size ?? (factors as any)?.est_crew_size) && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Crew</span>
                  <span className="text-[var(--tx)] font-medium">{quote.est_crew_size ?? (factors as any)?.est_crew_size} movers</span>
                </div>
              )}
              {quote.est_hours && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Est. Hours</span>
                  <span className="text-[var(--tx)] font-medium">~{quote.est_hours}h</span>
                </div>
              )}
              {quote.distance_km && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Distance</span>
                  <span className="text-[var(--tx)] font-medium">{quote.distance_km} km</span>
                </div>
              )}
              {quote.move_id && (
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Move</span>
                  <a href={`/admin/moves/${quote.move_id}`} className="text-[var(--gold)] font-medium hover:underline">View Move</a>
                </div>
              )}
            </div>
          </div>

          {/* Engagement Stats */}
          {engagement.length > 0 && (
            <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
              <h2 className="admin-section-h2 mb-3">
                Engagement Stats
              </h2>
              <div className="space-y-2 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Page Views</span>
                  <span className="text-[var(--tx)] font-medium">
                    {engagement.filter((e) => e.event_type === "page_view").length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Longest Session</span>
                  <span className="text-[var(--tx)] font-medium">
                    {fmtDuration(
                      Math.max(...engagement.map((e) => e.session_duration_seconds ?? 0)),
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Total Events</span>
                  <span className="text-[var(--tx)] font-medium">{engagement.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)]">Device</span>
                  <span className="text-[var(--tx)] font-medium capitalize">
                    {engagement.find((e) => e.device_type)?.device_type ?? "—"}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

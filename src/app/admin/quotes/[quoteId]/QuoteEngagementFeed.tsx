"use client";

/**
 * Client engagement activity feed, shared between the residential move quote
 * (QuoteDetailClient) and the commercial delivery quote (B2BQuoteDetailClient)
 * so both show the SAME chronological list of every client action, newest
 * first. Self-contained: the config + formatters + event merge mirror the
 * residential page one-to-one.
 */

import { useState } from "react";
import {
  Eye,
  MousePointerClick,
  ToggleRight,
  FileText,
  CreditCard,
  BarChart3,
  ExternalLink,
  LogOut,
  Smartphone,
  Monitor,
  ChevronDown,
} from "lucide-react";
import { toTitleCase } from "@/lib/format-text";
import { displayLabel } from "@/lib/displayLabels";
import { formatPlatformDisplay } from "@/lib/date-format";

export interface EngagementEvent {
  id: string;
  event_type: string;
  event_data: Record<string, unknown> | null;
  session_duration_seconds: number | null;
  device_type: string | null;
  created_at: string;
}
export interface LegacyEvent {
  id: string;
  event_type: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

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
  engagement_ping: { icon: Eye, label: "Activity ping", color: "text-[var(--tx3)]" },
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
function truncateAdminText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}
function hasResidentialTiers(tiers: unknown): boolean {
  if (!tiers) return false;
  try {
    const obj: Record<string, unknown> =
      typeof tiers === "string" ? (JSON.parse(tiers) as Record<string, unknown>) : (tiers as Record<string, unknown>);
    if (!obj || typeof obj !== "object") return false;
    const keys = Object.keys(obj).map((k) => k.toLowerCase());
    return keys.some((k) => ["essential", "curated", "signature", "estate", "premier", "essentials"].includes(k));
  } catch {
    return false;
  }
}

function ContractSignedEngagementDetail({ data, isSuperAdmin }: { data: Record<string, unknown> | null | undefined; isSuperAdmin: boolean }) {
  if (!data || typeof data !== "object") return null;
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : "");
  const typedName = str(data.typed_name);
  const signedRaw = str(data.signed_at);
  const signedLabel =
    signedRaw && !Number.isNaN(Date.parse(signedRaw))
      ? formatPlatformDisplay(signedRaw, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
      : signedRaw || "-";
  const deposit = str(data.deposit);
  const total = str(data.grand_total);
  const pkg = str(data.package_label);
  const ver = str(data.agreement_version);
  const ip = str(data.ip_address);
  const ua = str(data.user_agent);
  const uaShort = ua ? truncateAdminText(ua, isSuperAdmin ? 120 : 72) : "";
  const Row = ({ label, value }: { label: string; value: string }) => (
    <div className="min-w-0">
      <dt className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">{label}</dt>
      <dd className="text-[11px] font-medium text-[var(--tx)] mt-0.5 break-words">{value || "-"}</dd>
    </div>
  );
  return (
    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-left max-w-xl">
      {typedName ? <Row label="Signed name" value={typedName} /> : null}
      <Row label="Signed at" value={signedLabel} />
      {deposit && Number.isFinite(Number(deposit)) ? <Row label="Deposit" value={fmtCurrency(Number(deposit))} /> : null}
      {total && Number.isFinite(Number(total)) ? <Row label="Grand total" value={fmtCurrency(Number(total))} /> : null}
      {pkg ? <Row label="Package" value={pkg} /> : null}
      {ver ? <Row label="Agreement version" value={ver} /> : null}
      {isSuperAdmin && ip ? <Row label="IP" value={ip} /> : null}
      {uaShort ? (
        <div className="sm:col-span-2 min-w-0">
          <dt className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">{isSuperAdmin ? "User agent" : "Browser"}</dt>
          <dd className="text-[11px] font-medium text-[var(--tx)] mt-0.5 break-all">{uaShort}</dd>
        </div>
      ) : null}
    </dl>
  );
}

function formatEngagementEventDetail(eventType: string, data: Record<string, unknown> | null | undefined, showTierFields: boolean): string {
  if (!data || typeof data !== "object") return "";
  if (eventType === "contract_signed") return "";
  if (eventType === "engagement_ping") {
    const sp = data.scroll_pct;
    if (typeof sp === "number" && Number.isFinite(sp)) return `Scroll ${Math.round(sp)}%`;
    return "";
  }
  const parts: string[] = [];
  if (data.source != null && data.source !== "") {
    const s = String(data.source).toLowerCase();
    if (s === "server") parts.push("Server");
    else if (s === "client") parts.push("Client");
    else parts.push(toTitleCase(String(data.source)));
  }
  const skip = new Set(["source", "service_type", "scroll_pct", "elapsed_seconds"]);
  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "") continue;
    if (skip.has(k)) continue;
    if ((k === "tier" || k === "selected_tier") && !showTierFields) continue;
    if (k === "tier" || k === "selected_tier") {
      const t = String(v).toLowerCase();
      const label = t === "essential" || t === "curated" ? "Essential" : t === "signature" ? "Signature" : t === "estate" ? "Estate" : toTitleCase(String(v).replace(/_/g, " "));
      parts.push(`Tier: ${label}`);
      continue;
    }
    if (k === "addon_slug") {
      parts.push(`Add-on: ${displayLabel(String(v)) || toTitleCase(String(v).replace(/_/g, " "))}`);
      continue;
    }
    if (k === "addons_selected") { parts.push(`Add-ons: ${v}`); continue; }
    if (k === "contract_signed") { parts.push(typeof v === "boolean" && v ? "Contract signed" : "Contract not signed"); continue; }
    parts.push(`${toTitleCase(k.replace(/_/g, " "))}: ${typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}`);
  }
  return parts.join(" · ");
}

function engagementSignal(events: EngagementEvent[], showTiered: boolean): { label: string; color: string } {
  const types = new Set(events.map((e) => e.event_type));
  if (showTiered) {
    if (types.has("payment_started")) return { label: "Hot, started payment", color: "text-green-400" };
    if (types.has("contract_viewed") && types.has("tier_clicked")) return { label: "Warm, reviewed contract", color: "text-emerald-400" };
    if (types.has("tier_clicked")) return { label: "Interested, compared tiers", color: "text-amber-400" };
    if (types.has("page_view")) return { label: "Lukewarm, browsed briefly", color: "text-amber-400" };
    return { label: "No engagement", color: "text-[var(--tx3)]" };
  }
  if (types.has("payment_started")) return { label: "Hot, started payment", color: "text-green-400" };
  if (types.has("contract_viewed")) return { label: "Warm, reviewed contract", color: "text-emerald-400" };
  if (types.has("page_view")) {
    const maxDur = Math.max(0, ...events.map((e) => e.session_duration_seconds ?? 0));
    if (maxDur < 30) return { label: "Cold, quick glance", color: "text-red-400" };
    return { label: "Lukewarm, browsed briefly", color: "text-amber-400" };
  }
  return { label: "No engagement", color: "text-[var(--tx3)]" };
}

type MergedEvent = {
  id: string;
  type: string;
  data: Record<string, unknown> | null;
  duration: number | null;
  device: string | null;
  at: string;
};

function clipAfterSend<T extends { created_at: string }>(rows: T[], sentAt: string | null): T[] {
  if (sentAt == null || String(sentAt).trim() === "") return rows;
  const clip = Date.parse(String(sentAt));
  if (!Number.isFinite(clip)) return rows;
  return rows.filter((e) => {
    const t = Date.parse(String(e.created_at || ""));
    return Number.isFinite(t) && t >= clip;
  });
}

export default function QuoteEngagementFeed({
  engagement,
  legacyEvents,
  sentAt,
  tiers,
  isSuperAdmin = false,
  className = "",
}: {
  engagement: EngagementEvent[];
  legacyEvents: LegacyEvent[];
  sentAt: string | null;
  tiers?: unknown;
  isSuperAdmin?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const showTiered = hasResidentialTiers(tiers);

  const engagementAfterSend = clipAfterSend(engagement, sentAt);
  const legacyAfterSend = clipAfterSend(legacyEvents, sentAt);
  const signal = engagementSignal(engagementAfterSend, showTiered);

  const allEvents: MergedEvent[] = [
    ...engagementAfterSend.map((e) => ({
      id: e.id,
      type: e.event_type,
      data: e.event_data,
      duration: e.session_duration_seconds,
      device: e.device_type,
      at: e.created_at,
    })),
    ...legacyAfterSend
      .filter(
        (e) =>
          !engagementAfterSend.some(
            (eg) =>
              Math.abs(new Date(eg.created_at).getTime() - new Date(e.created_at).getTime()) < 5000 &&
              eg.event_type.includes(e.event_type.replace("quote_", "")),
          ),
      )
      .map((e) => ({ id: e.id, type: e.event_type, data: e.metadata, duration: null, device: null, at: e.created_at })),
  ]
    .filter((e) => (showTiered ? true : !["tier_clicked", "tier_hovered", "tier_selected", "comparison_viewed"].includes(String(e.type || ""))))
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const empty = engagementAfterSend.length === 0 && legacyAfterSend.length === 0;
  const COLLAPSED_LIMIT = 4;
  const visibleEvents = expanded ? allEvents : allEvents.slice(0, COLLAPSED_LIMIT);
  const hasMore = allEvents.length > COLLAPSED_LIMIT;

  return (
    <div className={className}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="admin-section-h2">Client Engagement</h2>
        <span className={`text-[10px] font-bold ${signal.color}`}>{signal.label}</span>
      </div>

      {empty ? (
        <p className="text-[11px] text-[var(--tx3)] italic">No engagement recorded yet. The client has not opened this quote.</p>
      ) : (
        <div className="space-y-0">
          {visibleEvents.map((ev, i) => {
            const cfg = EVENT_CONFIG[ev.type] ?? { icon: Eye, label: toTitleCase(ev.type), color: "text-[var(--tx3)]" };
            const Icon = cfg.icon;
            const detail = ev.type === "contract_signed" ? "" : formatEngagementEventDetail(ev.type, ev.data, showTiered);
            return (
              <div key={ev.id} className="flex items-start gap-3 py-2">
                <div className="relative flex flex-col items-center">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${cfg.color} bg-[var(--bg)]`}>
                    <Icon className="w-3 h-3" />
                  </div>
                  {i < visibleEvents.length - 1 && <div className="w-px flex-1 min-h-[16px] bg-[var(--brd)]/50" />}
                </div>
                <div className="flex-1 min-w-0 -mt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] font-medium text-[var(--tx)]">{cfg.label}</span>
                    {detail && <span className="text-[10px] text-[var(--tx3)]">({detail})</span>}
                  </div>
                  {ev.type === "contract_signed" ? <ContractSignedEngagementDetail data={ev.data} isSuperAdmin={isSuperAdmin} /> : null}
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-[var(--tx3)]/82">{timeAgo(ev.at)}</span>
                    {ev.duration != null && <span className="text-[9px] text-[var(--tx3)]/82">· {fmtDuration(ev.duration)} on page</span>}
                    {ev.device && (
                      <span className="text-[var(--tx3)]/40">
                        {ev.device === "mobile" ? <Smartphone className="w-2.5 h-2.5 inline" /> : <Monitor className="w-2.5 h-2.5 inline" />}
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
              onClick={() => setExpanded((p) => !p)}
              className="flex items-center gap-1.5 mt-2 py-1.5 px-2.5 rounded-lg text-[10px] font-medium text-[var(--gold)] hover:bg-[var(--gold)]/10 transition-colors"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
              {expanded ? "Show less" : `View all ${allEvents.length} events`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

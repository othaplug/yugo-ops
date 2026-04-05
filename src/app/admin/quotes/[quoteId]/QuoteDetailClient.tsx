"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  ArrowLeft,
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
  PencilSimple as Pencil,
} from "@phosphor-icons/react";
import {
  ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS,
  ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS,
} from "../../components/admin-toolbar-action-classes";
import { formatPlatformDisplay } from "@/lib/date-format";
import { toTitleCase } from "@/lib/format-text";
import { displayLabel } from "@/lib/displayLabels";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatPhone } from "@/lib/phone";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";
import { quoteDetailDateLabel } from "@/lib/quotes/quote-field-labels";
import type { QuoteEngagementMetrics } from "@/lib/quotes/comparison-intelligence";

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
  isSuperAdmin?: boolean;
  followupsSentCount?: number;
  followupMaxAttempts?: number;
  engagementMetrics?: QuoteEngagementMetrics | null;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "text-[var(--tx3)]",
  sent: "text-amber-400",
  viewed: "text-blue-400",
  accepted: "text-green-400",
  expired: "text-red-400",
  declined: "text-red-400",
  cold: "text-cyan-400",
  lost: "text-red-400",
  reactivated: "text-purple-400",
  superseded: "text-[var(--tx3)]",
  payment_failed: "text-orange-400",
};

const LOSS_REASON_OPTIONS: { value: string; label: string }[] = [
  { value: "competitor", label: "Went with competitor" },
  { value: "postponed", label: "Move postponed" },
  { value: "budget", label: "Over budget" },
  { value: "no_response", label: "No response" },
  { value: "other", label: "Other" },
];

const EVENT_CONFIG: Record<
  string,
  { icon: typeof Eye; label: string; color: string }
> = {
  page_view: { icon: Eye, label: "Viewed quote page", color: "text-blue-400" },
  tier_clicked: {
    icon: MousePointerClick,
    label: "Clicked tier",
    color: "text-[var(--gold)]",
  },
  tier_hovered: {
    icon: MousePointerClick,
    label: "Hovered tier",
    color: "text-[var(--tx3)]",
  },
  addon_toggled: {
    icon: ToggleRight,
    label: "Toggled add-on",
    color: "text-purple-400",
  },
  contract_viewed: {
    icon: FileText,
    label: "Viewed contract section",
    color: "text-emerald-400",
  },
  payment_started: {
    icon: CreditCard,
    label: "Started payment",
    color: "text-green-400",
  },
  payment_abandoned: {
    icon: CreditCard,
    label: "Abandoned payment",
    color: "text-red-400",
  },
  comparison_viewed: {
    icon: BarChart3,
    label: "Viewed comparison",
    color: "text-cyan-400",
  },
  call_crew_clicked: {
    icon: ExternalLink,
    label: "Clicked contact",
    color: "text-[var(--gold)]",
  },
  page_exit: { icon: LogOut, label: "Left page", color: "text-[var(--tx3)]" },
  engagement_ping: {
    icon: Eye,
    label: "Activity ping",
    color: "text-[var(--tx3)]",
  },
  quote_viewed: { icon: Eye, label: "Viewed quote", color: "text-blue-400" },
  tier_selected: {
    icon: MousePointerClick,
    label: "Selected tier",
    color: "text-[var(--gold)]",
  },
  contract_started: {
    icon: FileText,
    label: "Started contract",
    color: "text-emerald-400",
  },
  contract_signed: {
    icon: FileText,
    label: "Signed contract",
    color: "text-green-400",
  },
  quote_abandoned: {
    icon: LogOut,
    label: "Abandoned quote",
    color: "text-red-400",
  },
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

function engagementSignal(events: EngagementEvent[]): {
  label: string;
  color: string;
} {
  const types = new Set(events.map((e) => e.event_type));
  if (types.has("payment_started"))
    return { label: "Hot, started payment", color: "text-green-400" };
  if (types.has("contract_viewed") && types.has("tier_clicked"))
    return { label: "Warm, reviewed contract", color: "text-emerald-400" };
  if (types.has("tier_clicked"))
    return { label: "Engaged, exploring tiers", color: "text-blue-400" };
  if (types.has("page_view")) {
    const maxDur = Math.max(
      ...events.map((e) => e.session_duration_seconds ?? 0),
    );
    if (maxDur < 30)
      return { label: "Cold, quick glance", color: "text-red-400" };
    return { label: "Lukewarm, browsed briefly", color: "text-amber-400" };
  }
  return { label: "No engagement", color: "text-[var(--tx3)]" };
}

function tierInterestLine(metrics: QuoteEngagementMetrics): string {
  const entries = Object.entries(metrics.tierClickCounts);
  if (entries.length === 0) return "—";
  return entries
    .map(([k, v]) => `${toTitleCase(k)} ${v}×`)
    .join(", ");
}

export default function QuoteDetailClient({
  quote,
  engagement,
  legacyEvents,
  isSuperAdmin = false,
  followupsSentCount = 0,
  followupMaxAttempts = 3,
  engagementMetrics = null,
}: Props) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecoverConfirm, setShowRecoverConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [recoveringMove, setRecoveringMove] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pipelineStatus, setPipelineStatus] = useState(String(quote.status || "draft"));
  const [lossReasonKey, setLossReasonKey] = useState<string>("competitor");
  const [lossOtherNote, setLossOtherNote] = useState("");
  const [autoFollowup, setAutoFollowup] = useState(
    quote.auto_followup_active !== false,
  );
  const [pipelineSaving, setPipelineSaving] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState<string | null>(null);

  useEffect(() => {
    setPipelineStatus(String(quote.status || "draft"));
    setAutoFollowup(quote.auto_followup_active !== false);
    const lr = String(quote.loss_reason || "");
    if (lr.toLowerCase().startsWith("other:")) {
      setLossReasonKey("other");
      setLossOtherNote(lr.replace(/^other:\s*/i, "").trim());
    } else if (LOSS_REASON_OPTIONS.some((o) => o.value === lr)) {
      setLossReasonKey(lr);
      setLossOtherNote("");
    } else {
      setLossReasonKey("competitor");
      setLossOtherNote("");
    }
  }, [quote.status, quote.auto_followup_active, quote.loss_reason]);

  async function patchQuote(payload: Record<string, unknown>) {
    setPipelineSaving(true);
    setPipelineMsg(null);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Update failed");
      router.refresh();
      setPipelineMsg("Saved.");
    } catch (e) {
      setPipelineMsg(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPipelineSaving(false);
    }
  }

  async function savePipelineStatus() {
    if (pipelineStatus === "lost") {
      const lr =
        lossReasonKey === "other"
          ? lossOtherNote.trim()
            ? `other: ${lossOtherNote.trim()}`
            : "other"
          : lossReasonKey;
      await patchQuote({ status: "lost", loss_reason: lr });
      return;
    }
    if (pipelineStatus === "cold") {
      await patchQuote({ status: "cold", cold_reason: "coordinator_marked" });
      return;
    }
    await patchQuote({ status: pipelineStatus });
  }

  async function saveAutoFollowupToggle(next: boolean) {
    setAutoFollowup(next);
    await patchQuote({ auto_followup_active: next });
  }

  async function handleRecoverMove() {
    setRecoverError(null);
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
        router.push("/admin/moves");
      }
    } catch (err) {
      setRecoverError(
        err instanceof Error ? err.message : "Failed to create move",
      );
    } finally {
      setRecoveringMove(false);
    }
  }
  const contact = Array.isArray(quote.contacts)
    ? quote.contacts[0]
    : quote.contacts;

  async function handleDeleteQuote() {
    setDeleteError(null);
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/quotes/${quote.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error || "Failed to delete");
      } else {
        router.push("/admin/quotes");
      }
    } catch {
      setDeleteError("Failed to delete quote");
    } finally {
      setDeleting(false);
    }
  }

  const canDeleteQuote = quoteStatusAllowsHardDelete(
    quote.status,
    isSuperAdmin,
  );
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
      .filter(
        (e) =>
          !engagement.some(
            (eg) =>
              Math.abs(
                new Date(eg.created_at).getTime() -
                  new Date(e.created_at).getTime(),
              ) < 5000 &&
              eg.event_type.includes(e.event_type.replace("quote_", "")),
          ),
      )
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
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          {/* Row 1: back + eyebrow */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] shrink-0"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82">
              Sales · Quote
            </p>
          </div>

          {/* Row 2: title + status badge */}
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="admin-page-hero text-[var(--tx)]">
              {quote.quote_id}
            </h1>
            <span
              className={`dt-badge tracking-[0.04em] shrink-0 ${STATUS_COLORS[quote.status] ?? STATUS_COLORS.draft}`}
            >
              {toTitleCase(quote.status)}
            </span>
          </div>

          {/* Row 3: subtitle */}
          <p className="text-[12px] text-[var(--tx3)]">
            {displayLabel(quote.service_type) ||
              toTitleCase(quote.service_type?.split("_").join(" ") || "")}{" "}
            &middot; Created{" "}
            {formatPlatformDisplay(quote.created_at, {
              month: "short",
              day: "numeric",
            })}
          </p>

          {/* Row 4: action buttons, wrap on mobile */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() =>
                router.push(`/admin/quotes/${quote.quote_id}/edit`)
              }
              className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
            >
              <Pencil weight="regular" className="w-3 h-3 shrink-0" aria-hidden />
              Edit all details
            </button>
            {quote.quote_url && (
              <a
                href={quote.quote_url}
                target="_blank"
                rel="noreferrer"
                className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
              >
                <ExternalLink weight="regular" className="w-3 h-3 shrink-0" aria-hidden />
                Client view
              </a>
            )}
            {quote.status === "accepted" && (
              <>
                <button
                  type="button"
                  onClick={() => setShowRecoverConfirm(true)}
                  disabled={recoveringMove}
                  className="inline-flex items-center justify-center gap-1.5 min-h-[30px] px-3 py-1.5 rounded-lg text-[10px] font-semibold text-[var(--grn)] border-2 border-[color-mix(in_srgb,var(--grn)_45%,transparent)] bg-[color-mix(in_srgb,var(--grn)_12%,transparent)] hover:border-[var(--grn)] disabled:opacity-50 transition-colors"
                >
                  {recoveringMove ? "Creating…" : "Create Move"}
                </button>
                {recoverError && (
                  <span className="text-[11px] text-[var(--red)]">
                    {recoverError}
                  </span>
                )}
              </>
            )}
            {canDeleteQuote && !showDeleteConfirm && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className={ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS}
              >
                <Trash2 weight="regular" className="w-3 h-3 shrink-0" aria-hidden /> Delete
              </button>
            )}
            {deleting && (
              <span className="text-[11px] text-[var(--tx3)]">Deleting…</span>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 md:p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
            <div>
              <h2 className="admin-section-h2 mb-0">Status &amp; follow-ups</h2>
              <p className="text-[11px] text-[var(--tx3)] mt-1">
                Automated emails sent: {followupsSentCount} of {followupMaxAttempts}
              </p>
            </div>
            {quote.status === "accepted" && (
              <span className="dt-badge tracking-[0.04em] text-green-400 shrink-0">
                Won
              </span>
            )}
          </div>

          {quote.status !== "accepted" && (
            <>
              <div className="grid sm:grid-cols-2 gap-4 items-end">
                <div>
                  <label className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)] block mb-1.5">
                    Pipeline
                  </label>
                  <select
                    value={pipelineStatus}
                    onChange={(e) => setPipelineStatus(e.target.value)}
                    disabled={pipelineSaving}
                    className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)]"
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    <option value="viewed">Viewed</option>
                    <option value="cold">Cold (follow-ups paused)</option>
                    <option value="lost">Lost</option>
                    <option value="declined">Declined (client)</option>
                    <option value="expired">Expired</option>
                    <option value="reactivated">Reactivated</option>
                    <option value="superseded">Superseded</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)] cursor-pointer select-none pb-1">
                  <input
                    type="checkbox"
                    checked={autoFollowup}
                    disabled={pipelineSaving}
                    onChange={(e) => void saveAutoFollowupToggle(e.target.checked)}
                    className="accent-[#2C3E2D]"
                  />
                  Auto follow-up emails
                </label>
              </div>

              {pipelineStatus === "lost" && (
                <div className="space-y-2">
                  <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]">
                    Loss reason
                  </p>
                  <div className="flex flex-col gap-2">
                    {LOSS_REASON_OPTIONS.map((o) => (
                      <label
                        key={o.value}
                        className="flex items-center gap-2 text-[12px] text-[var(--tx)] cursor-pointer"
                      >
                        <input
                          type="radio"
                          name="loss_reason_admin"
                          value={o.value}
                          checked={lossReasonKey === o.value}
                          onChange={() => setLossReasonKey(o.value)}
                          className="accent-[#2C3E2D]"
                        />
                        {o.label}
                      </label>
                    ))}
                  </div>
                  {lossReasonKey === "other" && (
                    <input
                      type="text"
                      value={lossOtherNote}
                      onChange={(e) => setLossOtherNote(e.target.value)}
                      placeholder="Brief details"
                      className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[12px] text-[var(--tx)]"
                    />
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={pipelineSaving}
                  onClick={() => void savePipelineStatus()}
                  className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                >
                  Save status
                </button>
                {!autoFollowup && (
                  <span className="text-[11px] text-[var(--tx3)]">
                    Follow-ups paused
                  </span>
                )}
              </div>
              {pipelineMsg && (
                <p
                  className={`text-[11px] ${pipelineMsg === "Saved." ? "text-[var(--grn)]" : "text-[var(--red)]"}`}
                >
                  {pipelineMsg}
                </p>
              )}
            </>
          )}
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Left: Quote Details */}
          <div className="lg:col-span-2 space-y-0">
            {/* Quote Summary */}
            <div className="pb-6">
              <h2 className="admin-section-h2 mb-5">Quote Summary</h2>
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-5">
                {/* Client */}
                <div>
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)] mb-1.5">
                    Client
                  </p>
                  {quote.service_type === "b2b_delivery" &&
                  factors?.b2b_business_name ? (
                    <>
                      <p className="text-[12px] text-[var(--tx2)]">
                        <span className="text-[var(--tx3)]">Business: </span>
                        {String(factors.b2b_business_name)}
                      </p>
                      <p className="text-[15px] font-semibold text-[var(--tx)] leading-tight mt-1">
                        {contact?.name ?? "-"}
                      </p>
                    </>
                  ) : (
                    <p className="text-[15px] font-semibold text-[var(--tx)] leading-tight">
                      {contact?.name ?? "-"}
                    </p>
                  )}
                  <p className="text-[12px] text-[var(--tx3)] mt-0.5">
                    {contact?.email ?? "-"}
                  </p>
                  {contact?.phone && (
                    <p className="text-[12px] text-[var(--tx3)]">
                      {formatPhone(contact.phone)}
                    </p>
                  )}
                </div>
                {quote.service_type === "b2b_delivery" && factors && (
                  <div className="sm:col-span-2 space-y-2 pt-1 border-t border-[var(--brd)]/40">
                    <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)]">
                      Delivery
                    </p>
                    <div className="grid sm:grid-cols-2 gap-3 text-[12px] text-[var(--tx)]">
                      <div>
                        <span className="text-[var(--tx3)]">Vertical: </span>
                        <span className="font-medium">
                          {(factors.b2b_vertical_name as string) ||
                            displayLabel(
                              String(factors.b2b_vertical_code || ""),
                            ) ||
                            "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[var(--tx3)]">Handling: </span>
                        <span className="font-medium">
                          {displayLabel(
                            String(factors.b2b_handling_type || ""),
                          ) || "—"}
                        </span>
                      </div>
                      {factors.b2b_delivery_window ? (
                        <div className="sm:col-span-2">
                          <span className="text-[var(--tx3)]">Window: </span>
                          <span className="font-medium">
                            {String(factors.b2b_delivery_window)}
                          </span>
                        </div>
                      ) : null}
                      {Array.isArray(factors.b2b_line_items) &&
                      (factors.b2b_line_items as unknown[]).length > 0 ? (
                        <div className="sm:col-span-2">
                          <span className="text-[var(--tx3)] block mb-1">
                            Items
                          </span>
                          <ul className="list-disc list-inside text-[var(--tx2)] space-y-0.5">
                            {(
                              factors.b2b_line_items as {
                                description?: string;
                                quantity?: number;
                              }[]
                            ).map((li, idx) => (
                              <li key={idx}>
                                {Math.max(1, Number(li.quantity) || 1)}×{" "}
                                {li.description || "Item"}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : factors.b2b_items ? (
                        <div className="sm:col-span-2">
                          <span className="text-[var(--tx3)]">Items: </span>
                          <span className="text-[var(--tx2)]">
                            {Array.isArray(factors.b2b_items)
                              ? (factors.b2b_items as string[]).join(", ")
                              : String(factors.b2b_items)}
                          </span>
                        </div>
                      ) : null}
                      {(factors.b2b_assembly_required === true ||
                        factors.b2b_debris_removal === true ||
                        (Array.isArray(factors.b2b_complexity_addons) &&
                          (factors.b2b_complexity_addons as string[]).length >
                            0)) && (
                        <div className="sm:col-span-2 text-[11px] text-[var(--tx2)]">
                          {factors.b2b_assembly_required === true
                            ? "Assembly required. "
                            : ""}
                          {factors.b2b_debris_removal === true
                            ? "Debris removal. "
                            : ""}
                          {Array.isArray(factors.b2b_complexity_addons) &&
                          (factors.b2b_complexity_addons as string[]).length > 0
                            ? `Complexity: ${(
                                factors.b2b_complexity_addons as string[]
                              )
                                .map((k) => displayLabel(k))
                                .join(", ")}`
                            : ""}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {/* Move Date */}
                <div>
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)] mb-1.5">
                    Move Date
                  </p>
                  <p className="text-[15px] font-semibold text-[var(--tx)] leading-tight">
                    {quote.move_date
                      ? formatPlatformDisplay(new Date(quote.move_date + "T00:00:00"), {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })
                      : "TBD"}
                  </p>
                </div>
                {/* Route */}
                <div>
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)] mb-1.5">
                    Route
                  </p>
                  <p className="text-[12px] font-medium text-[var(--tx)] leading-snug">
                    {quote.from_address}
                  </p>
                  <p className="text-[12px] text-[var(--tx3)] leading-snug">
                    → {quote.to_address}
                  </p>
                  {quote.distance_km && (
                    <p className="text-[10px] text-[var(--tx3)] mt-1">
                      {quote.distance_km} km
                    </p>
                  )}
                </div>
                {/* Amount */}
                <div>
                  <p className="text-[9px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)] mb-1.5">
                    Amount
                  </p>
                  {(() => {
                    const HST = 0.13;
                    if (quote.tiers) {
                      const t = quote.tiers as Record<string, any>;
                      const prices = Object.values(t).map(
                        (v: any) => v.price as number,
                      );
                      const lo = Math.min(...prices);
                      const hi = Math.max(...prices);
                      return (
                        <>
                          <p className="text-[22px] font-bold text-[var(--gold)] font-heading leading-tight">
                            {fmtCurrency(lo)}–{fmtCurrency(hi)}
                          </p>
                          <p className="text-[10px] text-[var(--tx3)]/82 mt-0.5">
                            +{fmtCurrency(Math.round(lo * HST))}–
                            {fmtCurrency(Math.round(hi * HST))} HST (13%)
                          </p>
                        </>
                      );
                    }
                    const base = quote.custom_price ?? 0;
                    return (
                      <>
                        <p className="text-[22px] font-bold text-[var(--gold)] font-heading leading-tight">
                          {fmtCurrency(base)}
                        </p>
                        <p className="text-[10px] text-[var(--tx3)]/82 mt-0.5">
                          +{fmtCurrency(Math.round(base * HST))} HST (13%)
                        </p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div className="mt-5 h-px bg-[var(--brd)]/60" />
              {/* Truck + Crew */}
              {(quote.truck_primary ||
                factors?.est_crew_size ||
                quote.est_crew_size) && (
                <div className="mt-3 flex flex-wrap gap-4">
                  {quote.truck_primary && (
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">
                        Vehicle
                      </span>
                      <p className="text-[11px] font-medium text-[var(--tx)] mt-0.5">
                        {displayLabel(quote.truck_primary) ||
                          toTitleCase(quote.truck_primary)}
                        {quote.truck_secondary
                          ? ` + ${displayLabel(quote.truck_secondary) || toTitleCase(quote.truck_secondary)}`
                          : ""}
                      </p>
                    </div>
                  )}
                  {(quote.est_crew_size ?? factors?.est_crew_size) && (
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">
                        Crew
                      </span>
                      <p className="text-[11px] font-medium text-[var(--tx)] mt-0.5">
                        {quote.est_crew_size ?? factors?.est_crew_size}-person
                        crew
                      </p>
                    </div>
                  )}
                  {quote.est_hours && (
                    <div>
                      <span className="text-[10px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">
                        Est. Hours
                      </span>
                      <p className="text-[11px] font-medium text-[var(--tx)] mt-0.5">
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
                <h2 className="admin-section-h2">Client Engagement</h2>
                <span className={`text-[10px] font-bold ${signal.color}`}>
                  {signal.label}
                </span>
              </div>

              {engagement.length === 0 && legacyEvents.length === 0 ? (
                <p className="text-[11px] text-[var(--tx3)] italic">
                  No engagement recorded yet. The client has not opened this
                  quote.
                </p>
              ) : (
                (() => {
                  const COLLAPSED_LIMIT = 4;
                  const visibleEvents = engagementExpanded
                    ? allEvents
                    : allEvents.slice(0, COLLAPSED_LIMIT);
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
                          <div
                            key={ev.id}
                            className="flex items-start gap-3 py-2"
                          >
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
                                <span className="text-[9px] text-[var(--tx3)]/82">
                                  {timeAgo(ev.at)}
                                </span>
                                {ev.duration != null && (
                                  <span className="text-[9px] text-[var(--tx3)]/82">
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
                })()
              )}
            </div>
          </div>

          {/* Right: Quick Stats */}
          <div className="space-y-0">
            {/* Timeline, card treatment for prominence */}
            <div className="rounded-xl border border-[var(--brd)]/50 bg-[var(--card)] p-4 mb-5">
              <h2 className="admin-section-h2 text-[var(--gold)] mb-3">
                Timeline
              </h2>
              <div className="space-y-2.5 text-[11px]">
                <div className="flex items-center gap-2.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--tx3)]" />
                  <span className="text-[var(--tx3)] flex-1">Created</span>
                  <span className="text-[var(--tx)] font-medium">
                    {formatPlatformDisplay(quote.created_at, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {quote.sent_at && (
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-[var(--admin-primary-fill)]" />
                    <span className="text-[var(--tx3)] flex-1">Sent</span>
                    <span className="text-[var(--tx)] font-medium">
                      {formatPlatformDisplay(quote.sent_at, {
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
                    <span className="text-[var(--tx3)] flex-1">
                      First Viewed
                    </span>
                    <span className="text-blue-400 font-medium">
                      {formatPlatformDisplay(quote.viewed_at, {
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
                      {formatPlatformDisplay(quote.accepted_at, {
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
                    <div
                      className={`w-1.5 h-1.5 rounded-full ${new Date(quote.expires_at) < new Date() ? "bg-red-400" : "bg-[var(--tx3)]"}`}
                    />
                    <span className="text-[var(--tx3)] flex-1">Expires</span>
                    <span
                      className={`font-medium ${new Date(quote.expires_at) < new Date() ? "text-red-400" : "text-[var(--tx)]"}`}
                    >
                      {formatPlatformDisplay(quote.expires_at, {
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
                  <span className="text-[var(--tx)] font-medium">
                    {displayLabel(quote.service_type) ||
                      toTitleCase(
                        quote.service_type?.split("_").join(" ") || "",
                      )}
                  </span>
                </div>
                {quote.move_size && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Size</span>
                    <span className="text-[var(--tx)] font-medium">
                      {quote.move_size}
                    </span>
                  </div>
                )}
                {quote.truck_primary && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Vehicle</span>
                    <span className="text-[var(--tx)] font-medium">
                      {displayLabel(quote.truck_primary) ||
                        toTitleCase(quote.truck_primary)}
                    </span>
                  </div>
                )}
                {(quote.est_crew_size ?? (factors as any)?.est_crew_size) && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Crew</span>
                    <span className="text-[var(--tx)] font-medium">
                      {quote.est_crew_size ?? (factors as any)?.est_crew_size}
                      -person crew
                    </span>
                  </div>
                )}
                {quote.est_hours && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Est. Hours</span>
                    <span className="text-[var(--tx)] font-medium">
                      ~{quote.est_hours}h
                    </span>
                  </div>
                )}
                {quote.distance_km && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Distance</span>
                    <span className="text-[var(--tx)] font-medium">
                      {quote.distance_km} km
                    </span>
                  </div>
                )}
                {quote.move_id && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)]">Move</span>
                    <a
                      href={`/admin/moves/${quote.move_id}`}
                      className="text-[var(--gold)] font-medium hover:underline"
                    >
                      View Move
                    </a>
                  </div>
                )}
              </div>
            </div>

            {/* Client engagement (metrics + legacy stats) */}
            {(engagement.length > 0 || engagementMetrics) && (
              <div className="border-t border-[var(--brd)]/30 pt-6 pb-6">
                <h2 className="admin-section-h2 mb-3">Client engagement</h2>
                {engagementMetrics && (
                  <div className="space-y-2 text-[11px] mb-4">
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                        Views
                      </span>
                      <span className="text-[var(--tx)] font-medium text-right">
                        {engagementMetrics.pageViewCount}
                        {engagementMetrics.distinctViewDays > 0
                          ? ` (across ${engagementMetrics.distinctViewDays} day${engagementMetrics.distinctViewDays === 1 ? "" : "s"})`
                          : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                        Last activity
                      </span>
                      <span className="text-[var(--tx)] font-medium text-right">
                        {engagementMetrics.lastEngagementAt
                          ? timeAgo(engagementMetrics.lastEngagementAt)
                          : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                        Tier interest
                      </span>
                      <span className="text-[var(--tx)] font-medium text-right">
                        {tierInterestLine(engagementMetrics)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                        Time on page
                      </span>
                      <span className="text-[var(--tx)] font-medium text-right">
                        {engagementMetrics.maxSessionSeconds > 0
                          ? `up to ${fmtDuration(engagementMetrics.maxSessionSeconds)}`
                          : "—"}
                        {engagementMetrics.maxScrollPct > 0
                          ? ` · scroll ${engagementMetrics.maxScrollPct}%`
                          : ""}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                        Status
                      </span>
                      <span
                        className={`font-medium text-right ${engagementMetrics.comparingRecommended ? "text-amber-500" : "text-[var(--tx)]"}`}
                      >
                        {engagementMetrics.comparingLabel}
                      </span>
                    </div>
                  </div>
                )}
                {engagement.length > 0 && (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Raw page views</span>
                      <span className="text-[var(--tx)] font-medium">
                        {
                          engagement.filter((e) => e.event_type === "page_view")
                            .length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Longest session</span>
                      <span className="text-[var(--tx)] font-medium">
                        {fmtDuration(
                          Math.max(
                            ...engagement.map(
                              (e) => e.session_duration_seconds ?? 0,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Total events</span>
                      <span className="text-[var(--tx)] font-medium">
                        {engagement.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Device</span>
                      <span className="text-[var(--tx)] font-medium uppercase">
                        {engagement.find((e) => e.device_type)?.device_type ??
                          "-"}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showRecoverConfirm}
        title="Create Move from Quote"
        message="This will create a move record linked to this accepted quote. Continue?"
        confirmLabel="Create Move"
        onConfirm={() => {
          setShowRecoverConfirm(false);
          handleRecoverMove();
        }}
        onCancel={() => setShowRecoverConfirm(false)}
      />

      <ConfirmDialog
        open={showDeleteConfirm && canDeleteQuote}
        title="Delete Quote"
        message="This will permanently delete the quote and all engagement history. This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          setShowDeleteConfirm(false);
          handleDeleteQuote();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {deleteError && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-[var(--red)] text-white text-[12px] font-semibold px-4 py-2 rounded-xl shadow-lg">
          {deleteError}
        </div>
      )}
    </>
  );
}

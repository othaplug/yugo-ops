"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
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
  CaretRight,
  PencilSimple as Pencil,
  LinkSimple,
  WarningCircle,
} from "@phosphor-icons/react";
import {
  ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS,
  ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS,
} from "../../components/admin-toolbar-action-classes";
import { formatPlatformDisplay } from "@/lib/date-format";
import { QuotesFollowupAutomationHint } from "@/components/admin/AdminContextHints";
import { toTitleCase } from "@/lib/format-text";
import { displayLabel, serviceTypeDisplayLabel } from "@/lib/displayLabels";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { formatPhone } from "@/lib/phone";
import { quoteStatusAllowsHardDelete } from "@/lib/quotes/delete-eligibility";
import { quoteDetailDateLabel } from "@/lib/quotes/quote-field-labels";
import { isB2BDeliveryQuoteServiceType } from "@/lib/quotes/b2b-quote-copy";
import type { QuoteEngagementMetrics } from "@/lib/quotes/comparison-intelligence";
import { formatCurrency } from "@/lib/format-currency";
import type { QuotePaymentPipelineMode } from "@/lib/quotes/payment-pipeline-mode";
import { InfoHint } from "@/components/ui/InfoHint";

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
  paymentPipelineMode?: QuotePaymentPipelineMode;
  offlineTotalWithTax?: number;
  offlineDepositAmount?: number;
  linkedMoveCode?: string | null;
  linkedDeliveryNumber?: string | null;
  /** Set when a HubSpot deal id exists on the quote row */
  hubspotDealId?: string | null;
  /** False for sample or training quotes (no HubSpot sync) */
  hubspotEligible?: boolean;
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

function hasResidentialTiers(tiers: unknown): boolean {
  if (!tiers) return false;
  try {
    const obj: Record<string, unknown> =
      typeof tiers === "string"
        ? (JSON.parse(tiers) as Record<string, unknown>)
        : (tiers as Record<string, unknown>);
    if (!obj || typeof obj !== "object") return false;
    const keys = Object.keys(obj).map((k) => k.toLowerCase());
    return keys.some((k) =>
      [
        "essential",
        "curated",
        "signature",
        "estate",
        "premier",
        "essentials",
      ].includes(k),
    );
  } catch {
    return false;
  }
}

function truncateAdminText(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function ContractSignedEngagementDetail({
  data,
  isSuperAdmin,
}: {
  data: Record<string, unknown> | null | undefined;
  isSuperAdmin: boolean;
}) {
  if (!data || typeof data !== "object") return null;
  const str = (v: unknown) => (v != null && v !== "" ? String(v).trim() : "");
  const typedName = str(data.typed_name);
  const signedRaw = str(data.signed_at);
  const signedLabel =
    signedRaw && !Number.isNaN(Date.parse(signedRaw))
      ? formatPlatformDisplay(signedRaw, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
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
      <dt className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">
        {label}
      </dt>
      <dd className="text-[11px] font-medium text-[var(--tx)] mt-0.5 break-words">
        {value || "-"}
      </dd>
    </div>
  );

  return (
    <dl className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2.5 text-left max-w-xl">
      {typedName ? <Row label="Signed name" value={typedName} /> : null}
      <Row label="Signed at" value={signedLabel} />
      {deposit && Number.isFinite(Number(deposit)) ? (
        <Row label="Deposit" value={fmtCurrency(Number(deposit))} />
      ) : null}
      {total && Number.isFinite(Number(total)) ? (
        <Row label="Grand total" value={fmtCurrency(Number(total))} />
      ) : null}
      {pkg ? <Row label="Package" value={pkg} /> : null}
      {ver ? <Row label="Agreement version" value={ver} /> : null}
      {isSuperAdmin && ip ? <Row label="IP" value={ip} /> : null}
      {uaShort ? (
        <div className="sm:col-span-2 min-w-0">
          <dt className="text-[9px] font-semibold tracking-widest uppercase text-[var(--tx3)]/88">
            {isSuperAdmin ? "User agent" : "Browser"}
          </dt>
          <dd className="text-[11px] font-medium text-[var(--tx)] mt-0.5 break-all">
            {uaShort}
          </dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Human-readable engagement payload (never raw DB keys like service_type, scroll_pct). */
function formatEngagementEventDetail(
  eventType: string,
  data: Record<string, unknown> | null | undefined,
  quoteServiceType: string | null,
  showTierFields: boolean,
): string {
  if (!data || typeof data !== "object") return "";

  if (eventType === "contract_signed") {
    return "";
  }

  if (eventType === "engagement_ping") {
    const sp = data.scroll_pct;
    if (typeof sp === "number" && Number.isFinite(sp)) {
      return `Scroll ${Math.round(sp)}%`;
    }
    return "";
  }

  const parts: string[] = [];

  if (data.source != null && data.source !== "") {
    const s = String(data.source).toLowerCase();
    if (s === "server") parts.push("Server");
    else if (s === "client") parts.push("Client");
    else parts.push(toTitleCase(String(data.source)));
  }

  // Do not show `event_data.service_type`. It is often stale/incorrect for non-residential flows
  // and causes confusing labels like "(Local Move)" on commercial delivery quotes.

  const skip = new Set([
    "source",
    "service_type",
    "scroll_pct",
    "elapsed_seconds",
  ]);

  for (const [k, v] of Object.entries(data)) {
    if (v == null || v === "") continue;
    if (skip.has(k)) continue;

    if ((k === "tier" || k === "selected_tier") && !showTierFields) {
      continue;
    }
    if (k === "tier" || k === "selected_tier") {
      const t = String(v).toLowerCase();
      const label =
        t === "essential" || t === "curated"
          ? "Essential"
          : t === "signature"
            ? "Signature"
            : t === "estate"
              ? "Estate"
              : toTitleCase(String(v).replace(/_/g, " "));
      parts.push(`Tier: ${label}`);
      continue;
    }
    if (k === "addon_slug") {
      parts.push(
        `Add-on: ${displayLabel(String(v)) || toTitleCase(String(v).replace(/_/g, " "))}`,
      );
      continue;
    }
    if (k === "addons_selected") {
      parts.push(`Add-ons: ${v}`);
      continue;
    }
    if (k === "contract_signed") {
      parts.push(
        typeof v === "boolean" && v ? "Contract signed" : "Contract not signed",
      );
      continue;
    }

    parts.push(
      `${toTitleCase(k.replace(/_/g, " "))}: ${typeof v === "boolean" ? (v ? "Yes" : "No") : String(v)}`,
    );
  }

  return parts.join(" · ");
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
  return entries.map(([k, v]) => `${toTitleCase(k)} ${v}×`).join(", ");
}

export default function QuoteDetailClient({
  quote,
  engagement,
  legacyEvents,
  isSuperAdmin = false,
  followupsSentCount = 0,
  followupMaxAttempts = 3,
  engagementMetrics = null,
  paymentPipelineMode = "deposit_then_balance",
  offlineTotalWithTax = 0,
  offlineDepositAmount = 0,
  linkedMoveCode = null,
  linkedDeliveryNumber = null,
  hubspotDealId = null,
  hubspotEligible = true,
}: Props) {
  const router = useRouter();
  const [hubspotLinkedId, setHubspotLinkedId] = useState<string | null>(
    hubspotDealId?.trim() ? hubspotDealId.trim() : null,
  );
  const [hubspotRetryBusy, setHubspotRetryBusy] = useState(false);
  const [hubspotRetryError, setHubspotRetryError] = useState<string | null>(
    null,
  );
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showRecoverConfirm, setShowRecoverConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [engagementExpanded, setEngagementExpanded] = useState(false);
  const [recoveringMove, setRecoveringMove] = useState(false);
  const [recoverError, setRecoverError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const [pipelineStatus, setPipelineStatus] = useState(
    String(quote.status || "draft"),
  );
  const [lossReasonKey, setLossReasonKey] = useState<string>("competitor");
  const [lossOtherNote, setLossOtherNote] = useState("");
  const [autoFollowup, setAutoFollowup] = useState(
    quote.auto_followup_active !== false,
  );
  const [pipelineSaving, setPipelineSaving] = useState(false);
  const [pipelineMsg, setPipelineMsg] = useState<string | null>(null);
  const [offlineModalKind, setOfflineModalKind] = useState<
    "deposit" | "full" | null
  >(null);
  const [offlineLoading, setOfflineLoading] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineSuccess, setOfflineSuccess] = useState<string | null>(null);

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

  useEffect(() => {
    const v = hubspotDealId?.trim();
    setHubspotLinkedId(v ? v : null);
  }, [hubspotDealId]);

  const handleHubspotRetry = async () => {
    setHubspotRetryBusy(true);
    setHubspotRetryError(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${encodeURIComponent(quote.quote_id)}/hubspot-retry`,
        { method: "POST", credentials: "same-origin" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        dealId?: string;
      };
      if (!res.ok) {
        setHubspotRetryError(
          typeof data.message === "string"
            ? data.message
            : "Could not create HubSpot deal",
        );
        return;
      }
      if (data.dealId) {
        setHubspotLinkedId(String(data.dealId));
        router.refresh();
      }
    } catch {
      setHubspotRetryError("Request failed");
    } finally {
      setHubspotRetryBusy(false);
    }
  };

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

  const handleOfflineConfirm = async () => {
    if (!offlineModalKind || offlineLoading) return;
    setOfflineLoading(true);
    setOfflineError(null);
    try {
      const res = await fetch(
        `/api/admin/quotes/${quote.id}/confirm-offline-payment`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: offlineModalKind }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        already_booked?: boolean;
        move_code?: string;
        delivery_number?: string;
      };
      if (!res.ok) throw new Error(data.error || "Request failed");
      setOfflineModalKind(null);
      if (data.already_booked) {
        setOfflineSuccess("A job from this quote already exists.");
      } else if (data.move_code) {
        setOfflineSuccess(
          `Move ${data.move_code} created. Confirmation email and automations are running.`,
        );
      } else if (data.delivery_number) {
        setOfflineSuccess(
          `Delivery ${data.delivery_number} created. Confirmation and automations are running.`,
        );
      } else {
        setOfflineSuccess("Saved.");
      }
      router.refresh();
    } catch (e) {
      setOfflineError(e instanceof Error ? e.message : "Failed");
    } finally {
      setOfflineLoading(false);
    }
  };

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
  /** Bin rental jobs are tracked separately; “Create Move” is the wrong affordance here. */
  const showCreateMoveFromAcceptedQuote = quote.service_type !== "bin_rental";
  const factors = quote.factors_applied as Record<string, unknown> | null;
  const showTieredEngagement = hasResidentialTiers(quote.tiers);

  /** Draft previews can log real timestamps before send; clip to post-send for an accurate client timeline. */
  const engagementAfterSend = useMemo(() => {
    const raw = (quote as { sent_at?: string | null }).sent_at;
    if (raw == null || String(raw).trim() === "") return engagement;
    const clip = Date.parse(String(raw));
    if (!Number.isFinite(clip)) return engagement;
    return engagement.filter((e) => {
      const t = Date.parse(String(e.created_at || ""));
      return Number.isFinite(t) && t >= clip;
    });
  }, [engagement, quote.sent_at]);

  const legacyAfterSend = useMemo(() => {
    const raw = (quote as { sent_at?: string | null }).sent_at;
    if (raw == null || String(raw).trim() === "") return legacyEvents;
    const clip = Date.parse(String(raw));
    if (!Number.isFinite(clip)) return legacyEvents;
    return legacyEvents.filter((e) => {
      const t = Date.parse(String(e.created_at || ""));
      return Number.isFinite(t) && t >= clip;
    });
  }, [legacyEvents, quote.sent_at]);

  const signal = showTieredEngagement
    ? engagementSignal(engagementAfterSend)
    : (() => {
        const types = new Set(engagementAfterSend.map((e) => e.event_type));
        if (types.has("payment_started"))
          return { label: "Hot, started payment", color: "text-green-400" };
        if (types.has("contract_viewed"))
          return {
            label: "Warm, reviewed contract",
            color: "text-emerald-400",
          };
        if (types.has("page_view")) {
          const maxDur = Math.max(
            ...engagementAfterSend.map((e) => e.session_duration_seconds ?? 0),
          );
          if (maxDur < 30)
            return { label: "Cold, quick glance", color: "text-red-400" };
          return {
            label: "Lukewarm, browsed briefly",
            color: "text-amber-400",
          };
        }
        return { label: "No engagement", color: "text-[var(--tx3)]" };
      })();

  const allEvents = [
    ...engagementAfterSend.map((e) => ({
      id: e.id,
      type: e.event_type,
      data: e.event_data,
      duration: e.session_duration_seconds,
      device: e.device_type,
      at: e.created_at,
      source: "engagement" as const,
    })),
    ...legacyAfterSend
      .filter(
        (e) =>
          !engagementAfterSend.some(
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
  ]
    .filter((e) => {
      if (showTieredEngagement) return true;
      return ![
        "tier_clicked",
        "tier_hovered",
        "tier_selected",
        "comparison_viewed",
      ].includes(String(e.type || ""));
    })
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

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
            {serviceTypeDisplayLabel(quote.service_type)} &middot; Created{" "}
            {formatPlatformDisplay(quote.created_at, {
              month: "short",
              day: "numeric",
            })}
          </p>

          {(quote.sent_at || hubspotLinkedId) && (
            <div className="pt-2">
              {hubspotLinkedId ? (
                <div className="rounded-lg border border-[var(--brd)] bg-[var(--card)] px-3 py-2.5 flex flex-wrap items-center gap-2 text-[12px]">
                  <LinkSimple
                    className="w-4 h-4 shrink-0 text-[var(--tx3)]"
                    aria-hidden
                    weight="duotone"
                  />
                  <span className="font-semibold text-[var(--tx)]">
                    HubSpot
                  </span>
                  <span className="text-[var(--tx2)]">Deal linked</span>
                  <code className="text-[11px] font-mono bg-[var(--bg)] px-1.5 py-0.5 rounded border border-[var(--brd)] text-[var(--tx)]">
                    {hubspotLinkedId}
                  </code>
                  <InfoHint
                    variant="admin"
                    align="start"
                    ariaLabel="About HubSpot deal id"
                  >
                    Search this deal id in HubSpot (Sales deals) if it does not
                    open from a direct link. Stage updates depend on pipeline
                    settings in Platform Settings.
                  </InfoHint>
                </div>
              ) : quote.sent_at && !hubspotEligible ? (
                <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5 text-[12px] text-[var(--tx2)]">
                  <span className="font-semibold text-[var(--tx)]">
                    HubSpot
                  </span>{" "}
                  Not synced for sample or training quotes.
                </div>
              ) : quote.sent_at && hubspotEligible ? (
                <div className="rounded-lg border border-amber-500/35 bg-amber-500/5 px-3 py-3 space-y-2">
                  <div className="flex items-start gap-2">
                    <WarningCircle
                      className="w-4 h-4 shrink-0 text-amber-600 mt-0.5"
                      aria-hidden
                      weight="fill"
                    />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[12px] font-semibold text-[var(--tx)]">
                        No HubSpot deal linked
                      </p>
                      <p className="text-[11px] text-[var(--tx2)] leading-relaxed">
                        Deals are created when the quote is sent, if the
                        integration token and pipeline or stage ids are set. If
                        something failed at send time, fix settings then try
                        again here. This does not resend email.
                      </p>
                    </div>
                  </div>
                  {hubspotRetryError ? (
                    <p className="text-[11px] text-red-600 pl-6">
                      {hubspotRetryError}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2 pl-6">
                    <button
                      type="button"
                      onClick={() => void handleHubspotRetry()}
                      disabled={hubspotRetryBusy}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:opacity-95 disabled:opacity-50"
                    >
                      {hubspotRetryBusy ? "Working…" : "Create HubSpot deal"}
                    </button>
                    <Link
                      href="/admin/platform?tab=app"
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--tx2)] hover:text-[var(--tx)] underline underline-offset-2"
                    >
                      Platform Settings
                      <CaretRight
                        className="w-3 h-3"
                        weight="bold"
                        aria-hidden
                      />
                    </Link>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {/* Row 4: action buttons, wrap on mobile */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            <button
              type="button"
              onClick={() =>
                router.push(
                  isB2BDeliveryQuoteServiceType(
                    String(quote.service_type || ""),
                  )
                    ? `/admin/quotes/new?copy_quote=${encodeURIComponent(quote.quote_id)}`
                    : `/admin/quotes/${quote.quote_id}/edit`,
                )
              }
              className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
            >
              <Pencil
                weight="regular"
                className="w-3 h-3 shrink-0"
                aria-hidden
              />
              Edit all details
              <CaretRight
                weight="bold"
                className="w-3 h-3 shrink-0 opacity-90"
                aria-hidden
              />
            </button>
            {quote.quote_url && (
              <a
                href={quote.quote_url}
                target="_blank"
                rel="noreferrer"
                className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
              >
                <ExternalLink
                  weight="regular"
                  className="w-3 h-3 shrink-0"
                  aria-hidden
                />
                Client view
                <CaretRight
                  weight="bold"
                  className="w-3 h-3 shrink-0 opacity-90"
                  aria-hidden
                />
              </a>
            )}
            {quote.status === "accepted" && showCreateMoveFromAcceptedQuote && (
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
                <Trash2
                  weight="regular"
                  className="w-3 h-3 shrink-0"
                  aria-hidden
                />{" "}
                Delete
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
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="admin-section-h2 mb-0">
                  Status &amp; follow-ups
                </h2>
                <QuotesFollowupAutomationHint
                  iconSize={15}
                  ariaLabel="Automated quote follow-ups"
                />
              </div>
              <p className="text-[11px] text-[var(--tx3)] mt-1">
                Automated emails sent: {followupsSentCount} of{" "}
                {followupMaxAttempts}
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
                    onChange={(e) =>
                      void saveAutoFollowupToggle(e.target.checked)
                    }
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
                  <CaretRight
                    weight="bold"
                    className="w-3 h-3 shrink-0 opacity-90"
                    aria-hidden
                  />
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

        <div className="rounded-lg bg-[var(--card)] px-3 py-2">
          <div className="flex flex-col gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-x-3 sm:gap-y-1.5">
            <div className="flex items-center gap-1.5 min-w-0 shrink-0">
              <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                Offline payment
              </span>
              <InfoHint
                variant="admin"
                iconSize={15}
                ariaLabel="About offline payment"
                side="bottom"
              >
                <p className="text-[12px] leading-relaxed max-w-[min(100vw-2rem,320px)]">
                  When the client paid outside the quote page (cash, wire, or
                  cheque), record it here. This creates the move or delivery and
                  runs the same confirmation steps as card checkout.
                </p>
              </InfoHint>
            </div>
            {linkedMoveCode ? (
              <p className="text-[11px] text-[var(--tx)] sm:text-right">
                Booked{" "}
                <Link
                  href={`/admin/moves/${encodeURIComponent(linkedMoveCode)}`}
                  className="font-semibold text-[#2C3E2D] underline underline-offset-2 hover:opacity-90"
                >
                  {linkedMoveCode}
                </Link>
              </p>
            ) : linkedDeliveryNumber ? (
              <p className="text-[11px] text-[var(--tx)] sm:text-right">
                Booked{" "}
                <Link
                  href={`/admin/deliveries/${encodeURIComponent(linkedDeliveryNumber)}`}
                  className="font-semibold text-[#2C3E2D] underline underline-offset-2 hover:opacity-90"
                >
                  {linkedDeliveryNumber}
                </Link>
              </p>
            ) : (
              <div className="flex flex-col gap-1 min-w-0 sm:flex-1 sm:items-end">
                {(offlineSuccess || offlineError) && (
                  <p
                    className={`text-[10px] w-full text-right leading-snug ${
                      offlineError
                        ? "text-[var(--red)]"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  >
                    {offlineError ?? offlineSuccess}
                  </p>
                )}
                <div className="flex w-full flex-wrap items-center justify-end gap-2">
                  {paymentPipelineMode === "full_upfront" ? (
                    <button
                      type="button"
                      disabled={offlineLoading}
                      onClick={() => {
                        setOfflineError(null);
                        setOfflineSuccess(null);
                        setOfflineModalKind("full");
                      }}
                      className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                    >
                      Record full payment and confirm booking
                      <CaretRight
                        weight="bold"
                        className="w-3 h-3 shrink-0 opacity-90"
                        aria-hidden
                      />
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        disabled={offlineLoading}
                        onClick={() => {
                          setOfflineError(null);
                          setOfflineSuccess(null);
                          setOfflineModalKind("deposit");
                        }}
                        className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                      >
                        Record deposit received
                        <CaretRight
                          weight="bold"
                          className="w-3 h-3 shrink-0 opacity-90"
                          aria-hidden
                        />
                      </button>
                      <button
                        type="button"
                        disabled={offlineLoading}
                        onClick={() => {
                          setOfflineError(null);
                          setOfflineSuccess(null);
                          setOfflineModalKind("full");
                        }}
                        className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                      >
                        Record full payment (complete job)
                        <CaretRight
                          weight="bold"
                          className="w-3 h-3 shrink-0 opacity-90"
                          aria-hidden
                        />
                      </button>
                    </>
                  )}
                  <p className="text-[10px] text-[var(--tx3)] tabular-nums whitespace-nowrap">
                    Total {formatCurrency(offlineTotalWithTax)} incl. tax
                    {paymentPipelineMode === "deposit_then_balance" ? (
                      <>
                        {" "}
                        · First payment {formatCurrency(offlineDepositAmount)}
                      </>
                    ) : null}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          open={offlineModalKind !== null}
          title={
            offlineModalKind === "deposit"
              ? "Record deposit (offline)"
              : "Record full payment (offline)"
          }
          message={
            offlineModalKind === "deposit"
              ? `Create the booked job and record ${formatCurrency(offlineDepositAmount)} as paid (incl. tax), matching this quote. Confirmation email and automations will run.`
              : `Create the booked job and record ${formatCurrency(offlineTotalWithTax)} as paid in full (incl. tax). Confirmation email and automations will run.`
          }
          confirmLabel={offlineLoading ? "Working…" : "Confirm"}
          onConfirm={() => void handleOfflineConfirm()}
          onCancel={() => {
            if (!offlineLoading) {
              setOfflineModalKind(null);
              setOfflineError(null);
            }
          }}
        />

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
                      ? formatPlatformDisplay(
                          new Date(quote.move_date + "T00:00:00"),
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          },
                        )
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
                    const systemPreTax =
                      typeof quote.system_price === "number"
                        ? quote.system_price
                        : null;
                    const overridePreTax =
                      typeof quote.override_price === "number"
                        ? quote.override_price
                        : null;
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
                          {overridePreTax != null ? (
                            <div className="mt-2 rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)] px-3 py-2 space-y-1">
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[var(--tx3)]">
                                  System (engine)
                                </span>
                                <span className="font-medium text-[var(--tx)]">
                                  {systemPreTax != null
                                    ? fmtCurrency(systemPreTax)
                                    : "—"}
                                </span>
                              </div>
                              <div className="flex items-center justify-between text-[11px]">
                                <span className="text-[var(--tx3)]">
                                  Override (pre-tax)
                                </span>
                                <span className="font-semibold text-[var(--tx)]">
                                  {fmtCurrency(overridePreTax)}
                                </span>
                              </div>
                              {typeof quote.override_reason === "string" &&
                              quote.override_reason.trim() ? (
                                <p className="text-[10px] text-[var(--tx3)] pt-1 border-t border-[var(--brd)]/40">
                                  {quote.override_reason}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
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
                        {overridePreTax != null ? (
                          <div className="mt-2 rounded-lg border border-[var(--brd)]/60 bg-[var(--bg)] px-3 py-2 space-y-1">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[var(--tx3)]">
                                System (engine)
                              </span>
                              <span className="font-medium text-[var(--tx)]">
                                {systemPreTax != null
                                  ? fmtCurrency(systemPreTax)
                                  : "—"}
                              </span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-[var(--tx3)]">
                                Override (pre-tax)
                              </span>
                              <span className="font-semibold text-[var(--tx)]">
                                {fmtCurrency(overridePreTax)}
                              </span>
                            </div>
                            {typeof quote.override_reason === "string" &&
                            quote.override_reason.trim() ? (
                              <p className="text-[10px] text-[var(--tx3)] pt-1 border-t border-[var(--brd)]/40">
                                {quote.override_reason}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
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

              {engagementAfterSend.length === 0 &&
              legacyAfterSend.length === 0 ? (
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
                        const detail =
                          ev.type === "contract_signed"
                            ? ""
                            : formatEngagementEventDetail(
                                ev.type,
                                ev.data,
                                quote.service_type ?? null,
                                showTieredEngagement,
                              );

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
                              {ev.type === "contract_signed" ? (
                                <ContractSignedEngagementDetail
                                  data={ev.data}
                                  isSuperAdmin={isSuperAdmin}
                                />
                              ) : null}
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
                    {serviceTypeDisplayLabel(quote.service_type)}
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
            {(engagementAfterSend.length > 0 || engagementMetrics) && (
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
                    {showTieredEngagement && (
                      <div className="flex justify-between gap-3">
                        <span className="text-[var(--tx3)] uppercase tracking-wide shrink-0">
                          Tier interest
                        </span>
                        <span className="text-[var(--tx)] font-medium text-right">
                          {tierInterestLine(engagementMetrics)}
                        </span>
                      </div>
                    )}
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
                        {showTieredEngagement
                          ? engagementMetrics.comparingLabel
                          : "Engaged"}
                      </span>
                    </div>
                  </div>
                )}
                {engagementAfterSend.length > 0 && (
                  <div className="space-y-2 text-[11px]">
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Raw page views</span>
                      <span className="text-[var(--tx)] font-medium">
                        {
                          engagementAfterSend.filter(
                            (e) => e.event_type === "page_view",
                          ).length
                        }
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Longest session</span>
                      <span className="text-[var(--tx)] font-medium">
                        {fmtDuration(
                          Math.max(
                            ...engagementAfterSend.map(
                              (e) => e.session_duration_seconds ?? 0,
                            ),
                          ),
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Total events</span>
                      <span className="text-[var(--tx)] font-medium">
                        {engagementAfterSend.length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--tx3)]">Device</span>
                      <span className="text-[var(--tx)] font-medium uppercase">
                        {engagementAfterSend.find((e) => e.device_type)
                          ?.device_type ?? "-"}
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

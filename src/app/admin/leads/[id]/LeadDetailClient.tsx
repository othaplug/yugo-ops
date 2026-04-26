"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import {
  COMPLETENESS_PATH_LABELS,
  DISMISS_REASONS,
  humanizeLeadFieldKey,
  LEAD_ACTIVITY_LABELS,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/admin-labels"
import { SERVICE_TYPE_LABELS, serviceTypeDisplayLabel } from "@/lib/displayLabels"
import {
  isLeadMoveSizeApplicable,
  LEAD_MOVE_SIZE_SELECT_OPTIONS,
} from "@/lib/leads/lead-move-size"
import { CaretRight, Image as ImageIcon, VideoCamera, Wrench } from "@phosphor-icons/react"
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardEyebrow,
  CardHeader,
  CardTitle,
  cn,
  Select,
  StatusPill,
  Textarea,
} from "@/design-system/admin"
import { PageHeader, PageMetaDivider } from "@/design-system/admin/layout/PageHeader"
import { formatTimeAgo } from "@/lib/format-time-ago"
import AddressAutocomplete from "@/components/ui/AddressAutocomplete"
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame"
import LeadResponseSlaCountdown from "../LeadResponseSlaCountdown"

type Lead = Record<string, unknown>;
type Activity = {
  id: string;
  activity_type: string;
  notes: string | null;
  created_at: string;
  performed_by: string | null;
};

const INLINE_FIELD =
  "w-full min-w-0 h-8 max-h-8 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-2.5 text-[12px] leading-tight text-[var(--yu3-ink-strong)] shadow-none outline-none transition-colors placeholder:text-[var(--yu3-ink-faint)] hover:border-[var(--yu3-line)] focus:ring-0 focus:border-[var(--yu3-line-subtle)]"
const INLINE_SELECT = `${INLINE_FIELD} cursor-pointer appearance-none pr-7 bg-no-repeat`
const INLINE_TEXTAREA =
  "w-full min-w-0 min-h-[3.25rem] max-h-20 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-2.5 py-1.5 text-[12px] leading-snug text-[var(--yu3-ink-strong)] shadow-none outline-none transition-colors placeholder:text-[var(--yu3-ink-faint)] focus:ring-0 focus:border-[var(--yu3-line-subtle)] resize-y"
const ADDR_AUTOCOMPLETE_FIELD =
  "w-full h-8 min-h-8 rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-2.5 text-[12px] text-[var(--yu3-ink-strong)] placeholder:text-[var(--yu3-ink-faint)] transition-colors duration-[var(--yu3-dur-1)] hover:border-[var(--yu3-line-strong)] focus:outline-none focus:ring-0 focus:border-[var(--yu3-line)]"

function LeadFieldRow({
  label,
  children,
  alignTop,
}: {
  label: string
  children: ReactNode
  alignTop?: boolean
}) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,9.5rem)_1fr] sm:gap-3 py-2 first:pt-0">
      <dt className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] leading-tight self-center sm:pt-0.5">
        {label}
      </dt>
      <dd
        className={cn(
          "text-[12px] text-[var(--yu3-ink-strong)] min-w-0",
          alignTop
            ? "items-start flex flex-col gap-0.5 pt-0.5"
            : "flex items-center",
        )}
      >
        {children}
      </dd>
    </div>
  )
}

export default function LeadDetailClient({
  leadId,
  initialLead,
  initialActivities,
}: {
  leadId: string;
  initialLead: Lead;
  initialActivities: Activity[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [lead, setLead] = useState<Lead>(initialLead);
  const [activities, setActivities] = useState<Activity[]>(initialActivities);
  const [note, setNote] = useState("");
  const [dismissOpen, setDismissOpen] = useState(false);
  const [dismissReason, setDismissReason] = useState(DISMISS_REASONS[0]!.value);
  const viewedSent = useRef(false);

  const refresh = useCallback(async () => {
    const res = await fetch(`/api/admin/leads/${leadId}`);
    if (!res.ok) return;
    const data = await res.json();
    if (data.lead) setLead(data.lead);
    if (data.activities) setActivities(data.activities);
  }, [leadId]);

  useEffect(() => {
    if (viewedSent.current) return;
    viewedSent.current = true;
    fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ record_view: true }),
    })
      .then(() => refresh())
      .catch(() => {});
  }, [leadId, refresh]);

  const patchLead = async (body: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/leads/${leadId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Update failed");
    if (data.lead) setLead(data.lead);
    await refresh();
  };

  const saveProfileField = useCallback(
    async (key: string, value: string | null) => {
      const cur = lead[key]
      const curStr =
        cur == null
          ? ""
          : typeof cur === "string" || typeof cur === "number"
            ? String(cur)
            : ""
      const nextStr = value ?? ""
      if (key === "preferred_date") {
        const a = curStr.slice(0, 10)
        const b = nextStr.slice(0, 10)
        if (a === b) return
      } else if (curStr === nextStr) {
        return
      }
      try {
        await patchLead({ [key]: value })
      } catch (e) {
        toast(e instanceof Error ? e.message : "Update failed", "x")
      }
    },
    [lead, patchLead, toast],
  )

  const handleNote = async () => {
    if (!note.trim()) return;
    try {
      await patchLead({ note: note.trim() });
      setNote("");
      toast("Note saved", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  };

  const handleStatus = async (status: string) => {
    try {
      await patchLead({ status });
      toast("Status updated", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  };

  const handleCallLogged = async () => {
    try {
      await patchLead({ response_action: "phone_call" });
      toast("Logged as contacted", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  };

  const handleDismiss = async () => {
    try {
      await patchLead({
        status: "disqualified",
        lost_reason: dismissReason,
      });
      setDismissOpen(false);
      toast("Lead dismissed", "check");
      router.push("/admin/leads");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  };

  const patchLeadJson = useCallback(
    async (body: Record<string, unknown>) => {
      const res = await fetch(`/api/admin/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Update failed");
      if (data.lead) setLead(data.lead);
      await refresh();
    },
    [leadId, refresh],
  );

  const handleRequestPhotos = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/photo-request`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Request failed");
      if (data.lead) setLead(data.lead);
      await refresh();
      toast("Photo link sent to client", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  }, [leadId, refresh, toast]);

  const handleResendPhotoRequest = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/leads/${leadId}/photo-resend`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error((data as { error?: string }).error || "Resend failed");
      if (data.lead) setLead(data.lead);
      await refresh();
      toast("Link resent", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  }, [leadId, refresh, toast]);

  const handleScheduleWalkthrough = useCallback(async () => {
    try {
      await patchLeadJson({
        note: "Coordinator: virtual walkthrough or call scheduled to complete inventory (intake).",
        status: "contacted",
      });
      toast("Logged. Contact the client to walk through the home and capture inventory on the call.", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  }, [patchLeadJson, toast]);

  const handleBuildManually = useCallback(() => {
    router.push(`/admin/quotes/new?lead_id=${encodeURIComponent(leadId)}`);
  }, [leadId, router]);

  const handleSkipPhotoIntake = useCallback(async () => {
    try {
      await patchLeadJson({
        clear_photo_intake: true,
        status: "qualified",
      });
      toast("You can build from the description. Photo request cleared.", "check");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    }
  }, [patchLeadJson, toast]);

  const ln = String(lead.lead_number || "");
  const fn = String(lead.first_name || "");
  const lnName = String(lead.last_name || "");
  const phone = lead.phone != null ? String(lead.phone) : "";
  const email = lead.email != null ? String(lead.email) : "";
  const source = String(lead.source || "");
  const detail = lead.source_detail != null ? String(lead.source_detail) : "";
  const quoteHref = `/admin/quotes/new?lead_id=${encodeURIComponent(leadId)}`;
  const specialtyQuoteHref = `${quoteHref}&specialty_builder=1`;
  const requiresSpec = Boolean(lead.requires_specialty_quote);
  const heavyParsed =
    lead.parsed_weight_lbs_max != null &&
    Number(lead.parsed_weight_lbs_max) > 300;

  const leadStatus = String(lead.status || "new");
  const showIntakeChoice = ["new", "assigned", "contacted", "qualified"].includes(leadStatus);
  const isPhotosRequested = leadStatus === "photos_requested";
  const isPhotosReceived = leadStatus === "photos_received";
  const photosRequestedAt =
    lead.photos_requested_at != null ? String(lead.photos_requested_at) : "";
  const photosUploadedAt =
    lead.photos_uploaded_at != null ? String(lead.photos_uploaded_at) : "";
  const leadPhotoCount =
    lead.photo_count != null && Number(lead.photo_count) > 0
      ? Number(lead.photo_count)
      : 0

  const leadDisplayName = [fn, lnName].filter(Boolean).join(" ") || "Unknown"
  const presentKeys = Array.isArray(lead.fields_present)
    ? (lead.fields_present as string[])
    : []
  const missingKeys = Array.isArray(lead.fields_missing)
    ? (lead.fields_missing as string[])
    : []
  const hasCompletenessContent = Boolean(
    lead.completeness_path ||
      missingKeys.length > 0 ||
      (Array.isArray(lead.clarifications_needed) &&
        (lead.clarifications_needed as unknown[]).length > 0) ||
      lead.raw_inquiry_text ||
      lead.requires_specialty_quote ||
      lead.parsed_weight_lbs_max != null ||
      lead.parsed_dimensions_text ||
      presentKeys.length > 0,
  )
  const hasNextStepContent =
    (showIntakeChoice && !isPhotosRequested && !isPhotosReceived) ||
    isPhotosRequested ||
    isPhotosReceived

  const serviceTypeOptions = useMemo(
    () =>
      Object.entries(SERVICE_TYPE_LABELS)
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [],
  )

  const serviceTypeValue =
    typeof lead.service_type === "string" ? lead.service_type : ""
  const showMoveSize = isLeadMoveSizeApplicable(serviceTypeValue || null)

  return (
    <div className="w-full min-w-0 py-4 md:py-5 flex flex-col gap-6">
      <div>
        <BackButton label="Back to Leads" fallback="/admin/leads" />
      </div>

      <PageHeader
        variant="hero"
        eyebrow="Sales · Leads"
        title={
          <>
            {ln}
            <span className="text-[var(--yu3-ink-muted)] font-normal"> · </span>
            {leadDisplayName}
          </>
        }
        meta={
          <>
            <StatusPill tone="wine">
              {LEAD_STATUS_LABELS[String(lead.status)] || String(lead.status)}
            </StatusPill>
            <PageMetaDivider />
            <StatusPill tone="neutral">
              {LEAD_PRIORITY_LABELS[String(lead.priority)] || String(lead.priority)}
            </StatusPill>
            <PageMetaDivider />
            <span className="text-[var(--yu3-ink-muted)]">First response (5 min)</span>
            <LeadResponseSlaCountdown
              createdAt={String(lead.created_at || "")}
              responseSlaTargetAt={
                lead.response_sla_target_at != null
                  ? String(lead.response_sla_target_at)
                  : null
              }
              firstResponseAt={
                lead.first_response_at != null
                  ? String(lead.first_response_at)
                  : null
              }
            />
          </>
        }
      />

      <Card>
        <CardHeader className="items-center">
          <div>
            <CardEyebrow>Pipeline</CardEyebrow>
            <CardTitle className="mt-0.5">Quote and contact</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div
            className="flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
            role="toolbar"
            aria-label="Quote and contact actions"
          >
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Button asChild variant="primary" size="md" uppercase>
                <Link href={quoteHref} className="inline-flex items-center justify-center gap-1.5">
                  Send quote
                  <CaretRight size={16} weight="bold" aria-hidden />
                </Link>
              </Button>
              {(requiresSpec || heavyParsed) && (
                <Button asChild variant="secondary" size="md" uppercase>
                  <Link
                    href={specialtyQuoteHref}
                    className="inline-flex items-center justify-center gap-1.5"
                  >
                    Specialty builder
                    <CaretRight size={16} weight="bold" className="opacity-70" aria-hidden />
                  </Link>
                </Button>
              )}
              <span className="hidden sm:inline h-4 w-px bg-[var(--yu3-line)] mx-0.5" aria-hidden />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                uppercase
                className="text-[11px] tracking-[0.1em] text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] h-8"
                onClick={() => void handleCallLogged()}
              >
                Log call
              </Button>
            </div>

            <div className="flex justify-start sm:justify-end sm:pl-2">
              <Button
                type="button"
                variant="link"
                size="md"
                className="h-auto min-h-0 px-0 py-0 text-[var(--yu3-wine)] hover:text-[var(--yu3-wine)] hover:underline"
                onClick={() => setDismissOpen(true)}
              >
                Dismiss
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>

      {hasCompletenessContent && (
        <Card>
          <CardHeader>
            <div>
              <CardEyebrow>Intake quality</CardEyebrow>
              <CardTitle className="mt-0.5">Completeness and signals</CardTitle>
            </div>
            {missingKeys.length > 0 ? (
              <Badge variant="warning" size="sm" className="shrink-0">
                {missingKeys.length} field{missingKeys.length === 1 ? "" : "s"} missing
              </Badge>
            ) : null}
          </CardHeader>
          <CardBody className="space-y-5">
            {missingKeys.length > 0 ? (
              <div
                className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-warning-tint)]/35 px-4 py-3"
                role="status"
                aria-label="Fields still needed from the client"
              >
                <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-warning)] mb-2">
                  Still need from client
                </p>
                <ul className="flex flex-wrap gap-2" aria-label="Missing field names">
                  {missingKeys.map((k) => (
                    <li key={k}>
                      <Badge variant="warning" size="md">
                        {humanizeLeadFieldKey(k)}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/50 p-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-1">
                  Path
                </p>
                <p className="text-[13px] text-[var(--yu3-ink)] font-medium">
                  {COMPLETENESS_PATH_LABELS[String(lead.completeness_path)] ||
                    (lead.completeness_path
                      ? String(lead.completeness_path)
                      : "Not set")}
                  {lead.completeness_score != null
                    ? ` · Score ${String(lead.completeness_score)}`
                    : ""}
                </p>
              </div>
              {presentKeys.length > 0 ? (
                <div className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/50 p-3 sm:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-2">
                    Present
                  </p>
                  <ul className="flex flex-wrap gap-1.5" aria-label="Captured fields">
                    {presentKeys.map((k) => (
                      <li key={k}>
                        <Badge variant="forest" size="sm">
                          {humanizeLeadFieldKey(k)}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            {Array.isArray(lead.clarifications_needed) &&
            (lead.clarifications_needed as unknown[]).length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-2">
                  Clarifications
                </p>
                <ul className="list-none space-y-2 border-l-2 border-[var(--yu3-wine)]/25 pl-3">
                  {(lead.clarifications_needed as string[]).map((line, i) => (
                    <li
                      key={i}
                      className="text-[13px] text-[var(--yu3-ink)] leading-relaxed"
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {Array.isArray(lead.follow_up_questions) &&
            (lead.follow_up_questions as unknown[]).length > 0 ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-2">
                  Follow-up questions sent
                </p>
                <ol className="list-decimal pl-5 space-y-1.5 text-[13px] text-[var(--yu3-ink)] leading-relaxed">
                  {(lead.follow_up_questions as string[]).map((q, i) => (
                    <li key={i}>{q}</li>
                  ))}
                </ol>
              </div>
            ) : null}
            {lead.follow_up_sent_at ? (
              <p className="text-[12px] text-[var(--yu3-ink-muted)]">
                <span className="font-medium text-[var(--yu3-ink)]">Follow-up sent at: </span>
                {new Date(String(lead.follow_up_sent_at)).toLocaleString()}
              </p>
            ) : null}
            {lead.requires_specialty_quote ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Specialty quote: </span>
                Flagged for coordinator builder (manual review path)
              </p>
            ) : null}
            {lead.parsed_weight_lbs_max != null ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Parsed weight (max): </span>
                {String(lead.parsed_weight_lbs_max)} lb
              </p>
            ) : null}
            {lead.parsed_dimensions_text ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Parsed dimensions: </span>
                {String(lead.parsed_dimensions_text)}
              </p>
            ) : null}
            {lead.detected_service_type ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Detected service: </span>
                {serviceTypeDisplayLabel(String(lead.detected_service_type))}
              </p>
            ) : null}
            {Array.isArray(lead.detected_dates) &&
            (lead.detected_dates as unknown[]).length > 0 ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Dates in text: </span>
                {(lead.detected_dates as string[]).join(", ")}
              </p>
            ) : null}
            {lead.external_platform ? (
              <p className="text-[13px] text-[var(--yu3-ink)]">
                <span className="text-[var(--yu3-ink-muted)]">Referrer: </span>
                {String(lead.external_platform)}
                {lead.external_reference
                  ? ` · Ref ${String(lead.external_reference)}`
                  : ""}
              </p>
            ) : null}
            {lead.raw_inquiry_text ? (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-2">
                  Raw inquiry
                </p>
                <pre className="text-[11px] whitespace-pre-wrap font-mono rounded-[var(--yu3-r-md)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-sunken)] p-3 max-h-48 overflow-y-auto text-[var(--yu3-ink)]">
                  {String(lead.raw_inquiry_text)}
                </pre>
              </div>
            ) : null}
          </CardBody>
        </Card>
      )}

      {hasNextStepContent && (
        <Card aria-label="Intake next step">
          <CardHeader>
            <div>
              <CardEyebrow>Intake</CardEyebrow>
              <CardTitle className="mt-0.5">Next step</CardTitle>
              <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1 font-normal">
                Choose how you want to get enough detail to quote.
              </p>
            </div>
          </CardHeader>
          <CardBody className="space-y-5">
            {showIntakeChoice && !isPhotosRequested && !isPhotosReceived ? (
              <div className="grid md:grid-cols-3 gap-3">
                <button
                  type="button"
                  onClick={() => void handleRequestPhotos()}
                  className={cn(
                    "group text-left rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 transition",
                    "hover:border-[var(--yu3-wine)]/30 hover:shadow-[var(--yu3-shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yu3-wine)_25%,transparent)]",
                  )}
                >
                  <ImageIcon
                    className="mb-2 text-[var(--yu3-wine)]"
                    size={24}
                    weight="duotone"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold text-[var(--yu3-ink-strong)]">Request photos</p>
                  <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1.5 leading-relaxed">
                    Send a link so the client can upload room photos. About five minutes on their phone.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => void handleScheduleWalkthrough()}
                  className={cn(
                    "group text-left rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 transition",
                    "hover:border-[var(--yu3-wine)]/30 hover:shadow-[var(--yu3-shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yu3-wine)_25%,transparent)]",
                  )}
                >
                  <VideoCamera
                    className="mb-2 text-[var(--yu3-wine)]"
                    size={24}
                    weight="duotone"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold text-[var(--yu3-ink-strong)]">Virtual walkthrough</p>
                  <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1.5 leading-relaxed">
                    Schedule a video or phone call to walk the home and build inventory live.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={handleBuildManually}
                  className={cn(
                    "group text-left rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 transition",
                    "hover:border-[var(--yu3-wine)]/30 hover:shadow-[var(--yu3-shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color-mix(in_srgb,var(--yu3-wine)_25%,transparent)]",
                  )}
                >
                  <Wrench
                    className="mb-2 text-[var(--yu3-wine)]"
                    size={24}
                    weight="duotone"
                    aria-hidden
                  />
                  <p className="text-sm font-semibold text-[var(--yu3-ink-strong)]">Build manually</p>
                  <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1.5 leading-relaxed">
                    Create the inventory from the lead notes and go straight to quoting.
                  </p>
                </button>
              </div>
            ) : null}

            {isPhotosRequested ? (
              <div
                className="rounded-[var(--yu3-r-lg)] border border-amber-200/90 bg-[color-mix(in_srgb,var(--yu3-warning-tint)_55%,var(--yu3-bg-surface))] p-4"
                role="status"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-amber-950">Photos requested</p>
                    <p className="text-[12px] text-amber-900/90 mt-0.5">
                      Sent {formatTimeAgo(photosRequestedAt)}. Waiting for uploads.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      uppercase
                      onClick={() => void handleResendPhotoRequest()}
                      className="border-amber-300 text-amber-950 hover:bg-amber-100/50"
                    >
                      Resend link
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      uppercase
                      onClick={() => void handleSkipPhotoIntake()}
                    >
                      Skip, build manually
                    </Button>
                  </div>
                </div>
              </div>
            ) : null}

            {isPhotosReceived ? (
              <div
                className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-forest)]/30 bg-[var(--yu3-forest-tint)]/40 p-4"
                role="status"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#1a2f1b]">
                      {leadPhotoCount} photos received
                    </p>
                    <p className="text-[12px] text-[#2C3E2D] mt-0.5">
                      {photosUploadedAt
                        ? `Uploaded ${formatTimeAgo(photosUploadedAt)}. Ready for review.`
                        : "Ready for review."}
                    </p>
                  </div>
                  <Button asChild variant="accent" size="md" uppercase>
                    <Link
                      href={`/admin/leads/${leadId}/photos`}
                      className="inline-flex items-center justify-center gap-1"
                    >
                      Review photos and build inventory
                      <CaretRight size={14} weight="bold" className="opacity-90" aria-hidden />
                    </Link>
                  </Button>
                </div>
              </div>
            ) : null}
          </CardBody>
        </Card>
      )}

      {dismissOpen && (
        <ModalDialogFrame
          zClassName="z-50"
          backdropClassName=""
          onBackdropClick={() => setDismissOpen(false)}
          panelClassName="bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] border border-[var(--yu3-line)] shadow-[var(--yu3-shadow-lg)] rounded-[var(--yu3-r-xl)] p-5 max-w-md w-full modal-card"
          ariaLabelledBy="dismiss-lead-title"
        >
          <h2
            id="dismiss-lead-title"
            className="text-[15px] font-semibold text-[var(--yu3-ink-strong)] mb-1"
          >
            Dismiss lead
          </h2>
          <p className="text-[12px] text-[var(--yu3-ink-muted)] mb-4">This will remove the lead from the active list.</p>
          <label className="block text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-1.5" htmlFor="dismiss-reason">
            Reason
          </label>
          <Select
            id="dismiss-reason"
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            className="w-full mb-4"
          >
            {DISMISS_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <div className="flex gap-2 justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={() => setDismissOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" size="sm" uppercase onClick={handleDismiss}>
              Confirm dismiss
            </Button>
          </div>
        </ModalDialogFrame>
      )}

      <Card>
        <CardHeader>
          <div>
            <CardEyebrow>Profile</CardEyebrow>
            <CardTitle className="mt-0.5">Lead and job details</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <dl className="space-y-0.5">
            <LeadFieldRow label="Source">
              <select
                id="lead-source"
                className={INLINE_SELECT}
                value={typeof source === "string" && source in LEAD_SOURCE_LABELS ? source : "other"}
                onChange={(e) => void saveProfileField("source", e.target.value)}
                aria-label="Lead source"
              >
                {Object.entries(LEAD_SOURCE_LABELS).map(([value, lab]) => (
                  <option key={value} value={value}>
                    {lab}
                  </option>
                ))}
              </select>
            </LeadFieldRow>
            <LeadFieldRow label="Source detail">
              <input
                id="lead-source-detail"
                type="text"
                className={INLINE_FIELD}
                defaultValue={detail}
                key={`srcd-${leadId}-${detail}`}
                onBlur={(e) => void saveProfileField("source_detail", e.target.value.trim() || null)}
                placeholder="Optional"
                aria-label="Source detail"
              />
            </LeadFieldRow>
            <LeadFieldRow label="Phone">
              <input
                id="lead-phone"
                type="tel"
                className={INLINE_FIELD}
                defaultValue={phone}
                key={`ph-${leadId}-${phone}`}
                onBlur={(e) => void saveProfileField("phone", e.target.value.trim() || null)}
                placeholder="Phone"
                autoComplete="tel"
                aria-label="Phone"
              />
            </LeadFieldRow>
            <LeadFieldRow label="Email">
              <input
                id="lead-email"
                type="email"
                className={INLINE_FIELD}
                defaultValue={email}
                key={`em-${leadId}-${email}`}
                onBlur={(e) => void saveProfileField("email", e.target.value.trim() || null)}
                placeholder="Email"
                autoComplete="email"
                aria-label="Email"
              />
            </LeadFieldRow>
            <LeadFieldRow label="Service">
              <select
                id="lead-service-type"
                className={INLINE_SELECT}
                value={serviceTypeValue}
                onChange={(e) =>
                  void saveProfileField(
                    "service_type",
                    e.target.value.trim() || null,
                  )
                }
                aria-label="Service type"
              >
                <option value="">Not set</option>
                {serviceTypeOptions.map(({ value, label }) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </LeadFieldRow>
            {showMoveSize ? (
              <LeadFieldRow label="Move size">
                <select
                  id="lead-move-size"
                  className={INLINE_SELECT}
                  value={String(lead.move_size ?? "")}
                  onChange={(e) =>
                    void saveProfileField("move_size", e.target.value.trim() || null)
                  }
                  aria-label="Move size"
                >
                  {LEAD_MOVE_SIZE_SELECT_OPTIONS.map(({ value, label }) => (
                    <option key={value || "empty"} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </LeadFieldRow>
            ) : null}
            <LeadFieldRow label="Preferred date">
              <input
                id="lead-preferred-date"
                type="date"
                className={INLINE_FIELD}
                value={
                  lead.preferred_date != null
                    ? String(lead.preferred_date).slice(0, 10)
                    : ""
                }
                onChange={(e) => {
                  const v = e.target.value
                  void saveProfileField("preferred_date", v ? v : null)
                }}
                aria-label="Preferred date"
              />
            </LeadFieldRow>
            <LeadFieldRow label="From" alignTop>
              <AddressAutocomplete
                id="lead-from-address"
                name="from_address"
                variant="yu3"
                className={ADDR_AUTOCOMPLETE_FIELD}
                country="CA"
                placeholder="Search address"
                value={String(lead.from_address ?? "")}
                onChange={(r) => void saveProfileField("from_address", r.fullAddress || null)}
                onInputBlur={(v) => void saveProfileField("from_address", v.trim() || null)}
              />
            </LeadFieldRow>
            <LeadFieldRow label="To" alignTop>
              <AddressAutocomplete
                id="lead-to-address"
                name="to_address"
                variant="yu3"
                className={ADDR_AUTOCOMPLETE_FIELD}
                country="CA"
                placeholder="Search address"
                value={String(lead.to_address ?? "")}
                onChange={(r) => void saveProfileField("to_address", r.fullAddress || null)}
                onInputBlur={(v) => void saveProfileField("to_address", v.trim() || null)}
              />
            </LeadFieldRow>
            <LeadFieldRow label="Message" alignTop>
              <textarea
                id="lead-message"
                className={INLINE_TEXTAREA}
                defaultValue={lead.message != null ? String(lead.message) : ""}
                key={`msg-${leadId}-${String(lead.message ?? "").slice(0, 40)}`}
                onBlur={(e) =>
                  void saveProfileField("message", e.target.value.trim() || null)
                }
                placeholder="Client message"
                rows={2}
                aria-label="Client message"
              />
            </LeadFieldRow>
            {lead.quote_uuid ? (
              <LeadFieldRow label="Linked quote">
                <span className="font-mono text-[12px]">Quote on file</span>
              </LeadFieldRow>
            ) : null}
          </dl>
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Update status</CardTitle>
          </CardHeader>
          <CardBody>
            <label className="sr-only" htmlFor="lead-status-select">
              Lead status
            </label>
            <Select
              id="lead-status-select"
              value={String(lead.status || "new")}
              onChange={(e) => handleStatus(e.target.value)}
              className="max-w-md"
            >
              {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Add note</CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            <label className="sr-only" htmlFor="lead-internal-note">
              Internal note
            </label>
            <Textarea
              id="lead-internal-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Internal note"
            />
            <Button type="button" variant="primary" size="sm" uppercase onClick={handleNote}>
              Save note
            </Button>
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div>
            <CardEyebrow>Timeline</CardEyebrow>
            <CardTitle className="mt-0.5">Activity</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          {activities.length === 0 ? (
            <p className="text-[13px] text-[var(--yu3-ink-muted)]">No activity yet.</p>
          ) : (
            <ul className="space-y-0" aria-label="Lead activity">
              {activities.map((a, i) => (
                <li key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center pt-0.5" aria-hidden>
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--yu3-wine)]" />
                    {i < activities.length - 1 ? (
                      <span className="w-px flex-1 min-h-[20px] bg-[var(--yu3-line)]" />
                    ) : null}
                  </div>
                  <div className={cn("min-w-0 flex-1", i < activities.length - 1 && "pb-4")}>
                    <div className="text-[13px] font-semibold text-[var(--yu3-ink-strong)]">
                      {LEAD_ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                    </div>
                    <time
                      className="text-[11px] text-[var(--yu3-ink-faint)]"
                      dateTime={a.created_at}
                    >
                      {new Date(a.created_at).toLocaleString()}
                    </time>
                    {a.notes ? (
                      <p className="mt-1.5 text-[12px] text-[var(--yu3-ink-muted)] leading-relaxed">
                        {a.notes}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

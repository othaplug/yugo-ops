"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import {
  COMPLETENESS_PATH_LABELS,
  DISMISS_REASONS,
  LEAD_ACTIVITY_LABELS,
  LEAD_PRIORITY_LABELS,
  LEAD_SOURCE_LABELS,
  LEAD_STATUS_LABELS,
} from "@/lib/leads/admin-labels";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { CaretRight, Phone } from "@phosphor-icons/react";
import { formatTimeAgo } from "@/lib/format-time-ago";
import { ModalDialogFrame } from "@/components/ui/ModalDialogFrame";
import LeadResponseSlaCountdown from "../LeadResponseSlaCountdown";

type Lead = Record<string, unknown>;
type Activity = {
  id: string;
  activity_type: string;
  notes: string | null;
  created_at: string;
  performed_by: string | null;
};

function sourceLabel(source: string, detail: string | null | undefined) {
  const d = (detail || "").trim();
  if (d) return d;
  return LEAD_SOURCE_LABELS[source] || source.replace(/_/g, " ");
}

function telHref(phone: string | null | undefined): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 10) return `tel:+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `tel:+${d}`;
  return null;
}

function smsHref(phone: string | null | undefined): string | null {
  const d = (phone || "").replace(/\D/g, "");
  if (d.length === 10) return `sms:+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `sms:+${d}`;
  return null;
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
  const tel = telHref(phone);
  const sms = smsHref(phone);
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
      : 0;

  return (
    <div className="w-full min-w-0 py-5 md:py-6">
      <div className="mb-4">
        <BackButton label="Back to Leads" fallback="/admin/leads" />
      </div>

      <header className="mb-6">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--tx3)]">
          Lead
        </p>
        <h1 className="admin-page-hero text-[var(--tx)]">
          {ln} — {[fn, lnName].filter(Boolean).join(" ") || "Unknown"}
        </h1>
        <p className="text-[12px] text-[var(--tx3)] mt-1">
          {LEAD_STATUS_LABELS[String(lead.status)] || String(lead.status)} ·{" "}
          {LEAD_PRIORITY_LABELS[String(lead.priority)] || String(lead.priority)}
        </p>
        <p className="text-[11px] text-[var(--tx2)] mt-2 flex flex-wrap items-center gap-2">
          <span className="text-[var(--tx3)]">
            First response target (5 min):
          </span>
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
        </p>
      </header>

      {Boolean(
        lead.completeness_path ||
        (Array.isArray(lead.fields_missing) &&
          lead.fields_missing.length > 0) ||
        (Array.isArray(lead.clarifications_needed) &&
          lead.clarifications_needed.length > 0) ||
        lead.raw_inquiry_text ||
        lead.requires_specialty_quote ||
        lead.parsed_weight_lbs_max != null ||
        lead.parsed_dimensions_text,
      ) && (
        <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-6 space-y-2 text-[12px] text-[var(--tx2)]">
          <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-2">
            Completeness
          </h2>
          <p>
            <span className="text-[var(--tx3)]">Path:</span>{" "}
            {COMPLETENESS_PATH_LABELS[String(lead.completeness_path)] ||
              String(lead.completeness_path || "—")}
            {lead.completeness_score != null
              ? ` · Score ${String(lead.completeness_score)}`
              : ""}
          </p>
          {Array.isArray(lead.fields_present) &&
          (lead.fields_present as unknown[]).length > 0 ? (
            <p>
              <span className="text-[var(--tx3)]">Present:</span>{" "}
              {(lead.fields_present as string[]).join(", ")}
            </p>
          ) : null}
          {Array.isArray(lead.fields_missing) &&
          (lead.fields_missing as unknown[]).length > 0 ? (
            <p>
              <span className="text-[var(--tx3)]">Missing:</span>{" "}
              {(lead.fields_missing as string[]).join(", ")}
            </p>
          ) : null}
          {Array.isArray(lead.clarifications_needed) &&
          (lead.clarifications_needed as unknown[]).length > 0 ? (
            <p>
              <span className="text-[var(--tx3)]">Clarifications:</span>{" "}
              {(lead.clarifications_needed as string[]).join(" · ")}
            </p>
          ) : null}
          {Array.isArray(lead.follow_up_questions) &&
          (lead.follow_up_questions as unknown[]).length > 0 ? (
            <div>
              <span className="text-[var(--tx3)]">
                Follow-up questions sent:
              </span>
              <ol className="list-decimal pl-5 mt-1 space-y-1">
                {(lead.follow_up_questions as string[]).map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {lead.follow_up_sent_at ? (
            <p>
              <span className="text-[var(--tx3)]">Follow-up sent at:</span>{" "}
              {new Date(String(lead.follow_up_sent_at)).toLocaleString()}
            </p>
          ) : null}
          {lead.requires_specialty_quote ? (
            <p>
              <span className="text-[var(--tx3)]">Specialty quote:</span>{" "}
              Flagged for coordinator builder (manual review path)
            </p>
          ) : null}
          {lead.parsed_weight_lbs_max != null ? (
            <p>
              <span className="text-[var(--tx3)]">Parsed weight (max):</span>{" "}
              {String(lead.parsed_weight_lbs_max)} lb
            </p>
          ) : null}
          {lead.parsed_dimensions_text ? (
            <p>
              <span className="text-[var(--tx3)]">Parsed dimensions:</span>{" "}
              {String(lead.parsed_dimensions_text)}
            </p>
          ) : null}
          {lead.detected_service_type ? (
            <p>
              <span className="text-[var(--tx3)]">Detected service:</span>{" "}
              {serviceTypeDisplayLabel(String(lead.detected_service_type))}
            </p>
          ) : null}
          {Array.isArray(lead.detected_dates) &&
          (lead.detected_dates as unknown[]).length > 0 ? (
            <p>
              <span className="text-[var(--tx3)]">Dates in text:</span>{" "}
              {(lead.detected_dates as string[]).join(", ")}
            </p>
          ) : null}
          {lead.external_platform ? (
            <p>
              <span className="text-[var(--tx3)]">Referrer:</span>{" "}
              {String(lead.external_platform)}
              {lead.external_reference
                ? ` · Ref ${String(lead.external_reference)}`
                : ""}
            </p>
          ) : null}
          {lead.raw_inquiry_text ? (
            <div className="mt-2">
              <span className="text-[var(--tx3)] block mb-1">Raw inquiry</span>
              <pre className="text-[11px] whitespace-pre-wrap font-mono bg-[var(--bg)] border border-[var(--brd)] rounded-lg p-3 max-h-48 overflow-y-auto">
                {String(lead.raw_inquiry_text)}
              </pre>
            </div>
          ) : null}
        </section>
      )}

      <section className="mt-2 mb-6" aria-label="Intake next step">
        <p className="text-[10px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">
          Next step
        </p>
        {showIntakeChoice && !isPhotosRequested && !isPhotosReceived ? (
          <div className="grid md:grid-cols-3 gap-3">
            <button
              type="button"
              onClick={() => void handleRequestPhotos()}
              className="p-4 bg-[var(--card)] rounded-lg border border-[var(--brd)] hover:border-[#5C1A33]/35 transition text-left"
            >
              <p className="text-sm font-semibold text-[var(--tx)]">Request photos</p>
              <p className="text-[11px] text-[var(--tx2)] mt-1 leading-relaxed">
                Send a link so the client can upload room photos. About five minutes on their phone.
              </p>
            </button>
            <button
              type="button"
              onClick={() => void handleScheduleWalkthrough()}
              className="p-4 bg-[var(--card)] rounded-lg border border-[var(--brd)] hover:border-[#5C1A33]/35 transition text-left"
            >
              <p className="text-sm font-semibold text-[var(--tx)]">Virtual walkthrough</p>
              <p className="text-[11px] text-[var(--tx2)] mt-1 leading-relaxed">
                Schedule a video or phone call to walk the home and build inventory live.
              </p>
            </button>
            <button
              type="button"
              onClick={handleBuildManually}
              className="p-4 bg-[var(--card)] rounded-lg border border-[var(--brd)] hover:border-[#5C1A33]/35 transition text-left"
            >
              <p className="text-sm font-semibold text-[var(--tx)]">Build manually</p>
              <p className="text-[11px] text-[var(--tx2)] mt-1 leading-relaxed">
                Create the inventory from the lead notes and go straight to quoting.
              </p>
            </button>
          </div>
        ) : null}

        {isPhotosRequested ? (
          <div className="p-4 bg-[rgba(245,220,150,0.12)] border border-amber-200/80 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-amber-950">Photos requested</p>
                <p className="text-[11px] text-amber-900/90 mt-0.5">
                  Sent {formatTimeAgo(photosRequestedAt)}. Waiting for uploads.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleResendPhotoRequest()}
                  className="text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1.5 border border-amber-300/90 text-amber-950 rounded-lg hover:bg-amber-100/50"
                >
                  Resend link
                </button>
                <button
                  type="button"
                  onClick={() => void handleSkipPhotoIntake()}
                  className="text-[10px] font-bold tracking-[0.1em] uppercase px-3 py-1.5 text-[var(--tx2)]"
                >
                  Skip, build manually
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {isPhotosReceived ? (
          <div className="p-4 bg-[rgba(220,250,230,0.2)] border border-[#2C3E2D]/25 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-[#1a2f1b]">
                  {leadPhotoCount} photos received
                </p>
                <p className="text-[11px] text-[#2C3E2D] mt-0.5">
                  {photosUploadedAt
                    ? `Uploaded ${formatTimeAgo(photosUploadedAt)}. Ready for review.`
                    : "Ready for review."}
                </p>
              </div>
              <Link
                href={`/admin/leads/${leadId}/photos`}
                className="inline-flex items-center justify-center gap-1 px-4 py-2.5 bg-[#2C3E2D] text-white rounded-lg text-[10px] font-bold tracking-[0.12em] uppercase"
              >
                Review photos and build inventory
                <CaretRight size={14} weight="bold" className="opacity-90" aria-hidden />
              </Link>
            </div>
          </div>
        ) : null}
      </section>

      <div className="flex flex-wrap gap-2 mb-6">
        <Link
          href={quoteHref}
          className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--tx)]/25 text-[12px] font-semibold text-[var(--tx)] tracking-wide uppercase hover:bg-[var(--hover)]"
        >
          Send quote
          <CaretRight
            size={16}
            weight="bold"
            className="opacity-80"
            aria-hidden
          />
        </Link>
        {(requiresSpec || heavyParsed) && (
          <Link
            href={specialtyQuoteHref}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
          >
            Specialty builder
            <CaretRight
              size={16}
              weight="bold"
              className="opacity-70"
              aria-hidden
            />
          </Link>
        )}
        {tel ? (
          <a
            href={tel}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
          >
            <Phone size={16} aria-hidden />
            Call
          </a>
        ) : null}
        {sms ? (
          <a
            href={sms}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
          >
            SMS
          </a>
        ) : null}
        <button
          type="button"
          onClick={handleCallLogged}
          className="px-3 py-2 rounded-lg border border-[var(--brd)] text-[12px] font-semibold text-[var(--tx2)] hover:bg-[var(--hover)]"
        >
          Log call
        </button>
        <button
          type="button"
          onClick={() => setDismissOpen(true)}
          className="px-3 py-2 rounded-lg border border-red-500/30 text-[12px] font-semibold text-red-400 hover:bg-red-500/10"
        >
          Dismiss
        </button>
      </div>

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
            className="text-[14px] font-bold text-[var(--tx)] mb-3"
          >
            Dismiss lead
          </h2>
          <label className="block text-[11px] text-[var(--tx3)] mb-1">
            Reason
          </label>
          <select
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--tx)] mb-4"
          >
            {DISMISS_REASONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={() => setDismissOpen(false)}
              className="px-3 py-1.5 rounded-lg text-[12px] text-[var(--tx2)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="px-3 py-1.5 rounded-lg bg-red-500/90 text-white text-[12px] font-bold"
            >
              Confirm
            </button>
          </div>
        </ModalDialogFrame>
      )}

      <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 mb-6 space-y-2 text-[12px] text-[var(--tx2)]">
        <p>
          <span className="text-[var(--tx3)]">Source:</span>{" "}
          {sourceLabel(source, detail)}
        </p>
        <p>
          <span className="text-[var(--tx3)]">Phone:</span> {phone || "—"}
        </p>
        <p>
          <span className="text-[var(--tx3)]">Email:</span> {email || "—"}
        </p>
        <p>
          <span className="text-[var(--tx3)]">Service:</span>{" "}
          {serviceTypeDisplayLabel(
            typeof lead.service_type === "string" ? lead.service_type : null,
          )}
        </p>
        <p>
          <span className="text-[var(--tx3)]">Move size:</span>{" "}
          {String(lead.move_size || "—")}
        </p>
        <p>
          <span className="text-[var(--tx3)]">Preferred date:</span>{" "}
          {String(lead.preferred_date || "—")}
        </p>
        <p>
          <span className="text-[var(--tx3)]">From:</span>{" "}
          {String(lead.from_address || "—")}
        </p>
        <p>
          <span className="text-[var(--tx3)]">To:</span>{" "}
          {String(lead.to_address || "—")}
        </p>
        {lead.message ? (
          <p>
            <span className="text-[var(--tx3)]">Message:</span>{" "}
            {String(lead.message)}
          </p>
        ) : null}
        {lead.quote_uuid ? (
          <p>
            <span className="text-[var(--tx3)]">Linked quote:</span>{" "}
            <span className="font-mono text-[11px]">Quote on file</span>
          </p>
        ) : null}
      </section>

      <section className="mb-6">
        <label className="block text-[11px] font-bold text-[var(--tx3)] mb-1">
          Update status
        </label>
        <select
          value={String(lead.status || "new")}
          onChange={(e) => handleStatus(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--tx)]"
        >
          {Object.entries(LEAD_STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </section>

      <section className="mb-6">
        <label className="block text-[11px] font-bold text-[var(--tx3)] mb-1">
          Add note
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[13px] text-[var(--tx)] mb-2"
          placeholder="Internal note…"
        />
        <button
          type="button"
          onClick={handleNote}
          className="px-3 py-1.5 rounded-lg bg-[var(--hover)] text-[12px] font-semibold text-[var(--tx2)] border border-[var(--brd)]"
        >
          Save note
        </button>
      </section>

      <section>
        <h2 className="text-[11px] font-bold tracking-[0.16em] uppercase text-[var(--tx3)] mb-3">
          Activity
        </h2>
        <ul className="space-y-3">
          {activities.map((a) => (
            <li
              key={a.id}
              className="border-l-2 border-[var(--brd)] pl-3 text-[12px] text-[var(--tx2)]"
            >
              <div className="font-semibold text-[var(--tx)]">
                {LEAD_ACTIVITY_LABELS[a.activity_type] || a.activity_type}
              </div>
              <div className="text-[10px] text-[var(--tx3)]">
                {new Date(a.created_at).toLocaleString()}
              </div>
              {a.notes ? <p className="mt-1 text-[11px]">{a.notes}</p> : null}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import ModalOverlay from "../../components/ModalOverlay";
import { Icon } from "@/components/AppIcons";
import { useToast } from "../../components/Toast";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { ArrowRight } from "@phosphor-icons/react";
import { capMarginAlertMinutes } from "@/lib/jobs/duration-estimate";
import { formatMinutesAsHhMm, parseHhMmToMinutes } from "@/lib/duration-hhmm";

const COMPLEXITY_PRESETS = [
  "White Glove",
  "Piano",
  "High Value Client",
  "Repeat Client",
  "Artwork",
  "Antiques",
  "Storage",
];
const IN_PROGRESS_STATUSES = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "dispatched",
  "in_transit",
];
function isMoveInProgress(
  status: string | null | undefined,
  stage: string | null | undefined,
): boolean {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const st = (stage || "").toLowerCase().replace(/-/g, "_");
  return IN_PROGRESS_STATUSES.includes(s) || IN_PROGRESS_STATUSES.includes(st);
}
const ACCESS_OPTIONS = [
  "Elevator",
  "Stairs",
  "Loading dock",
  "Parking",
  "Gate / Buzz code",
  "Ground floor",
  "Building access required",
];

interface EditMoveDetailsModalProps {
  open: boolean;
  onClose: () => void;
  /** When set, only show and save this section (addresses = location/schedule/crew, notes = internal notes only). */
  section?: "addresses" | "notes" | null;
  moveId: string;
  initial: {
    from_address?: string | null;
    to_address?: string | null;
    from_lat?: number | null;
    from_lng?: number | null;
    to_lat?: number | null;
    to_lng?: number | null;
    crew_id?: string | null;
    status?: string | null;
    stage?: string | null;
    coordinator_name?: string | null;
    scheduled_date?: string | null;
    arrival_window?: string | null;
    /** On-site work time (minutes), not the arrival window span */
    estimated_duration_minutes?: number | null;
    margin_alert_minutes?: number | null;
    from_access?: string | null;
    to_access?: string | null;
    access_notes?: string | null;
    complexity_indicators?: string[] | null;
    internal_notes?: string | null;
  };
  crews?: { id: string; name: string }[];
  isCompleted?: boolean;
  onSaved?: (updates: Record<string, unknown>) => void;
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-[11px] font-semibold text-[var(--tx2)] mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

const inputBase =
  "w-full px-3 py-1.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)]/82 focus:border-[var(--brd)] focus:ring-1 focus:ring-[var(--brd)]/30 outline-none transition-all";

export default function EditMoveDetailsModal({
  open,
  onClose,
  section = null,
  moveId,
  initial,
  crews = [],
  isCompleted = false,
  onSaved,
}: EditMoveDetailsModalProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [fromAddress, setFromAddress] = useState(initial.from_address || "");
  const [toAddress, setToAddress] = useState(initial.to_address || "");
  const [fromLat, setFromLat] = useState<number | null>(
    initial.from_lat ?? null,
  );
  const [fromLng, setFromLng] = useState<number | null>(
    initial.from_lng ?? null,
  );
  const [toLat, setToLat] = useState<number | null>(initial.to_lat ?? null);
  const [toLng, setToLng] = useState<number | null>(initial.to_lng ?? null);
  const toDateInput = (d: string | null | undefined) => {
    if (!d) return "";
    const p = new Date(d);
    return isNaN(p.getTime()) ? "" : p.toISOString().slice(0, 10);
  };
  const parseAccessNotes = (s: string | null | undefined) => {
    if (!s || !s.trim()) return { fromAccess: "", toAccess: "", notesOnly: "" };
    const fromMatch = s.match(/^From:\s*(.+?)(?=\n|$)/m);
    const toMatch = s.match(/^To:\s*(.+?)(?=\n|$)/m);
    const fromAccess = fromMatch ? fromMatch[1].trim() : "";
    const toAccess = toMatch ? toMatch[1].trim() : "";
    let notesOnly = s
      .replace(/^From:\s*.+?(?=\n|$)/m, "")
      .replace(/^To:\s*.+?(?=\n|$)/m, "")
      .replace(/\n{2,}/g, "\n")
      .trim();
    return { fromAccess, toAccess, notesOnly };
  };
  const parsed = parseAccessNotes(initial.access_notes);
  const [scheduledDate, setScheduledDate] = useState(() =>
    toDateInput(initial.scheduled_date),
  );
  const [arrivalWindow, setArrivalWindow] = useState(
    initial.arrival_window || "",
  );
  const [allocatedJobHhMm, setAllocatedJobHhMm] = useState(() => {
    const v = initial.estimated_duration_minutes;
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
      return formatMinutesAsHhMm(Math.round(Number(v)));
    }
    return "";
  });
  const [marginAlertHhMm, setMarginAlertHhMm] = useState(() => {
    const v = initial.margin_alert_minutes;
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
      return formatMinutesAsHhMm(Math.round(Number(v)));
    }
    return "";
  });
  // Snapshot of initial allocated time so we can show a "Was X → Y" diff
  // when the admin types something different. Without this feedback,
  // there's no in-modal confirmation that the change is being staged.
  const initialAllocatedHhMm = useMemo(() => {
    const v = initial.estimated_duration_minutes;
    if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
      return formatMinutesAsHhMm(Math.round(Number(v)));
    }
    return "";
  }, [initial.estimated_duration_minutes]);
  const [fromAccess, setFromAccess] = useState(
    initial.from_access || parsed.fromAccess,
  );
  const [toAccess, setToAccess] = useState(
    initial.to_access || parsed.toAccess,
  );
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>(
    Array.isArray(initial.complexity_indicators)
      ? initial.complexity_indicators
      : [],
  );
  const [internalNotes, setInternalNotes] = useState(
    initial.internal_notes || "",
  );
  const [customComplexity, setCustomComplexity] = useState("");
  const [crewId, setCrewId] = useState(initial.crew_id || "");
  const [coordinatorName, setCoordinatorName] = useState(
    initial.coordinator_name || "",
  );
  const [saving, setSaving] = useState(false);

  // Sync form state when modal opens. Only [open, moveId] so dependency array size never changes.
  useEffect(() => {
    if (!open) return;
    setFromAddress(initial.from_address || "");
    setToAddress(initial.to_address || "");
    setFromLat(initial.from_lat ?? null);
    setFromLng(initial.from_lng ?? null);
    setToLat(initial.to_lat ?? null);
    setToLng(initial.to_lng ?? null);
    setScheduledDate(toDateInput(initial.scheduled_date));
    setArrivalWindow(initial.arrival_window || "");
    {
      const v = initial.estimated_duration_minutes;
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
        setAllocatedJobHhMm(formatMinutesAsHhMm(Math.round(Number(v))));
      } else {
        setAllocatedJobHhMm("");
      }
    }
    {
      const v = initial.margin_alert_minutes;
      if (v != null && Number.isFinite(Number(v)) && Number(v) > 0) {
        setMarginAlertHhMm(formatMinutesAsHhMm(Math.round(Number(v))));
      } else {
        setMarginAlertHhMm("");
      }
    }
    const p = parseAccessNotes(initial.access_notes);
    setFromAccess(initial.from_access || p.fromAccess);
    setToAccess(initial.to_access || p.toAccess);
    setComplexityIndicators(
      Array.isArray(initial.complexity_indicators)
        ? initial.complexity_indicators
        : [],
    );
    setInternalNotes(initial.internal_notes || "");
    setCrewId(initial.crew_id || "");
    setCoordinatorName(initial.coordinator_name || "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: sync only when open/moveId changes to keep deps array fixed size
  }, [open, moveId]);

  if (!open) return null;

  const handleSave = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setSaving(true);
    const moveInProgress = isMoveInProgress(initial.status, initial.stage);
    const crewChanging = (crewId.trim() || null) !== (initial.crew_id || null);
    if (moveInProgress && crewChanging) {
      toast(
        "Cannot reassign: this move is in progress. Reassignment is only allowed before the crew has started.",
        "alertTriangle",
      );
      setSaving(false);
      return;
    }
    const updated_at = new Date().toISOString();
    const accessNotesMerged =
      [
        fromAccess.trim() && `From: ${fromAccess.trim()}`,
        toAccess.trim() && `To: ${toAccess.trim()}`,
      ]
        .filter(Boolean)
        .join("\n") || null;

    const updatePayload: Record<string, unknown> = { updated_at };
    if (section !== "notes") {
      const trimmedAlloc = allocatedJobHhMm.trim();
      const trimmedMargin = marginAlertHhMm.trim();
      if (trimmedAlloc === "") {
        Object.assign(updatePayload, {
          est_hours: null,
          estimated_duration_minutes: null,
          margin_alert_minutes: null,
        });
      } else {
        const parsed = parseHhMmToMinutes(trimmedAlloc);
        if (!parsed.ok) {
          toast(parsed.message, "alertTriangle");
          setSaving(false);
          return;
        }
        const M = parsed.minutes;
        // Margin alert: when the admin typed a value, honour it (capped to
        // 2x allocated to keep alerts meaningful). When blank, fall back to
        // the previous behaviour: keep prior margin if reasonable, else 2x.
        let marginMinutes: number;
        if (trimmedMargin !== "") {
          const parsedMargin = parseHhMmToMinutes(trimmedMargin);
          if (!parsedMargin.ok) {
            toast(parsedMargin.message, "alertTriangle");
            setSaving(false);
            return;
          }
          marginMinutes = capMarginAlertMinutes(M, parsedMargin.minutes);
        } else {
          const prev = initial.margin_alert_minutes;
          const prevN =
            typeof prev === "string" ? Number.parseFloat(prev) : Number(prev);
          const uncapped =
            Number.isFinite(prevN) && prevN > 0 ? Math.max(prevN, M) : M * 2;
          marginMinutes = capMarginAlertMinutes(M, uncapped);
        }
        // Keep est_hours in sync with the manually-set duration so the display
        // always reads from est_hours (the authoritative field).
        Object.assign(updatePayload, {
          est_hours: Math.round((M / 60) * 100) / 100,
          estimated_duration_minutes: M,
          margin_alert_minutes: marginMinutes,
        });
      }
    }
    if (section === "notes") {
      updatePayload.internal_notes = internalNotes.trim() || null;
    } else if (section === "addresses") {
      Object.assign(updatePayload, {
        from_address: fromAddress.trim() || null,
        to_address: toAddress.trim() || null,
        delivery_address: toAddress.trim() || null,
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: toLat,
        to_lng: toLng,
        from_access: fromAccess.trim() || null,
        to_access: toAccess.trim() || null,
        scheduled_date: scheduledDate.trim() || null,
        scheduled_time: null,
        arrival_window: arrivalWindow.trim() || null,
        access_notes: accessNotesMerged,
        crew_id: crewId.trim() || null,
        coordinator_name: coordinatorName.trim() || null,
      });
    } else {
      Object.assign(updatePayload, {
        from_address: fromAddress.trim() || null,
        to_address: toAddress.trim() || null,
        delivery_address: toAddress.trim() || null,
        from_lat: fromLat,
        from_lng: fromLng,
        to_lat: toLat,
        to_lng: toLng,
        from_access: fromAccess.trim() || null,
        to_access: toAccess.trim() || null,
        scheduled_date: scheduledDate.trim() || null,
        scheduled_time: null,
        arrival_window: arrivalWindow.trim() || null,
        access_notes: accessNotesMerged,
        crew_id: crewId.trim() || null,
        coordinator_name: coordinatorName.trim() || null,
        complexity_indicators: complexityIndicators.length
          ? complexityIndicators
          : null,
        internal_notes: internalNotes.trim() || null,
      });
    }

    const res = await fetch(`/api/admin/moves/${moveId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update_details", ...updatePayload }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast(typeof data.error === "string" ? data.error : "Failed to save", "alertTriangle");
      return;
    }
    onSaved?.(data);
    onClose();
    router.refresh();
    toast("Move details updated", "check");
    if (section !== "notes") {
      fetch("/api/admin/gcal/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobType: "move", jobId: moveId }),
      }).catch(() => {});
    }
  };

  const toggleComplexity = (preset: string) => {
    setComplexityIndicators((prev) =>
      prev.includes(preset)
        ? prev.filter((p) => p !== preset)
        : [...prev, preset],
    );
  };

  const addCustomComplexity = () => {
    const v = customComplexity.trim();
    if (v && !complexityIndicators.includes(v)) {
      setComplexityIndicators((prev) => [...prev, v]);
      setCustomComplexity("");
    }
  };

  const showAddresses = section === null || section === "addresses";
  const showNotes = section === null || section === "notes";
  const modalTitle =
    section === "addresses"
      ? "Edit addresses & schedule"
      : section === "notes"
        ? "Edit internal notes"
        : "Edit move details";

  return (
    <ModalOverlay
      open={open}
      onClose={onClose}
      title={modalTitle}
      maxWidth="3xl"
    >
      <form onSubmit={handleSave} className="flex flex-col min-h-0">
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 bg-[var(--bg)]/40">
          {/* Location */}
          {showAddresses && (
            <fieldset
              disabled={isCompleted}
              className={isCompleted ? "opacity-70" : ""}
            >
              <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 sm:p-5 space-y-3">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
                  <Icon
                    name="mapPin"
                    className="w-3.5 h-3.5 text-[var(--gold)]"
                  />
                  Location
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <AddressAutocomplete
                      value={fromAddress}
                      onRawChange={setFromAddress}
                      onChange={(r) => {
                        setFromAddress(r.fullAddress);
                        setFromLat(r.lat);
                        setFromLng(r.lng);
                      }}
                      placeholder="Origin address"
                      label="From address"
                      className={inputBase}
                    />
                    <Field label="From access">
                      <select
                        value={fromAccess}
                        onChange={(e) => setFromAccess(e.target.value)}
                        className={inputBase}
                      >
                        <option value="">Select…</option>
                        {ACCESS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <div className="space-y-3">
                    <AddressAutocomplete
                      value={toAddress}
                      onRawChange={setToAddress}
                      onChange={(r) => {
                        setToAddress(r.fullAddress);
                        setToLat(r.lat);
                        setToLng(r.lng);
                      }}
                      placeholder="Destination address"
                      label="To address"
                      className={inputBase}
                    />
                    <Field label="To access">
                      <select
                        value={toAccess}
                        onChange={(e) => setToAccess(e.target.value)}
                        className={inputBase}
                      >
                        <option value="">Select…</option>
                        {ACCESS_OPTIONS.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </div>
              </section>
            </fieldset>
          )}

          {/* Schedule */}
          {showAddresses && (
            <fieldset
              disabled={isCompleted}
              className={isCompleted ? "opacity-70" : ""}
            >
              <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 sm:p-5 space-y-4">
                <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
                  <Icon
                    name="calendar"
                    className="w-3.5 h-3.5 text-[var(--gold)]"
                  />
                  Schedule
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="Date">
                    <input
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className={inputBase}
                    />
                  </Field>
                  <Field label="Time window">
                    <select
                      value={arrivalWindow}
                      onChange={(e) => setArrivalWindow(e.target.value)}
                      className={inputBase}
                    >
                      <option value="">Select window…</option>
                      {TIME_WINDOW_OPTIONS.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                      {arrivalWindow &&
                        !TIME_WINDOW_OPTIONS.includes(arrivalWindow) && (
                          <option value={arrivalWindow}>{arrivalWindow}</option>
                        )}
                    </select>
                  </Field>
                </div>
                {/* Allocated job time + Margin alert pair. Sub-card so the
                    two related "on-site time" fields read as one decision.
                    The diff hint below the allocated input answers the
                    question "did my change take effect?" before save. */}
                <div className="rounded-lg border border-[var(--brd)]/50 bg-[var(--bg)]/40 p-3 sm:p-4 space-y-3">
                  <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)]">
                    On-site work time
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label="Allocated job time (h:mm)">
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        value={allocatedJobHhMm}
                        onChange={(e) => setAllocatedJobHhMm(e.target.value)}
                        placeholder="e.g. 6:00"
                        className={inputBase}
                        aria-describedby="allocated-job-time-hint"
                      />
                      {initialAllocatedHhMm &&
                        allocatedJobHhMm.trim() !== "" &&
                        allocatedJobHhMm.trim() !== initialAllocatedHhMm && (
                          <p className="mt-1.5 flex items-center gap-1.5 text-[10px] font-medium text-[var(--gold)]">
                            <span className="text-[var(--tx3)]">
                              {initialAllocatedHhMm}
                            </span>
                            <ArrowRight className="w-3 h-3" aria-hidden />
                            <span>{allocatedJobHhMm.trim()}</span>
                            <span className="text-[var(--tx3)]">
                              · saves on confirm
                            </span>
                          </p>
                        )}
                    </Field>
                    <Field label="Margin alert at (h:mm)">
                      <input
                        type="text"
                        inputMode="text"
                        autoComplete="off"
                        value={marginAlertHhMm}
                        onChange={(e) => setMarginAlertHhMm(e.target.value)}
                        placeholder="auto (2× allocated)"
                        className={inputBase}
                      />
                    </Field>
                  </div>
                  <p
                    id="allocated-job-time-hint"
                    className="text-[10px] text-[var(--tx3)] leading-snug"
                  >
                    On-site work time for this job, separate from the arrival
                    window. Use hours and minutes (for example 2:30). Margin
                    alert defaults to 2× allocated when blank. Leave allocated
                    blank to clear; the move can still fall back to quote
                    estimated hours if those are set.
                  </p>
                </div>
              </section>
            </fieldset>
          )}

          {/* Crew & Coordinator */}
          {showAddresses && (
            <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 sm:p-5 space-y-4">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
                <Icon
                  name="users"
                  className="w-3.5 h-3.5 text-[var(--gold)]"
                />
                Crew &amp; coordinator
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {crews.length > 0 && (
                  <fieldset
                    disabled={
                      isCompleted ||
                      isMoveInProgress(initial.status, initial.stage)
                    }
                    className={
                      isCompleted ||
                      isMoveInProgress(initial.status, initial.stage)
                        ? "opacity-70"
                        : ""
                    }
                  >
                    <Field label="Crew (for live tracking)">
                      <select
                        value={crewId}
                        onChange={(e) => setCrewId(e.target.value)}
                        className={inputBase}
                      >
                        <option value="">No crew assigned</option>
                        {crews.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </fieldset>
                )}
                <Field label="Coordinator">
                  <input
                    type="text"
                    value={coordinatorName}
                    onChange={(e) => setCoordinatorName(e.target.value)}
                    placeholder="Coordinator name"
                    className={inputBase}
                  />
                </Field>
              </div>
            </section>
          )}

          {/* Internal notes + Complexity. Notes-only modal shows just the
              textarea. Full modal shows a single card with both Complexity
              indicators and Internal notes visible by default (was hidden
              behind a chevron — but coordinators reach for these often
              enough that the extra click was friction). */}
          {showNotes && (
            <section className="rounded-xl border border-[var(--brd)]/70 bg-[var(--card)] p-4 sm:p-5 space-y-4">
              <h3 className="text-[10px] font-bold tracking-widest uppercase text-[var(--tx3)] flex items-center gap-2">
                <Icon
                  name="fileText"
                  className="w-3.5 h-3.5 text-[var(--gold)]"
                />
                {section === "notes" ? "Internal notes" : "Notes & complexity"}
              </h3>
              {section === "notes" ? (
                <Field label="Internal notes">
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder="Client preferences, special instructions, internal-only..."
                    rows={5}
                    className={`${inputBase} resize-none min-h-[120px]`}
                  />
                </Field>
              ) : (
                <div className="space-y-4">
                  <Field label="Complexity indicators">
                    <div className="flex flex-wrap gap-2 mb-2">
                      {COMPLEXITY_PRESETS.map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => toggleComplexity(preset)}
                          className={`px-3 py-1.5 rounded-md text-[11px] font-medium transition-all border ${
                            complexityIndicators.includes(preset)
                              ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                              : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input
                        value={customComplexity}
                        onChange={(e) => setCustomComplexity(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addCustomComplexity();
                          }
                        }}
                        placeholder="Add custom (Enter to add)"
                        className={`${inputBase} flex-1`}
                      />
                      <button
                        type="button"
                        onClick={addCustomComplexity}
                        className="px-4 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] hover:bg-[var(--gold)]/5 transition-all shrink-0"
                      >
                        Add
                      </button>
                    </div>
                  </Field>
                  <Field label="Internal notes">
                    <textarea
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      placeholder="Client preferences, special instructions, internal-only..."
                      rows={4}
                      className={`${inputBase} resize-none min-h-[96px]`}
                    />
                  </Field>
                </div>
              )}
            </section>
          )}
        </div>

        {/* Sticky footer */}
        <div className="shrink-0 px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom,0px))] border-t border-[var(--brd)] bg-[var(--card)] flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
          <button
            type="button"
            onClick={onClose}
            className="admin-btn admin-btn-ghost w-full sm:w-auto"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="admin-btn admin-btn-primary w-full sm:w-auto"
          >
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}

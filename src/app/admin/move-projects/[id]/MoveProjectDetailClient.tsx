"use client";

import React, { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMoveDate } from "@/lib/date-format";
import { useToast } from "@/app/admin/components/Toast";
import { CheckCircle, Circle, MapPin, CaretDown, CaretRight } from "@phosphor-icons/react";

type AddressStop = {
  address?: string;
  label?: string;
  access?: string;
  parking?: string;
  is_partial?: boolean;
  move_size?: string;
};

type PhaseRow = Record<string, unknown> & {
  id?: string;
  phase_name?: string;
  phase_type?: string;
  phase_number?: number;
  status?: string;
  origin_index?: number | null;
  destination_index?: number | null;
  description?: string | null;
  days?: DayRow[];
};

type DayRow = Record<string, unknown> & {
  id?: string;
  date?: string;
  day_type?: string;
  label?: string;
  status?: string;
  description?: string | null;
  crew_size?: number | null;
  crew_ids?: string[] | null;
  truck_type?: string | null;
  truck_count?: number | null;
  estimated_hours?: number | null;
  day_cost_estimate?: number | null;
  completion_notes?: string | null;
  issues?: string | null;
  origin_address?: string | null;
  destination_address?: string | null;
  arrival_window?: string | null;
  start_time?: string | null;
  end_time?: string | null;
};

type CommRow = {
  id: string;
  comm_type: string;
  subject: string | null;
  sent_at: string;
  recipient_kind: string | null;
};

type ProjectRecord = Record<string, unknown> & {
  project_name?: string;
  status?: string;
  start_date?: string;
  end_date?: string;
  total_days?: number;
  project_type?: string;
  quote_id?: string | null;
  coordinator_name?: string | null;
  special_instructions?: string | null;
  internal_notes?: string | null;
  origins?: unknown;
  destinations?: unknown;
  total_price?: number | null;
  deposit?: number | null;
};

function parseStops(raw: unknown): AddressStop[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter(Boolean) as AddressStop[];
}

function timeForInput(t: unknown): string {
  if (t == null) return "";
  const s = String(t);
  const m = /^(\d{1,2}):(\d{2})/.exec(s);
  return m ? `${m[1]!.padStart(2, "0")}:${m[2]}` : "";
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  quoted: "Quoted",
  confirmed: "Confirmed",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  scheduled: "Scheduled",
  pending: "Pending",
};

function ProjectDayScheduleForm({
  projectId,
  day,
  crews,
  disabled,
  onSaved,
}: {
  projectId: string;
  day: DayRow;
  crews: { id: string; name: string }[];
  disabled?: boolean;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const dayId = String(day.id || "");
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [crewId, setCrewId] = useState(() => (Array.isArray(day.crew_ids) && day.crew_ids[0] ? day.crew_ids[0] : ""));
  const [dateStr, setDateStr] = useState(() => (day.date ? String(day.date).slice(0, 10) : ""));
  const [startT, setStartT] = useState(() => timeForInput(day.start_time));
  const [endT, setEndT] = useState(() => timeForInput(day.end_time));
  const [arrival, setArrival] = useState(() => String(day.arrival_window ?? ""));
  const [origin, setOrigin] = useState(() => String(day.origin_address ?? ""));
  const [dest, setDest] = useState(() => String(day.destination_address ?? ""));

  const handleSave = useCallback(async () => {
    if (!dayId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/move-projects/${projectId}/days/${dayId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crew_ids: crewId ? [crewId] : [],
          date: dateStr || undefined,
          start_time: startT || null,
          end_time: endT || null,
          arrival_window: arrival.trim() || null,
          origin_address: origin.trim() || null,
          destination_address: dest.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      toast("Day updated", "check");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  }, [
    projectId,
    dayId,
    crewId,
    dateStr,
    startT,
    endT,
    arrival,
    origin,
    dest,
    toast,
    onSaved,
  ]);

  return (
    <div className="mt-3 pt-3 border-t border-[var(--brd)]/60">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={disabled}
        className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-[var(--yu-accent)] hover:underline disabled:opacity-50"
      >
        {open ? <CaretDown className="w-3.5 h-3.5" /> : <CaretRight className="w-3.5 h-3.5" />}
        Crew and schedule
      </button>
      {open && (
        <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Assigned crew</span>
            <select
              value={crewId}
              onChange={(e) => setCrewId(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            >
              <option value="">Unassigned</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Date</span>
            <input
              type="date"
              value={dateStr}
              onChange={(e) => setDateStr(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Start time</span>
            <input
              type="time"
              value={startT}
              onChange={(e) => setStartT(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            />
          </label>
          <label className="block">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">End time</span>
            <input
              type="time"
              value={endT}
              onChange={(e) => setEndT(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Arrival window</span>
            <input
              value={arrival}
              onChange={(e) => setArrival(e.target.value)}
              placeholder="e.g. 8–10 a.m."
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)] placeholder:text-[var(--tx3)]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Origin (this day)</span>
            <input
              value={origin}
              onChange={(e) => setOrigin(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)]">Destination (this day)</span>
            <input
              value={dest}
              onChange={(e) => setDest(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--brd)] bg-[var(--card)] px-2 py-1.5 text-[11px] text-[var(--tx)]"
            />
          </label>
          <div className="sm:col-span-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void handleSave()}
              className="admin-btn admin-btn-sm admin-btn-primary"
            >
              {saving ? "Saving…" : "Save day"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MoveProjectDetailClient({
  projectId,
  project,
  initialPhases,
  initialComms,
  crews,
}: {
  projectId: string;
  project: ProjectRecord;
  initialPhases: PhaseRow[];
  initialComms: CommRow[];
  crews: { id: string; name: string }[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [comms] = useState(initialComms);
  const [completing, setCompleting] = useState<string | null>(null);

  const origins = useMemo(() => parseStops(project.origins), [project.origins]);
  const destinations = useMemo(() => parseStops(project.destinations), [project.destinations]);

  const crewNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of crews) m.set(c.id, c.name);
    return m;
  }, [crews]);

  const progress = useMemo(() => {
    let total = 0;
    let done = 0;
    for (const ph of initialPhases) {
      for (const d of ph.days ?? []) {
        total++;
        if (String(d.status) === "completed") done++;
      }
    }
    return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [initialPhases]);

  const refresh = useCallback(() => router.refresh(), [router]);

  async function markDayComplete(dayId: string) {
    setCompleting(dayId);
    try {
      const res = await fetch(`/api/admin/move-projects/${projectId}/days/${dayId}/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed");
      toast("Day marked complete", "check");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "x");
    } finally {
      setCompleting(null);
    }
  }

  const quoteId = project.quote_id ? String(project.quote_id) : null;

  return (
    <div className="space-y-8">
      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-1">Project</p>
            <p className="text-[11px] text-[var(--tx2)]">
              {STATUS_LABEL[String(project.status)] ?? String(project.status ?? "")}
              {project.project_type ? ` · ${String(project.project_type).replace(/_/g, " ")}` : ""}
            </p>
            {project.coordinator_name ? (
              <p className="text-[11px] text-[var(--tx3)] mt-1">Coordinator: {String(project.coordinator_name)}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {quoteId ? (
              <Link
                href={`/admin/quotes/${encodeURIComponent(quoteId)}/edit`}
                className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded border border-[var(--brd)] text-[var(--tx)] hover:bg-[var(--gdim)]"
              >
                Open quote
              </Link>
            ) : null}
          </div>
        </div>
        {project.special_instructions ? (
          <p className="text-[11px] text-[var(--tx2)] leading-relaxed border-t border-[var(--brd)]/50 pt-3">
            <span className="font-semibold text-[var(--tx3)]">Instructions: </span>
            {String(project.special_instructions)}
          </p>
        ) : null}
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-3 flex items-center gap-2">
          <MapPin className="w-4 h-4" weight="bold" aria-hidden />
          Locations
        </p>
        {origins.length === 0 && destinations.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)]">No stops recorded on this project.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {origins.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-2">Pickups</p>
                <ul className="space-y-2">
                  {origins.map((o, i) => (
                    <li key={`o-${i}`} className="text-[12px] border border-[var(--brd)]/70 rounded-lg p-2.5">
                      <p className="font-medium text-[var(--tx)]">{o.label?.trim() || `Origin ${i + 1}`}</p>
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5">{o.address || "—"}</p>
                      <div className="flex flex-wrap gap-2 mt-1 text-[10px] text-[var(--tx3)]">
                        {o.is_partial ? <span>Partial</span> : null}
                        {o.move_size ? <span>{o.move_size}</span> : null}
                        {o.access ? <span>{o.access}</span> : null}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {destinations.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wide text-[var(--tx3)] mb-2">Drop-offs</p>
                <ul className="space-y-2">
                  {destinations.map((o, i) => (
                    <li key={`d-${i}`} className="text-[12px] border border-[var(--brd)]/70 rounded-lg p-2.5">
                      <p className="font-medium text-[var(--tx)]">{o.label?.trim() || `Destination ${i + 1}`}</p>
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5">{o.address || "—"}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-2">Overall progress</p>
        <div className="flex justify-between text-[11px] text-[var(--tx2)] mb-2">
          <span>
            {progress.done} / {progress.total} days complete
          </span>
          <span>{progress.pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-[var(--brd)] overflow-hidden">
          <div
            className="h-full rounded-full bg-[var(--admin-primary-fill)] transition-all"
            style={{ width: `${progress.pct}%` }}
          />
        </div>
      </div>

      <div className="space-y-6">
        {initialPhases.map((ph) => {
          const oi = ph.origin_index;
          const di = ph.destination_index;
          const originHint =
            typeof oi === "number" && origins[oi]
              ? origins[oi]!.label || origins[oi]!.address || `Pickup ${oi + 1}`
              : null;
          const destHint =
            typeof di === "number" && destinations[di]
              ? destinations[di]!.label || destinations[di]!.address || `Drop-off ${di + 1}`
              : null;
          return (
            <div key={String(ph.id)} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
              <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
                <div>
                  <h2 className="text-[13px] font-semibold text-[var(--tx)]">{String(ph.phase_name ?? "Phase")}</h2>
                  <p className="text-[10px] text-[var(--tx3)] mt-0.5">
                    {ph.phase_type ? <span className="font-medium">{String(ph.phase_type)}</span> : null}
                    {originHint ? <span> · Pickup focus: {originHint}</span> : null}
                    {destHint ? <span> · Drop-off focus: {destHint}</span> : null}
                  </p>
                  {ph.description ? (
                    <p className="text-[11px] text-[var(--tx2)] mt-1 leading-snug">{String(ph.description)}</p>
                  ) : null}
                </div>
                <span className="text-[10px] uppercase font-bold text-[var(--tx3)]">{String(ph.status ?? "")}</span>
              </div>
              <ul className="space-y-3">
                {(ph.days ?? []).map((d) => {
                  const done = String(d.status) === "completed";
                  const dayId = String(d.id || "");
                  const ids = (Array.isArray(d.crew_ids) ? d.crew_ids : []) as string[];
                  const assigned =
                    ids.length > 0
                      ? ids.map((id) => crewNameById.get(id) || id.slice(0, 8)).join(", ")
                      : null;
                  return (
                    <li
                      key={dayId || String(d.date)}
                      className="flex flex-wrap items-start justify-between gap-3 border border-[var(--brd)]/80 rounded-lg p-3"
                    >
                      <div className="flex gap-2 min-w-0 flex-1">
                        {done ? (
                          <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden />
                        ) : (
                          <Circle className="w-5 h-5 shrink-0 text-[var(--tx3)]" aria-hidden />
                        )}
                        <div className="min-w-0 space-y-1 flex-1">
                          <p className="text-[12px] font-medium text-[var(--tx)]">
                            {String(d.label ?? "Day")}
                            {d.day_type ? (
                              <span className="text-[10px] font-normal text-[var(--tx3)] ml-2">
                                ({String(d.day_type)})
                              </span>
                            ) : null}
                          </p>
                          <p className="text-[11px] text-[var(--tx3)]">
                            {d.date ? formatMoveDate(String(d.date)) : ""}
                            {timeForInput(d.start_time) || timeForInput(d.end_time)
                              ? ` · ${timeForInput(d.start_time) || "—"}–${timeForInput(d.end_time) || "—"}`
                              : ""}
                          </p>
                          {assigned ? (
                            <p className="text-[11px] text-[var(--tx2)]">
                              <span className="font-semibold text-[var(--tx3)]">Crew: </span>
                              {assigned}
                            </p>
                          ) : (
                            <p className="text-[11px] text-[var(--tx3)]">Crew: unassigned</p>
                          )}
                          {d.arrival_window ? (
                            <p className="text-[11px] text-[var(--tx2)]">Window: {String(d.arrival_window)}</p>
                          ) : null}
                          {d.description ? (
                            <p className="text-[11px] text-[var(--tx2)] leading-snug">{String(d.description)}</p>
                          ) : null}
                          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--tx3)]">
                            {typeof d.crew_size === "number" ? <span>Plan: {d.crew_size} people</span> : null}
                            {d.truck_type ? (
                              <span>
                                {String(d.truck_type)}
                                {typeof d.truck_count === "number" && d.truck_count > 1 ? ` ×${d.truck_count}` : ""}
                              </span>
                            ) : null}
                            {typeof d.estimated_hours === "number" ? <span>~{d.estimated_hours} h est.</span> : null}
                            {d.day_cost_estimate != null && Number(d.day_cost_estimate) > 0 ? (
                              <span className="tabular-nums">Cost est. ${Number(d.day_cost_estimate).toLocaleString("en-CA")}</span>
                            ) : null}
                          </div>
                          {(d.origin_address || d.destination_address) && (
                            <div className="text-[10px] text-[var(--tx3)] space-y-0.5 mt-1">
                              {d.origin_address ? (
                                <p>
                                  <span className="font-semibold">Origin: </span>
                                  {String(d.origin_address)}
                                </p>
                              ) : null}
                              {d.destination_address ? (
                                <p>
                                  <span className="font-semibold">Destination: </span>
                                  {String(d.destination_address)}
                                </p>
                              ) : null}
                            </div>
                          )}
                          {d.issues ? (
                            <p className="text-[10px] text-amber-800 dark:text-amber-200/90 mt-1">
                              <span className="font-semibold">Issues: </span>
                              {String(d.issues)}
                            </p>
                          ) : null}
                          {d.completion_notes ? (
                            <p className="text-[10px] text-[var(--tx2)] mt-1">
                              <span className="font-semibold text-[var(--tx3)]">Completion: </span>
                              {String(d.completion_notes)}
                            </p>
                          ) : null}
                          {dayId ? (
                            <ProjectDayScheduleForm
                              projectId={projectId}
                              day={d}
                              crews={crews}
                              disabled={done}
                              onSaved={refresh}
                            />
                          ) : null}
                        </div>
                      </div>
                      {!done && dayId && (
                        <button
                          type="button"
                          disabled={completing === dayId}
                          onClick={() => markDayComplete(dayId)}
                          className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded border border-[var(--brd)] hover:bg-[var(--gdim)] text-[var(--tx)] disabled:opacity-50 self-start"
                        >
                          {completing === dayId ? "Saving…" : "Mark complete"}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx3)] mb-3">Communication log</p>
        {comms.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)]">No logged messages yet.</p>
        ) : (
          <ul className="space-y-2 text-[12px]">
            {comms.map((c) => (
              <li key={c.id} className="flex justify-between gap-2 border-b border-[var(--brd)]/60 pb-2 last:border-0">
                <span className="text-[var(--tx)]">{c.subject || c.comm_type}</span>
                <span className="text-[var(--tx3)] shrink-0 tabular-nums">
                  {new Date(c.sent_at).toLocaleString("en-CA", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

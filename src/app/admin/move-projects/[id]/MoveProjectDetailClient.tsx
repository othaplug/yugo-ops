"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoveDate } from "@/lib/date-format";
import { useToast } from "@/app/admin/components/Toast";
import { CheckCircle, Circle } from "@phosphor-icons/react";

type PhaseRow = Record<string, unknown> & {
  id?: string;
  phase_name?: string;
  status?: string;
  days?: DayRow[];
};

type DayRow = Record<string, unknown> & {
  id?: string;
  date?: string;
  label?: string;
  status?: string;
  description?: string | null;
  crew_size?: number | null;
  truck_type?: string | null;
  truck_count?: number | null;
  estimated_hours?: number | null;
  day_cost_estimate?: number | null;
  completion_notes?: string | null;
  issues?: string | null;
};

type CommRow = {
  id: string;
  comm_type: string;
  subject: string | null;
  sent_at: string;
  recipient_kind: string | null;
};

export default function MoveProjectDetailClient({
  projectId,
  initialPhases,
  initialComms,
}: {
  projectId: string;
  initialPhases: PhaseRow[];
  initialComms: CommRow[];
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [comms] = useState(initialComms);
  const [completing, setCompleting] = useState<string | null>(null);

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

  return (
    <div className="space-y-8">
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
        {initialPhases.map((ph) => (
          <div key={String(ph.id)} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
            <div className="flex items-center justify-between gap-2 mb-3">
              <h2 className="text-[13px] font-semibold text-[var(--tx)]">{String(ph.phase_name ?? "Phase")}</h2>
              <span className="text-[10px] uppercase font-bold text-[var(--tx3)]">{String(ph.status ?? "")}</span>
            </div>
            <ul className="space-y-3">
              {(ph.days ?? []).map((d) => {
                const done = String(d.status) === "completed";
                const dayId = String(d.id || "");
                return (
                  <li
                    key={dayId || String(d.date)}
                    className="flex flex-wrap items-start justify-between gap-3 border border-[var(--brd)]/80 rounded-lg p-3"
                  >
                    <div className="flex gap-2 min-w-0">
                      {done ? (
                        <CheckCircle className="w-5 h-5 shrink-0 text-emerald-600" aria-hidden />
                      ) : (
                        <Circle className="w-5 h-5 shrink-0 text-[var(--tx3)]" aria-hidden />
                      )}
                      <div className="min-w-0 space-y-1">
                        <p className="text-[12px] font-medium text-[var(--tx)]">{String(d.label ?? "Day")}</p>
                        <p className="text-[11px] text-[var(--tx3)]">
                          {d.date ? formatMoveDate(String(d.date)) : ""}
                        </p>
                        {d.description ? (
                          <p className="text-[11px] text-[var(--tx2)] leading-snug">{String(d.description)}</p>
                        ) : null}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-[var(--tx3)]">
                          {typeof d.crew_size === "number" ? <span>{d.crew_size} crew</span> : null}
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
                      </div>
                    </div>
                    {!done && dayId && (
                      <button
                        type="button"
                        disabled={completing === dayId}
                        onClick={() => markDayComplete(dayId)}
                        className="text-[10px] font-bold uppercase tracking-wide px-3 py-1.5 rounded border border-[var(--brd)] hover:bg-[var(--gdim)] text-[var(--tx)] disabled:opacity-50"
                      >
                        {completing === dayId ? "Saving…" : "Mark complete"}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
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

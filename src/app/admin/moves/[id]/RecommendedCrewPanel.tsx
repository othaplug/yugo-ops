"use client";

import { useState, useEffect } from "react";
import { ArrowsClockwise, CircleNotch, Users } from "@phosphor-icons/react";

interface CrewRecommendation {
  crew: {
    user_id: string;
    name: string | null;
    role: string | null;
    total_jobs: number;
    avg_satisfaction: number;
    damage_rate: number;
    avg_hours_vs_estimate: number;
    score_white_glove: number;
    on_time_rate: number;
  };
  score: number;
  reason: string;
}

interface RecommendedCrewPanelProps {
  moveId: string;
  moveDate: string | null;
  serviceType: string | null;
  tierSelected: string | null;
  hasPiano?: boolean;
  estimate?: number | null;
  currentCrewId?: string | null;
  onAssign?: (userId: string, name: string) => void;
}

export default function RecommendedCrewPanel({
  moveId,
  moveDate,
  serviceType,
  tierSelected,
  hasPiano,
  estimate,
  currentCrewId,
  onAssign,
}: RecommendedCrewPanelProps) {
  const [recommendations, setRecommendations] = useState<CrewRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assigned, setAssigned] = useState<string | null>(currentCrewId ?? null);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({
      moveId,
      ...(moveDate ? { moveDate } : {}),
      ...(serviceType ? { serviceType } : {}),
      ...(tierSelected ? { tierSelected } : {}),
      ...(hasPiano ? { hasPiano: "true" } : {}),
      ...(estimate ? { estimate: String(estimate) } : {}),
    });
    fetch(`/api/admin/crew/recommendations?${params.toString()}`, {
      credentials: "same-origin",
    })
      .then((r) => r.json())
      .then((d) => setRecommendations((d as { data?: CrewRecommendation[] }).data ?? []))
      .catch(() => setRecommendations([]))
      .finally(() => setLoading(false));
  }, [moveId, moveDate, serviceType, tierSelected, hasPiano, estimate]);

  async function handleAssign(rec: CrewRecommendation) {
    setAssigning(rec.crew.user_id);
    try {
      const res = await fetch(`/api/admin/moves/${moveId}/assign-crew`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ crew_id: rec.crew.user_id }),
      });
      if (!res.ok) throw new Error("Failed to assign");
      setAssigned(rec.crew.user_id);
      onAssign?.(rec.crew.user_id, rec.crew.name ?? "Crew member");
    } catch {
      // silently fail — let parent handle errors
    } finally {
      setAssigning(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-[var(--tx3)] text-[13px]">
        <CircleNotch size={16} className="animate-spin" />
        Calculating best crew match…
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="py-4 px-4 rounded-xl border border-[var(--brd)] bg-[var(--bg)]/40">
        <p className="text-[12px] text-[var(--tx3)]">
          No crew profiles found. Once crew complete their first jobs, AI recommendations will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} className="text-[var(--gold)]" />
        <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)]">
          Recommended Crew
        </span>
      </div>

      {recommendations.map((rec, idx) => {
        const isTop = idx === 0;
        const isAssigned = assigned === rec.crew.user_id;
        const isCurrentlyAssigning = assigning === rec.crew.user_id;

        return (
          <div
            key={rec.crew.user_id}
            className={`relative rounded-xl border p-4 transition-all ${
              isTop
                ? "border-[var(--gold)]/40 bg-[var(--gold)]/5 shadow-[0_0_0_1px_rgba(255,255,255,0.08)]"
                : "border-[var(--brd)] bg-[var(--card)]"
            }`}
          >
            {isTop && (
              <div className="absolute -top-2 left-4">
                <span className="dt-badge tracking-[0.04em] text-[var(--admin-primary-fill)]">
                  Top Match
                </span>
              </div>
            )}

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[13px] font-bold text-[var(--tx)]">
                    {rec.crew.name ?? "Unnamed crew member"}
                  </span>
                  {rec.crew.role === "lead" && (
                    <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                      Lead
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-[var(--tx3)] leading-relaxed mb-2">
                  {rec.reason}
                </p>

                <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--tx3)]">
                  <span>
                    Satisfaction {rec.crew.avg_satisfaction?.toFixed(1) ?? "—"}
                  </span>
                  <span>
                    {rec.crew.damage_rate === 0
                      ? "Zero damage"
                      : `${(rec.crew.damage_rate * 100).toFixed(0)}% damage`}
                  </span>
                  <span className="text-[var(--brd)]">·</span>
                  <span>{rec.crew.total_jobs} jobs</span>
                  <span className="text-[var(--brd)]">·</span>
                  <span className="font-semibold text-[var(--tx)]">
                    Score {rec.score}
                  </span>
                </div>
              </div>

              <div className="shrink-0">
                {isAssigned ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                    Assigned
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAssign(rec)}
                    disabled={!!assigning}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all disabled:opacity-50 ${
                      isTop
                        ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] hover:opacity-90"
                        : "border border-[var(--brd)] text-[var(--tx3)] hover:text-[var(--tx)] hover:border-[var(--tx3)]"
                    }`}
                  >
                    {isCurrentlyAssigning ? (
                      <ArrowsClockwise size={12} className="animate-spin" />
                    ) : null}
                    {isCurrentlyAssigning ? "Assigning…" : isTop ? "Assign" : "Select"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

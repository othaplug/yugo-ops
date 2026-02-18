"use client";

import { useState } from "react";
import Badge from "../../components/Badge";

type ExhibitionStatus = "installing" | "staging";

const ACTIVE_EXHIBITIONS: {
  id: string;
  name: string;
  gallery: string;
  location: string;
  dates: string;
  startDate: string;
  endDate: string;
  works: number;
  percent: number;
  status: ExhibitionStatus;
  details: string;
}[] = [
  { id: "1", name: "Feinstein: Convergence", gallery: "Bau-Xi", location: "Main Gallery", dates: "Feb 14 - Mar 28", startDate: "2026-02-14", endDate: "2026-03-28", works: 8, percent: 60, status: "installing", details: "Contemporary oil paintings. 12 pieces from the Convergence series. Climate-controlled transport required." },
  { id: "2", name: "Group: Northern Light", gallery: "Bau-Xi", location: "Vault", dates: "Mar 1 - Apr 15", startDate: "2026-03-01", endDate: "2026-04-15", works: 12, percent: 25, status: "staging", details: "Group exhibition featuring 6 artists. Mixed media. Staging in progress at Vault space." },
];

function getProgressBarColor(onTrack: boolean, atRisk: boolean, behind: boolean): string {
  if (onTrack) return "bg-[var(--grn)]";
  if (atRisk) return "bg-[var(--org)]";
  return "bg-[var(--red)]";
}

function getExhibitionProgress(ex: (typeof ACTIVE_EXHIBITIONS)[0]) {
  const now = new Date();
  const start = new Date(ex.startDate);
  const end = new Date(ex.endDate);
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / 86400000));
  const elapsed = Math.max(0, Math.ceil((now.getTime() - start.getTime()) / 86400000));
  const daysRemaining = Math.max(0, Math.ceil((end.getTime() - now.getTime()) / 86400000));
  const expectedPercent = Math.min(100, Math.round((elapsed / totalDays) * 100));
  const onTrack = ex.percent >= expectedPercent - 10;
  const atRisk = ex.percent >= expectedPercent - 25 && ex.percent < expectedPercent - 10;
  const behind = ex.percent < expectedPercent - 25;
  return { totalDays, elapsed, daysRemaining, onTrack, atRisk, behind };
}

type Transport = { id: string; title: string; gallery: string; route: string; value: string; date: string; status: "scheduled" | "confirmed"; details: string };

const SCHEDULED_TRANSPORTS: Transport[] = [
  { id: "1", title: "Feinstein Oil #4", gallery: "Bau-Xi", route: "Storage → Main Gallery", value: "$45K", date: "Feb 12", status: "scheduled", details: "Single piece. White-glove handling. Insurance certificate on file." },
  { id: "2", title: "Maxwell Bronze #2", gallery: "Olga Korper", route: "Foundry → Gallery", value: "$28K", date: "Feb 13", status: "confirmed", details: "Bronze sculpture. Crated. Loading dock at both ends." },
];

export default function GalleryClient() {
  const [expandedEx, setExpandedEx] = useState<Set<string>>(new Set());
  const [expandedTrans, setExpandedTrans] = useState<Set<string>>(new Set());
  const [projectDetail, setProjectDetail] = useState<Transport | null>(null);

  const toggleEx = (id: string) => {
    setExpandedEx((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleTrans = (id: string) => {
    setExpandedTrans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <>
      {/* Active Exhibitions - collapsible */}
      <div className="mb-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Active Exhibitions</h3>
        <div className="space-y-2">
          {ACTIVE_EXHIBITIONS.map((ex) => {
            const isExpanded = expandedEx.has(ex.id);
            const progress = getExhibitionProgress(ex);
            const barColor = getProgressBarColor(progress.onTrack, progress.atRisk, progress.behind);
            return (
              <div key={ex.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden hover:border-[var(--gold)] transition-all">
                <button
                  type="button"
                  onClick={() => toggleEx(ex.id)}
                  className="w-full p-4 flex items-start justify-between gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--tx)]">{ex.name}</div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {ex.gallery} • {ex.location} • {ex.dates} • {ex.works} works
                    </div>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center justify-between gap-2 text-[10px] text-[var(--tx3)]">
                        <span>{ex.percent}% — {progress.elapsed} of {progress.totalDays} days</span>
                        <span className="font-semibold text-[var(--tx2)]">{progress.daysRemaining} days left</span>
                      </div>
                      <div className="h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                        <div className={`h-full ${barColor} rounded-full transition-all duration-500`} style={{ width: `${ex.percent}%` }} />
                      </div>
                    </div>
                  </div>
                  <Badge status={ex.status} />
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-[var(--brd)]">
                    <div className="text-[11px] text-[var(--tx2)] mt-3 leading-relaxed">{ex.details}</div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scheduled Transports - collapsible */}
      <div className="mb-6">
        <h3 className="font-heading text-[13px] font-bold text-[var(--tx)] mb-3">Scheduled Transports</h3>
        <div className="space-y-2">
          {SCHEDULED_TRANSPORTS.map((t) => {
            const isExpanded = expandedTrans.has(t.id);
            return (
              <div key={t.id} className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden hover:border-[var(--gold)] transition-all">
                <button
                  type="button"
                  onClick={() => toggleTrans(t.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="w-10 h-10 rounded-lg bg-[var(--gdim)] flex items-center justify-center text-[var(--gold)] shrink-0">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <path d="M3 9h18M9 21V9" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-bold text-[var(--tx)]">{t.title}</div>
                    <div className="text-[10px] text-[var(--tx3)]">{t.gallery} • {t.route} • {t.value}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-[10px] text-[var(--tx3)]">{t.date}</div>
                    <span className="text-[10px] font-semibold text-[var(--blue)]">{t.status}</span>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`}>
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t border-[var(--brd)]">
                    <div className="text-[11px] text-[var(--tx2)] mt-3 leading-relaxed">{t.details}</div>
                    <button
                      type="button"
                      onClick={() => setProjectDetail(t)}
                      className="inline-block mt-2 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                    >
                      View project →
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Project detail modal */}
      {projectDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setProjectDetail(null)} aria-hidden="true" />
          <div className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-md p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 mb-4">
              <h3 className="font-heading text-[15px] font-bold text-[var(--tx)]">Project details</h3>
              <button type="button" onClick={() => setProjectDetail(null)} className="text-[var(--tx3)] hover:text-[var(--tx)] text-lg leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-[12px]">
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Title</div>
                <div className="text-[var(--tx)] font-semibold">{projectDetail.title}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Gallery</div>
                <div className="text-[var(--tx)]">{projectDetail.gallery}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Route</div>
                <div className="text-[var(--tx)]">{projectDetail.route}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Value</div>
                <div className="text-[var(--gold)] font-semibold">{projectDetail.value}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Date</div>
                <div className="text-[var(--tx)]">{projectDetail.date}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Status</div>
                <Badge status={projectDetail.status} />
              </div>
              <div>
                <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-0.5">Details</div>
                <p className="text-[var(--tx2)] leading-relaxed">{projectDetail.details}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

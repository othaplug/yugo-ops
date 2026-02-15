"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "../../components/Badge";

const ACTIVE_EXHIBITIONS = [
  { id: "1", name: "Feinstein: Convergence", gallery: "Bau-Xi", location: "Main Gallery", dates: "Feb 14 - Mar 28", works: 8, percent: 40, status: "installing" as const, details: "Contemporary oil paintings. 12 pieces from the Convergence series. Climate-controlled transport required." },
  { id: "2", name: "Group: Northern Light", gallery: "Bau-Xi", location: "Vault", dates: "Mar 1 - Apr 15", works: 12, percent: 10, status: "staging" as const, details: "Group exhibition featuring 6 artists. Mixed media. Staging in progress at Vault space." },
];

const SCHEDULED_TRANSPORTS = [
  { id: "1", title: "Feinstein Oil #4", gallery: "Bau-Xi", route: "Storage → Main Gallery", value: "$45K", date: "Feb 12", status: "scheduled" as const, details: "Single piece. White-glove handling. Insurance certificate on file." },
  { id: "2", title: "Maxwell Bronze #2", gallery: "Olga Korper", route: "Foundry → Gallery", value: "$28K", date: "Feb 13", status: "confirmed" as const, details: "Bronze sculpture. Crated. Loading dock at both ends." },
];

export default function GalleryClient() {
  const [expandedEx, setExpandedEx] = useState<Set<string>>(new Set());
  const [expandedTrans, setExpandedTrans] = useState<Set<string>>(new Set());

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
                    <div className="mt-2 h-1.5 bg-[var(--bg)] rounded-full overflow-hidden">
                      <div className="h-full bg-[var(--gold)] rounded-full transition-all duration-500" style={{ width: `${ex.percent}%` }} />
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
                    <Link href="/admin/deliveries" className="inline-block mt-2 text-[10px] font-semibold text-[var(--gold)] hover:underline">
                      View delivery →
                    </Link>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

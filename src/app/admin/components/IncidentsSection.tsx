"use client";

import { useState, useEffect } from "react";

function formatIncidentUrgency(raw: string): string {
  const u = raw.trim().toLowerCase();
  if (u === "high") return "High";
  if (u === "medium") return "Medium";
  if (u === "low") return "Low";
  return raw.replace(/_/g, " ");
}

function formatIncidentStatus(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (s === "open") return "Open";
  if (s === "in_progress") return "In progress";
  if (s === "resolved") return "Resolved";
  if (s === "closed") return "Closed";
  return raw.replace(/_/g, " ");
}

type Incident = {
  id: string;
  issue_type: string;
  issueLabel: string;
  description: string | null;
  created_at: string;
  urgency?: string | null;
  status?: string | null;
  photo_urls?: string[] | null;
};

export default function IncidentsSection({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: "move" | "delivery";
}) {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/incidents?jobId=${encodeURIComponent(jobId)}&jobType=${jobType}`)
      .then((r) => r.json())
      .then((d) => setIncidents(Array.isArray(d) ? d : []))
      .catch(() => setIncidents([]))
      .finally(() => setLoading(false));
  }, [jobId, jobType]);

  if (loading) return null;
  if (incidents.length === 0) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--org)]/30 rounded-xl p-5">
      <h3 className="font-heading text-[13px] font-bold text-[var(--org)] mb-3 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-[var(--org)]" />
        Reported Issues ({incidents.length})
      </h3>
      <div className="space-y-3">
        {incidents.map((i) => (
          <div key={i.id} className="border border-[var(--brd)] rounded-lg p-3">
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <span className="text-[11px] font-semibold text-[var(--tx)]">{i.issueLabel}</span>
              <span className="text-[10px] text-[var(--tx3)] shrink-0">
                {new Date(i.created_at).toLocaleString()}
              </span>
            </div>
            {(i.urgency || i.status) && (
              <p className="text-[10px] text-[var(--tx3)] mb-1">
                {i.urgency ? (
                  <span className="font-medium text-[var(--tx2)]">
                    Urgency: {formatIncidentUrgency(i.urgency)}
                  </span>
                ) : null}
                {i.urgency && i.status ? " · " : null}
                {i.status ? (
                  <span>Status: {formatIncidentStatus(i.status)}</span>
                ) : null}
              </p>
            )}
            {i.photo_urls && i.photo_urls.length > 0 && (
              <p className="text-[10px] text-[#2C3E2D] mb-1">
                {i.photo_urls.length} photo(s) on file
              </p>
            )}
            {i.description && (
              <p className="text-[12px] text-[var(--tx2)] mt-1">{i.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

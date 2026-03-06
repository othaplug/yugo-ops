"use client";

import { useState, useEffect } from "react";

type Incident = {
  id: string;
  issue_type: string;
  issueLabel: string;
  description: string | null;
  created_at: string;
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
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-semibold text-[var(--tx)]">{i.issueLabel}</span>
              <span className="text-[10px] text-[var(--tx3)]">
                {new Date(i.created_at).toLocaleString()}
              </span>
            </div>
            {i.description && (
              <p className="text-[12px] text-[var(--tx2)] mt-1">{i.description}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

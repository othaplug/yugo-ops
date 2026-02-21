"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CREW_STATUS_TO_LABEL } from "@/lib/move-status";

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 120) return "1 min ago";
  if (sec < 3600) return `${Math.floor(sec / 60)} min ago`;
  return `${Math.floor(sec / 3600)}h ago`;
}

interface Session {
  id: string;
  jobId: string;
  jobType: string;
  jobName: string;
  status: string;
  teamName: string;
  crewLeadName: string;
  lastLocation: { lat?: number; lng?: number; timestamp?: string } | null;
  updatedAt: string;
  toAddress: string | null;
}

export default function LiveOperationsCard() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = () => {
      fetch("/api/tracking/active")
        .then((r) => r.json())
        .then((d) => setSessions(d.sessions || []))
        .catch(() => setSessions([]))
        .finally(() => setLoading(false));
    };
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading && sessions.length === 0) return null;

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden mt-4 sm:mt-6">
      <div className="sh px-4 pt-4 flex items-center justify-between">
        <div className="sh-t flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--gold)] opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--gold)]" />
          </span>
          LIVE OPERATIONS
        </div>
        <Link href="/admin/crew" className="sh-l">View Map →</Link>
      </div>
      <div className="px-4 pb-4 space-y-2">
        {sessions.length === 0 ? (
          <p className="text-[12px] text-[var(--tx3)] py-4">No active tracking sessions</p>
        ) : (
          sessions.map((s) => (
            <Link
              key={s.id}
              href={s.jobType === "move" ? `/admin/moves/${s.jobId}` : `/admin/deliveries/${s.jobId}`}
              className="block px-3 py-2.5 rounded-lg border border-[var(--brd)] hover:border-[var(--gold)]/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--gold)] shrink-0" />
                <span className="text-[12px] font-semibold text-[var(--tx)] truncate">
                  {s.teamName} · {s.jobName} · {CREW_STATUS_TO_LABEL[s.status] || s.status}
                </span>
              </div>
              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                Last update: {formatRelative(s.updatedAt)}
                {s.toAddress && ` · ${s.toAddress}`}
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}

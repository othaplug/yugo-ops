"use client";

import { useState, useEffect } from "react";
import { Icon } from "@/components/AppIcons";

interface LoginEntry {
  id: string;
  device: string | null;
  ip_address: string | null;
  location: string | null;
  status: string;
  created_at: string;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default function LoginHistoryPanel() {
  const [entries, setEntries] = useState<LoginEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/login-history")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setEntries(d); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="py-4 text-center text-[12px] text-[var(--tx3)]">Loading login history...</div>;
  }

  if (entries.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-[12px] text-[var(--tx3)]">No login history available.</p>
        <p className="text-[10px] text-[var(--tx3)] mt-1">Login events will appear here once tracking is enabled.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-2">Recent Sign-In Activity</div>
        <div className="border border-[var(--brd)] rounded-lg overflow-hidden">
          <div className="hidden sm:grid grid-cols-5 gap-2 px-3 py-2 bg-[var(--bg2)] text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]">
            <div>Date / Time</div>
            <div>Device</div>
            <div>IP Address</div>
            <div>Location</div>
            <div className="text-right">Status</div>
          </div>
          {entries.map((entry) => (
            <div key={entry.id} className="grid grid-cols-1 sm:grid-cols-5 gap-1 sm:gap-2 px-3 py-2.5 border-t border-[var(--brd)] text-[11px]">
              <div className="text-[var(--tx)]">{formatDate(entry.created_at)}</div>
              <div className="text-[var(--tx3)]">{entry.device || "Unknown"}</div>
              <div className="text-[var(--tx3)] font-mono text-[10px]">{entry.ip_address || "—"}</div>
              <div className="text-[var(--tx3)]">{entry.location || "—"}</div>
              <div className="text-right">
                {entry.status === "success" ? (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-[rgba(45,159,90,0.12)] text-[var(--grn)]">Success</span>
                ) : (
                  <span className="text-[9px] font-semibold px-2 py-0.5 rounded bg-red-500/12 text-[var(--red)]">Failed</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

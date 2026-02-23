"use client";

import { useState, useEffect } from "react";

export default function DistanceLogistics({
  fromAddress,
  toAddress,
}: {
  fromAddress?: string | null;
  toAddress?: string | null;
}) {
  const [distance, setDistance] = useState<string | null>(null);
  const [duration, setDuration] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    if (!fromAddress?.trim() || !toAddress?.trim()) {
      setDistance(null);
      setDuration(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    fetch(
      `/api/admin/moves/distance-matrix?from=${encodeURIComponent(fromAddress)}&to=${encodeURIComponent(toAddress)}`
    )
      .then((r) => r.json())
      .then((d) => {
        if (d.distance != null && d.duration != null) {
          setDistance(d.distance);
          setDuration(d.duration);
          setError(null);
        } else {
          setDistance(null);
          setDuration(null);
          setError(d.error || null);
        }
      })
      .catch(() => {
        setDistance(null);
        setDuration(null);
        setError("Request failed");
      })
      .finally(() => setLoading(false));
  }, [fromAddress, toAddress]);

  const hasAddresses = Boolean(fromAddress?.trim() && toAddress?.trim());

  return (
    <div className="bg-[var(--card)] border border-[var(--brd)]/50 rounded-lg p-3 transition-colors">
      <h3 className="font-heading text-[10px] font-bold tracking-wide uppercase text-[var(--tx3)] mb-2">
        Distance & Logistics
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
        <div>
          <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Distance</span>
          <div className="text-[11px] font-medium text-[var(--tx)]">
            {!hasAddresses ? "Add addresses above" : loading ? "Loading…" : error ? error : distance ?? "—"}
          </div>
        </div>
        <div>
          <span className="text-[8px] font-medium tracking-widest uppercase text-[var(--tx3)]/70">Drive Time</span>
          <div className="text-[11px] font-medium text-[var(--tx)]">
            {!hasAddresses ? "—" : loading ? "Loading…" : error ? "—" : duration ?? "—"}
          </div>
        </div>
      </div>
    </div>
  );
}

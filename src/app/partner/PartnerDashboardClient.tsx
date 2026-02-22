"use client";

import { useState, useEffect } from "react";

interface DashboardData {
  deliveriesCount: number;
  movesCount: number;
  recentDeliveries: { id: string; delivery_number: string; status: string; scheduled_date: string | null }[];
  recentMoves: { id: string; move_code: string; status: string; scheduled_date: string | null }[];
}

export default function PartnerDashboardClient() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/partner/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="mt-6 py-8 text-center text-[13px] text-[var(--tx3)]">
        Loading…
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mt-6 py-8 text-center text-[13px] text-[var(--tx3)]">
        Unable to load dashboard
      </div>
    );
  }

  const total = data.deliveriesCount + data.movesCount;

  return (
    <div className="mt-6 space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]">Deliveries</div>
          <div className="text-[24px] font-bold text-[var(--tx)] mt-1">{data.deliveriesCount}</div>
        </div>
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--tx3)]">Moves</div>
          <div className="text-[24px] font-bold text-[var(--tx)] mt-1">{data.movesCount}</div>
        </div>
      </div>

      {total === 0 ? (
        <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
          <p className="text-[13px] text-[var(--tx3)]">No deliveries or moves linked to your account yet.</p>
          <p className="text-[12px] text-[var(--tx3)] mt-2">Your administrator will link projects to your organization.</p>
        </div>
      ) : (
        <>
          {data.recentDeliveries.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Recent Deliveries</h2>
              <div className="space-y-2">
                {data.recentDeliveries.map((d) => (
                  <div
                    key={d.id}
                    className="block rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--tx)]">{d.delivery_number}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--tx2)] capitalize">{d.status}</span>
                    </div>
                    {d.scheduled_date && (
                      <div className="text-[12px] text-[var(--tx3)] mt-1">{new Date(d.scheduled_date).toLocaleDateString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {data.recentMoves.length > 0 && (
            <div>
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3">Recent Moves</h2>
              <div className="space-y-2">
                {data.recentMoves.map((m) => (
                  <div
                    key={m.id}
                    className="block rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--tx)]">{m.move_code}</span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-[var(--bg)] text-[var(--tx2)] capitalize">{m.status}</span>
                    </div>
                    {m.scheduled_date && (
                      <div className="text-[12px] text-[var(--tx3)] mt-1">{new Date(m.scheduled_date).toLocaleDateString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

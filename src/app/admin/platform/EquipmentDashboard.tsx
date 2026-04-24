"use client";

import { toTitleCase } from "@/lib/format-text";
import { useEffect, useState } from "react";
import { Truck, Warning, CheckCircle, MinusCircle } from "@phosphor-icons/react";

type FleetRow = {
  truckId: string;
  name: string;
  status: "low" | "full" | "none" | string;
  itemsLabel: string;
  shortCount: number;
  lastChecked: string | null;
};

type RestockRow = { name: string; shortAcross: number; estCost: number };
type LossRow = {
  id: string;
  date: string;
  item: string;
  qty: number;
  reason: string;
  cost: number;
  moveId: string | null;
  deliveryId: string | null;
};

interface EquipmentDashboardProps {
  refreshKey?: number;
}

export default function EquipmentDashboard({ refreshKey = 0 }: EquipmentDashboardProps) {
  const [fleet, setFleet] = useState<FleetRow[]>([]);
  const [restock, setRestock] = useState<RestockRow[]>([]);
  const [losses, setLosses] = useState<LossRow[]>([]);
  const [lossTotal, setLossTotal] = useState(0);
  const [avgCostPerJob, setAvgCostPerJob] = useState<number | null>(null);
  const [checks30d, setChecks30d] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/admin/equipment-dashboard")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.fleetOverview)) setFleet(d.fleetOverview);
        if (Array.isArray(d.itemsNeedingRestock)) setRestock(d.itemsNeedingRestock);
        if (Array.isArray(d.lossHistory)) setLosses(d.lossHistory);
        if (typeof d.lossTotal30d === "number") setLossTotal(d.lossTotal30d);
        if (typeof d.avgEquipmentCostPerJob30d === "number") setAvgCostPerJob(d.avgEquipmentCostPerJob30d);
        if (typeof d.equipmentChecksSubmitted30d === "number") setChecks30d(d.equipmentChecksSubmitted30d);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [refreshKey]);

  if (loading) {
    return <p className="text-[12px] text-[var(--tx3)] py-6">Loading equipment status…</p>;
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Toronto" });
  };

  return (
    <section className="rounded-xl border border-[var(--brd)] bg-[var(--card)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center gap-2">
        <Truck className="w-4 h-4 text-[var(--gold)]" aria-hidden />
        <h2 className="text-[13px] font-bold text-[var(--tx)]">Equipment status</h2>
      </div>
      <div className="p-4 space-y-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--tx3)] mb-1">Fleet overview</p>
          <p className="text-[10px] text-[var(--tx3)] mb-2 leading-snug">
            Lists active and in-maintenance fleet vehicles. Line counts fill in when each truck has equipment rows (crew checks and assignments).
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-[var(--tx3)] border-b border-[var(--brd)]">
                  <th className="pb-2 pr-3">Truck</th>
                  <th className="pb-2 pr-3">Status</th>
                  <th className="pb-2 pr-3">Lines OK</th>
                  <th className="pb-2 pr-3">Short</th>
                  <th className="pb-2">Last check</th>
                </tr>
              </thead>
              <tbody>
                {fleet.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-4 text-[var(--tx3)]">
                      No active or in-service fleet vehicles yet. Add vehicles under Fleet Vehicles in this tab.
                    </td>
                  </tr>
                ) : (
                  fleet.map((f) => (
                    <tr key={f.truckId} className="border-b border-[var(--brd)]/60">
                      <td className="py-2 pr-3 font-medium text-[var(--tx)]">{f.name}</td>
                      <td className="py-2 pr-3">
                        {f.status === "low" ? (
                          <span className="inline-flex items-center gap-1 text-amber-700">
                            <Warning size={12} aria-hidden /> Low
                          </span>
                        ) : f.status === "none" ? (
                          <span className="inline-flex items-center gap-1 text-[var(--tx3)]">
                            <MinusCircle size={12} aria-hidden /> No equipment rows
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-emerald-700">
                            <CheckCircle size={12} aria-hidden /> Full
                          </span>
                        )}
                      </td>
                      <td className="py-2 pr-3 tabular-nums text-[var(--tx2)]">{f.itemsLabel}</td>
                      <td className="py-2 pr-3 tabular-nums">{f.shortCount > 0 ? f.shortCount : ""}</td>
                      <td className="py-2 text-[var(--tx3)]">{fmtDate(f.lastChecked)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--tx3)] mb-2">Items below assigned qty (all trucks)</p>
          <ul className="space-y-1 text-[12px] text-[var(--tx)]">
            {restock.length === 0 ? (
              <li className="text-[var(--tx3)]">None flagged.</li>
            ) : (
              restock.map((r) => (
                <li key={r.name}>
                  <span className="font-medium">{r.name}</span>
                  <span className="text-[var(--tx3)]"> — {r.shortAcross} below target</span>
                </li>
              ))
            )}
          </ul>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--tx3)] mb-2">Loss history (30 days)</p>
          <p className="text-[12px] text-[var(--tx2)] mb-2">
            Total estimated: <span className="font-semibold text-[var(--tx)]">${lossTotal.toFixed(2)}</span>
            {avgCostPerJob != null && checks30d != null && checks30d > 0 ? (
              <>
                {" "}
                · Avg equipment incident cost per check submitted:{" "}
                <span className="font-semibold text-[var(--tx)]">${avgCostPerJob.toFixed(2)}</span>
                <span className="text-[var(--tx3)]"> ({checks30d} checks)</span>
              </>
            ) : null}
          </p>
          <div className="overflow-x-auto max-h-[220px] overflow-y-auto">
            <table className="w-full text-[11px]">
              <thead className="sticky top-0 bg-[var(--card)]">
                <tr className="text-left text-[var(--tx3)] border-b border-[var(--brd)]">
                  <th className="pb-2 pr-2">Date</th>
                  <th className="pb-2 pr-2">Item</th>
                  <th className="pb-2 pr-2">Qty</th>
                  <th className="pb-2 pr-2">Reason</th>
                  <th className="pb-2">Cost</th>
                </tr>
              </thead>
              <tbody>
                {losses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-3 text-[var(--tx3)]">No incidents.</td>
                  </tr>
                ) : (
                  losses.map((l) => (
                    <tr key={l.id} className="border-b border-[var(--brd)]/50">
                      <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(l.date)}</td>
                      <td className="py-1.5 pr-2">{l.item}</td>
                      <td className="py-1.5 pr-2 tabular-nums">{l.qty}</td>
                      <td className="py-1.5 pr-2 text-[var(--tx2)]">{toTitleCase(l.reason)}</td>
                      <td className="py-1.5 tabular-nums">${l.cost.toFixed(2)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/client-timezone";
import PartnerChangePasswordGate from "./PartnerChangePasswordGate";
import { PartnerNotificationProvider } from "./PartnerNotificationContext";
import { useToast } from "@/app/admin/components/Toast";

type Summary = {
  org: { name?: string | null };
  contract: {
    id: string;
    contract_number: string;
    contract_type: string;
    start_date: string;
    end_date: string;
    status: string;
  } | null;
  properties: { id: string; building_name: string; address: string; total_units: number | null }[];
  stats: {
    propertiesCount: number;
    totalUnits: number;
    movesThisMonth: number;
    movesCompletedThisMonth: number;
    revenueThisMonth: number;
  };
  upcomingMoves: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    status: string | null;
    building_name: string | null;
  }[];
};

const CONTRACT_LABELS: Record<string, string> = {
  per_move: "Per move",
  fixed_rate: "Fixed rate",
  day_rate_retainer: "Day-rate retainer",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending review",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  paid: "Paid",
};

function labelFor(key: string, map: Record<string, string>) {
  const k = (key || "").toLowerCase();
  return map[k] ?? key.replace(/_/g, " ");
}

export default function PartnerPropertyManagementPortal({
  orgId,
  orgName,
  contactName,
}: {
  orgId: string;
  orgName: string;
  contactName: string;
}) {
  const { toast } = useToast();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"dash" | "book" | "reno">("dash");
  const [reno, setReno] = useState<{ projects: { id: string; project_name: string; total_units: number; units: unknown[] }[] } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/partner/pm/summary");
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed to load");
      setSummary(d);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load", "x");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab !== "reno") return;
    fetch("/api/partner/pm/renovations")
      .then((r) => r.json())
      .then((d) => setReno(d))
      .catch(() => setReno({ projects: [] }));
  }, [tab]);

  return (
    <PartnerNotificationProvider orgId={orgId}>
      <PartnerChangePasswordGate>
        <div className="min-h-screen bg-[#F5F3F0]">
          <header className="bg-[var(--card)] border-b border-[var(--brd)] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
            <div className="flex items-center gap-2">
              <YugoLogo size={18} variant="gold" />
              <span className="text-[13px] font-semibold text-[var(--tx)] truncate max-w-[200px]">{orgName}</span>
            </div>
            <span className="text-[11px] text-[var(--tx3)]">Hi, {contactName}</span>
          </header>

          <nav className="flex gap-1 px-3 py-2 bg-[var(--card)] border-b border-[var(--brd)] text-[11px] font-semibold">
            {(
              [
                { id: "dash" as const, label: "Dashboard" },
                { id: "book" as const, label: "Book move" },
                { id: "reno" as const, label: "Renovations" },
              ]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  tab === t.id ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx2)] hover:bg-[var(--bg)]"
                }`}
              >
                {t.label}
              </button>
            ))}
            <Link href="/partner/login" className="ml-auto px-2 py-1.5 text-[var(--tx3)] hover:text-[var(--tx)]">
              Account
            </Link>
          </nav>

          <main className="p-4 max-w-3xl mx-auto space-y-4 pb-24">
            {loading && <p className="text-[13px] text-[var(--tx3)]">Loading…</p>}

            {!loading && tab === "dash" && summary && (
              <>
                <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                  <h1 className="text-[18px] font-bold text-[var(--tx)]">Property dashboard</h1>
                  <p className="text-[12px] text-[var(--tx3)] mt-1">Contract moves, buildings, and upcoming work.</p>
                </div>

                {summary.contract ? (
                  <div className="rounded-xl border border-[var(--gold)]/30 bg-[var(--gold)]/5 p-4 space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--gold)]">Active contract</p>
                    <p className="text-[15px] font-semibold text-[var(--tx)]">{summary.contract.contract_number}</p>
                    <p className="text-[12px] text-[var(--tx2)]">
                      {formatDate(summary.contract.start_date, { month: "short", day: "numeric", year: "numeric" })} –{" "}
                      {formatDate(summary.contract.end_date, { month: "short", day: "numeric", year: "numeric" })}
                      {" · "}
                      {CONTRACT_LABELS[summary.contract.contract_type] ?? summary.contract.contract_type}
                    </p>
                    <p className="text-[11px] text-[var(--tx3)]">
                      {summary.stats.propertiesCount} buildings · {summary.stats.totalUnits || "—"} units tracked
                    </p>
                  </div>
                ) : (
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 text-[13px] text-[var(--tx2)]">
                    No active contract on file yet. Your Yugo account manager will finalize rates and terms.
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3">
                    <p className="text-[10px] text-[var(--tx3)] uppercase font-bold">This month</p>
                    <p className="text-[20px] font-bold text-[var(--tx)]">{summary.stats.movesThisMonth}</p>
                    <p className="text-[10px] text-[var(--tx3)]">Moves scheduled</p>
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3">
                    <p className="text-[10px] text-[var(--tx3)] uppercase font-bold">Revenue</p>
                    <p className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(summary.stats.revenueThisMonth)}</p>
                    <p className="text-[10px] text-[var(--tx3)]">Quoted / booked</p>
                  </div>
                </div>

                <div>
                  <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Properties</h2>
                  <div className="space-y-2">
                    {summary.properties.map((p) => (
                      <div key={p.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3 flex flex-col gap-2">
                        <div>
                          <p className="text-[14px] font-semibold text-[var(--tx)]">{p.building_name}</p>
                          <p className="text-[11px] text-[var(--tx3)]">{p.address}</p>
                          {p.total_units != null && <p className="text-[11px] text-[var(--tx2)] mt-1">{p.total_units} units</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setTab("book");
                          }}
                          className="self-start px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                        >
                          Book move
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Upcoming moves</h2>
                  <div className="rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[var(--bg)] text-[var(--tx3)] text-left">
                        <tr>
                          <th className="p-2">Date</th>
                          <th className="p-2">Unit</th>
                          <th className="p-2">Tenant</th>
                          <th className="p-2">Building</th>
                          <th className="p-2">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.upcomingMoves.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-4 text-center text-[var(--tx3)]">
                              No upcoming contract moves
                            </td>
                          </tr>
                        ) : (
                          summary.upcomingMoves.map((m) => (
                            <tr key={m.id} className="border-t border-[var(--brd)]">
                              <td className="p-2 whitespace-nowrap">
                                {m.scheduled_date ? formatDate(m.scheduled_date, { month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="p-2">{m.unit_number || "—"}</td>
                              <td className="p-2">{m.tenant_name || "—"}</td>
                              <td className="p-2 truncate max-w-[100px]" title={m.building_name || ""}>
                                {m.building_name || "—"}
                              </td>
                              <td className="p-2">{labelFor(m.status || "", STATUS_LABELS)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {!loading && tab === "book" && summary && (
              <PmBookForm
                summary={summary}
                onBooked={() => {
                  toast("Booking submitted — our team will confirm shortly.", "check");
                  load();
                  setTab("dash");
                }}
              />
            )}

            {!loading && tab === "reno" && (
              <div className="space-y-3">
                <h2 className="text-[16px] font-bold text-[var(--tx)]">Renovation programs</h2>
                {!reno ? (
                  <p className="text-[13px] text-[var(--tx3)]">Loading…</p>
                ) : reno.projects.length === 0 ? (
                  <p className="text-[13px] text-[var(--tx2)]">No renovation projects yet. Your coordinator can create one in Yugo+.</p>
                ) : (
                  reno.projects.map((p) => (
                    <div key={p.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                      <p className="text-[14px] font-semibold text-[var(--tx)]">{p.project_name}</p>
                      <p className="text-[11px] text-[var(--tx3)]">{p.total_units} units · {(p.units as unknown[]).length} rows tracked</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </main>
        </div>
      </PartnerChangePasswordGate>
    </PartnerNotificationProvider>
  );
}

function PmBookForm({ summary, onBooked }: { summary: Summary; onBooked: () => void }) {
  const { toast } = useToast();
  const contract = summary.contract;
  const [propertyId, setPropertyId] = useState(summary.properties[0]?.id ?? "");
  const [unitNumber, setUnitNumber] = useState("");
  const [unitType, setUnitType] = useState("2br");
  const [moveKind, setMoveKind] = useState("renovation_move_out");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [instructions, setInstructions] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const prop = summary.properties.find((p) => p.id === propertyId);
    if (prop) {
      setFromAddress((prev) => (prev.trim() ? prev : `${prop.address} (Unit ${unitNumber || "—"})`));
    }
  }, [propertyId, summary.properties, unitNumber]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contract?.id) {
      toast("No active contract — contact Yugo.", "x");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/partner/pm/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contract.id,
          partner_property_id: propertyId,
          unit_number: unitNumber,
          unit_type: unitType,
          move_kind: moveKind,
          tenant_name: tenantName,
          tenant_phone: tenantPhone,
          tenant_email: tenantEmail,
          from_address: fromAddress,
          to_address: toAddress,
          scheduled_date: scheduledDate,
          special_instructions: instructions,
        }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || "Failed");
      onBooked();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed", "x");
    } finally {
      setSaving(false);
    }
  };

  if (!contract) {
    return <p className="text-[13px] text-[var(--tx2)]">Booking opens once your contract is active.</p>;
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
      <h2 className="text-[16px] font-bold text-[var(--tx)]">Book a move</h2>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Property</label>
        <select
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        >
          {summary.properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.building_name}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Unit #</label>
          <input
            value={unitNumber}
            onChange={(e) => setUnitNumber(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
            required
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Unit type</label>
          <select
            value={unitType}
            onChange={(e) => setUnitType(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          >
            {["studio", "1br", "2br", "3br", "4br_plus"].map((u) => (
              <option key={u} value={u}>
                {u.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Move type</label>
        <select
          value={moveKind}
          onChange={(e) => setMoveKind(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        >
          <option value="renovation_move_out">Renovation move-out (→ storage)</option>
          <option value="renovation_move_in">Renovation move-in (storage → unit)</option>
          <option value="renovation_bundle">Renovation bundle (out + in)</option>
          <option value="tenant_move_gta">Tenant move (GTA)</option>
          <option value="tenant_move_outside">Tenant move (outside GTA)</option>
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Tenant</label>
        <input
          placeholder="Name"
          value={tenantName}
          onChange={(e) => setTenantName(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] mb-2"
          required
        />
        <input
          placeholder="Phone"
          value={tenantPhone}
          onChange={(e) => setTenantPhone(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] mb-2"
        />
        <input
          placeholder="Email"
          type="email"
          value={tenantEmail}
          onChange={(e) => setTenantEmail(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">From address</label>
        <input
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">To address</label>
        <input
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Preferred date</label>
        <input
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Special instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        />
      </div>

      <button
        type="submit"
        disabled={saving || !propertyId}
        className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
      >
        {saving ? "Submitting…" : "Submit booking request"}
      </button>
      <p className="text-[10px] text-[var(--tx3)]">Submissions are reviewed by Yugo operations before confirmation.</p>
    </form>
  );
}

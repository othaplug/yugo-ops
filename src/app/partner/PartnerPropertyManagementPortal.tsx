"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import YugoLogo from "@/components/YugoLogo";
import { formatCurrency } from "@/lib/format-currency";
import { formatDate } from "@/lib/client-timezone";
import PartnerChangePasswordGate from "./PartnerChangePasswordGate";
import { PartnerNotificationProvider } from "./PartnerNotificationContext";
import { useToast } from "@/app/admin/components/Toast";

type MoveReason = {
  reason_code: string;
  label: string;
  description?: string | null;
  is_round_trip: boolean;
  default_origin: string;
  default_destination: string;
  requires_return_move: boolean;
  urgency_default: string;
};

type ContractAddon = { id: string; addon_code: string; label: string; price: number; price_type: string };

type PmProjectRow = {
  id: string;
  project_name: string;
  project_type: string;
  total_units: number | null;
  tracked_units?: number;
  status: string;
};

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
  properties: {
    id: string;
    building_name: string;
    address: string;
    total_units: number | null;
    service_region?: string | null;
  }[];
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
    scheduled_time?: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    status: string | null;
    building_name: string | null;
    move_type_label: string | null;
  }[];
  recentCompleted?: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    unit_number: string | null;
    tenant_name: string | null;
    building_name: string | null;
    move_type_label: string | null;
    amount: number | null;
    estimate: number | null;
  }[];
  projects?: PmProjectRow[];
  dashboard?: {
    showPropertyStrip: boolean;
    showProjects: boolean;
    scheduledByProperty: Record<string, number>;
  };
};

const CONTRACT_LABELS: Record<string, string> = {
  per_move: "Per Job",
  fixed_rate: "Fixed rate",
  day_rate_retainer: "Day-rate retainer",
};

const STATUS_LABELS: Record<string, string> = {
  pending_approval: "Pending review",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  completed: "Completed",
  paid: "Paid",
  delivered: "Delivered",
};

const PROJECT_TYPE_LABELS: Record<string, string> = {
  renovation: "Renovation",
  building_upgrade: "Building upgrade",
  tenant_turnover: "Tenant turnover",
  office_buildout: "Office buildout",
  flood_remediation: "Flood remediation",
  staging_campaign: "Staging campaign",
  lease_up: "Lease-up",
  other: "Other program",
};

const ZONE_LABELS: Record<string, string> = {
  same_building: "Same building",
  local: "Local",
  within_region: "Within region",
  to_from_toronto: "Durham ↔ Toronto",
  outside_gta: "Outside GTA",
};

const TIME_WINDOWS = ["8 AM – 10 AM", "10 AM – 12 PM", "12 PM – 2 PM", "2 PM – 4 PM", "4 PM – 6 PM"];

function labelFor(key: string, map: Record<string, string>) {
  const k = (key || "").toLowerCase();
  return map[k] ?? key.replace(/_/g, " ");
}

function unitLine(address: string, unit: string) {
  return `${address} (Unit ${unit.trim() || "—"})`;
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
  const [tab, setTab] = useState<"dash" | "book" | "programs">("dash");
  const [programs, setPrograms] = useState<{ projects: PmProjectRow[] } | null>(null);

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
    if (tab !== "programs") return;
    fetch("/api/partner/pm/projects")
      .then((r) => r.json())
      .then((d) => setPrograms(d))
      .catch(() => setPrograms({ projects: [] }));
  }, [tab]);

  const dash = summary?.dashboard;
  const showPropStrip = dash?.showPropertyStrip ?? (summary?.properties.length ?? 0) >= 2;
  const showProjectsOnDash = dash?.showProjects ?? ((summary?.projects?.length ?? 0) > 0);

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
                { id: "book" as const, label: "Book Delivery" },
                { id: "programs" as const, label: "Programs" },
              ] as const
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
                  <p className="text-[12px] text-[var(--tx3)] mt-1">Contract service, buildings, and upcoming work.</p>
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
                    <p className="text-[10px] text-[var(--tx3)]">Jobs scheduled</p>
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3">
                    <p className="text-[10px] text-[var(--tx3)] uppercase font-bold">Completed</p>
                    <p className="text-[20px] font-bold text-[var(--tx)]">{summary.stats.movesCompletedThisMonth}</p>
                    <p className="text-[10px] text-[var(--tx3)]">This month</p>
                  </div>
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3 col-span-2">
                    <p className="text-[10px] text-[var(--tx3)] uppercase font-bold">Revenue</p>
                    <p className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(summary.stats.revenueThisMonth)}</p>
                    <p className="text-[10px] text-[var(--tx3)]">Quoted / booked (month)</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setTab("book")}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)]"
                  >
                    Book A Delivery
                  </button>
                </div>

                {showPropStrip && (
                  <div>
                    <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Properties</h2>
                    <div className="flex flex-wrap gap-2">
                      {summary.properties.map((p) => {
                        const n = dash?.scheduledByProperty?.[p.id] ?? 0;
                        return (
                          <div
                            key={p.id}
                            className="rounded-xl border border-[var(--brd)] bg-[var(--card)] px-3 py-2 min-w-[140px]"
                          >
                            <p className="text-[13px] font-semibold text-[var(--tx)]">{p.building_name}</p>
                            <p className="text-[10px] text-[var(--tx3)]">{n > 0 ? `${n} scheduled` : "No upcoming"}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {!showPropStrip && summary.properties.length === 1 && (
                  <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3">
                    <p className="text-[13px] font-semibold text-[var(--tx)]">{summary.properties[0]!.building_name}</p>
                    <p className="text-[11px] text-[var(--tx3)]">{summary.properties[0]!.address}</p>
                  </div>
                )}

                {showProjectsOnDash && (summary.projects?.length ?? 0) > 0 && (
                  <div>
                    <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Active programs</h2>
                    <div className="space-y-2">
                      {summary.projects!.map((p) => (
                        <div key={p.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-3">
                          <p className="text-[14px] font-semibold text-[var(--tx)]">{p.project_name}</p>
                          <p className="text-[11px] text-[var(--tx3)]">
                            {PROJECT_TYPE_LABELS[p.project_type] ?? labelFor(p.project_type, PROJECT_TYPE_LABELS)}
                            {p.total_units != null ? ` · ${p.total_units} units planned` : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">UPCOMING SERVICE</h2>
                  <div className="rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]">
                    <table className="w-full text-[11px]">
                      <thead className="bg-[var(--bg)] text-[var(--tx3)] text-left">
                        <tr>
                          <th className="p-2">DATE</th>
                          <th className="p-2">BUILDING</th>
                          <th className="p-2">UNIT</th>
                          <th className="p-2">TYPE</th>
                          <th className="p-2">TENANT</th>
                          <th className="p-2">STATUS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {summary.upcomingMoves.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="p-4 text-center text-[var(--tx3)]">
                              No upcoming scheduled service
                            </td>
                          </tr>
                        ) : (
                          summary.upcomingMoves.map((m) => (
                            <tr key={m.id} className="border-t border-[var(--brd)]">
                              <td className="p-2 whitespace-nowrap">
                                {m.scheduled_date ? formatDate(m.scheduled_date, { month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="p-2 truncate max-w-[90px]" title={m.building_name || ""}>
                                {m.building_name || "—"}
                              </td>
                              <td className="p-2">{m.unit_number || "—"}</td>
                              <td className="p-2 truncate max-w-[100px]" title={m.move_type_label || ""}>
                                {m.move_type_label || "—"}
                              </td>
                              <td className="p-2 truncate max-w-[80px]">{m.tenant_name || "—"}</td>
                              <td className="p-2">{labelFor(m.status || "", STATUS_LABELS)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {(summary.recentCompleted?.length ?? 0) > 0 && (
                  <div>
                    <h2 className="text-[12px] font-bold text-[var(--tx3)] uppercase tracking-wider mb-2">Recent completed</h2>
                    <div className="rounded-xl border border-[var(--brd)] overflow-hidden bg-[var(--card)]">
                      <table className="w-full text-[11px]">
                        <thead className="bg-[var(--bg)] text-[var(--tx3)] text-left">
                          <tr>
                            <th className="p-2">DATE</th>
                            <th className="p-2">UNIT</th>
                            <th className="p-2">TYPE</th>
                            <th className="p-2">AMOUNT</th>
                          </tr>
                        </thead>
                        <tbody>
                          {summary.recentCompleted!.map((m) => (
                            <tr key={m.id} className="border-t border-[var(--brd)]">
                              <td className="p-2 whitespace-nowrap">
                                {m.scheduled_date ? formatDate(m.scheduled_date, { month: "short", day: "numeric" }) : "—"}
                              </td>
                              <td className="p-2">{m.unit_number || "—"}</td>
                              <td className="p-2">{m.move_type_label || "—"}</td>
                              <td className="p-2">{formatCurrency(Number(m.amount ?? m.estimate) || 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
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

            {!loading && tab === "programs" && (
              <div className="space-y-3">
                <h2 className="text-[16px] font-bold text-[var(--tx)]">Programs & campaigns</h2>
                {!programs ? (
                  <p className="text-[13px] text-[var(--tx3)]">Loading…</p>
                ) : programs.projects.length === 0 ? (
                  <p className="text-[13px] text-[var(--tx2)]">
                    No programs yet. Moves can still be booked without a program. Your coordinator can add a program in Yugo when needed.
                  </p>
                ) : (
                  programs.projects.map((p) => (
                    <div key={p.id} className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
                      <p className="text-[14px] font-semibold text-[var(--tx)]">{p.project_name}</p>
                      <p className="text-[11px] text-[var(--tx3)]">
                        {PROJECT_TYPE_LABELS[p.project_type] ?? p.project_type}
                        {p.total_units != null ? ` · ${p.total_units} units` : ""}
                        {p.tracked_units != null ? ` · ${p.tracked_units} tracked` : ""}
                      </p>
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
  const [unitFloor, setUnitFloor] = useState("");
  const [unitType, setUnitType] = useState("2br");
  const [reasonCode, setReasonCode] = useState("");
  const [reasons, setReasons] = useState<MoveReason[]>([]);
  const [addons, setAddons] = useState<ContractAddon[]>([]);
  const [projects, setProjects] = useState<PmProjectRow[]>([]);
  const [pmProjectId, setPmProjectId] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [vacantNoTenant, setVacantNoTenant] = useState(false);
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [suiteFrom, setSuiteFrom] = useState("");
  const [suiteTo, setSuiteTo] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState(TIME_WINDOWS[0]!);
  const [urgency, setUrgency] = useState<"standard" | "priority" | "emergency">("standard");
  const [afterHours, setAfterHours] = useState(false);
  const [holiday, setHoliday] = useState(false);
  const [weekendOverride, setWeekendOverride] = useState(false);
  const [instructions, setInstructions] = useState("");
  const [selectedAddons, setSelectedAddons] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [pricing, setPricing] = useState<{
    zone: string;
    subtotal: number;
    base_price: number;
    weekend: boolean;
    error?: string;
  } | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevReasonRef = useRef<string>("");

  const prop = summary.properties.find((p) => p.id === propertyId);

  useEffect(() => {
    if (!contract?.id) return;
    let cancelled = false;
    Promise.all([
      fetch(`/api/partner/pm/move-reasons?contract_id=${encodeURIComponent(contract.id)}`).then((r) => r.json()),
      fetch(`/api/partner/pm/addons?contract_id=${encodeURIComponent(contract.id)}`).then((r) => r.json()),
      fetch("/api/partner/pm/projects").then((r) => r.json()),
    ])
      .then(([r1, r2, r3]) => {
        if (cancelled) return;
        setReasons(r1.reasons ?? []);
        if (r1.reasons?.[0]?.reason_code) setReasonCode((c) => c || r1.reasons[0].reason_code);
        setAddons(r2.addons ?? []);
        setProjects(r3.projects ?? []);
      })
      .catch(() => {
        if (!cancelled) toast("Could not load booking options", "x");
      });
    return () => {
      cancelled = true;
    };
  }, [contract?.id, toast]);

  const selectedReason = reasons.find((r) => r.reason_code === reasonCode) ?? null;

  useEffect(() => {
    if (!selectedReason || !prop) return;
    const reasonJustChanged = prevReasonRef.current !== selectedReason.reason_code;
    if (reasonJustChanged) prevReasonRef.current = selectedReason.reason_code;

    const ua = unitLine(prop.address, unitNumber);
    const storageHint = "Storage location (Yugo warehouse, building storage, or full address)";
    if (selectedReason.reason_code === "suite_transfer") {
      setFromAddress(unitLine(prop.address, suiteFrom));
      setToAddress(unitLine(prop.address, suiteTo));
      return;
    }
    const o = selectedReason.default_origin;
    const d = selectedReason.default_destination;
    if (o === "unit") setFromAddress(ua);
    else if (o === "external") {
      if (reasonJustChanged) setFromAddress("");
      else setFromAddress((prev) => (prev.trim() ? prev : ""));
    } else if (o === "storage") setFromAddress((prev) => (prev.includes("Storage") ? prev : storageHint));
    else if (o === "custom" && reasonJustChanged) setFromAddress("");

    if (d === "unit") setToAddress(ua);
    else if (d === "external") {
      if (reasonJustChanged) setToAddress("");
      else setToAddress((prev) => (prev.trim() ? prev : ""));
    } else if (d === "storage") setToAddress((prev) => (prev.includes("Storage") || prev.length > 12 ? prev : storageHint));
    else if (d === "custom" && reasonJustChanged) setToAddress("");

    if (selectedReason.urgency_default === "emergency") setUrgency("emergency");
    else if (selectedReason.urgency_default === "priority") setUrgency("priority");
    else setUrgency("standard");
  }, [selectedReason, prop, unitNumber, suiteFrom, suiteTo]);

  const runPreview = useCallback(() => {
    if (!contract?.id || !reasonCode || !fromAddress.trim() || !toAddress.trim() || !propertyId) {
      setPricing(null);
      return;
    }
    setPricingLoading(true);
    fetch("/api/partner/pm/preview-pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contract_id: contract.id,
        partner_property_id: propertyId,
        reason_code: reasonCode,
        unit_type: unitType,
        from_address: fromAddress,
        to_address: toAddress,
        scheduled_date: scheduledDate,
        urgency,
        after_hours: afterHours,
        holiday,
        weekend: weekendOverride,
      }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) {
          setPricing({ zone: "", subtotal: 0, base_price: 0, weekend: false, error: d.error || "Could not price" });
          return;
        }
        setPricing({
          zone: d.zone,
          subtotal: d.subtotal,
          base_price: d.base_price,
          weekend: d.weekend,
        });
      })
      .catch(() => setPricing({ zone: "", subtotal: 0, base_price: 0, weekend: false, error: "Network error" }))
      .finally(() => setPricingLoading(false));
  }, [contract?.id, reasonCode, fromAddress, toAddress, propertyId, unitType, scheduledDate, urgency, afterHours, holiday, weekendOverride]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(runPreview, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [runPreview]);

  const needsReturn = !!(selectedReason?.requires_return_move || selectedReason?.is_round_trip);
  const suiteMode = reasonCode === "suite_transfer";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!contract?.id) {
      toast("No active contract — contact Yugo.", "x");
      return;
    }
    if (suiteMode && (!suiteFrom.trim() || !suiteTo.trim())) {
      toast("Enter both suite units for a suite transfer.", "x");
      return;
    }
    if (needsReturn && !returnDate) {
      toast("Return service date is required for this job type.", "x");
      return;
    }
    setSaving(true);
    try {
      const addon_selections = addons
        .filter((a) => selectedAddons[a.addon_code])
        .map((a) => ({ addon_code: a.addon_code, label: a.label, price: a.price }));
      const res = await fetch("/api/partner/pm/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contract.id,
          partner_property_id: propertyId,
          unit_number: unitNumber,
          unit_floor: unitFloor,
          unit_type: unitType,
          reason_code: reasonCode,
          tenant_name: vacantNoTenant ? "" : tenantName,
          vacant_no_tenant: vacantNoTenant,
          tenant_phone: tenantPhone,
          tenant_email: tenantEmail,
          from_address: fromAddress,
          to_address: toAddress,
          scheduled_date: scheduledDate,
          return_scheduled_date: needsReturn ? returnDate : "",
          scheduled_time: scheduledTime,
          urgency,
          after_hours: afterHours,
          holiday,
          weekend: weekendOverride,
          special_instructions: instructions,
          addon_selections,
          pm_project_id: pmProjectId || null,
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
      <h2 className="text-[16px] font-bold text-[var(--tx)]">Book A Delivery</h2>

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
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Floor</label>
          <input
            value={unitFloor}
            onChange={(e) => setUnitFloor(e.target.value)}
            placeholder="Optional"
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          />
        </div>
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

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Move type</label>
        <select
          value={reasonCode}
          onChange={(e) => setReasonCode(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        >
          {reasons.length === 0 ? (
            <option value="">Loading…</option>
          ) : (
            reasons.map((r) => (
              <option key={r.reason_code} value={r.reason_code}>
                {r.label}
                {r.urgency_default === "emergency" ? " ⚡" : ""}
              </option>
            ))
          )}
        </select>
        {selectedReason?.description && <p className="text-[11px] text-[var(--tx3)] mt-1">{selectedReason.description}</p>}
      </div>

      {projects.length > 0 && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Program (optional)</label>
          <select
            value={pmProjectId}
            onChange={(e) => setPmProjectId(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          >
            <option value="">None — standalone job</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.project_name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div>
        <label className="flex items-center gap-2 text-[12px] text-[var(--tx2)]">
          <input type="checkbox" checked={vacantNoTenant} onChange={(e) => setVacantNoTenant(e.target.checked)} />
          No tenant — vacant unit
        </label>
      </div>

      {!vacantNoTenant && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Tenant / occupant</label>
          <input
            placeholder="Name"
            value={tenantName}
            onChange={(e) => setTenantName(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px] mb-2"
            required={!vacantNoTenant}
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
      )}

      {suiteMode && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">From unit</label>
            <input
              value={suiteFrom}
              onChange={(e) => setSuiteFrom(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">To unit</label>
            <input
              value={suiteTo}
              onChange={(e) => setSuiteTo(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
              required
            />
          </div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Origin</label>
        <textarea
          value={fromAddress}
          onChange={(e) => setFromAddress(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>
      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Destination</label>
        <textarea
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
          rows={2}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Move date</label>
        <input
          type="date"
          value={scheduledDate}
          onChange={(e) => setScheduledDate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
          required
        />
      </div>

      {needsReturn && (
        <div>
          <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Return Date</label>
          <input
            type="date"
            value={returnDate}
            onChange={(e) => setReturnDate(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
            required
          />
          <p className="text-[10px] text-[var(--tx3)] mt-1">A return leg will be created automatically for ops to confirm.</p>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Time window</label>
        <select
          value={scheduledTime}
          onChange={(e) => setScheduledTime(e.target.value)}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        >
          {TIME_WINDOWS.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Urgency</label>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value as "standard" | "priority" | "emergency")}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        >
          <option value="standard">Standard</option>
          <option value="priority">Priority (+15%)</option>
          <option value="emergency">Emergency (+30%)</option>
        </select>
      </div>

      <div className="space-y-2 text-[12px] text-[var(--tx2)]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={afterHours} onChange={(e) => setAfterHours(e.target.checked)} />
          After-hours window
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={holiday} onChange={(e) => setHoliday(e.target.checked)} />
          Holiday / statutory day
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={weekendOverride} onChange={(e) => setWeekendOverride(e.target.checked)} />
          Count as weekend pricing
        </label>
      </div>

      {addons.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-[var(--tx3)] uppercase mb-2">Add-ons (contract rates)</p>
          <div className="space-y-2">
            {addons.map((a) => (
              <label key={a.addon_code} className="flex items-start gap-2 text-[12px] text-[var(--tx)]">
                <input
                  type="checkbox"
                  checked={!!selectedAddons[a.addon_code]}
                  onChange={(e) => setSelectedAddons((s) => ({ ...s, [a.addon_code]: e.target.checked }))}
                />
                <span>
                  {a.label} — {formatCurrency(Number(a.price))}
                  {a.price_type !== "flat" ? ` (${a.price_type.replace("_", " ")})` : ""}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className="block text-[10px] font-bold text-[var(--tx3)] uppercase mb-1">Special instructions</label>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-[var(--brd)] bg-[var(--bg)] text-[13px]"
        />
      </div>

      <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-3 text-[12px] space-y-1">
        <p className="text-[10px] font-bold text-[var(--tx3)] uppercase">Pricing (estimate)</p>
        {pricingLoading && <p className="text-[var(--tx3)]">Calculating…</p>}
        {!pricingLoading && pricing?.error && <p className="text-red-600">{pricing.error}</p>}
        {!pricingLoading && pricing && !pricing.error && (
          <>
            <p className="text-[var(--tx)]">
              Zone: {ZONE_LABELS[pricing.zone] ?? pricing.zone}
              {pricing.weekend ? " · Weekend surcharges apply" : ""}
            </p>
            <p className="text-[var(--tx)]">
              Base: {formatCurrency(pricing.base_price)} → Total: {formatCurrency(pricing.subtotal)}
            </p>
          </>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || !propertyId || !reasonCode}
        className="w-full py-3 rounded-xl text-[13px] font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
      >
        {saving ? "Submitting…" : "Submit booking request"}
      </button>
      <p className="text-[10px] text-[var(--tx3)]">Submissions are reviewed by Yugo operations before confirmation.</p>
    </form>
  );
}

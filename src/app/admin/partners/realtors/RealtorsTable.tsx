"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import FilterBar, { SortableHeader } from "../../components/FilterBar";
import { useToast } from "../../components/Toast";
import { AddReferralButton, AddRealtorButton } from "./RealtorsClient";
import AgentDetailModal from "./AgentDetailModal";
import { formatCurrency } from "@/lib/format-currency";
import { CaretDown } from "@phosphor-icons/react";

type Referral = {
  id: string;
  agent_name: string | null;
  brokerage: string | null;
  client_name: string | null;
  property: string | null;
  tier: string | null;
  status: string;
  commission?: number | null;
  agent_email?: string | null;
  created_at?: string;
  move_id?: string | null;
};

type Realtor = { id: string; agent_name: string; email?: string | null; brokerage?: string | null };

const STATUS_OPTIONS = [
  { value: "", label: "All status" },
  { value: "new", label: "New" },
  { value: "lead", label: "Lead" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

const STATUS_STAGE_OPTIONS = STATUS_OPTIONS.filter((o) => o.value !== "");

const STATUS_STYLES: Record<string, string> = {
  new:       "text-[var(--yu3-ink-muted)]",
  lead:      "text-amber-800 dark:text-amber-200",
  quoted:    "text-[var(--yu3-wine)]",
  booked:    "text-sky-800 dark:text-sky-200",
  scheduled: "text-sky-800 dark:text-sky-200",
  completed: "text-[var(--yu3-success)]",
};

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "Curated", label: "Essential" },
  { value: "Essentials", label: "Essentials" },
  { value: "Premier", label: "Premier" },
  { value: "Signature", label: "Signature" },
  { value: "Estate", label: "Estate" },
];

const TIER_STYLES: Record<string, string> = {
  essential:  "text-[var(--yu3-ink-muted)]",
  curated:    "text-[var(--yu3-ink-muted)]",
  essentials: "text-[var(--yu3-ink-muted)]",
  premier:    "text-amber-800 dark:text-amber-200",
  signature:  "text-sky-800 dark:text-sky-200",
  estate:     "text-[var(--yu3-wine)]",
};

function initials(name: string | null) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}

function StatusSelect({
  referralId,
  status,
  updatingId,
  onUpdate,
}: {
  referralId: string;
  status: string;
  updatingId: string | null;
  onUpdate: (id: string, status: string) => void;
}) {
  const key = (status || "new").toLowerCase();
  const style = STATUS_STYLES[key] ?? STATUS_STYLES.new;
  const isUpdating = updatingId === referralId;

  return (
    <div className="relative inline-flex items-center">
      <select
        value={key}
        onChange={(e) => onUpdate(referralId, e.target.value)}
        disabled={isUpdating}
        className={`appearance-none cursor-pointer rounded-[var(--yu3-r-sm)] border-0 py-1 pl-2.5 pr-6 text-[10px] font-bold tracking-[0.04em] outline-none transition-opacity disabled:opacity-40 dt-badge ${style}`}
        style={{ background: "inherit" }}
      >
        {[
          ...STATUS_STAGE_OPTIONS,
          ...(STATUS_STAGE_OPTIONS.some((o) => o.value === key)
            ? []
            : [{ value: key, label: key.replace(/\b\w/g, (c) => c.toUpperCase()) }]),
        ].map((o) => (
          <option
            key={o.value}
            value={o.value}
            className="bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)]"
          >
            {o.label}
          </option>
        ))}
      </select>
      <CaretDown
        size={9}
        className="absolute right-2 pointer-events-none opacity-60"
        weight="bold"
      />
    </div>
  );
}

export default function RealtorsTable({
  referrals,
  clientNameToId = {},
  clientNameToMoveId = {},
  realtors = [],
}: {
  referrals: Referral[];
  clientNameToId?: Record<string, string>;
  clientNameToMoveId?: Record<string, string>;
  realtors?: Realtor[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; brokerage: string | null } | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [agentFilter, setAgentFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const agentOptions = useMemo(() => {
    const seen = new Set<string>();
    const opts: { value: string; label: string }[] = [{ value: "", label: "All agents" }];
    (referrals || []).forEach((r) => {
      const name = r.agent_name || "";
      if (name && !seen.has(name)) {
        seen.add(name);
        opts.push({ value: name, label: name });
      }
    });
    return opts;
  }, [referrals]);

  const filteredAndSorted = useMemo(() => {
    let list = [...(referrals || [])];
    if (statusFilter) list = list.filter((r) => (r.status || "").toLowerCase() === statusFilter.toLowerCase());
    if (agentFilter) list = list.filter((r) => (r.agent_name || "") === agentFilter);
    if (tierFilter) list = list.filter((r) => (r.tier || "").toLowerCase() === tierFilter.toLowerCase());

    if (sortKey) {
      list.sort((a, b) => {
        let va: string | number = "";
        let vb: string | number = "";
        if (sortKey === "agent")       { va = (a.agent_name || "").toLowerCase(); vb = (b.agent_name || "").toLowerCase(); }
        else if (sortKey === "client") { va = (a.client_name || "").toLowerCase(); vb = (b.client_name || "").toLowerCase(); }
        else if (sortKey === "property") { va = (a.property || "").toLowerCase(); vb = (b.property || "").toLowerCase(); }
        else if (sortKey === "tier")   { va = (a.tier || "").toLowerCase(); vb = (b.tier || "").toLowerCase(); }
        else if (sortKey === "status") { va = (a.status || "").toLowerCase(); vb = (b.status || "").toLowerCase(); }
        else if (sortKey === "commission") { va = Number(a.commission) || 0; vb = Number(b.commission) || 0; }
        else if (sortKey === "created_at") { va = new Date(a.created_at || 0).getTime(); vb = new Date(b.created_at || 0).getTime(); }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [referrals, statusFilter, agentFilter, tierFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("asc"); }
  };

  const hasActiveFilters = !!(statusFilter || agentFilter || tierFilter);
  const clearFilters = () => { setStatusFilter(""); setAgentFilter(""); setTierFilter(""); };

  const handleStatusUpdate = async (id: string, status: string) => {
    if (!status) return;
    setUpdatingId(id);
    try {
      const res = await fetch(`/api/admin/referrals/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to update");
      }
      toast("Status updated", "check");
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to update status", "x");
    } finally {
      setUpdatingId(null);
    }
  };

  const all = filteredAndSorted;
  const agentReferrals = selectedAgent
    ? all.filter(
        (r) =>
          (r.agent_name || "") === selectedAgent.name &&
          (r.brokerage || null) === selectedAgent.brokerage
      )
    : [];
  const firstReferral = agentReferrals[0];

  return (
    <>
      <div className="overflow-hidden rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)]">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 border-b border-[var(--yu3-line)] px-5 py-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <h3 className="font-heading text-base font-bold text-[var(--yu3-ink-strong)]">
              Referral Pipeline
            </h3>
            <span className="yu3-t-eyebrow text-[var(--yu3-ink-muted)]">
              {all.length} {all.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <AddRealtorButton />
            <AddReferralButton realtors={realtors} />
          </div>
        </div>

        {/* Filter bar */}
        <FilterBar
          filters={[
            { key: "status", label: "Status", value: statusFilter, options: STATUS_OPTIONS, onChange: setStatusFilter },
            { key: "agent",  label: "Agent",  value: agentFilter,  options: agentOptions,   onChange: setAgentFilter },
            { key: "tier",   label: "Tier",   value: tierFilter,   options: TIER_OPTIONS,   onChange: setTierFilter },
          ]}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[620px]">
            <thead>
              <tr className="bg-[var(--yu3-bg-canvas)]/60">
                <SortableHeader label="Agent"      sortKey="agent"      currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="pl-5 w-[200px]" />
                <SortableHeader label="Client"     sortKey="client"     currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Property"   sortKey="property"   currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Tier"       sortKey="tier"       currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Status"     sortKey="status"     currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
                <SortableHeader label="Commission" sortKey="commission" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} className="text-right pr-5" />
              </tr>
            </thead>
            <tbody>
              {all.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-16 text-center">
                    <p className="text-[12px] font-semibold text-[var(--yu3-ink-muted)]">
                      {hasActiveFilters ? "No referrals match the current filters." : "No referrals yet."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-[11px] font-semibold text-[var(--yu3-wine)] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {all.map((r) => {
                const tierKey = (r.tier || "").toLowerCase();
                const tierStyle = TIER_STYLES[tierKey] ?? "text-[var(--yu3-ink-muted)]";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedAgent({ name: r.agent_name || "", brokerage: r.brokerage || null })}
                    className="group cursor-pointer border-t border-[var(--yu3-line-subtle)] transition-colors hover:bg-[var(--yu3-bg-surface-sunken)]/80"
                  >
                    {/* Agent */}
                    <td className="pl-5 pr-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[var(--yu3-r-sm)] bg-[var(--yu3-wine-tint)] text-[9px] font-bold text-[var(--yu3-wine)] transition-colors group-hover:bg-[var(--yu3-wine-wash)]">
                          {initials(r.agent_name)}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold leading-tight text-[var(--yu3-ink-strong)]">
                            {r.agent_name || "-"}
                          </div>
                          {r.brokerage && (
                            <div className="mt-0.5 text-[9px] leading-tight text-[var(--yu3-ink-muted)]">
                              {r.brokerage}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] text-[var(--yu3-ink)]">{r.client_name || "-"}</span>
                    </td>

                    {/* Property */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] text-[var(--yu3-ink)]">{r.property || "-"}</span>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3.5">
                      {r.tier ? (
                        <span className={`dt-badge tracking-[0.04em] ${tierStyle}`}>
                          {r.tier}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--yu3-ink-muted)]">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                      <StatusSelect
                        referralId={r.id}
                        status={r.status}
                        updatingId={updatingId}
                        onUpdate={handleStatusUpdate}
                      />
                    </td>

                    {/* Commission */}
                    <td className="px-4 pl-4 pr-5 py-3.5 text-right">
                      {Number(r.commission) > 0 ? (
                        <span className="text-[12px] font-semibold text-[var(--yu3-wine)]">
                          {formatCurrency(r.commission)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--yu3-ink-muted)]">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer count */}
        {all.length > 0 && (
          <div className="flex items-center justify-between border-t border-[var(--yu3-line)] px-5 py-3">
            <span className="text-[10px] text-[var(--yu3-ink-muted)]">
              Showing {all.length} of {referrals.length} referral{referrals.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] font-semibold text-[var(--yu3-wine)]">
              {formatCurrency(all.reduce((s, r) => s + (Number(r.commission) || 0), 0))} total commission
            </span>
          </div>
        )}
      </div>

      <AgentDetailModal
        open={!!selectedAgent}
        onClose={() => setSelectedAgent(null)}
        agentName={selectedAgent?.name ?? ""}
        brokerage={selectedAgent?.brokerage ?? null}
        agentEmail={firstReferral?.agent_email ?? null}
        referrals={agentReferrals}
        clientNameToId={clientNameToId}
        clientNameToMoveId={clientNameToMoveId}
      />
    </>
  );
}

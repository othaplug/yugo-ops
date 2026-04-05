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
  new:       "text-[var(--tx3)]",
  lead:      "text-amber-700 dark:text-amber-300",
  quoted:    "text-[var(--org)]",
  booked:    "text-sky-600 dark:text-sky-400",
  scheduled: "text-sky-600 dark:text-sky-400",
  completed: "text-[var(--grn)]",
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
  essential:  "text-[var(--tx3)]",
  curated:    "text-[var(--tx3)]",
  essentials: "text-[var(--tx3)]",
  premier:    "text-amber-700 dark:text-amber-300",
  signature:  "text-sky-600 dark:text-sky-400",
  estate:     "text-[var(--org)]",
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
        className={`appearance-none pl-2.5 pr-6 py-1 rounded-md text-[10px] font-bold cursor-pointer outline-none transition-opacity border-0 disabled:opacity-40 dt-badge tracking-[0.04em] ${style}`}
        style={{ background: "inherit" }}
      >
        {[
          ...STATUS_STAGE_OPTIONS,
          ...(STATUS_STAGE_OPTIONS.some((o) => o.value === key)
            ? []
            : [{ value: key, label: key.replace(/\b\w/g, (c) => c.toUpperCase()) }]),
        ].map((o) => (
          <option key={o.value} value={o.value} className="bg-[#1a1916] text-[var(--tx)]">
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-[var(--brd)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="font-heading text-[var(--text-base)] font-bold text-[var(--tx)]">Referral Pipeline</h3>
            <span className="dt-badge tracking-[0.04em] text-[var(--tx3)]">
              {all.length} {all.length === 1 ? "entry" : "entries"}
            </span>
          </div>
          <div className="flex items-center gap-2">
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
              <tr className="bg-[var(--bg)]/40">
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
                    <p className="text-[12px] font-semibold text-[var(--tx3)]">
                      {hasActiveFilters ? "No referrals match the current filters." : "No referrals yet."}
                    </p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        onClick={clearFilters}
                        className="mt-2 text-[11px] text-[var(--gold)] hover:underline"
                      >
                        Clear filters
                      </button>
                    )}
                  </td>
                </tr>
              )}
              {all.map((r) => {
                const tierKey = (r.tier || "").toLowerCase();
                const tierStyle = TIER_STYLES[tierKey] ?? "text-[var(--tx3)]";
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedAgent({ name: r.agent_name || "", brokerage: r.brokerage || null })}
                    className="hover:bg-[var(--gdim)]/50 transition-colors cursor-pointer group border-t border-[var(--brd)]/60"
                  >
                    {/* Agent */}
                    <td className="pl-5 pr-4 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-md bg-[var(--brd)] flex items-center justify-center text-[9px] font-bold text-[var(--tx3)] shrink-0 group-hover:bg-[var(--gdim)] transition-colors">
                          {initials(r.agent_name)}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--tx)] leading-tight">{r.agent_name || "-"}</div>
                          {r.brokerage && (
                            <div className="text-[9px] text-[var(--tx3)] mt-0.5 leading-tight">{r.brokerage}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] text-[var(--tx2)]">{r.client_name || "-"}</span>
                    </td>

                    {/* Property */}
                    <td className="px-4 py-3.5">
                      <span className="text-[11px] text-[var(--tx2)]">{r.property || "-"}</span>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3.5">
                      {r.tier ? (
                        <span className={`dt-badge tracking-[0.04em] ${tierStyle}`}>
                          {r.tier}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--tx3)]">-</span>
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
                        <span className="text-[12px] font-semibold text-[var(--gold)]">
                          {formatCurrency(r.commission)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-[var(--tx3)]">-</span>
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
          <div className="px-5 py-3 border-t border-[var(--brd)] flex items-center justify-between">
            <span className="text-[10px] text-[var(--tx3)]">
              Showing {all.length} of {referrals.length} referral{referrals.length !== 1 ? "s" : ""}
            </span>
            <span className="text-[10px] font-semibold text-[var(--gold)]">
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

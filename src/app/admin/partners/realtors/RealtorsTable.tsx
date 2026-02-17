"use client";

import { useState, useMemo } from "react";
import Badge from "../../components/Badge";
import FilterBar, { SortableHeader } from "../../components/FilterBar";
import { AddReferralButton } from "./RealtorsClient";
import AgentDetailModal from "./AgentDetailModal";
import { formatCurrency } from "@/lib/format-currency";

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
  { value: "lead", label: "Lead" },
  { value: "quoted", label: "Quoted" },
  { value: "booked", label: "Booked" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
];

const TIER_OPTIONS = [
  { value: "", label: "All tiers" },
  { value: "Essentials", label: "Essentials" },
  { value: "Premier", label: "Premier" },
  { value: "Estate", label: "Estate" },
];

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
  const [selectedAgent, setSelectedAgent] = useState<{ name: string; brokerage: string | null } | null>(null);
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
        if (sortKey === "agent") {
          va = (a.agent_name || "").toLowerCase();
          vb = (b.agent_name || "").toLowerCase();
        } else if (sortKey === "client") {
          va = (a.client_name || "").toLowerCase();
          vb = (b.client_name || "").toLowerCase();
        } else if (sortKey === "property") {
          va = (a.property || "").toLowerCase();
          vb = (b.property || "").toLowerCase();
        } else if (sortKey === "tier") {
          va = (a.tier || "").toLowerCase();
          vb = (b.tier || "").toLowerCase();
        } else if (sortKey === "status") {
          va = (a.status || "").toLowerCase();
          vb = (b.status || "").toLowerCase();
        } else if (sortKey === "commission") {
          va = Number(a.commission) || 0;
          vb = Number(b.commission) || 0;
        } else if (sortKey === "created_at") {
          va = new Date(a.created_at || 0).getTime();
          vb = new Date(b.created_at || 0).getTime();
        }
        const cmp = va < vb ? -1 : va > vb ? 1 : 0;
        return sortDir === "asc" ? cmp : -cmp;
      });
    }
    return list;
  }, [referrals, statusFilter, agentFilter, tierFilter, sortKey, sortDir]);

  const handleSort = (key: string) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const hasActiveFilters = !!(statusFilter || agentFilter || tierFilter);
  const clearFilters = () => {
    setStatusFilter("");
    setAgentFilter("");
    setTierFilter("");
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
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden overflow-x-auto">
        <div className="px-4 py-3 border-b border-[var(--brd)] flex items-center justify-between">
          <h3 className="font-heading text-[13px] font-bold text-[var(--tx)]">Referral Pipeline</h3>
          <AddReferralButton realtors={realtors} />
        </div>
        <FilterBar
          filters={[
            { key: "status", label: "Status", value: statusFilter, options: STATUS_OPTIONS, onChange: setStatusFilter },
            { key: "agent", label: "Agent", value: agentFilter, options: agentOptions, onChange: setAgentFilter },
            { key: "tier", label: "Tier", value: tierFilter, options: TIER_OPTIONS, onChange: setTierFilter },
          ]}
          hasActiveFilters={hasActiveFilters}
          onClear={clearFilters}
        />
        <table className="w-full border-collapse min-w-[500px]">
          <thead>
            <tr>
              <SortableHeader label="Agent" sortKey="agent" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Client" sortKey="client" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Property" sortKey="property" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Tier" sortKey="tier" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Status" sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
              <SortableHeader label="Comm." sortKey="commission" currentSort={sortKey} currentDir={sortDir} onSort={handleSort} />
            </tr>
          </thead>
          <tbody>
            {all.map((r) => (
              <tr
                key={r.id}
                onClick={() => setSelectedAgent({ name: r.agent_name || "", brokerage: r.brokerage || null })}
                className="hover:bg-[var(--gdim)] transition-colors cursor-pointer"
              >
                <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                  <div className="text-[10px] font-semibold text-[var(--tx)]">{r.agent_name}</div>
                  <div className="text-[9px] text-[var(--tx3)]">{r.brokerage}</div>
                </td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.client_name}</td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.property}</td>
                <td className="px-4 py-2.5 text-[10px] border-b border-[var(--brd)]">{r.tier}</td>
                <td className="px-4 py-2.5 border-b border-[var(--brd)]">
                  <Badge status={r.status} />
                </td>
                <td className="px-4 py-2.5 text-[10px] font-semibold border-b border-[var(--brd)]">
                  {Number(r.commission) > 0 ? formatCurrency(r.commission) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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

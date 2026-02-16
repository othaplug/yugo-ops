"use client";

import { useState } from "react";
import Badge from "../../components/Badge";
import { AddReferralButton } from "./RealtorsClient";
import AgentDetailModal from "./AgentDetailModal";

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

  const all = referrals || [];
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
        <table className="w-full border-collapse min-w-[500px]">
          <thead>
            <tr>
              {["Agent", "Client", "Property", "Tier", "Status", "Comm."].map((h) => (
                <th
                  key={h}
                  className="text-left text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] px-4 py-2.5 border-b border-[var(--brd)]"
                >
                  {h}
                </th>
              ))}
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
                  {Number(r.commission) > 0 ? `$${Number(r.commission).toLocaleString()}` : "—"}
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

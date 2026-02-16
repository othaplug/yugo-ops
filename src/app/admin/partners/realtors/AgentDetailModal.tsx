"use client";

import { useState } from "react";
import Link from "next/link";
import Badge from "../../components/Badge";

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

interface AgentDetailModalProps {
  open: boolean;
  onClose: () => void;
  agentName: string;
  brokerage: string | null;
  agentEmail: string | null;
  referrals: Referral[];
  clientNameToId?: Record<string, string>;
  clientNameToMoveId?: Record<string, string>;
}

export default function AgentDetailModal({
  open,
  onClose,
  agentName,
  brokerage,
  agentEmail,
  referrals,
  clientNameToId = {},
  clientNameToMoveId = {},
}: AgentDetailModalProps) {
  const [clientsExpanded, setClientsExpanded] = useState(true);
  const [clientDetailId, setClientDetailId] = useState<string | null>(null);

  const totalCommission = referrals.reduce((s, r) => s + Number(r.commission || 0), 0);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" aria-modal="true">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-[var(--card)] border border-[var(--brd)] rounded-xl w-full max-w-xl md:max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 pb-4 shrink-0 border-b border-[var(--brd)]">
          <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">Agent details</div>
          <h2 className="font-heading text-[22px] font-bold text-[var(--tx)] leading-tight">{agentName}</h2>
          {(brokerage || agentEmail) && (
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-[var(--tx3)]">
              {brokerage && <span>{brokerage}</span>}
              {agentEmail && <a href={`mailto:${agentEmail}`} className="text-[var(--gold)] hover:underline">{agentEmail}</a>}
            </div>
          )}
        </div>

        <div className="p-4 space-y-4 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Total commission</span>
            <span className="text-[16px] font-bold text-[var(--gold)]">${totalCommission.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-wider uppercase text-[var(--tx3)]">Referrals brought in</span>
            <span className="text-[13px] font-semibold text-[var(--tx)]">{referrals.length}</span>
          </div>

          {/* Clients referred - collapsible */}
          <div className="border border-[var(--brd)] rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setClientsExpanded((e) => !e)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[var(--bg)]/50 text-left hover:bg-[var(--gdim)] transition-colors"
            >
              <span className="text-[11px] font-bold text-[var(--tx)]">Clients referred</span>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className={`shrink-0 transition-transform ${clientsExpanded ? "rotate-180" : ""}`}
              >
                <path d="M6 9l6 6 6-6" />
              </svg>
            </button>
            {clientsExpanded && (
              <div className="divide-y divide-[var(--brd)]">
                {referrals.map((r) => (
                  <div key={r.id} className="px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setClientDetailId(clientDetailId === r.id ? null : r.id)}
                      className="w-full text-left group"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-semibold text-[var(--tx)] group-hover:text-[var(--gold)] transition-colors">
                          {r.client_name || "—"}
                        </span>
                        <span className="text-[10px] font-semibold text-[var(--gold)]">
                          {r.commission ? `$${Number(r.commission).toLocaleString()}` : "—"}
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                        {r.property && <span>{r.property}</span>}
                      </div>
                    </button>
                    {clientDetailId === r.id && (
                      <div className="mt-2 pt-2 border-t border-[var(--brd)] text-[11px] text-[var(--tx2)] space-y-1">
                        <div><span className="text-[var(--tx3)]">Address:</span> {r.property || "—"}</div>
                        <div className="flex items-center gap-2">
                          <Badge status={r.status} />
                        </div>
                        {(r.move_id || clientNameToMoveId[r.client_name || ""]) ? (
                          <Link
                            href={`/admin/moves/${r.move_id || clientNameToMoveId[r.client_name || ""]}`}
                            className="inline-block mt-2 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                          >
                            View move →
                          </Link>
                        ) : (
                          <span className="inline-block mt-2 text-[10px] text-[var(--tx3)]">No move linked</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[var(--brd)] shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 rounded-lg text-[11px] font-semibold bg-[var(--bg)] text-[var(--tx)] border border-[var(--brd)] hover:border-[var(--gold)] transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

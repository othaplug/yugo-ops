"use client";

import { formatCurrency } from "@/lib/format-currency";

interface Referral {
  id: string;
  agent_name: string;
  client_name: string | null;
  client_email: string | null;
  property: string | null;
  tier: string | null;
  status: string;
  commission: number;
  move_type: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  new: "bg-blue-50 text-blue-600",
  contacted: "bg-amber-50 text-amber-600",
  booked: "bg-green-50 text-green-700",
  completed: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

const TIER_LABEL: Record<string, string> = {
  standard: "Essentials",
  premium: "Premier",
  luxury: "Estate",
};

export default function PartnerRealtorTab({
  referrals,
  mode,
  orgId,
  onRefresh,
}: {
  referrals: Referral[];
  mode: "active" | "completed";
  orgId: string;
  onRefresh: () => void;
}) {
  if (referrals.length === 0) {
    return (
      <div className="bg-white border border-[#E8E4DF] rounded-xl p-8 text-center">
        <p className="text-[14px] text-[#888]">
          {mode === "active" ? "No active referrals." : "No completed referrals yet."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {referrals.map((r) => {
        const badgeClass = STATUS_BADGE[(r.status || "").toLowerCase()] || "bg-gray-50 text-gray-600";
        const statusLabel = (r.status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
        const tierLabel = TIER_LABEL[r.tier || "standard"] || r.tier || "Standard";

        return (
          <div key={r.id} className="bg-white border border-[#E8E4DF] rounded-xl p-5 hover:border-[#C9A962]/40 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-bold text-[#1A1A1A]">{r.client_name || "Unnamed Client"}</h3>
                <p className="text-[12px] text-[#888] mt-0.5">
                  {r.property || "Property TBD"} — {tierLabel}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold ${badgeClass}`}>
                  {statusLabel}
                </span>
                {r.commission > 0 && (
                  <span className="text-[16px] font-bold text-[#2D9F5A] font-serif">{formatCurrency(r.commission)}</span>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-4 text-[12px]">
              <div>
                <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Move Date</div>
                <div className="text-[#1A1A1A] font-medium mt-0.5">
                  {r.created_at
                    ? new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                    : "TBD"}
                </div>
              </div>
              {mode === "completed" && (
                <div>
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Total Value</div>
                  <div className="text-[#1A1A1A] font-medium mt-0.5">{formatCurrency(r.commission * 10)}</div>
                </div>
              )}
              {mode === "active" && r.client_email && (
                <div>
                  <div className="text-[10px] font-semibold tracking-wider uppercase text-[#888]">Est. Value</div>
                  <div className="text-[#1A1A1A] font-medium mt-0.5">
                    {r.tier === "luxury" ? "$30,000+" : r.tier === "premium" ? "$12,000+" : "$5,000+"}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

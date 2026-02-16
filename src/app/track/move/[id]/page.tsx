import { notFound } from "next/navigation";
import Link from "next/link";
import { getMoveCode } from "@/lib/move-code";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTrackToken } from "@/lib/track-token";

export default async function TrackMovePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ token?: string }>;
}) {
  const { id } = await params;
  const { token } = await searchParams;

  if (!verifyTrackToken("move", id, token || "")) notFound();

  const supabase = createAdminClient();
  const { data: move, error } = await supabase
    .from("moves")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !move) notFound();

  const estimate = Number(move.estimate || 0);
  const depositPaid = Math.round(estimate * 0.25);
  const balanceDue = estimate - depositPaid;
  const typeLabel = move.move_type === "office" ? "Office / Commercial" : "Residential";
  const statusColors: Record<string, string> = {
    pending: "bg-amber-500/20 text-amber-400",
    confirmed: "bg-emerald-500/20 text-emerald-400",
    scheduled: "bg-blue-500/20 text-blue-400",
    "in-transit": "bg-amber-400/20 text-amber-300",
    delivered: "bg-emerald-500/20 text-emerald-400",
    cancelled: "bg-red-500/20 text-red-400",
  };
  const statusClass = statusColors[move.status] || "bg-amber-400/20 text-amber-300";

  return (
    <div className="min-h-screen bg-[#0F0F0F] text-[#E8E5E0] font-sans">
      <div className="max-w-[560px] mx-auto px-5 py-8 md:py-12">
        <div className="text-center mb-8">
          <span className="inline-flex items-center justify-center px-4 py-2 rounded-full bg-[rgba(201,169,98,0.08)] border border-[rgba(201,169,98,0.35)] text-[#C9A962] font-semibold tracking-widest text-sm">
            OPS+
          </span>
        </div>
        <div className="text-[9px] font-bold tracking-widest uppercase text-[#C9A962] mb-2">Move Tracking</div>
        <h1 className="text-xl md:text-2xl font-bold mb-6">
          {getMoveCode(move)} — {move.client_name}
        </h1>

        <div className="bg-[#1E1E1E] border border-[#2A2A2A] rounded-xl p-5 md:p-6 space-y-5">
          <div>
            <div className="text-[9px] font-bold uppercase text-[#666] mb-2">Status</div>
            <span className={`inline-block px-3 py-1.5 rounded-lg text-sm font-semibold capitalize ${statusClass}`}>
              {move.status?.replace("-", " ")}
            </span>
          </div>
          {move.stage && (
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Stage</div>
              <div className="text-sm font-semibold">{(move.stage || "").replace(/_/g, " ")}</div>
            </div>
          )}
          {move.next_action && (
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Next action</div>
              <div className="text-sm font-semibold text-[#C9A962]">{move.next_action}</div>
            </div>
          )}
          <div className="grid grid-cols-1 gap-4 pt-4 border-t border-[#2A2A2A]">
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">From</div>
              <div className="text-sm">{move.from_address || "—"}</div>
            </div>
            <div>
              <div className="text-[9px] font-bold uppercase text-[#666] mb-1">To</div>
              <div className="text-sm">{move.to_address || move.delivery_address || "—"}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Move date</div>
                <div className="text-sm font-semibold">{move.scheduled_date || "—"}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Type</div>
                <div className="text-sm font-semibold">{typeLabel}</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[#2A2A2A]">
              <div>
                <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Estimate</div>
                <div className="text-sm font-bold text-[#C9A962]">${estimate.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Deposit</div>
                <div className="text-sm font-bold text-emerald-400">${depositPaid.toLocaleString()}</div>
              </div>
              <div>
                <div className="text-[9px] font-bold uppercase text-[#666] mb-1">Balance</div>
                <div className="text-sm font-bold">${balanceDue.toLocaleString()}</div>
              </div>
            </div>
          </div>
          {move.updated_at && (
            <div className="text-[10px] text-[#666] pt-2">
              Last updated: {new Date(move.updated_at).toLocaleString()}
            </div>
          )}
        </div>

        <p className="text-center text-[11px] text-[#666] mt-8">
          <Link href="/" className="text-[#C9A962] hover:underline">OPS+</Link> · Powered by OPS+
        </p>
      </div>
    </div>
  );
}

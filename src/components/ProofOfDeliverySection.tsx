"use client";

import { useState, useEffect } from "react";
import { FileText, Download, Star, MapPin, CheckCircle as CheckCircle2, Warning as AlertTriangle } from "@phosphor-icons/react";

interface ItemCondition {
  item_name: string;
  condition: string;
  notes?: string;
}

interface PoDData {
  id: string;
  signer_name: string | null;
  signed_at: string | null;
  satisfaction_rating: number | null;
  satisfaction_comment: string | null;
  item_conditions: ItemCondition[];
  crew_members: string[] | null;
  gps_lat: number | null;
  gps_lng: number | null;
  completed_at: string | null;
  signature_data: string | null;
  pdf_url: string | null;
  photos_delivery: { url: string; caption?: string }[];
}

const CONDITION_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pristine: { bg: "bg-emerald-500/10", text: "text-emerald-600", label: "Pristine" },
  minor_scuff: { bg: "bg-amber-500/10", text: "text-amber-600", label: "Minor Scuff" },
  pre_existing_damage: { bg: "bg-[var(--tx3)]/10", text: "text-[var(--tx3)]", label: "Pre-existing" },
  new_damage: { bg: "bg-red-500/10", text: "text-red-600", label: "New Damage" },
};

export default function ProofOfDeliverySection({
  jobId,
  jobType,
}: {
  jobId: string;
  jobType: "move" | "delivery";
}) {
  const [pod, setPod] = useState<PoDData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/pod/by-job?jobId=${jobId}&jobType=${jobType}`);
        if (res.ok) {
          const data = await res.json();
          setPod(data);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [jobId, jobType]);

  if (loading) {
    return (
      <div className="py-8 text-center">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--gold)]/30 border-t-[var(--gold)] animate-spin mx-auto" />
      </div>
    );
  }

  if (!pod) {
    return (
      <div className="py-8 text-center">
        <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-[var(--bg)] flex items-center justify-center">
          <FileText className="w-5 h-5 text-[var(--tx3)]" />
        </div>
        <p className="text-[13px] text-[var(--tx3)]">No Proof of Delivery recorded yet.</p>
        <p className="text-[11px] text-[var(--tx3)]/60 mt-0.5">PoD is captured when the crew completes the delivery.</p>
      </div>
    );
  }

  const itemConditions: ItemCondition[] = Array.isArray(pod.item_conditions) ? pod.item_conditions : [];
  const hasNewDamage = itemConditions.some((ic) => ic.condition === "new_damage");

  return (
    <div className="space-y-5">
      {/* Completion summary */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[13px] font-semibold text-[var(--tx)]">
            Proof of Delivery Captured
          </div>
          <div className="text-[11px] text-[var(--tx3)]">
            {pod.completed_at
              ? new Date(pod.completed_at).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
                })
              : "—"}
          </div>
        </div>
        <a
          href={`/api/pod/${pod.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)]/10 text-[var(--gold)] hover:bg-[var(--gold)]/20 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Download PDF
        </a>
      </div>

      {/* New damage alert */}
      {hasNewDamage && (
        <div className="flex items-start gap-2.5 p-3 rounded-xl bg-red-500/5 border border-red-500/20">
          <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-[12px] font-semibold text-red-600">New Damage Reported</div>
            <div className="text-[11px] text-red-500/80 mt-0.5">
              {itemConditions.filter((ic) => ic.condition === "new_damage").length} item(s) flagged with new damage during delivery.
            </div>
          </div>
        </div>
      )}

      {/* Item conditions */}
      {itemConditions.length > 0 && (
        <div>
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Item Conditions</div>
          <div className="space-y-1.5">
            {itemConditions.map((ic, i) => {
              const c = CONDITION_COLORS[ic.condition] || CONDITION_COLORS.pristine;
              return (
                <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-lg bg-[var(--bg)]/60">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] font-medium text-[var(--tx)] truncate">{ic.item_name}</div>
                    {ic.notes && <div className="text-[10px] text-[var(--tx3)] mt-0.5 truncate">{ic.notes}</div>}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${c.bg} ${c.text}`}>
                    {c.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Signature */}
      <div className="border-t border-[var(--brd)]/30 pt-4">
        <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Customer Signature</div>
        {pod.signature_data && (
          <div className="w-[180px] h-[60px] rounded-lg overflow-hidden border border-[var(--brd)]/30 bg-white mb-2">
            <img src={pod.signature_data} alt="Signature" className="w-full h-full object-contain" />
          </div>
        )}
        <div className="text-[12px] font-medium text-[var(--tx)]">{pod.signer_name || "—"}</div>
        <div className="text-[10px] text-[var(--tx3)]">
          {pod.signed_at
            ? new Date(pod.signed_at).toLocaleDateString("en-US", {
                month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
              })
            : "—"}
        </div>
      </div>

      {/* Satisfaction */}
      {pod.satisfaction_rating != null && (
        <div className="border-t border-[var(--brd)]/30 pt-4">
          <div className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Customer Satisfaction</div>
          <div className="flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <Star
                key={n}
                className={`w-5 h-5 ${n <= pod.satisfaction_rating! ? "text-[var(--gold)] fill-[var(--gold)]" : "text-[var(--brd)]"}`}
              />
            ))}
            <span className="text-[12px] font-semibold text-[var(--tx)] ml-1.5">{pod.satisfaction_rating}/5</span>
          </div>
          {pod.satisfaction_comment && (
            <p className="text-[12px] text-[var(--tx3)] mt-1.5 italic">&ldquo;{pod.satisfaction_comment}&rdquo;</p>
          )}
        </div>
      )}

      {/* GPS + Crew */}
      <div className="border-t border-[var(--brd)]/30 pt-4 flex flex-wrap gap-4">
        {pod.gps_lat != null && pod.gps_lng != null && (
          <div className="flex items-center gap-1.5 text-[11px] text-[var(--tx3)]">
            <MapPin className="w-3.5 h-3.5" />
            {Number(pod.gps_lat).toFixed(4)}, {Number(pod.gps_lng).toFixed(4)}
          </div>
        )}
        {pod.crew_members && pod.crew_members.length > 0 && (
          <div className="text-[11px] text-[var(--tx3)]">
            Crew: {pod.crew_members.join(", ")}
          </div>
        )}
      </div>
    </div>
  );
}

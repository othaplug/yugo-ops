"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPlatformDisplay } from "@/lib/date-format";
import { formatCurrency } from "@/lib/format-currency";
import { ArrowLeft } from "@phosphor-icons/react";

interface ClaimItem {
  name: string;
  description: string;
  damage_description: string;
  declared_value: number;
  weight_lbs: number;
  photo_urls: string[];
}

interface ClaimPhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  uploaded_by: string;
  caption: string | null;
  created_at: string;
}

interface TimelineEvent {
  id: string;
  event_type: string;
  event_description: string;
  user_id: string | null;
  created_at: string;
}

interface Claim {
  id: string;
  claim_number: string;
  client_name: string;
  client_email: string;
  client_phone: string | null;
  move_id: string | null;
  delivery_id: string | null;
  valuation_tier: string;
  was_upgraded: boolean;
  status: string;
  items: ClaimItem[];
  total_claimed_value: number;
  approved_amount: number | null;
  resolution_type: string | null;
  resolution_notes: string | null;
  payout_method: string | null;
  assessment_notes: string | null;
  crew_team: string | null;
  crew_members: string[];
  submitted_at: string;
  resolved_at: string | null;
}

const VALUATION_RATES: Record<string, number> = {
  released: 0.6,
  enhanced: 5.0,
  full_replacement: 0,
};

const VALUATION_LABELS: Record<string, string> = {
  released: "Released Value Protection",
  enhanced: "Enhanced Value Protection",
  full_replacement: "Full Replacement Value",
};

const RESOLUTION_OPTIONS = [
  { value: "repair", label: "Repair" },
  { value: "replacement", label: "Replacement" },
  { value: "cash_settlement", label: "Cash Settlement" },
  { value: "partial", label: "Partial" },
];

const PAYOUT_OPTIONS = [
  { value: "e_transfer", label: "e-Transfer" },
  { value: "credit_card_refund", label: "Credit Card Refund" },
  { value: "cheque", label: "Cheque" },
];

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusBadge(status: string): string {
  switch (status) {
    case "submitted": return "text-[var(--tx3)]";
    case "under_review": return "text-[var(--blue)]";
    case "approved": case "settled": return "text-[var(--grn)]";
    case "partially_approved": return "text-[var(--org)]";
    case "denied": return "text-[var(--red)]";
    case "closed": return "text-[var(--tx3)]";
    default: return "text-[var(--tx3)]";
  }
}

function coverageCalc(tier: string, weightLbs: number, declaredValue: number): { max: number; formula: string } {
  if (tier === "full_replacement") return { max: declaredValue, formula: "Full replacement value" };
  const rate = VALUATION_RATES[tier] || 0.6;
  const max = weightLbs * rate;
  return { max, formula: `${weightLbs}lb × $${rate.toFixed(2)} = $${max.toFixed(0)} max` };
}

export default function ClaimDetailClient({
  claim,
  photos,
  timeline,
  moveCode,
  moveTier,
  crewName,
  crewMembers,
}: {
  claim: Claim;
  photos: ClaimPhoto[];
  timeline: TimelineEvent[];
  moveCode: string | null;
  moveTier: string | null;
  crewName: string | null;
  crewMembers: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [assessmentNotes, setAssessmentNotes] = useState(claim.assessment_notes || "");
  const [resolutionType, setResolutionType] = useState(claim.resolution_type || "cash_settlement");
  const [resolutionNotes, setResolutionNotes] = useState(claim.resolution_notes || "");
  const [payoutMethod, setPayoutMethod] = useState(claim.payout_method || "e_transfer");
  const [itemAmounts, setItemAmounts] = useState<Record<number, number>>(() => {
    const map: Record<number, number> = {};
    claim.items.forEach((item, idx) => {
      const { max } = coverageCalc(claim.valuation_tier, item.weight_lbs, item.declared_value);
      map[idx] = Math.min(max, item.declared_value);
    });
    return map;
  });
  const [itemResolutions, setItemResolutions] = useState<Record<number, string>>(() => {
    const map: Record<number, string> = {};
    claim.items.forEach((_, idx) => { map[idx] = "cash_settlement"; });
    return map;
  });

  const totalApproved = Object.values(itemAmounts).reduce((s, v) => s + v, 0);
  const isResolved = ["approved", "partially_approved", "denied", "settled", "closed"].includes(claim.status);

  const handleStatusChange = useCallback(async (newStatus: string) => {
    setSaving(true);
    try {
      await fetch(`/api/admin/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [claim.id, router]);

  const handleApprove = useCallback(async () => {
    setSaving(true);
    try {
      await fetch(`/api/admin/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "approve",
          approved_amount: totalApproved,
          resolution_type: resolutionType,
          resolution_notes: resolutionNotes,
          assessment_notes: assessmentNotes,
          payout_method: payoutMethod,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [claim.id, totalApproved, resolutionType, resolutionNotes, assessmentNotes, payoutMethod, router]);

  const handleDeny = useCallback(async () => {
    if (!resolutionNotes.trim()) return;
    setSaving(true);
    try {
      await fetch(`/api/admin/claims/${claim.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "deny",
          resolution_notes: resolutionNotes,
          assessment_notes: assessmentNotes,
        }),
      });
      router.refresh();
    } finally {
      setSaving(false);
    }
  }, [claim.id, resolutionNotes, assessmentNotes, router]);

  return (
    <div className="w-full min-w-0 p-4 sm:p-6">
      {/* Back + eyebrow */}
      <div className="flex items-center gap-2 mb-3">
        <button type="button" onClick={() => router.back()} className="p-1 rounded-md hover:bg-[var(--gdim)] text-[var(--tx3)] shrink-0 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82">Operations · Claim</p>
      </div>

      {/* Title + status */}
      <div className="flex items-center gap-3 flex-wrap mb-1">
        <h1 className="admin-page-hero text-[var(--tx)]">{claim.claim_number}</h1>
        <span className={`dt-badge tracking-[0.04em] shrink-0 ${statusBadge(claim.status)}`}>
          {statusLabel(claim.status)}
        </span>
      </div>
      <p className="text-[12px] text-[var(--tx3)] mb-4">
        {claim.client_name} · {moveCode || "-"} · {VALUATION_LABELS[claim.valuation_tier] || claim.valuation_tier}
      </p>

      {/* Actions */}
      {claim.status === "submitted" && (
        <div className="mb-6">
          <button
            onClick={() => handleStatusChange("under_review")}
            disabled={saving}
            className="px-4 py-2 rounded-lg text-[13px] font-semibold bg-[#3B82F6] text-white hover:bg-[#2563EB] transition-colors disabled:opacity-50"
          >
            Start Review
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Claim Info */}
          <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
            <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-3">Claim Details</h3>
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              <div>
                <p className="text-[var(--tx3)] mb-0.5">Client</p>
                <p className="text-[var(--tx)] font-medium">{claim.client_name}</p>
                <p className="text-[11px] text-[var(--tx3)]">{claim.client_email}</p>
              </div>
              <div>
                <p className="text-[var(--tx3)] mb-0.5">Move</p>
                <p className="text-[var(--tx)] font-medium">{moveCode || "-"}</p>
                {moveTier && <p className="text-[11px] text-[var(--tx3)] uppercase">{moveTier}</p>}
              </div>
              <div>
                <p className="text-[var(--tx3)] mb-0.5">Valuation</p>
                <p className="text-[var(--tx)] font-medium">{VALUATION_LABELS[claim.valuation_tier] || claim.valuation_tier}</p>
              </div>
              <div>
                <p className="text-[var(--tx3)] mb-0.5">Submitted</p>
                <p className="text-[var(--tx)] font-medium">
                  {formatPlatformDisplay(claim.submitted_at, { month: "short", day: "numeric" })}
                </p>
              </div>
            </div>
          </div>

          {/* Crew */}
          {(crewName || claim.crew_team) && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
              <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-2">Crew</h3>
              <p className="text-[13px] text-[var(--tx)]">{crewName || claim.crew_team}</p>
              {(crewMembers.length > 0 || claim.crew_members?.length > 0) && (
                <p className="text-[12px] text-[var(--tx3)] mt-1">
                  {(crewMembers.length > 0 ? crewMembers : claim.crew_members).join(", ")}
                </p>
              )}
            </div>
          )}

          {/* Items */}
          <div className="space-y-4">
            <h3 className="text-[16px] font-bold text-[var(--tx)]">Items Claimed</h3>
            {claim.items.map((item, idx) => {
              const { max, formula } = coverageCalc(claim.valuation_tier, item.weight_lbs, item.declared_value);
              const itemPhotos = photos.filter((p) => {
                if (item.photo_urls?.includes(p.photo_url)) return true;
                return false;
              });
              return (
                <div key={idx} className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-[var(--text-base)] font-bold text-[var(--tx)]">{idx + 1}. {item.name}</h4>
                      {item.description && <p className="text-[13px] text-[var(--tx3)]">{item.description}</p>}
                    </div>
                    <span className="text-[13px] text-[var(--tx2)] font-medium">Est: {formatCurrency(item.declared_value)}</span>
                  </div>
                  <p className="text-[13px] text-[var(--tx2)] mb-3">{item.damage_description}</p>
                  {item.weight_lbs > 0 && (
                    <p className="text-[12px] text-[var(--tx3)] mb-3">Weight: {item.weight_lbs} lbs</p>
                  )}

                  {/* Photos */}
                  {(item.photo_urls?.length > 0 || itemPhotos.length > 0) && (
                    <div className="flex gap-2 mb-3 flex-wrap">
                      {(item.photo_urls || []).map((url, pi) => (
                        <a key={pi} href={url} target="_blank" rel="noopener noreferrer" className="block w-20 h-20 rounded-lg overflow-hidden bg-[var(--bg)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={url} alt={`Photo ${pi + 1}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Assessment */}
                  <div className="rounded-lg p-3 bg-[var(--bg)] border border-[var(--brd)] mt-3">
                    <p className="text-[12px] font-semibold text-[var(--tx3)] uppercase tracking-wide mb-2">Assessment</p>
                    <p className="text-[12px] text-[var(--tx2)] mb-2">Coverage: {formula} (max {formatCurrency(max)})</p>
                    {!isResolved && (
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Resolution</label>
                          <select
                            value={itemResolutions[idx] || "cash_settlement"}
                            onChange={(e) => setItemResolutions((prev) => ({ ...prev, [idx]: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] outline-none"
                          >
                            {RESOLUTION_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="w-32">
                          <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1">Approved $</label>
                          <input
                            type="number"
                            value={itemAmounts[idx] || 0}
                            onChange={(e) => setItemAmounts((prev) => ({ ...prev, [idx]: parseFloat(e.target.value) || 0 }))}
                            className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[12px] outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Totals + Actions */}
          {!isResolved && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-[12px] text-[var(--tx3)]">Total Claimed</p>
                  <p className="text-[18px] font-bold text-[var(--tx)]">{formatCurrency(claim.total_claimed_value)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[12px] text-[var(--tx3)]">Total Approved</p>
                  <p className="text-[18px] font-bold text-[var(--grn)]">{formatCurrency(totalApproved)}</p>
                </div>
              </div>

              <div className="space-y-3 mb-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Assessment Notes</label>
                  <textarea
                    value={assessmentNotes}
                    onChange={(e) => setAssessmentNotes(e.target.value)}
                    placeholder="Internal notes on this assessment..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none resize-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Resolution Type</label>
                    <select
                      value={resolutionType}
                      onChange={(e) => setResolutionType(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] outline-none"
                    >
                      {RESOLUTION_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Payout Method</label>
                    <select
                      value={payoutMethod}
                      onChange={(e) => setPayoutMethod(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] outline-none"
                    >
                      {PAYOUT_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--tx3)] mb-1 uppercase">Resolution Notes (visible to client)</label>
                  <textarea
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Describe the resolution..."
                    rows={2}
                    className="w-full px-3.5 py-2.5 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[13px] text-[var(--tx)] outline-none resize-none"
                  />
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleApprove}
                  disabled={saving || totalApproved <= 0}
                  className="flex-1 py-2.5 rounded-lg text-[13px] font-bold bg-[var(--grn)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {saving ? "Saving..." : `Approve & Notify (${formatCurrency(totalApproved)})`}
                </button>
                <button
                  onClick={handleDeny}
                  disabled={saving || !resolutionNotes.trim()}
                  className="px-5 py-2.5 rounded-lg text-[13px] font-bold bg-[var(--red)] text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  Deny
                </button>
              </div>
            </div>
          )}

          {/* Resolved summary */}
          {isResolved && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
              <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-3">Resolution</h3>
              <div className="grid grid-cols-2 gap-4 text-[13px]">
                <div>
                  <p className="text-[var(--tx3)]">Status</p>
                  <p className="font-medium uppercase">{statusLabel(claim.status)}</p>
                </div>
                <div>
                  <p className="text-[var(--tx3)]">Approved Amount</p>
                  <p className="font-bold text-[var(--grn)]">{claim.approved_amount != null ? formatCurrency(claim.approved_amount) : "-"}</p>
                </div>
                {claim.resolution_type && (
                  <div>
                    <p className="text-[var(--tx3)]">Resolution Type</p>
                    <p className="font-medium uppercase">{claim.resolution_type.replace(/_/g, " ")}</p>
                  </div>
                )}
                {claim.payout_method && (
                  <div>
                    <p className="text-[var(--tx3)]">Payout Method</p>
                    <p className="font-medium uppercase">{claim.payout_method.replace(/_/g, " ")}</p>
                  </div>
                )}
              </div>
              {claim.resolution_notes && (
                <div className="mt-3 pt-3 border-t border-[var(--brd)]">
                  <p className="text-[var(--tx3)] text-[12px] mb-1">Resolution Notes</p>
                  <p className="text-[13px] text-[var(--tx)]">{claim.resolution_notes}</p>
                </div>
              )}
              {claim.assessment_notes && (
                <div className="mt-3 pt-3 border-t border-[var(--brd)]">
                  <p className="text-[var(--tx3)] text-[12px] mb-1">Assessment Notes</p>
                  <p className="text-[13px] text-[var(--tx)]">{claim.assessment_notes}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right sidebar: Timeline */}
        <div className="space-y-6">
          <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
            <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-4">Timeline</h3>
            {timeline.length === 0 ? (
              <p className="text-[13px] text-[var(--tx3)]">No events yet</p>
            ) : (
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-[var(--admin-primary-fill)] mt-1.5 shrink-0" />
                      <div className="w-px flex-1 bg-[var(--brd)]" />
                    </div>
                    <div className="pb-4">
                      <p className="text-[13px] text-[var(--tx)] leading-relaxed">{event.event_description}</p>
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5">
                        {formatPlatformDisplay(event.created_at, {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Photos */}
          {photos.length > 0 && (
            <div className="bg-[var(--card)] rounded-xl border border-[var(--brd)] p-5">
              <h3 className="text-[var(--text-base)] font-bold text-[var(--tx)] mb-3">All Photos ({photos.length})</h3>
              <div className="grid grid-cols-3 gap-2">
                {photos.map((p) => (
                  <a key={p.id} href={p.photo_url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden bg-[var(--bg)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.photo_url} alt={p.caption || "Claim photo"} className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

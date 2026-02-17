"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { getMoveCode } from "@/lib/move-code";
import { Icon } from "@/components/AppIcons";
import TrackInventory from "./TrackInventory";
import TrackPhotos from "./TrackPhotos";
import TrackDocuments from "./TrackDocuments";
import TrackMessageForm from "./TrackMessageForm";
import TrackLiveMap from "./TrackLiveMap";
import {
  MOVE_STATUS_OPTIONS,
  MOVE_STATUS_INDEX,
  MOVE_STATUS_COLORS,
  LIVE_TRACKING_STAGES,
  LIVE_STAGE_MAP,
  getStatusLabel,
} from "@/lib/move-status";
import { formatMoveDate } from "@/lib/date-format";

const CHANGE_TYPES = [
  "Change move date",
  "Change move time",
  "Add items to inventory",
  "Remove items to inventory",
  "Change destination address",
  "Add special instructions",
  "Upgrade service tier",
  "Other",
];

const YUGO_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";
const YUGO_EMAIL = process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com";

type TabKey = "dash" | "track" | "inv" | "photos" | "docs" | "msg";

/** Map legacy status to index for timeline */
function getStatusIdx(status: string | null): number {
  if (!status) return 0;
  if (MOVE_STATUS_INDEX[status] !== undefined) return MOVE_STATUS_INDEX[status];
  const legacy: Record<string, number> = {
    pending: 0, quote: 0, delivered: 4, dispatched: 3, "in-transit": 3,
  };
  return legacy[status] ?? 0;
}

export default function TrackMoveClient({
  move,
  crew,
  token,
  fromNotify = false,
}: {
  move: any;
  crew: { id: string; name: string; members?: string[] } | null;
  token: string;
  fromNotify?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("dash");
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState(CHANGE_TYPES[0]);
  const [changeDesc, setChangeDesc] = useState("");
  const [changeUrgent, setChangeUrgent] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);
  const [liveStage, setLiveStage] = useState<string | null>(move.stage || null);
  const [showNotifyBanner, setShowNotifyBanner] = useState(!!fromNotify);

  useEffect(() => {
    setLiveStage(move.stage || null);
  }, [move.stage]);

  // Auto-hide "your move status was recently updated" card after 5s when arriving from notify email
  useEffect(() => {
    if (!fromNotify) return;
    const t = setTimeout(() => setShowNotifyBanner(false), 5000);
    return () => clearTimeout(t);
  }, [fromNotify]);

  // Poll crew-status (including liveStage) so client stays in sync when admin updates stage
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/track/moves/${move.id}/crew-status?token=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );
        const data = await res.json();
        if (res.ok && data && "liveStage" in data) setLiveStage(data.liveStage ?? null);
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 10000);
    return () => clearInterval(id);
  }, [move.id, token]);

  const moveCode = getMoveCode(move);
  const displayCode = moveCode.startsWith("MV") ? `YG-${moveCode.slice(2)}` : moveCode;
  const statusVal = move.status || "confirmed";
  const currentIdx = getStatusIdx(statusVal);
  const isCancelled = statusVal === "cancelled";
  const isCompleted = statusVal === "completed" || statusVal === "delivered";
  const typeLabel = move.move_type === "office" ? "Office / Commercial" : "Premier Residential";
  const scheduledDate = move.scheduled_date ? new Date(move.scheduled_date) : null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;
  const estimate = Number(move.estimate || 0);
  const depositPaid = Math.round(estimate * 0.25);
  const balanceDue = estimate - depositPaid;

  const crewMembers = Array.isArray(move.assigned_members) ? move.assigned_members : (crew?.members ?? []);
  const crewRoles = ["Lead", "Specialist", "Specialist", "Driver"];

  const handleSubmitChange = async () => {
    if (!changeDesc.trim()) return;
    setChangeSubmitting(true);
    try {
      const res = await fetch(
        `/api/track/moves/${move.id}/change-request?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            type: changeType,
            description: changeDesc.trim(),
            urgency: changeUrgent ? "urgent" : "normal",
          }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setChangeModalOpen(false);
      setChangeDesc("");
    } catch {
      // Could add toast
    } finally {
      setChangeSubmitting(false);
    }
  };

  const tabs: { key: TabKey; label: string }[] = [
    { key: "dash", label: "Dashboard" },
    { key: "track", label: "Live Tracking" },
    { key: "inv", label: "Inventory" },
    { key: "photos", label: "Photos" },
    { key: "docs", label: "Documents" },
    { key: "msg", label: "Messages" },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAF8] text-[#1A1A1A] font-sans" data-theme="light">
      {/* Header - YUGO + YOUR MOVE */}
      <header className="sticky top-0 z-50 bg-white border-b border-[#E7E5E4]">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3.5">
          <div className="flex items-center gap-2">
            <span className="font-hero text-lg tracking-[2px] text-[#1A1A1A] font-semibold">YUGO</span>
            <span className="text-[10px] font-bold text-[#1A1A1A] bg-[#E8D5A3] px-2.5 py-1 rounded-full tracking-wider">
              YOUR MOVE
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-[800px] mx-auto px-4 sm:px-5 md:px-6 py-4 sm:py-6 min-w-0 w-full">
        {fromNotify && (
          <div
            className="grid transition-[grid-template-rows] duration-300 ease-out mb-5"
            style={{ gridTemplateRows: showNotifyBanner ? "1fr" : "0fr" }}
          >
            <div className="overflow-hidden">
              <div
                className={`rounded-xl border border-[#C9A962]/40 bg-[#C9A962]/10 px-4 py-3 flex items-center gap-3 transition-opacity duration-300 ease-out ${showNotifyBanner ? "opacity-100" : "opacity-0"}`}
              >
                <div className="w-8 h-8 rounded-full bg-[#C9A962]/20 flex items-center justify-center shrink-0">
                  <Icon name="check" className="w-4 h-4 text-[#C9A962]" />
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-[#1A1A1A]">Your move status was recently updated</div>
                  <div className="text-[11px] text-[#666]">View the details below to see what changed.</div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Hero - client name, code, status badge */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-heading text-[26px] text-[#1A1A1A] leading-tight font-semibold">
              {move.client_name || "Your Move"}
            </h1>
            <p className="text-[12px] text-[#666] mt-1">
              {displayCode} · {typeLabel}
            </p>
          </div>
          <span className={`inline-flex items-center rounded-md px-3 py-1.5 text-[11px] font-semibold border ${MOVE_STATUS_COLORS[statusVal] || "bg-[#E8D5A3] text-[#1A1A1A] border-[#E8D5A3]"}`}>
            {getStatusLabel(statusVal)}
          </span>
        </div>

        {/* Countdown card - light theme */}
        <div className="rounded-xl border border-[#E7E5E4] bg-white p-6 mb-5 shadow-sm">
          <div className="text-center">
            <div className="font-hero text-[48px] md:text-[56px] leading-none text-[#C9A962]">
              {daysUntil ?? "—"}
            </div>
            <div className="mt-1 text-[13px] text-[#666]">days until move day</div>
            {scheduledDate && (
              <div className="mt-2 text-[13px] font-semibold text-[#1A1A1A]">
                {formatMoveDate(scheduledDate)}{" "}
                at {move.scheduled_time || move.arrival_window || "TBD"}
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[#E7E5E4] mb-5 overflow-x-auto bg-white rounded-t-lg">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-3 text-[12px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? "text-[#C9A962] border-[#C9A962]"
                  : "text-[#999] border-transparent hover:text-[#666]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "dash" && (
          <div className="space-y-6">
            {/* Move Timeline - Confirmed → Scheduled → Final Payment → In Progress → Completed */}
            <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
              <h3 className="text-[14px] font-bold mb-4 text-[#1A1A1A]">Move Timeline</h3>
              <div className="relative pl-7 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-[#E7E5E4]">
                {MOVE_STATUS_OPTIONS.filter((s) => s.value !== "cancelled").map((s, i) => {
                  const state = isCancelled ? "wait" : i < currentIdx ? "done" : i === currentIdx ? "act" : "wait";
                  const completedDate = isCompleted && i === 4 ? formatMoveDate(move.updated_at ? new Date(move.updated_at) : scheduledDate) : null;
                  return (
                    <div key={s.value} className="relative pb-5 last:pb-0">
                      <div
                        className={`absolute -left-[19px] top-0.5 w-3 h-3 rounded-full border-2 border-white z-10 ${
                          state === "done"
                            ? "bg-[#22C55E] w-3.5 h-3.5 -left-5"
                            : state === "act"
                              ? "bg-[#F59E0B] w-3.5 h-3.5 -left-5 shadow-[0_0_0_4px_rgba(245,158,11,0.2)]"
                              : "bg-[#E7E5E4]"
                        }`}
                      />
                      <div className={`text-[13px] font-semibold ${state === "done" ? "text-[#22C55E]" : state === "act" ? "text-[#F59E0B]" : "text-[#999]"}`}>
                        {s.label}
                      </div>
                      <div className="text-[11px] text-[#666] mt-0.5">
                        {state === "done" ? (completedDate ? `Completed ${completedDate}` : "Completed") : state === "act" ? `In Progress` : "Upcoming"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Move Details + Your Crew grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#999] mb-4">Move Details</h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">From</div>
                    <div className="text-[13px] text-[#1A1A1A]">{move.from_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">To</div>
                    <div className="text-[13px] text-[#1A1A1A]">{move.to_address || move.delivery_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">Estimate</div>
                    <div className="text-[18px] font-bold text-[#C9A962]">${estimate.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[#999] mb-0.5">Deposit</div>
                    <div className="text-[14px] font-semibold text-[#1A1A1A]">${depositPaid.toLocaleString()}</div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[#999] mb-4">
                  Your Crew {crewMembers.length > 0 && `(${crewMembers.length})`}
                </h3>
                {crewMembers.length > 0 ? (
                  <>
                    {crewMembers.map((name: string, i: number) => (
                      <div key={i} className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-[#E8D5A3] flex items-center justify-center text-[11px] font-bold text-[#1A1A1A] shrink-0">
                          {(name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[13px] font-semibold text-[#1A1A1A]">{name}</div>
                          <div className="text-[11px] text-[#666]">{crewRoles[i] || "Team member"}</div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
                      <div className="text-[10px] font-semibold text-[#999]">Coordinator</div>
                      <div className="text-[13px] text-[#1A1A1A] mt-0.5 flex items-center gap-2">
                        <Icon name="phone" className="w-[12px] h-[12px] text-[#C9A962]" />
                        {YUGO_PHONE}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[12px] text-[#666]">
                    Your crew will be assigned as your move is confirmed. Contact us with any questions.
                  </div>
                )}
              </div>
            </div>

            {/* Request a Change */}
            <button
              type="button"
              onClick={() => setChangeModalOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-[#E7E5E4] py-4 text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors flex items-center justify-center gap-2 bg-white"
            >
              <Icon name="clipboard" className="w-[14px] h-[14px]" />
              Request a Change
            </button>
          </div>
        )}

        {activeTab === "track" && (
          <div className="space-y-5">
            <div className="bg-white border border-[#E7E5E4] rounded-xl overflow-hidden shadow-sm">
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-[14px] font-bold text-[#1A1A1A]">Progress Detail</h3>
                  <span className="relative flex h-2 w-2" aria-hidden>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[#22C55E]" />
                  </span>
                </div>
                <p className="text-[11px] text-[#666] mb-4">Live stage of your move — updates when your coordinator updates</p>
                <div className="mb-4">
                  <div className="h-2.5 overflow-hidden rounded-full bg-[#E7E5E4]">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${move.status === "in_progress" && liveStage != null
                          ? 100 * Math.max(0, (LIVE_STAGE_MAP[liveStage || ""] ?? -1) + 1) / 6
                          : 0}%`,
                        background: "linear-gradient(90deg, #ECDEC4, #C9A962)",
                      }}
                    />
                  </div>
                  <div className="mt-2 text-[13px] font-semibold" style={{ color: "#C9A962" }}>
                    {move.status === "in_progress" && liveStage
                      ? LIVE_TRACKING_STAGES.find((s) => s.key === liveStage)?.label ?? "In progress"
                      : "Not started — live stages begin when move is in progress"}
                  </div>
                </div>
              </div>
            </div>
            <TrackLiveMap moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "inv" && (
          <div className="mb-6">
            <TrackInventory moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "photos" && (
          <div className="mb-6">
            <TrackPhotos moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "docs" && (
          <div className="mb-6">
            <TrackDocuments moveId={move.id} token={token} />
          </div>
        )}

        {activeTab === "msg" && (
          <div className="bg-white border border-[#E7E5E4] rounded-xl p-5 shadow-sm">
            <h3 className="text-[14px] font-bold mb-3 text-[#1A1A1A]">Messages with your coordinator</h3>
            <div className="space-y-2 text-[13px] mb-4 text-[#1A1A1A]">
              <p className="flex items-center gap-2">
                <Icon name="phone" className="w-[12px] h-[12px] text-[#C9A962]" />
                {YUGO_PHONE}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="mail" className="w-[12px] h-[12px] text-[#C9A962]" />
                <a href={`mailto:${YUGO_EMAIL}`} className="text-[#C9A962] hover:underline">{YUGO_EMAIL}</a>
              </p>
            </div>
            <TrackMessageForm moveId={move.id} token={token} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center bg-white border-t border-[#E7E5E4]">
        <p className="text-[11px] text-[#999]">
          <Link href="/" className="font-hero text-[#C9A962] hover:underline">Yugo</Link> — The art of moving.
        </p>
      </footer>

      {/* Change Request Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E7E5E4] bg-white p-5 shadow-xl">
            <h3 className="mb-3 text-[16px] font-bold text-[#1A1A1A] font-heading">Request a Change</h3>
            <p className="mb-4 text-[12px] text-[#666] leading-relaxed">
              Submit a change request. Your coordinator will review and confirm.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[#999]">Type of Change</label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#1A1A1A] focus:border-[#C9A962] outline-none"
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[10px] font-bold uppercase text-[#999]">Details</label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder="Describe what you need changed..."
                  rows={4}
                  className="w-full resize-y rounded-lg border border-[#E7E5E4] bg-[#FAFAF8] px-3 py-2 text-[12px] text-[#1A1A1A] placeholder:text-[#999] focus:border-[#C9A962] outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[10px] font-bold uppercase text-[#999]">Urgency</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#666]">
                    <input type="radio" name="urgency" checked={!changeUrgent} onChange={() => setChangeUrgent(false)} className="accent-[#C9A962]" />
                    Normal
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#666]">
                    <input type="radio" name="urgency" checked={changeUrgent} onChange={() => setChangeUrgent(true)} className="accent-[#C9A962]" />
                    Urgent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 rounded-lg border border-[#E7E5E4] py-2.5 text-[12px] font-semibold text-[#666] hover:border-[#C9A962] hover:text-[#C9A962] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitChange}
                  disabled={changeSubmitting}
                  className="flex-1 rounded-lg bg-[#C9A962] py-2.5 text-[12px] font-bold text-white hover:bg-[#B89A52] disabled:opacity-50 transition-colors"
                >
                  {changeSubmitting ? "Submitting…" : "Submit"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

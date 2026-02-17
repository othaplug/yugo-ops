"use client";

import { useState } from "react";
import Link from "next/link";
import { getMoveCode } from "@/lib/move-code";
import { Icon } from "@/components/AppIcons";
import TrackInventory from "./TrackInventory";
import TrackPhotos from "./TrackPhotos";
import TrackDocuments from "./TrackDocuments";
import TrackMessageForm from "./TrackMessageForm";

const STEPS = [
  { key: "quote", label: "Quote" },
  { key: "scheduled", label: "Pre-Move" },
  { key: "in_progress", label: "Move Day" },
  { key: "delivered", label: "Complete" },
];

const STAGE_MAP: Record<string, number> = {
  quote: 0,
  pending: 0,
  scheduled: 1,
  confirmed: 1,
  "in-transit": 2,
  dispatched: 2,
  in_progress: 2,
  delivered: 3,
  cancelled: -1,
};


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

const YUGO_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(555) 123-4567";
const YUGO_EMAIL = process.env.NEXT_PUBLIC_YUGO_EMAIL || "hello@yugo.com";

type TabKey = "dash" | "track" | "inv" | "photos" | "docs" | "msg";

function getContextMessage(move: any): string {
  const status = (move.status || "").toLowerCase();
  const stage = (move.stage || move.status || "quote").toLowerCase();
  const scheduledDate = move.scheduled_date ? new Date(move.scheduled_date) : null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;

  if (status === "delivered" || stage === "delivered") {
    return "Your move is complete! Thanks for choosing Yugo.";
  }
  if (status === "in-transit" || status === "dispatched") {
    return "Your crew is on the way. You'll receive updates as they progress.";
  }
  if (stage === "in_progress" && daysUntil === 0) {
    return `Your crew has been assigned. You're all set for ${scheduledDate?.toLocaleDateString("en-US", { month: "long", day: "numeric" })}.`;
  }
  if (stage === "scheduled" || stage === "confirmed") {
    return `Your move is confirmed for ${scheduledDate?.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}.`;
  }
  if (stage === "quote" || status === "pending") {
    return "Your quote is ready. We'll confirm once your deposit is received.";
  }
  return "We're preparing your move details. You'll receive an update when your move is confirmed.";
}

function getWhatToExpect(move: any): { title: string; items: string[] } {
  const status = (move.status || "").toLowerCase();
  const stage = (move.stage || move.status || "quote").toLowerCase();
  const scheduledDate = move.scheduled_date ? new Date(move.scheduled_date) : null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;

  if (status === "delivered" || stage === "delivered") {
    return {
      title: "Move Complete",
      items: [
        `Thanks for choosing Yugo, ${(move.client_name || "there").split(" ")[0]}. We hope your move went smoothly.`,
      ],
    };
  }
  if (daysUntil === 0 && (stage === "in_progress" || stage === "scheduled" || stage === "confirmed")) {
    return {
      title: "Tomorrow's the Day",
      items: [
        "Your crew will arrive between the scheduled time window.",
        "Clear hallways and doorways for the crew.",
        "If anything changes, contact us at the number below.",
      ],
    };
  }
  if (daysUntil !== null && daysUntil > 0 && daysUntil <= 7 && (stage === "scheduled" || stage === "confirmed")) {
    return {
      title: "Preparing for Your Move",
      items: [
        "Clear hallways and doorways for the crew.",
        "Label any fragile or high-value items.",
        "Set aside essentials you'll want to keep with you (medications, documents, valuables).",
        "Confirm parking/elevator access at both locations.",
      ],
    };
  }
  return {
    title: "What's Next",
    items: [
      "We're preparing your move details.",
      "Once confirmed, we'll assign a dedicated crew.",
      "You'll receive an update email when your move is confirmed.",
    ],
  };
}

export default function TrackMoveClient({
  move,
  crew,
  token,
}: {
  move: any;
  crew: { id: string; name: string; members?: string[] } | null;
  token: string;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>("dash");
  const [changeModalOpen, setChangeModalOpen] = useState(false);
  const [changeType, setChangeType] = useState(CHANGE_TYPES[0]);
  const [changeDesc, setChangeDesc] = useState("");
  const [changeUrgent, setChangeUrgent] = useState(false);
  const [changeSubmitting, setChangeSubmitting] = useState(false);

  const moveCode = getMoveCode(move);
  const displayCode = moveCode.startsWith("MV") ? `YG-${moveCode.slice(2)}` : moveCode;
  const stageVal = move.stage || move.status || "quote";
  const currentIdx = STAGE_MAP[stageVal] ?? 0;
  const typeLabel = move.move_type === "office" ? "Office / Commercial" : "Residential";
  const scheduledDate = move.scheduled_date ? new Date(move.scheduled_date) : null;
  const daysUntil = scheduledDate ? Math.ceil((scheduledDate.getTime() - Date.now()) / 86400000) : null;
  const progressPct = Math.min(100, Math.max(0, ((currentIdx + 1) / STEPS.length) * 100));
  const estimate = Number(move.estimate || 0);
  const depositPaid = Math.round(estimate * 0.25);
  const balanceDue = estimate - depositPaid;
  const depositPct = estimate > 0 ? Math.round((depositPaid / estimate) * 100) : 0;
  const contextMsg = getContextMessage(move);
  const whatToExpect = getWhatToExpect(move);

  const crewMembers = Array.isArray(move.assigned_members) ? move.assigned_members : (crew?.members ?? []);

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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--tx)] font-sans">
      {/* Top bar - OPS+ branding */}
      <header className="sticky top-0 z-50 flex items-center justify-between px-4 sm:px-6 py-3.5 border-b border-[var(--brd)] bg-[var(--card)]">
        <div className="flex items-center gap-1.5">
          <span className="font-hero text-lg tracking-[2px] text-[var(--tx)]">YUGO</span>
          <span className="text-[8px] font-bold text-[var(--gold)] bg-[var(--gdim)] px-1.5 py-0.5 rounded-[10px] tracking-wider border border-[rgba(201,169,98,0.35)]">
            YOUR MOVE
          </span>
        </div>
        <span className="inline-flex items-center justify-center px-3 py-1.5 rounded-full bg-[var(--gdim)] border border-[rgba(201,169,98,0.35)] text-[var(--gold)] font-hero font-semibold tracking-widest text-[10px]">
          OPS+
        </span>
      </header>

      <main className="max-w-[800px] mx-auto px-5 sm:px-6 py-6">
        {/* Hero - client name, code, status badge */}
        <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
          <div>
            <h1 className="font-heading text-[26px] text-[var(--tx)] leading-tight">
              {move.client_name || "Your Move"}
            </h1>
            <p className="text-[11px] text-[var(--tx2)] mt-1 flex items-center gap-1.5">
              {displayCode} · {typeLabel}
              <Icon name={move.move_type === "office" ? "building" : "home"} className="w-[10px] h-[10px]" />
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold border ${
              currentIdx < 0
                ? "bg-[var(--rdim)] text-[var(--red)] border-[var(--red)]/20"
                : "bg-[var(--ordim)] text-[var(--org)] border-[var(--org)]/20"
            }`}
          >
            {currentIdx >= 0 && (
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--org)]" />
            )}
            {currentIdx < 0 ? "Cancelled" : (STEPS[currentIdx]?.label || "In Progress")}
          </span>
        </div>

        {/* Countdown card */}
        <div className="rounded-xl border border-[var(--brd)] bg-gradient-to-br from-[var(--gdim)] to-[var(--gdim)]/50 p-5 mb-5">
          <div className="text-center">
            <div className="font-hero text-[48px] md:text-[56px] leading-none text-[var(--gold)]">
              {daysUntil ?? "—"}
            </div>
            <div className="mt-1 text-[12px] text-[var(--tx2)]">days until move day</div>
            {scheduledDate && (
              <div className="mt-2 text-[12px] font-semibold text-[var(--tx)]">
                {scheduledDate.toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}{" "}
                at {move.scheduled_time || move.arrival_window || "TBD"}
              </div>
            )}
            <div className="mt-3 flex items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full border border-[var(--brd)] bg-[var(--bg)]">
                <div
                  className="h-full rounded-full bg-[var(--gold)] transition-all"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
              <span className="text-[11px] font-bold text-[var(--gold)]">{Math.round(progressPct)}%</span>
            </div>
          </div>
        </div>

        <p className="text-[13px] text-[var(--tx)] font-medium text-center mb-5">{contextMsg}</p>

        {/* Tabs */}
        <div className="flex gap-0 border-b border-[var(--brd)] mb-5 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-[11px] font-semibold whitespace-nowrap border-b-2 transition-colors ${
                activeTab === t.key
                  ? "text-[var(--gold)] border-[var(--gold)]"
                  : "text-[var(--tx3)] border-transparent hover:text-[var(--tx)]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "dash" && (
          <div className="space-y-5">
            {/* Move Timeline */}
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
              <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
                <Icon name="calendar" className="w-[12px] h-[12px]" />
                Move Timeline
              </h3>
              <div className="relative pl-7 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-[var(--brd)]">
                {STEPS.map((s, i) => {
                  const state = currentIdx < 0 ? "wait" : i < currentIdx ? "done" : i === currentIdx ? "act" : "wait";
                  return (
                    <div key={s.key} className="relative pb-5 last:pb-0">
                      <div
                        className={`absolute -left-[19px] top-0.5 w-3 h-3 rounded-full border-2 border-[var(--card)] z-10 ${
                          state === "done"
                            ? "bg-[var(--grn)] w-3.5 h-3.5 -left-5"
                            : state === "act"
                              ? "bg-[var(--org)] w-3.5 h-3.5 -left-5 shadow-[0_0_0_4px_rgba(212,138,41,0.12)] animate-pulse"
                              : "bg-[var(--brd)]"
                        }`}
                      />
                      <div className={`text-[12px] font-semibold ${state === "done" ? "text-[var(--grn)]" : state === "act" ? "text-[var(--org)]" : "text-[var(--tx)]"}`}>
                        {s.label}
                      </div>
                      <div className="text-[10px] text-[var(--tx2)] mt-0.5">
                        {state === "done" ? "Completed" : state === "act" ? "In progress" : "Scheduled"}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Move Details + Crew grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3 flex items-center gap-2">
                  <Icon name="mapPin" className="w-[10px] h-[10px]" />
                  Move Details
                </h3>
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[var(--tx3)] mb-0.5">From</div>
                    <div className="text-[12px] text-[var(--tx)]">{move.from_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[var(--tx3)] mb-0.5">To</div>
                    <div className="text-[12px] text-[var(--tx)]">{move.to_address || move.delivery_address || "—"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[var(--tx3)] mb-0.5">Estimate</div>
                    <div className="font-hero text-[20px] text-[var(--gold)]">${estimate.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold uppercase text-[var(--tx3)] mb-0.5">Deposit</div>
                    <div className="text-[12px] font-semibold text-[var(--tx)] flex items-center gap-1.5">
                      ${depositPaid.toLocaleString()}
                      {depositPaid > 0 && <Icon name="check" className="w-[14px] h-[14px] text-[var(--grn)]" />}
                    </div>
                    <div className="text-[10px] text-[var(--tx2)]">{depositPct}%</div>
                  </div>
                </div>
              </div>

              <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
                <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-3 flex items-center gap-2">
                  <Icon name="users" className="w-[10px] h-[10px]" />
                  Your Crew {crewMembers.length > 0 && `(${crewMembers.length})`}
                </h3>
                {crewMembers.length > 0 ? (
                  <>
                    {crewMembers.map((name: string, i: number) => (
                      <div key={i} className="flex items-center gap-2 mb-2">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[var(--gold)] to-[#8B7332] flex items-center justify-center text-[9px] font-bold text-white shrink-0">
                          {(name || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-[11px] font-semibold text-[var(--tx)]">{name}</div>
                          <div className="text-[9px] text-[var(--tx2)]">Team member</div>
                        </div>
                      </div>
                    ))}
                    <div className="mt-3 pt-3 border-t border-[var(--brd)]">
                      <div className="text-[10px] font-semibold text-[var(--tx3)]">Coordinator</div>
                      <div className="text-[11px] text-[var(--tx)] mt-0.5 flex items-center gap-2">
                        <Icon name="phone" className="w-[10px] h-[10px] text-[var(--gold)]" />
                        {YUGO_PHONE}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] text-[var(--tx2)]">
                    Your crew will be assigned as your move is confirmed. Contact us with any questions.
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div id="payment" className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
              <h3 className="text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-4 flex items-center gap-2">
                <Icon name="dollarSign" className="w-[12px] h-[12px]" />
                Financial Summary
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Estimate</div>
                  <div className="text-[14px] font-bold text-[var(--gold)]">${estimate.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Deposit</div>
                  <div className="text-[14px] font-bold flex items-center gap-1.5 text-[var(--tx)]">
                    ${depositPaid.toLocaleString()}
                    {depositPaid > 0 && <Icon name="check" className="w-[14px] h-[14px] text-[var(--grn)]" />}
                  </div>
                  <div className="text-[10px] text-[var(--tx2)]">{depositPct}%</div>
                </div>
                <div>
                  <div className="text-[9px] font-bold uppercase text-[var(--tx3)] mb-1">Balance</div>
                  <div className={`text-[14px] font-bold ${balanceDue > 0 ? "text-[var(--org)]" : "text-[var(--grn)]"}`}>
                    ${balanceDue.toLocaleString()}
                  </div>
                  {balanceDue > 0 && (
                    <a
                      href="#payment"
                      className="inline-block mt-2 px-3 py-1.5 rounded-lg text-[11px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
                    >
                      Pay Balance — ${balanceDue}
                    </a>
                  )}
                  {balanceDue <= 0 && (
                    <span className="text-[10px] text-[var(--grn)] flex items-center gap-1 mt-1">
                      <Icon name="check" className="w-[12px] h-[12px]" />
                      Paid in full
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* What to Expect */}
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
              <h3 className="text-[14px] font-bold mb-3">{whatToExpect.title}</h3>
              <ul className="space-y-2">
                {whatToExpect.items.map((item, i) => (
                  <li key={i} className="text-[12px] text-[var(--tx2)] flex gap-2">
                    <span className="text-[var(--gold)] shrink-0">•</span>
                    {item}
                  </li>
                ))}
              </ul>
              {(move.status === "delivered" || move.stage === "delivered") && (
                <div className="mt-4 flex gap-3">
                  <a
                    href="#"
                    className="inline-block px-4 py-2 rounded-lg text-[12px] font-semibold bg-[var(--gold)] text-[#0D0D0D] hover:bg-[var(--gold2)] transition-colors"
                  >
                    Leave a Review →
                  </a>
                  <a
                    href={`mailto:${YUGO_EMAIL}`}
                    className="inline-block px-4 py-2 rounded-lg text-[12px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)] transition-colors"
                  >
                    Contact Us
                  </a>
                </div>
              )}
            </div>

            {/* Request a Change */}
            <button
              type="button"
              onClick={() => setChangeModalOpen(true)}
              className="w-full rounded-xl border-2 border-dashed border-[var(--brd)] py-4 text-[12px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors flex items-center justify-center gap-2 bg-[var(--card)]"
            >
              <Icon name="clipboard" className="w-[14px] h-[14px]" />
              Request a Change
            </button>
          </div>
        )}

        {activeTab === "track" && (
          <div className="space-y-5">
            <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
              <h3 className="text-[14px] font-bold mb-4 flex items-center gap-2">
                <Icon name="truck" className="w-[12px] h-[12px]" />
                Progress Detail
              </h3>
              <div className="relative pl-7 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-[var(--brd)]">
                {STEPS.map((s, i) => {
                  const state = currentIdx < 0 ? "wait" : i < currentIdx ? "done" : i === currentIdx ? "act" : "wait";
                  return (
                    <div key={s.key} className="relative pb-4 last:pb-0">
                      <div
                        className={`absolute -left-[19px] top-0.5 w-3 h-3 rounded-full border-2 border-[var(--card)] z-10 ${
                          state === "done"
                            ? "bg-[var(--grn)] w-3.5 h-3.5 -left-5"
                            : state === "act"
                              ? "bg-[var(--org)] w-3.5 h-3.5 -left-5 shadow-[0_0_0_4px_rgba(212,138,41,0.12)]"
                              : "bg-[var(--brd)]"
                        }`}
                      />
                      <div className={`text-[12px] font-semibold ${state === "done" ? "text-[var(--grn)]" : state === "act" ? "text-[var(--org)]" : "text-[var(--tx3)]"}`}>
                        {s.label}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-4 text-[13px] text-[var(--tx2)]">{contextMsg}</p>
              <p className="mt-2 text-[11px] text-[var(--tx3)]">
                Real-time crew location updates will appear here when your move is in progress.
              </p>
            </div>
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
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5">
            <h3 className="text-[14px] font-bold mb-3 flex items-center gap-2">
              <Icon name="messageSquare" className="w-[12px] h-[12px]" />
              Questions about your move?
            </h3>
            <div className="space-y-2 text-[13px] mb-4 text-[var(--tx)]">
              <p className="flex items-center gap-2">
                <Icon name="phone" className="w-[12px] h-[12px] text-[var(--gold)]" />
                {YUGO_PHONE}
              </p>
              <p className="flex items-center gap-2">
                <Icon name="mail" className="w-[12px] h-[12px] text-[var(--gold)]" />
                <a href={`mailto:${YUGO_EMAIL}`} className="text-[var(--gold)] hover:underline">{YUGO_EMAIL}</a>
              </p>
            </div>
            <TrackMessageForm moveId={move.id} token={token} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-8 text-center">
        <p className="text-[11px] text-[var(--tx3)]">
          <Link href="/" className="font-hero text-[var(--gold)] hover:underline">Yugo</Link> — The art of moving.
        </p>
        <span className="text-[10px] text-[var(--tx3)]">Powered by OPS+</span>
      </footer>

      {/* Change Request Modal */}
      {changeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 shadow-xl">
            <h3 className="mb-3 text-[16px] font-bold text-[var(--tx)] font-heading">Request a Change</h3>
            <p className="mb-4 text-[11px] text-[var(--tx2)] leading-relaxed">
              Submit a change request. Your coordinator will review and confirm.
            </p>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase text-[var(--tx3)]">Type of Change</label>
                <select
                  value={changeType}
                  onChange={(e) => setChangeType(e.target.value)}
                  className="w-full rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--tx)] focus:border-[var(--gold)] outline-none"
                >
                  {CHANGE_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[9px] font-bold uppercase text-[var(--tx3)]">Details</label>
                <textarea
                  value={changeDesc}
                  onChange={(e) => setChangeDesc(e.target.value)}
                  placeholder="Describe what you need changed..."
                  rows={4}
                  className="w-full resize-y rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2 text-[12px] text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none"
                />
              </div>
              <div>
                <label className="mb-2 block text-[9px] font-bold uppercase text-[var(--tx3)]">Urgency</label>
                <div className="flex gap-4">
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--tx2)]">
                    <input type="radio" name="urgency" checked={!changeUrgent} onChange={() => setChangeUrgent(false)} className="accent-[var(--gold)]" />
                    Normal
                  </label>
                  <label className="flex cursor-pointer items-center gap-2 text-[11px] text-[var(--tx2)]">
                    <input type="radio" name="urgency" checked={changeUrgent} onChange={() => setChangeUrgent(true)} className="accent-[var(--gold)]" />
                    Urgent
                  </label>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setChangeModalOpen(false)}
                  className="flex-1 rounded-lg border border-[var(--brd)] py-2.5 text-[11px] font-semibold text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSubmitChange}
                  disabled={changeSubmitting}
                  className="flex-1 rounded-lg bg-[var(--gold)] py-2.5 text-[11px] font-bold text-[#0D0D0D] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
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

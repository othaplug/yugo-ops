"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatTime, formatDate } from "@/lib/client-timezone";
import {
  MOVE_STATUS_FLOW,
  DELIVERY_STATUS_FLOW,
  getNextStatus,
  getStatusLabel,
} from "@/lib/crew-tracking-status";
import { normalizePhone } from "@/lib/phone";
import PageContent from "@/app/admin/components/PageContent";
import StageProgressBar from "@/components/StageProgressBar";
import JobPhotos from "./JobPhotos";
import JobInventory from "./JobInventory";

const DISPATCH_PHONE = "(647) 370-4525";

type TabId = "status" | "details" | "items" | "photos";

interface CrewMember {
  name: string;
  role: string;
}

interface JobDetail {
  id: string;
  jobId: string;
  jobType: "move" | "delivery";
  moveType?: string;
  status?: string;
  clientName: string;
  fromAddress: string;
  toAddress: string;
  fromAccess?: string | null;
  toAccess?: string | null;
  accessNotes?: string | null;
  arrivalWindow?: string | null;
  scheduledDate?: string | null;
  access: string | null;
  crewMembers?: CrewMember[];
  jobTypeLabel: string;
  inventory: { room: string; items: string[]; itemsWithId?: { id: string; item_name: string; quantity?: number }[] }[];
  extraItems?: { id: string; description?: string; room?: string; quantity?: number; added_at?: string }[];
  internalNotes: string | null;
  scheduledTime: string | null;
  crewId: string;
}

interface Session {
  id: string;
  status: string;
  isActive: boolean;
  startedAt: string | null;
  completedAt?: string | null;
  checkpoints: { status: string; timestamp: string; note: string | null }[];
  lastLocation: { lat: number; lng: number } | null;
}

function formatElapsed(ms: number): string {
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

export default function CrewJobPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const router = useRouter();
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const [job, setJob] = useState<JobDetail | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [note, setNote] = useState("");
  const [gpsStatus, setGpsStatus] = useState<"off" | "on" | "unavailable">("on");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("damage");
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [canAdvanceFromArrived, setCanAdvanceFromArrived] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [itemsVerified, setItemsVerified] = useState(0);
  const [itemsTotal, setItemsTotal] = useState(0);
  const noteInputRef = useRef<HTMLInputElement | null>(null);

  const [pickupModalOpen, setPickupModalOpen] = useState(false);
  const [pickupPhotosCount, setPickupPhotosCount] = useState(0);
  const [pickupVerificationDone, setPickupVerificationDone] = useState(false);

  const statusFlow = jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  const currentStatus = session?.status || "not_started";
  const nextStatus = getNextStatus(currentStatus, jobType);
  const isCompleted = currentStatus === "completed";
  const progressIdx = statusFlow.indexOf(currentStatus as any);
  const progressPercent = isCompleted ? 100 : progressIdx >= 0 ? ((progressIdx + 1) / statusFlow.length) * 100 : 0;

  const totalItems = itemsTotal > 0 ? itemsTotal : (job
    ? (job.inventory?.flatMap((r) => r.itemsWithId || r.items.map((n) => ({ id: `noid`, item_name: n }))).length ?? 0) + (job.extraItems?.length ?? 0)
    : 0);

  const fetchJob = useCallback(async () => {
    const r = await fetch(`/api/crew/job/${jobType}/${id}`);
    if (!r.ok) throw new Error("Job not found");
    const d = await r.json();
    setJob(d);
  }, [jobType, id]);

  const fetchSession = useCallback(async () => {
    const r = await fetch(`/api/crew/session/${jobType}/${id}`);
    const d = await r.json();
    if (d.session) {
      setSession({
        id: d.session.id,
        status: d.session.status,
        isActive: d.session.isActive,
        startedAt: d.session.startedAt,
        completedAt: d.session.completedAt,
        checkpoints: d.checkpoints || [],
        lastLocation: d.lastLocation,
      });
    } else {
      setSession(null);
    }
  }, [id, jobType]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchJob(), fetchSession()])
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fetchJob, fetchSession]);

  useEffect(() => {
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (
      currentStatus === "arrived_at_pickup" &&
      !pickupVerificationDone &&
      !loading &&
      session?.isActive
    ) {
      setPickupModalOpen(true);
    }
  }, [currentStatus, pickupVerificationDone, loading, session?.isActive]);

  useEffect(() => {
    if (!session?.startedAt || !session?.isActive) {
      setElapsedMs(0);
      return;
    }
    const tick = () => setElapsedMs(Date.now() - new Date(session.startedAt!).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt, session?.isActive]);

  const startJob = async () => {
    setAdvancing(true);
    try {
      const r = await fetch("/api/tracking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: id, jobType }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to start");
      await fetchSession();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdvancing(false);
    }
  };

  const advanceStatus = async () => {
    if (!session || !nextStatus) return;
    if (nextStatus === "completed") {
      router.push(`/crew/dashboard/job/${jobType}/${id}/signoff`);
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => doAdvance(nextStatus, p.coords.latitude, p.coords.longitude),
        () => doAdvance(nextStatus),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 }
      );
    } else {
      await doAdvance(nextStatus);
    }
  };

  const doAdvance = async (status: string, lat?: number, lng?: number) => {
    if (!session) return;
    setAdvancing(true);
    try {
      const r = await fetch("/api/tracking/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          status,
          note: note.trim() || undefined,
          lat,
          lng,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed");
      setNote("");
      await fetchSession();
      if (status === "completed") {
        stopGpsTracking();
        setGpsStatus("off");
      }
      if (status === "arrived_at_pickup") {
        setPickupModalOpen(true);
        setPickupVerificationDone(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdvancing(false);
    }
  };

  const watchIdRef = useRef<number | null>(null);
  const lastSentRef = useRef(0);
  const ACTIVE_INTERVAL = 5000;
  const IDLE_INTERVAL = 30000;

  const stopGpsTracking = useCallback(() => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }
    setGpsStatus("on");
    const activeSessionId = session?.isActive && session?.id ? session.id : undefined;
    const interval = activeSessionId ? ACTIVE_INTERVAL : IDLE_INTERVAL;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < interval) return;
        lastSentRef.current = now;
        const body: Record<string, unknown> = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: new Date().toISOString(),
        };
        if (activeSessionId) body.sessionId = activeSessionId;
        fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        })
          .then(async (res) => {
            if (!res.ok) return;
            const data = await res.json().catch(() => null);
            if (data?.autoAdvanced) fetchSession();
          })
          .catch(() => {});
      },
      () => setGpsStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 },
    );
    return () => stopGpsTracking();
  }, [session?.id, session?.isActive, fetchSession, stopGpsTracking]);

  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const requestLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          lock = await (navigator as any).wakeLock.request("screen");
        }
      } catch {}
    };
    requestLock();
    return () => { lock?.release?.(); };
  }, []);

  if (loading) {
    return (
      <PageContent>
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--tx3)]">Loading job...</p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (error || !job) {
    return (
      <PageContent>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-[14px] text-[var(--red)] mb-4">{error || "Job not found"}</p>
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-medium text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors"
          >
            <span aria-hidden>←</span> Back to Jobs
          </Link>
        </div>
      </PageContent>
    );
  }

  const jobCompleted = ["completed", "delivered", "done"].includes((job.status || "").toLowerCase());
  const showStartButton = !session && !jobCompleted;
  const atArrivedRequiringPhotos = ["arrived_at_pickup", "arrived_at_destination", "arrived"].includes(currentStatus);
  const blockedByPhotos = atArrivedRequiringPhotos && !canAdvanceFromArrived;
  const blockedByPickupVerification = currentStatus === "arrived_at_pickup" && !pickupVerificationDone;
  const showAdvanceButton = session?.isActive && nextStatus && !showStartButton;

  const itemsLabel = itemsTotal > 0 ? `Items (${itemsVerified}/${itemsTotal})` : `Items (${totalItems})`;
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "status", label: "Status", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg> },
    { id: "details", label: "Details", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> },
    { id: "items", label: itemsLabel, icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg> },
    { id: "photos", label: "Photos", icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg> },
  ];

  const hasInventory = (job.inventory?.length ?? 0) > 0 || (job.extraItems?.length ?? 0) > 0 || (jobType === "move" && job.moveType === "residential" && (job.inventory?.length ?? 0) === 0);

  return (
    <PageContent className="max-w-[520px]">
      {/* Sticky top bar with back + elapsed + GPS */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <Link
          href="/crew/dashboard"
          className="inline-flex items-center gap-1.5 py-2 px-3 -ml-3 rounded-xl text-[12px] font-medium text-[var(--tx2)] hover:text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 18 9 12 15 6"/></svg>
          Jobs
        </Link>
        <div className="flex items-center gap-2">
          {(session?.isActive || isCompleted) && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--tx3)" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">
                {formatElapsed(isCompleted && session?.completedAt && session?.startedAt ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime() : elapsedMs)}
              </span>
            </div>
          )}
          {session && !isCompleted && (
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold ${gpsStatus === "on" ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/25" : "bg-[var(--bg)] text-[var(--tx3)] border border-[var(--brd)]"}`}>
              <span className="relative flex h-1.5 w-1.5">
                {gpsStatus === "on" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${gpsStatus === "on" ? "bg-[#22C55E]" : "bg-[var(--tx3)]"}`} />
              </span>
              GPS
            </span>
          )}
        </div>
      </div>

      {/* Job header — seamless flow */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-1">{job.jobTypeLabel}</p>
            <h1 className="font-hero text-[22px] font-bold text-[var(--tx)] leading-tight">{job.clientName}</h1>
            <p className="text-[11px] text-[var(--tx3)] mt-1 font-mono">{job.jobId}</p>
          </div>
          {isCompleted && (
            <div className="px-3 py-1.5 rounded-xl bg-[#22C55E]/12 border border-[#22C55E]/30">
              <span className="text-[11px] font-bold text-[#22C55E]">Complete</span>
            </div>
          )}
        </div>

        {/* Compact route display */}
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2.5">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] bg-[var(--gold)]/20" />
              <div className="w-px h-4 bg-[var(--brd)]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Pickup</p>
              <p className="text-[13px] text-[var(--tx)] truncate">{job.fromAddress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-3 h-3 rounded-full border-2 border-[#22C55E] bg-[#22C55E]/20" />
            <div className="min-w-0 flex-1">
              <p className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Drop-off</p>
              <p className="text-[13px] text-[var(--tx)] truncate">{job.toAddress}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[var(--bg)] rounded-xl p-1 border border-[var(--brd)] mb-4">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-2.5 rounded-lg text-[11px] font-semibold transition-all ${
              activeTab === t.id
                ? "bg-[var(--card)] text-[var(--gold)] shadow-sm border border-[var(--brd)]"
                : "text-[var(--tx3)] hover:text-[var(--tx2)] border border-transparent"
            }`}
          >
            <span className={activeTab === t.id ? "text-[var(--gold)]" : "text-[var(--tx3)]"}>{t.icon}</span>
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {activeTab === "status" && (
        <div className="space-y-4">
          {/* Progress bar */}
          <div className="pt-4 pb-4 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0">
            <StageProgressBar
              stages={
                jobType === "move"
                  ? [{ label: "En Route" }, { label: "Loading" }, { label: "Unloading" }, { label: "Complete" }]
                  : [{ label: "En Route" }, { label: "Arrived" }, { label: "Delivering" }, { label: "Complete" }]
              }
              currentIndex={
                isCompleted
                  ? 3
                  : progressIdx >= 0
                    ? jobType === "move"
                      ? progressIdx <= 0 ? 0 : progressIdx <= 2 ? 1 : progressIdx <= 5 ? 2 : 3
                      : Math.min(progressIdx, 3)
                    : -1
              }
              variant="dark"
            />
          </div>

          {/* Main action */}
          <div>
            {showStartButton && (
              <button
                onClick={startJob}
                disabled={advancing}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                {advancing ? "Starting..." : "START JOB"}
              </button>
            )}
            {showAdvanceButton && (
              <>
                {session?.isActive && (
                  <JobPhotos
                    jobId={id}
                    jobType={jobType}
                    sessionId={session?.id ?? null}
                    currentStatus={currentStatus}
                    onCanAdvanceFromArrivedChange={setCanAdvanceFromArrived}
                  />
                )}
                {currentStatus === "arrived_at_pickup" && !pickupVerificationDone && (
                  <button
                    onClick={() => setPickupModalOpen(true)}
                    className="w-full mt-3 py-4 rounded-2xl font-bold text-[14px] text-white bg-blue-600 hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Verify Inventory & Take Photos
                  </button>
                )}
                <button
                  onClick={advanceStatus}
                  disabled={advancing || blockedByPhotos || blockedByPickupVerification}
                  className="w-full mt-3 py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50 transition-all shadow-lg"
                  style={{
                    background: blockedByPhotos || blockedByPickupVerification
                      ? "var(--brd)"
                      : "linear-gradient(135deg, #C9A962, #8B7332)",
                    color: blockedByPhotos || blockedByPickupVerification ? "var(--tx3)" : "white",
                  }}
                >
                  {advancing
                    ? "Updating..."
                    : blockedByPickupVerification
                      ? "Complete verification first"
                      : blockedByPhotos
                        ? "Take photo to continue"
                        : nextStatus === "completed"
                          ? "Complete & Get Client Sign-Off"
                          : getStatusLabel(nextStatus!)}
                </button>
              </>
            )}
            {isCompleted && (
              <div className="w-full py-4 rounded-2xl font-bold text-[15px] text-[#22C55E] text-center bg-[#22C55E]/10 border border-[#22C55E]/25">
                <div className="flex items-center justify-center gap-2">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Job Complete
                </div>
              </div>
            )}
          </div>

          {/* Note input */}
          {showAdvanceButton && (
            <input
              ref={noteInputRef}
              type="text"
              placeholder="Add a note..."
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-3 rounded-2xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none transition-colors"
            />
          )}

          {/* Timeline */}
          <div className="pt-6 pb-5 border-t border-[var(--brd)]/30">
            <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-5">Timeline</h2>
            <div className="relative pl-7 before:content-[''] before:absolute before:left-[7px] before:top-1 before:bottom-1 before:w-0.5 before:bg-[var(--brd)]">
              {statusFlow.map((s, i) => {
                const cp = session?.checkpoints?.find((c) => c.status === s);
                const isCurrent = currentStatus === s;
                const idx = statusFlow.indexOf(currentStatus as any);
                const isPast = idx > i || (idx === i && isCompleted);
                const isLastStep = s === statusFlow[statusFlow.length - 1];
                const state = isPast ? "done" : isCurrent ? "act" : "wait";
                return (
                  <div key={s} className="relative pb-5 last:pb-0">
                    <div
                      className={`absolute -left-[20px] top-0.5 rounded-full border-2 border-[var(--card)] z-10 transition-all ${
                        state === "done" && isLastStep
                          ? "w-5 h-5 -left-[23px] bg-[#22C55E]"
                          : state === "done"
                            ? "w-3.5 h-3.5 -left-[20px] bg-[#22C55E]"
                            : state === "act"
                              ? "w-4 h-4 -left-[21px] bg-[var(--gold)] shadow-[0_0_0_4px_rgba(201,169,98,0.2)]"
                              : "w-3 h-3 -left-[19px] bg-[var(--brd)]"
                      }`}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <div className={`text-[13px] font-semibold transition-colors ${state === "done" ? "text-[#22C55E]" : state === "act" ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}>
                        {getStatusLabel(s)}
                      </div>
                      {cp?.timestamp && (
                        <span className="text-[10px] text-[var(--tx3)] tabular-nums font-medium">
                          {formatTime(cp.timestamp, { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                    </div>
                    {cp?.note && (
                      <p className="text-[11px] text-[var(--tx3)] mt-0.5 italic">{cp.note}</p>
                    )}
                    {state === "act" && !cp?.timestamp && (
                      <span className="text-[10px] text-[var(--gold)] font-medium">In progress</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick actions */}
          {!isCompleted && (
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => noteInputRef.current?.focus()}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-[var(--brd)] bg-[var(--card)] text-[11px] font-medium text-[var(--tx2)] hover:border-[var(--gold)]/50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Note
              </button>
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-[#F59E0B]/30 bg-[var(--card)] text-[11px] font-medium text-[#F59E0B] hover:border-[#F59E0B]/60 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Issue
              </button>
              <a
                href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                className="flex flex-col items-center gap-1.5 py-3 rounded-2xl border border-[var(--brd)] bg-[var(--card)] text-[11px] font-medium text-[var(--tx)] hover:border-[var(--gold)]/50 transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Dispatch
              </a>
            </div>
          )}

          {/* Dispatch notes */}
          {job.internalNotes && (
            <div className="pt-6 pb-4 border-t border-[var(--brd)]/30">
              <h2 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Dispatch Notes</h2>
              <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap leading-relaxed">{job.internalNotes}</p>
            </div>
          )}

          {/* Sign-off CTA */}
          {["unloading", "delivering"].includes(currentStatus) && !isCompleted && (
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}/signoff`}
              className="flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[14px] text-white transition-all shadow-lg"
              style={{ background: "linear-gradient(135deg, #22C55E, #16A34A)" }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="M9 12l2 2 4-4"/></svg>
              Client Sign-Off
            </Link>
          )}
        </div>
      )}

      {activeTab === "details" && (
        <div className="space-y-0">
          {(job.scheduledDate || job.arrivalWindow) && (
            <div className="pt-6 pb-4 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0">
              <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Schedule</h3>
              {job.scheduledDate && (
                <p className="text-[14px] font-semibold text-[var(--tx)]">
                  {formatDate(job.scheduledDate + "T12:00:00", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              {job.arrivalWindow && <p className="text-[12px] text-[var(--tx3)] mt-1">Window: {job.arrivalWindow}</p>}
              {job.scheduledTime && <p className="text-[12px] text-[var(--tx3)] mt-0.5">Time: {job.scheduledTime}</p>}
            </div>
          )}
          <div className="pt-6 pb-4 border-t border-[var(--brd)]/30 first:border-t-0 first:pt-0">
            <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Pickup</h3>
            <p className="text-[14px] font-semibold text-[var(--tx)]">{job.fromAddress}</p>
            {job.fromAccess && <p className="text-[12px] text-[var(--tx3)] mt-1.5">Access: {job.fromAccess}</p>}
          </div>
          <div className="pt-6 pb-4 border-t border-[var(--brd)]/30">
            <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Drop-off</h3>
            <p className="text-[14px] font-semibold text-[var(--tx)]">{job.toAddress}</p>
            {job.toAccess && <p className="text-[12px] text-[var(--tx3)] mt-1.5">Access: {job.toAccess}</p>}
          </div>
          {job.accessNotes && (
            <div className="pt-6 pb-4 border-t border-[var(--brd)]/30">
              <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Access notes</h3>
              <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap leading-relaxed">{job.accessNotes}</p>
            </div>
          )}
          {job.crewMembers && job.crewMembers.length > 0 && (
            <div className="pt-6 pb-4 border-t border-[var(--brd)]/30">
              <h3 className="text-[9px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-3">Crew ({job.crewMembers.length})</h3>
              <div className="space-y-2">
                {job.crewMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[var(--gold)]/15 text-[var(--gold)]">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[13px] font-medium text-[var(--tx)]">{m.name}</span>
                      <span className="text-[11px] text-[var(--tx3)] ml-2">{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "items" && hasInventory && (
        <div className="mt-1">
          <JobInventory
            jobId={id}
            jobType={jobType}
            moveType={job.moveType}
            inventory={job.inventory || []}
            extraItems={job.extraItems || []}
            currentStatus={currentStatus}
            onRefresh={fetchJob}
            onCountChange={(v, t) => { setItemsVerified(v); setItemsTotal(t); }}
            readOnly={isCompleted}
          />
        </div>
      )}

      {activeTab === "items" && !hasInventory && (
        <div className="mt-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          </div>
          <p className="text-[13px] text-[var(--tx3)]">No inventory for this job</p>
        </div>
      )}

      {activeTab === "photos" && (
        <div className="mt-1">
          {session?.isActive || isCompleted ? (
            <JobPhotos
              jobId={id}
              jobType={jobType}
              sessionId={session?.id ?? null}
              currentStatus={currentStatus}
              onCanAdvanceFromArrivedChange={setCanAdvanceFromArrived}
              readOnly={isCompleted}
            />
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-2xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold)" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
              </div>
              <p className="text-[13px] text-[var(--tx3)]">Start the job to capture photos</p>
            </div>
          )}
        </div>
      )}

      {/* Pickup Verification Modal */}
      {pickupModalOpen && job && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 z-10">
              <h3 className="font-hero text-[18px] font-bold text-[var(--tx)]">
                Pickup Verification
              </h3>
              <p className="text-[12px] text-[var(--tx3)] mt-1">
                Verify all items with the client and take photos before loading.
              </p>
            </div>

            <div className="px-5 py-4 space-y-5">
              <div>
                <h4 className="font-hero text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--gold)] mb-3">
                  Step 1 — Verify Inventory
                </h4>
                <JobInventory
                  jobId={id}
                  jobType={jobType}
                  moveType={job.moveType}
                  inventory={job.inventory || []}
                  extraItems={job.extraItems || []}
                  currentStatus={currentStatus}
                  onRefresh={fetchJob}
                  onCountChange={(v, t) => {
                    setItemsVerified(v);
                    setItemsTotal(t);
                  }}
                />
              </div>

              <div>
                <h4 className="font-hero text-[11px] font-bold uppercase tracking-[1.5px] text-[var(--gold)] mb-3">
                  Step 2 — Document Condition
                </h4>
                <p className="text-[12px] text-[var(--tx3)] mb-3">
                  Take photos of items and rooms before loading begins.
                </p>
                {session && (
                  <JobPhotos
                    jobId={id}
                    jobType={jobType}
                    sessionId={session.id}
                    currentStatus={currentStatus}
                    onPhotoCountChange={(count) => setPickupPhotosCount(count)}
                    onCanAdvanceFromArrivedChange={setCanAdvanceFromArrived}
                  />
                )}
              </div>
            </div>

            <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-5 py-4 space-y-2">
              <div className="flex items-center justify-between text-[12px] text-[var(--tx3)] mb-1">
                <span>
                  Items: {itemsVerified}/{itemsTotal > 0 ? itemsTotal : totalItems} verified
                </span>
                <span>{pickupPhotosCount} photo{pickupPhotosCount !== 1 ? "s" : ""} taken</span>
              </div>
              <button
                onClick={() => {
                  setPickupVerificationDone(true);
                  setPickupModalOpen(false);
                }}
                disabled={pickupPhotosCount < 1 && (itemsTotal > 0 || totalItems > 0)}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                {pickupPhotosCount < 1 && (itemsTotal > 0 || totalItems > 0)
                  ? "Take at least 1 photo to continue"
                  : "Complete Verification"}
              </button>
              {(itemsTotal === 0 && totalItems === 0) && (
                <p className="text-[11px] text-[var(--tx3)] text-center">No items to verify — take a photo of the space or complete to continue.</p>
              )}
              <button
                type="button"
                onClick={() => setPickupModalOpen(false)}
                className="w-full py-2.5 rounded-xl text-[13px] font-medium text-[var(--tx3)] hover:text-[var(--tx2)] transition-colors"
              >
                Minimize
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-5 max-w-[360px] w-full shadow-2xl">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-2">Report Issue</h3>
            {reportSubmitted ? (
              <div className="py-4">
                <div className="w-10 h-10 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                </div>
                <p className="text-[13px] text-[#22C55E] text-center mb-4">Issue reported. Dispatch notified.</p>
                <button
                  onClick={() => { setReportModalOpen(false); setReportSubmitted(false); setReportDesc(""); }}
                  className="w-full py-2.5 rounded-xl text-white font-semibold"
                  style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">Issue type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
                  >
                    <option value="damage">Damage</option>
                    <option value="delay">Delay</option>
                    <option value="missing_item">Missing item</option>
                    <option value="access_problem">Access problem</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">Description</label>
                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Describe what happened..."
                    rows={3}
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none resize-none"
                  />
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 py-2.5 rounded-xl border border-[var(--brd)] text-[var(--tx2)] text-[13px] font-medium hover:bg-[var(--bg)] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setReportSubmitting(true);
                      try {
                        const r = await fetch("/api/crew/incident", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            jobId: job.id,
                            jobType,
                            sessionId: session?.id,
                            issueType: reportType,
                            description: reportDesc.trim() || undefined,
                          }),
                        });
                        if (!r.ok) throw new Error("Failed");
                        setReportSubmitted(true);
                      } catch {
                        setReportSubmitting(false);
                      }
                    }}
                    disabled={reportSubmitting}
                    className="flex-1 py-2.5 rounded-xl bg-[#F59E0B] text-white font-semibold disabled:opacity-50 transition-colors"
                  >
                    {reportSubmitting ? "Sending..." : "Submit"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </PageContent>
  );
}

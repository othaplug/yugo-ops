"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
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

  // Pickup verification modal
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
    const interval = setInterval(fetchSession, 15000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  // Auto-open pickup verification modal if crew is at arrived_at_pickup and hasn't completed verification
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
      // Open pickup verification modal when arriving at pickup
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

  const watchIdRef = { current: null as number | null };
  const lastSentRef = { current: 0 };
  const SEND_INTERVAL = 15000; // 15s — send location every 10–30s while job is active

  const stopGpsTracking = () => {
    if (watchIdRef.current != null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  };

  // GPS always on while on job page — with or without active session, so team location stays visible on tracking page
  useEffect(() => {
    if (!("geolocation" in navigator)) {
      setGpsStatus("unavailable");
      return;
    }
    setGpsStatus("on");
    const sessionId = session?.isActive && session?.id ? session.id : undefined;
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSentRef.current < SEND_INTERVAL) return;
        lastSentRef.current = now;
        const body: Record<string, unknown> = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: new Date().toISOString(),
        };
        if (sessionId) body.sessionId = sessionId;
        fetch("/api/tracking/location", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }).catch(() => {});
      },
      () => setGpsStatus("unavailable"),
      { enableHighAccuracy: true, maximumAge: 15000, timeout: 20000 }
    );
    return () => stopGpsTracking();
  }, [session?.id, session?.isActive]);

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
          <p className="text-[14px] text-[var(--tx3)]">Loading…</p>
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
            className="inline-flex items-center gap-2 py-2.5 px-3 rounded-lg text-[13px] font-medium text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors"
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
  const tabs: { id: TabId; label: string }[] = [
    { id: "status", label: "Status" },
    { id: "details", label: "Details" },
    { id: "items", label: itemsLabel },
    { id: "photos", label: "Photos" },
  ];

  const hasInventory = (job.inventory?.length ?? 0) > 0 || (job.extraItems?.length ?? 0) > 0 || (jobType === "move" && job.moveType === "residential" && (job.inventory?.length ?? 0) === 0);

  return (
    <PageContent className="max-w-[520px]">
      <Link
        href="/crew/dashboard"
        className="inline-flex items-center gap-2 py-2.5 px-3 -ml-3 rounded-lg text-[13px] font-medium text-[var(--tx2)] hover:text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors border border-transparent hover:border-[var(--gold)]/30"
      >
        <span aria-hidden className="text-[16px] leading-none">←</span>
        Back to Jobs
      </Link>

      <div className="flex items-start justify-between gap-3 mt-2">
        <div>
          <h1 className="font-hero text-[20px] font-bold text-[var(--tx)]">{job.clientName}</h1>
          <p className="text-[12px] text-[var(--tx3)] mt-0.5">
            {job.jobId} · {job.jobTypeLabel}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {(session?.isActive || isCompleted) && (
            <span className="text-[11px] text-[var(--tx3)] tabular-nums">
              {formatElapsed(isCompleted && session?.completedAt && session?.startedAt ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime() : elapsedMs)}
            </span>
          )}
          {session && !isCompleted && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${gpsStatus === "on" ? "bg-[var(--grn)]/15 text-[var(--grn)]" : "bg-[var(--brd)]/50 text-[var(--tx3)]"}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${gpsStatus === "on" ? "bg-[var(--grn)]" : "bg-[var(--tx3)]"}`} />
              GPS {gpsStatus === "on" ? "ON" : gpsStatus === "unavailable" ? "Unavailable" : "OFF"}
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-1 mt-4 border-b border-[var(--brd)]">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`px-3 py-2.5 text-[12px] font-medium transition-colors border-b-2 -mb-px ${
              activeTab === t.id
                ? "border-[var(--gold)] text-[var(--gold)]"
                : "border-transparent text-[var(--tx3)] hover:text-[var(--tx2)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === "status" && (
        <div className="mt-4 space-y-4">
          {/* Job progress bar - stage labels, purple line, starts when en route */}
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
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

          <div>
            {showStartButton && (
              <button
                onClick={startJob}
                disabled={advancing}
                className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
              >
                {advancing ? "Starting…" : "START JOB"}
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
                    className="w-full mt-3 py-4 rounded-xl font-semibold text-[15px] text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Verify Inventory & Take Photos
                  </button>
                )}
                <button
                  onClick={advanceStatus}
                  disabled={advancing || blockedByPhotos || blockedByPickupVerification}
                  className="w-full mt-3 py-4 rounded-xl font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
                >
                  {advancing
                    ? "Updating…"
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
              <div className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--grn)] text-center bg-[rgba(45,159,90,0.15)]">
                Job complete
              </div>
            )}
          </div>

          {showAdvanceButton && (
            <input
              ref={noteInputRef}
              type="text"
              placeholder="Add note (optional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
            />
          )}

          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-5 shadow-sm">
            <h2 className="font-hero text-[14px] font-bold text-[var(--tx)] mb-4">Move Timeline</h2>
            <div className="relative pl-7 before:content-[''] before:absolute before:left-2 before:top-0 before:bottom-0 before:w-0.5 before:bg-[var(--brd)] before:transition-colors before:duration-500">
              {statusFlow.map((s, i) => {
                const cp = session?.checkpoints?.find((c) => c.status === s);
                const isCurrent = currentStatus === s;
                const idx = statusFlow.indexOf(currentStatus as any);
                const isPast = idx > i || (idx === i && isCompleted);
                const isLastStep = s === statusFlow[statusFlow.length - 1];
                const state = isPast ? "done" : isCurrent ? "act" : "wait";
                return (
                  <div
                    key={s}
                    className="relative pb-5 last:pb-0 group cursor-default transition-colors duration-200"
                  >
                    <div
                      className={`absolute -left-[19px] top-0.5 rounded-full border-2 border-[var(--card)] z-10 transition-all duration-300 ease-out client-timeline-dot ${
                        state === "done" && isLastStep
                          ? "w-5 h-5 -left-6 bg-[#22C55E] shadow-[0_0_0_0_4px_rgba(34,197,94,0.25)] client-timeline-dot-completed"
                          : state === "done"
                            ? "w-3.5 h-3.5 -left-5 bg-[#22C55E] group-hover:scale-110"
                            : state === "act"
                              ? "w-3.5 h-3.5 -left-5 bg-[#F59E0B] shadow-[0_0_0_4px_rgba(245,158,11,0.2)] group-hover:shadow-[0_0_0_6px_rgba(245,158,11,0.3)]"
                              : "w-3 h-3 bg-[var(--brd)]/80 group-hover:bg-[var(--brd)]"
                      }`}
                    />
                    <div className={`text-[13px] font-semibold transition-colors duration-300 ${state === "done" ? "text-[#22C55E]" : state === "act" ? "text-[#F59E0B]" : "text-[var(--tx3)]"}`}>
                      {getStatusLabel(s)}
                    </div>
                    <div className="text-[11px] text-[var(--tx3)] mt-0.5 flex items-center justify-between gap-2">
                      {cp?.timestamp ? (
                        <span className="tabular-nums">{new Date(cp.timestamp).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</span>
                      ) : (
                        <span>{state === "done" ? "Done" : state === "act" ? "In progress" : "Upcoming"}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {!isCompleted && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => noteInputRef.current?.focus()}
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-dashed border-[var(--brd)] text-[12px] font-medium text-[var(--tx2)] hover:border-[var(--gold)]/50 transition-colors"
              >
                Note
              </button>
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-dashed border-[#D48A29]/50 text-[12px] font-medium text-[#D48A29] hover:border-[#D48A29] transition-colors"
              >
                Issue
              </button>
              <a
                href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                className="flex-1 flex items-center justify-center py-2.5 rounded-xl border border-[var(--brd)] text-[12px] font-medium text-[var(--tx)] bg-[var(--card)] hover:border-[var(--gold)]/50 transition-colors"
              >
                Call
              </a>
            </div>
          )}

          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
            <h2 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--gold)] mb-2">Dispatch Notes</h2>
            <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap">{job.internalNotes || "No dispatch notes for this job."}</p>
          </div>

          {["unloading", "delivering"].includes(currentStatus) && !isCompleted && (
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}/signoff`}
              className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-semibold text-[14px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[var(--gold2)] transition-colors"
            >
              Client Sign-Off
            </Link>
          )}
        </div>
      )}

      {activeTab === "details" && (
        <div className="mt-4 space-y-4">
          {(job.scheduledDate || job.arrivalWindow) && (
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
              <h3 className="font-hero text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Schedule</h3>
              {job.scheduledDate && (
                <p className="text-[14px] font-semibold text-[var(--tx)]">
                  {new Date(job.scheduledDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              {job.arrivalWindow && <p className="text-[12px] text-[var(--tx3)] mt-1">Window: {job.arrivalWindow}</p>}
              {job.scheduledTime && <p className="text-[12px] text-[var(--tx3)] mt-0.5">Time: {job.scheduledTime}</p>}
            </div>
          )}
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
            <h3 className="font-hero text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Pickup</h3>
            <p className="text-[14px] font-semibold text-[var(--tx)]">{job.fromAddress}</p>
            {job.fromAccess && <p className="text-[12px] text-[var(--tx3)] mt-1">Access: {job.fromAccess}</p>}
          </div>
          <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
            <h3 className="font-hero text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Drop-off</h3>
            <p className="text-[14px] font-semibold text-[var(--tx)]">{job.toAddress}</p>
            {job.toAccess && <p className="text-[12px] text-[var(--tx3)] mt-1">Access: {job.toAccess}</p>}
          </div>
          {job.accessNotes && (
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
              <h3 className="font-hero text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Access notes</h3>
              <p className="text-[13px] text-[var(--tx2)] whitespace-pre-wrap">{job.accessNotes}</p>
            </div>
          )}
          {job.crewMembers && job.crewMembers.length > 0 && (
            <div className="rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4">
              <h3 className="font-hero text-[10px] font-bold uppercase tracking-wider text-[var(--tx3)] mb-2">Crew ({job.crewMembers.length})</h3>
              <div className="space-y-1.5">
                {job.crewMembers.map((m, i) => (
                  <div key={i} className="text-[13px] text-[var(--tx)]">
                    {m.name} — {m.role}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "items" && hasInventory && (
        <div className="mt-4">
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
        <div className="mt-6 text-center text-[13px] text-[var(--tx3)]">No inventory for this job.</div>
      )}

      {activeTab === "photos" && (
        <div className="mt-4">
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
            <div className="text-center py-8 text-[13px] text-[var(--tx3)]">
              Start the job to capture photos.
            </div>
          )}
        </div>
      )}

      {/* ── Pickup Verification Modal ── */}
      {pickupModalOpen && job && (
        <div className="fixed inset-0 bg-black/80 flex items-end sm:items-center justify-center z-50 animate-fade-in">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-xl w-full max-w-[480px] max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 z-10">
              <h3 className="font-hero text-[18px] font-bold text-[var(--tx)]">
                Pickup Verification
              </h3>
              <p className="text-[12px] text-[var(--tx3)] mt-1">
                Verify all items with the client and take photos before loading.
              </p>
            </div>

            <div className="px-5 py-4 space-y-5">
              {/* Inventory verification section */}
              <div>
                <h4 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--gold)] mb-3">
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

              {/* Photo section */}
              <div>
                <h4 className="font-hero text-[11px] font-bold uppercase tracking-wider text-[var(--gold)] mb-3">
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

            {/* Footer */}
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
                className="w-full py-4 rounded-xl font-semibold text-[15px] text-[var(--btn-text-on-accent)] bg-[var(--gold)] hover:bg-[var(--gold2)] disabled:opacity-50 transition-colors"
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
                Minimize (come back later)
              </button>
            </div>
          </div>
        </div>
      )}

      {reportModalOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl p-5 max-w-[340px] w-full">
            <h3 className="font-hero text-[16px] font-bold text-[var(--tx)] mb-2">Report Issue</h3>
            {reportSubmitted ? (
              <div className="py-4">
                <p className="text-[13px] text-[var(--grn)] mb-4">Issue reported. Dispatch will be notified.</p>
                <button
                  onClick={() => { setReportModalOpen(false); setReportSubmitted(false); setReportDesc(""); }}
                  className="w-full py-2.5 rounded-lg bg-[var(--gold)] text-[var(--btn-text-on-accent)] font-semibold hover:bg-[var(--gold2)]"
                >
                  Done
                </button>
              </div>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Issue type</label>
                  <select
                    value={reportType}
                    onChange={(e) => setReportType(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--gold)] outline-none"
                  >
                    <option value="damage">Damage</option>
                    <option value="delay">Delay</option>
                    <option value="missing_item">Missing item</option>
                    <option value="access_problem">Access problem</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-[10px] font-semibold text-[var(--tx3)] mb-1">Description (optional)</label>
                  <textarea
                    value={reportDesc}
                    onChange={(e) => setReportDesc(e.target.value)}
                    placeholder="Describe what happened..."
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--gold)] outline-none"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    onClick={() => setReportModalOpen(false)}
                    className="flex-1 py-2.5 rounded-lg border border-[var(--brd)] text-[var(--tx)] text-[13px] hover:bg-[var(--card)]"
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
                    className="flex-1 py-2.5 rounded-lg bg-[#D48A29] text-[var(--btn-text-on-accent)] font-semibold disabled:opacity-50"
                  >
                    {reportSubmitting ? "Sending…" : "Submit"}
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

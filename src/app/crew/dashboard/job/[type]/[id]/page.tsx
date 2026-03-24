"use client";

import { use, useState, useEffect, useCallback, useRef } from "react";
import { CaretLeft, CheckCircle, FileText, ClipboardText, Image, Clock, Lock, PencilSimple, Warning, Phone, Check, Clipboard } from "@phosphor-icons/react";
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
import { formatAccessForDisplay } from "@/lib/format-text";
import PageContent from "@/app/admin/components/PageContent";
import StageProgressBar from "@/components/StageProgressBar";
import JobPhotos from "./JobPhotos";
import JobInventory from "./JobInventory";
import DayRateStopFlow from "./DayRateStopFlow";
import WalkthroughModal from "./WalkthroughModal";

const DISPATCH_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";

type TabId = "status" | "details" | "items" | "photos";

interface CrewMember {
  name: string;
  role: string;
}

interface ProjectContext {
  projectNumber: string;
  projectName: string;
  phaseName: string | null;
}

interface DeliveryStop {
  id: string;
  stop_number: number;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  client_phone: string | null;
  items_description: string | null;
  special_instructions: string | null;
  notes: string | null;
  stop_status: string;
  stop_type: string;
  arrived_at: string | null;
  completed_at: string | null;
}

interface JobDetail {
  id: string;
  jobId: string;
  jobType: "move" | "delivery";
  bookingType?: string | null;
  stopsCompleted?: number;
  moveType?: string;
  status?: string;
  stops?: DeliveryStop[];
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
  projectContext?: ProjectContext | null;
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

  // Inventory walkthrough
  const [walkthroughModalOpen, setWalkthroughModalOpen] = useState(false);
  const [walkthroughDone, setWalkthroughDone] = useState(false);
  const [walkthroughSkipped, setWalkthroughSkipped] = useState(false);
  const [walkthroughResult, setWalkthroughResult] = useState<{
    itemsMatched: number;
    itemsMissing: number;
    itemsExtra: number;
    netDelta: number;
    changeRequestId: string | null;
    noChanges: boolean;
  } | null>(null);
  const [changeRequestSubmitted, setChangeRequestSubmitted] = useState(false);

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
      !walkthroughDone &&
      !walkthroughSkipped &&
      !loading &&
      session?.isActive
    ) {
      setWalkthroughModalOpen(true);
    }
  }, [currentStatus, walkthroughDone, walkthroughSkipped, loading, session?.isActive]);

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
        setWalkthroughModalOpen(true);
        setWalkthroughDone(false);
        setWalkthroughSkipped(false);
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
          <p className="text-[var(--text-base)] text-[var(--red)] mb-4">{error || "Job not found"}</p>
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

  // Day rate with stops — render dedicated multi-stop flow
  const isDayRate = job.bookingType === "day_rate" && job.stops && job.stops.length > 0;
  if (isDayRate) {
    return (
      <PageContent className="max-w-[520px]">
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-lg text-[12px] font-medium text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors"
          >
            <CaretLeft size={15} weight="regular" />
            Jobs
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full" style={{ background: "#0D948820", color: "#0D9488" }}>
            Day Rate
          </span>
        </div>
        <DayRateStopFlow
          stops={job.stops!}
          delivery={{ id: job.id, bookingType: job.bookingType ?? null, stopsCompleted: job.stopsCompleted ?? 0, totalStops: job.stops!.length, clientName: job.clientName, deliveryNumber: job.jobId }}
          partnerName={job.clientName}
          vehicleType={null}
          onStopUpdated={() => { fetchJob(); }}
        />
      </PageContent>
    );
  }

  const jobCompleted = ["completed", "delivered", "done"].includes((job.status || "").toLowerCase());
  const showStartButton = !session && !jobCompleted;
  const atArrivedRequiringPhotos = ["arrived_at_destination", "arrived"].includes(currentStatus);
  const blockedByPhotos = atArrivedRequiringPhotos && !canAdvanceFromArrived;
  // Walkthrough must be done (or skipped) before loading can start
  const blockedByWalkthrough = currentStatus === "arrived_at_pickup" && !walkthroughDone && !walkthroughSkipped;
  const showAdvanceButton = session?.isActive && nextStatus && !showStartButton;

  const itemsLabel = itemsTotal > 0 ? `Items (${itemsVerified}/${itemsTotal})` : `Items (${totalItems})`;
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "status", label: "Status", icon: <CheckCircle size={14} /> },
    { id: "details", label: "Details", icon: <FileText size={14} /> },
    { id: "items", label: itemsLabel, icon: <ClipboardText size={14} /> },
    { id: "photos", label: "Photos", icon: <Image size={14} /> },
  ];

  const hasInventory = (job.inventory?.length ?? 0) > 0 || (job.extraItems?.length ?? 0) > 0 || (jobType === "move" && job.moveType === "residential" && (job.inventory?.length ?? 0) === 0);

  return (
    <PageContent className="max-w-[520px]">

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-2 mb-5">
        <Link
          href="/crew/dashboard"
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-lg text-[12px] font-medium text-[var(--tx3)] hover:text-[var(--gold)] hover:bg-[var(--gdim)] transition-colors"
        >
          <CaretLeft size={15} weight="regular" />
          Jobs
        </Link>
        <div className="flex items-center gap-1.5">
          {(session?.isActive || isCompleted) && (
            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-[var(--bg)] border border-[var(--brd)]">
              <Clock size={11} color="var(--tx3)" />
              <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">
                {formatElapsed(isCompleted && session?.completedAt && session?.startedAt ? new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime() : elapsedMs)}
              </span>
            </div>
          )}
          {session && !isCompleted && (
            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${gpsStatus === "on" ? "bg-[#22C55E]/10 text-[#22C55E] border border-[#22C55E]/25" : "bg-[var(--bg)] text-[var(--tx3)] border border-[var(--brd)]"}`}>
              <span className="relative flex h-1.5 w-1.5">
                {gpsStatus === "on" && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />}
                <span className={`relative inline-flex rounded-full h-1.5 w-1.5 ${gpsStatus === "on" ? "bg-[#22C55E]" : "bg-[var(--tx3)]"}`} />
              </span>
              GPS
            </span>
          )}
        </div>
      </div>

      {/* ── Job header ── */}
      <div className="mb-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/60 mb-0.5">{job.jobTypeLabel}</p>
            <h1 className="font-hero text-[26px] font-bold text-[var(--tx)] leading-tight truncate">{job.clientName}</h1>
            <p className="text-[10px] text-[var(--tx3)] mt-0.5 font-mono tracking-wide">{job.jobId}</p>
          </div>
          {isCompleted && (
            <span className="shrink-0 px-2.5 py-1 rounded-lg bg-[#22C55E]/12 border border-[#22C55E]/30 text-[10px] font-bold text-[#22C55E]">Complete</span>
          )}
        </div>
        <div className="border-t border-[var(--brd)]/50 pt-3">
          <div className="flex gap-3">
            {/* Dot + connector column */}
            <div className="flex flex-col items-center shrink-0 pt-1">
              {/* Pickup dot, outlined ring with gold inner */}
              <div className="w-4 h-4 rounded-full border-2 border-[var(--gold)]/60 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--gold)]" />
              </div>
              {/* Connector line */}
              <div className="w-[2px] flex-1 my-1 rounded-full" style={{ background: "rgba(255,255,255,0.1)", minHeight: 20 }} />
              {/* Drop-off dot, solid green */}
              <div className="w-4 h-4 rounded-full border-2 border-[#22C55E]/60 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#22C55E]" />
              </div>
            </div>

            {/* Address column */}
            <div className="flex flex-col justify-between min-w-0 flex-1 gap-3">
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--tx3)]/50 mb-0.5">Pickup</p>
                <p className="text-[var(--text-base)] text-[var(--tx)] leading-snug">{job.fromAddress}</p>
                {job.fromAccess && (
                  <p className="text-[10px] text-[var(--gold)]/80 mt-0.5 flex items-center gap-1">
                    <Lock size={9} />
                    {job.fromAccess}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[9px] font-semibold tracking-[0.12em] uppercase text-[var(--tx3)]/50 mb-0.5">Drop-off</p>
                <p className="text-[var(--text-base)] text-[var(--tx)] leading-snug">{job.toAddress}</p>
                {job.toAccess && (
                  <p className="text-[10px] text-[var(--gold)]/80 mt-0.5 flex items-center gap-1">
                    <Lock size={9} />
                    {job.toAccess}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex justify-center border-b border-[var(--brd)]/40 mb-5">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={`relative flex-1 px-3 py-3.5 text-[11px] font-bold tracking-[0.10em] uppercase transition-colors duration-150 whitespace-nowrap touch-manipulation ${
              activeTab === t.id
                ? "text-[var(--gold)]"
                : "text-[var(--tx3)]/45 hover:text-[var(--tx3)]"
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-[1.5px] rounded-full bg-[var(--gold)]" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ STATUS TAB ══════════════ */}
      {activeTab === "status" && (
        <div className="space-y-3">

          {/* Progress */}
          <div className="px-2">
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
                      : progressIdx <= 0 ? 0 : progressIdx <= 1 ? 1 : progressIdx <= 3 ? 2 : 3
                    : -1
              }
              variant="dark"
            />
          </div>

          {/* Walkthrough gate, shown when at pickup and walkthrough not done */}
          {currentStatus === "arrived_at_pickup" && blockedByWalkthrough && (
            <div className="rounded-2xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 p-4 space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center shrink-0">
                  <Clipboard size={16} color="var(--gold)" />
                </div>
                <div>
                  <p className="text-[12px] font-bold text-[var(--tx)]">Inventory Walkthrough Required</p>
                  <p className="text-[11px] text-[var(--tx3)]">Complete before loading starts</p>
                </div>
              </div>
              <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
                Walk through with the client and verify the inventory matches the quote.
                Flag missing items and add any extras.
              </p>
              <button
                onClick={() => setWalkthroughModalOpen(true)}
                className="w-full py-3 rounded-xl font-bold text-[13px] text-white"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                Start Inventory Check
              </button>
            </div>
          )}

          {/* Change request submitted banner */}
          {changeRequestSubmitted && walkthroughResult && !walkthroughResult.noChanges && (
            <div className="rounded-2xl border border-[#22C55E]/25 bg-[#22C55E]/5 px-4 py-3 flex items-start gap-2.5">
              <CheckCircle size={16} color="#22C55E" className="shrink-0 mt-0.5" />
              <div>
                <p className="text-[12px] font-bold text-[#22C55E]">Change request submitted</p>
                <p className="text-[11px] text-[#22C55E]/70 mt-0.5">
                  {walkthroughResult.itemsExtra > 0 && `${walkthroughResult.itemsExtra} extra item${walkthroughResult.itemsExtra !== 1 ? "s" : ""}. `}
                  {walkthroughResult.itemsMissing > 0 && `${walkthroughResult.itemsMissing} missing. `}
                  Net {walkthroughResult.netDelta >= 0 ? "+" : ""}${walkthroughResult.netDelta}. Client notified.
                </p>
              </div>
            </div>
          )}

          {/* Advance status / Client Sign-Off button */}
          {showAdvanceButton && !blockedByPhotos && !blockedByWalkthrough && (
            nextStatus === "completed" ? (
              <Link
                href={`/crew/dashboard/job/${jobType}/${id}/signoff`}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-[13px] text-white transition-all border border-[var(--gold)]/20 active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                <CheckCircle size={14} />
                Client Sign-Off
              </Link>
            ) : (
              <button
                type="button"
                onClick={advanceStatus}
                disabled={advancing}
                className="w-full py-2.5 rounded-xl font-semibold text-[13px] text-white disabled:opacity-60 transition-all border border-[var(--gold)]/20 active:scale-[0.99]"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                {advancing ? "Updating…" : getStatusLabel(nextStatus!)}
              </button>
            )
          )}
          {showAdvanceButton && blockedByPhotos && (
            <p className="text-center text-[11px] text-[var(--tx3)] py-2">
              Take photos in the Photos tab to advance
            </p>
          )}

          {/* Timeline */}
          <div>
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
              <p className="text-[9px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/50">Timeline</p>
              {session?.startedAt && (
                <span className="text-[9px] text-[var(--tx3)]/50 tabular-nums">
                  Started {formatTime(session.startedAt, { hour: "numeric", minute: "2-digit" })}
                </span>
              )}
            </div>
            {/* Steps */}
            <div className="space-y-0">
              {statusFlow.map((s, i) => {
                const cp = session?.checkpoints?.find((c) => c.status === s);
                const idx = statusFlow.indexOf(currentStatus as any);
                const isPast = idx > i || (idx === i && isCompleted);
                const isCurrent = currentStatus === s && !isCompleted;
                const isLast = i === statusFlow.length - 1;
                const state = isPast ? "done" : isCurrent ? "act" : "wait";

                const prevCp = i > 0 ? session?.checkpoints?.find((c) => c.status === statusFlow[i - 1]) : null;
                const stepTs = cp?.timestamp ?? (isLast && isCompleted ? session?.completedAt ?? null : null);
                const elapsed = stepTs && prevCp?.timestamp
                  ? Math.round((new Date(stepTs).getTime() - new Date(prevCp.timestamp).getTime()) / 60000)
                  : null;

                // Dot styles — Uber-style solid circles
                const DOT = 20;
                const dotBg = state === "done"
                  ? (isLast && isCompleted ? "#22C55E" : "rgba(34,197,94,0.18)")
                  : state === "act"
                  ? "var(--gold)"
                  : "transparent";
                const dotBorder = state === "done"
                  ? (isLast && isCompleted ? "#22C55E" : "rgba(34,197,94,0.5)")
                  : state === "act"
                  ? "var(--gold)"
                  : "rgba(255,255,255,0.12)";
                const dotShadow = state === "act"
                  ? "0 0 0 5px rgba(201,169,98,0.18)"
                  : isLast && isCompleted
                  ? "0 0 0 4px rgba(34,197,94,0.12)"
                  : "none";

                // Connector: gold for active step leading down, green for done, faint for wait
                const connectorColor = state === "done"
                  ? "rgba(34,197,94,0.35)"
                  : state === "act"
                  ? "rgba(201,169,98,0.3)"
                  : "rgba(255,255,255,0.08)";

                return (
                  <div key={s} className="flex gap-3.5">
                    {/* Dot + connector column */}
                    <div className="flex flex-col items-center shrink-0" style={{ width: DOT }}>
                      {/* Dot */}
                      <div
                        className="shrink-0 rounded-full z-10 flex items-center justify-center"
                        style={{
                          width: DOT,
                          height: DOT,
                          background: dotBg,
                          border: `2px solid ${dotBorder}`,
                          boxShadow: dotShadow,
                        }}
                      >
                        {state === "done" && (
                          <span
                            className="rounded-full"
                            style={{
                              width: isLast && isCompleted ? 8 : 7,
                              height: isLast && isCompleted ? 8 : 7,
                              background: isLast && isCompleted ? "rgba(255,255,255,0.9)" : "#22C55E",
                              opacity: isLast && isCompleted ? 1 : 0.9,
                            }}
                          />
                        )}
                        {state === "act" && (
                          <span className="rounded-full animate-pulse" style={{ width: 7, height: 7, background: "rgba(255,255,255,0.85)" }} />
                        )}
                        {state === "wait" && (
                          <span className="rounded-full" style={{ width: 6, height: 6, background: "rgba(255,255,255,0.1)" }} />
                        )}
                      </div>
                      {/* Connector */}
                      {!isLast && (
                        <div
                          style={{
                            width: 2,
                            flex: 1,
                            marginTop: 3,
                            marginBottom: 3,
                            minHeight: 18,
                            background: connectorColor,
                            borderRadius: 1,
                          }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className={`text-[12px] font-semibold leading-tight block ${
                            state === "done" ? "text-[var(--tx)]"
                            : state === "act" ? "text-[var(--gold)]"
                            : "text-[var(--tx3)]/35"
                          }`}>
                            {getStatusLabel(s)}
                          </span>
                          {state === "act" && (
                            <span className="text-[9px] font-bold text-[var(--gold)]/70 uppercase tracking-widest block mt-0.5">Now</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {elapsed !== null && elapsed > 0 && (
                            <span className="text-[9px] text-[var(--tx3)]/40 tabular-nums">{elapsed}m</span>
                          )}
                          {(() => {
                            const ts = cp?.timestamp ?? (isLast && isCompleted ? session?.completedAt ?? null : null);
                            return ts ? (
                              <span className={`text-[10px] tabular-nums font-medium ${state === "done" && isLast ? "text-[#22C55E]" : "text-[var(--tx3)]"}`}>
                                {formatTime(ts, { hour: "numeric", minute: "2-digit" })}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      {cp?.note && (
                        <p className="mt-0.5 text-[10px] text-[var(--tx3)] italic leading-snug">{cp.note}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch notes */}
          {job.internalNotes && (
            <div className="rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/5 p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--gold)]/60 mb-2">Dispatch Notes</p>
              <p className="text-[12px] text-[var(--tx2)] whitespace-pre-wrap leading-relaxed">{job.internalNotes}</p>
            </div>
          )}

          {/* Quick actions */}
          {!isCompleted && (
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => noteInputRef.current?.focus()}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[var(--tx2)] bg-[var(--bg)] hover:bg-[var(--gold)]/10 active:scale-95 transition-all"
              >
                <PencilSimple size={14} />
                Note
              </button>
              <button
                onClick={() => setReportModalOpen(true)}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[#F59E0B] bg-[#F59E0B]/8 hover:bg-[#F59E0B]/15 active:scale-95 transition-all"
              >
                <Warning size={14} />
                Report Issue
              </button>
              <a
                href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                className="flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium text-[var(--tx2)] bg-[var(--bg)] hover:bg-[var(--gold)]/10 active:scale-95 transition-all"
              >
                <Phone size={14} />
                Dispatch
              </a>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DETAILS TAB ══════════════ */}
      {activeTab === "details" && (
        <>
          {/* Project context banner */}
          {job.projectContext && (
            <div className="mx-0 mb-4 px-4 py-3 rounded-2xl border border-[var(--gold)]/20 bg-[var(--gold)]/5">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--gold)]/60 mb-0.5">Part of Project</p>
              <p className="text-[13px] font-semibold text-[var(--tx)]">
                {job.projectContext.projectNumber}, {job.projectContext.projectName}
              </p>
              {job.projectContext.phaseName && (
                <p className="text-[11px] text-[var(--gold)] mt-0.5">{job.projectContext.phaseName}</p>
              )}
            </div>
          )}
          {(job.scheduledDate || job.arrivalWindow) && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-2">Schedule</p>
              {job.scheduledDate && (
                <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">
                  {formatDate(job.scheduledDate + "T12:00:00", { weekday: "long", month: "short", day: "numeric", year: "numeric" })}
                </p>
              )}
              {job.arrivalWindow && <p className="text-[12px] text-[var(--tx3)] mt-1">Window: {job.arrivalWindow}</p>}
              {job.scheduledTime && <p className="text-[12px] text-[var(--tx3)] mt-0.5">Time: {job.scheduledTime}</p>}
            </div>
          )}
          <div className="p-4">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">Pickup</p>
            <p className="text-[13px] font-semibold text-[var(--tx)]">{job.fromAddress}</p>
            {formatAccessForDisplay(job.fromAccess) && <p className="text-[11px] text-[var(--tx3)] mt-1">Access: {formatAccessForDisplay(job.fromAccess)}</p>}
          </div>
          <div className="p-4">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">Drop-off</p>
            <p className="text-[13px] font-semibold text-[var(--tx)]">{job.toAddress}</p>
            {formatAccessForDisplay(job.toAccess) && <p className="text-[11px] text-[var(--tx3)] mt-1">Access: {formatAccessForDisplay(job.toAccess)}</p>}
          </div>
          {job.accessNotes && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">Access Notes</p>
              <p className="text-[12px] text-[var(--tx2)] whitespace-pre-wrap leading-relaxed">{job.accessNotes}</p>
            </div>
          )}
          {job.crewMembers && job.crewMembers.length > 0 && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-3">Crew ({job.crewMembers.length})</p>
              <div className="space-y-2.5">
                {job.crewMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[var(--gold)]/15 text-[var(--gold)] shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[12px] font-semibold text-[var(--tx)]">{m.name}</span>
                      <span className="text-[10px] text-[var(--tx3)] ml-2">{m.role}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════ ITEMS TAB ══════════════ */}
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
        <div className="rounded-2xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
          <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
            <ClipboardText size={18} color="var(--gold)" />
          </div>
          <p className="text-[12px] text-[var(--tx3)]">No inventory for this job</p>
        </div>
      )}

      {/* ══════════════ PHOTOS TAB ══════════════ */}
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
            <div className="rounded-2xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
              <div className="w-10 h-10 rounded-xl bg-[var(--gold)]/10 flex items-center justify-center mx-auto mb-3">
                <Image size={18} color="var(--gold)" />
              </div>
              <p className="text-[12px] text-[var(--tx3)]">Start the job to capture photos</p>
            </div>
          )}
        </div>
      )}

      {/* Inventory Walkthrough Modal */}
      {walkthroughModalOpen && job && jobType === "move" && (
        <WalkthroughModal
          jobId={id}
          inventory={job.inventory || []}
          onComplete={(result) => {
            setWalkthroughDone(true);
            setWalkthroughModalOpen(false);
            setWalkthroughResult(result);
            if (!result.noChanges && result.changeRequestId) {
              setChangeRequestSubmitted(true);
            }
            // Open photo verification after walkthrough
            setPickupModalOpen(true);
          }}
          onSkip={(reason) => {
            setWalkthroughSkipped(true);
            setWalkthroughModalOpen(false);
            // Save skip reason to server
            fetch(`/api/crew/walkthrough/${id}/skip`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ skip_reason: reason }),
            }).catch(() => {});
            // Open photo verification
            setPickupModalOpen(true);
          }}
          onClose={() => setWalkthroughModalOpen(false)}
        />
      )}

      {/* Photo verification modal, shown after walkthrough */}
      {pickupModalOpen && job && (
        <div className="fixed inset-0 bg-black/80 flex min-h-0 items-center justify-center z-[99990] animate-fade-in p-4 sm:p-5">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl w-full max-w-[480px] overflow-y-auto shadow-2xl" style={{ maxHeight: "min(90dvh, 90vh)" }}>
            <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 z-10">
              <h3 className="font-hero text-[26px] font-bold text-[var(--tx)]">
                Document Condition
              </h3>
              <p className="text-[12px] text-[var(--tx3)] mt-1">
                Take photos of items and rooms before loading begins.
              </p>
            </div>

            <div className="px-5 py-4 space-y-5">
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

            <div className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-5 py-4 space-y-2">
              <div className="flex items-center justify-between text-[12px] text-[var(--tx3)] mb-1">
                <span>{pickupPhotosCount} photo{pickupPhotosCount !== 1 ? "s" : ""} taken</span>
              </div>
              <button
                onClick={() => {
                  setPickupVerificationDone(true);
                  setPickupModalOpen(false);
                }}
                disabled={pickupPhotosCount < 1 && totalItems > 0}
                className="w-full py-4 rounded-2xl font-bold text-[15px] text-white disabled:opacity-50 transition-all shadow-lg"
                style={{ background: "linear-gradient(135deg, #C9A962, #8B7332)" }}
              >
                {pickupPhotosCount < 1 && totalItems > 0
                  ? "Take at least 1 photo to continue"
                  : "Complete, Start Loading"}
              </button>
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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[99990]">
          <div className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-5 max-w-[360px] w-full shadow-2xl">
            <h3 className="font-hero text-[24px] font-bold text-[var(--tx)] mb-2">Report Issue</h3>
            {reportSubmitted ? (
              <div className="py-4">
                <div className="w-10 h-10 rounded-2xl bg-[#22C55E]/10 flex items-center justify-center mx-auto mb-3">
                  <Check size={18} color="#22C55E" weight="bold" />
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
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--brd)] outline-none"
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
                    className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] placeholder:text-[var(--tx3)] text-[13px] focus:border-[var(--brd)] outline-none resize-none"
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

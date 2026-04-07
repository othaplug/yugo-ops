"use client";

import {
  use,
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
  Suspense,
  type Dispatch,
  type SetStateAction,
} from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  FileText,
  ClipboardText,
  Image,
  Clock,
  Lock,
  PencilSimple,
  Warning,
  Phone,
  Check,
  Toolbox,
  ListChecks,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatTime } from "@/lib/client-timezone";
import { formatPlatformDisplay } from "@/lib/date-format";
import {
  MOVE_STATUS_FLOW,
  DELIVERY_STATUS_FLOW,
  getNextStatus,
  getCrewCheckpointDisplayLabel,
} from "@/lib/crew-tracking-status";
import { normalizePhone } from "@/lib/phone";
import { formatAccessForDisplay } from "@/lib/format-text";
import PageContent from "@/app/admin/components/PageContent";
import { useCrewImmersiveNav } from "@/app/crew/components/CrewImmersiveNavContext";
import StageProgressBar from "@/components/StageProgressBar";
import JobPhotos from "./JobPhotos";
import JobInventory from "./JobInventory";
import DayRateStopFlow from "./DayRateStopFlow";
import WalkthroughModal from "./WalkthroughModal";
import {
  useCrewPersistentTracking,
  checkLocationPermissions,
  markCrewLocationAllowed,
  type GeoPermissionState,
} from "@/lib/crew/useCrewPersistentTracking";
import type { CrewNavDestination } from "@/components/crew/CrewNavigation";
import {
  MOVE_DAY_ISSUE_OPTIONS,
  defaultUrgencyForIssue,
} from "@/lib/crew/move-day-issues";

const CrewNavigation = dynamic(
  () =>
    import("@/components/crew/CrewNavigation").then((m) => m.CrewNavigation),
  { ssr: false },
);

const DISPATCH_PHONE = process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";

function isValidNavCoord(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng)
  );
}

/** Opens nav when crew lands from sidebar/mobile with ?nav=1 (must be under Suspense). */
function OpenNavFromQuery({
  setNavOpen,
}: {
  setNavOpen: Dispatch<SetStateAction<boolean>>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  useEffect(() => {
    if (searchParams.get("nav") !== "1") return;
    setNavOpen(true);
    router.replace(pathname, { scroll: false });
  }, [searchParams, pathname, router, setNavOpen]);
  return null;
}

function CrewLocationStatusPill({
  locationPermission,
}: {
  locationPermission: GeoPermissionState;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--brd)]/50 bg-[var(--card)]/35 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tx3)]/75">
      <span className="shrink-0">Location</span>
      <span className="h-2.5 w-px shrink-0 bg-[var(--brd)]/55" aria-hidden />
      <span
        className={`min-w-0 font-semibold normal-case tracking-normal ${
          locationPermission === "granted"
            ? "text-[var(--tx)]"
            : locationPermission === "denied"
              ? "text-[#B45309]"
              : "text-[var(--tx)]"
        }`}
      >
        {locationPermission === "granted" && "Enabled"}
        {(locationPermission === "prompt" ||
          locationPermission === "unknown") &&
          "Pending"}
        {locationPermission === "denied" && "Off"}
        {locationPermission === "unsupported" && "Not on this device"}
      </span>
    </span>
  );
}

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
  inventory: {
    room: string;
    items: string[];
    itemsWithId?: { id: string; item_name: string; quantity?: number }[];
  }[];
  extraItems?: {
    id: string;
    description?: string;
    room?: string;
    quantity?: number;
    added_at?: string;
  }[];
  internalNotes: string | null;
  scheduledTime: string | null;
  crewId: string;
  projectContext?: ProjectContext | null;
  fromLat?: number | null;
  fromLng?: number | null;
  toLat?: number | null;
  toLng?: number | null;
  truckType?: string | null;
  fuelPriceCadPerLitre?: number | null;
  estCrewSize?: number | null;
  serviceType?: string | null;
  /** Partner org vertical (deliveries); used for B2B context in crew UI. */
  partnerVertical?: string | null;
  complexityBadges?: string[];
  /** Move jobs only — client pre-move checklist from tracking. */
  preMoveChecklistDone?: number;
  preMoveChecklistTotal?: number;
  preMoveChecklistAllComplete?: boolean;
  preMoveChecklistNotifiedAt?: string | null;
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
  const pathname = usePathname();
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const [job, setJob] = useState<JobDetail | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  /** Start job / checkpoint failures while the job UI is visible (do not use full-page error gate). */
  const [actionError, setActionError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [note, setNote] = useState("");
  const [locationPermission, setLocationPermission] =
    useState<GeoPermissionState>("unknown");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportType, setReportType] = useState("access_problem");
  const [reportUrgency, setReportUrgency] = useState<"high" | "medium" | "low">(
    "medium",
  );
  const [reportDesc, setReportDesc] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSubmitted, setReportSubmitted] = useState(false);
  const [canAdvanceFromArrived, setCanAdvanceFromArrived] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("status");
  const [elapsedMs, setElapsedMs] = useState(0);
  const [itemsVerified, setItemsVerified] = useState(0);
  const [itemsTotal, setItemsTotal] = useState(0);
  const [inventoryVerifyEpoch, setInventoryVerifyEpoch] = useState(0);
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
  const [navOpen, setNavOpen] = useState(false);
  const [equipmentCheckPending, setEquipmentCheckPending] = useState(false);
  const { setImmersiveNav } = useCrewImmersiveNav();

  const statusFlow =
    jobType === "move" ? MOVE_STATUS_FLOW : DELIVERY_STATUS_FLOW;
  const currentStatus = session?.status || "not_started";
  const nextStatus = getNextStatus(currentStatus, jobType);
  const isCompleted = currentStatus === "completed";
  const progressIdx = statusFlow.indexOf(currentStatus as any);
  const progressPercent = isCompleted
    ? 100
    : progressIdx >= 0
      ? ((progressIdx + 1) / statusFlow.length) * 100
      : 0;

  const isNavigatingLeg =
    currentStatus === "en_route_to_pickup" ||
    currentStatus === "en_route_to_destination";

  const navDestination: CrewNavDestination | null = useMemo(() => {
    if (!job || !session?.isActive || isCompleted) return null;
    if (
      currentStatus === "en_route_to_pickup" &&
      isValidNavCoord(job.fromLat, job.fromLng)
    ) {
      return { lat: job.fromLat!, lng: job.fromLng!, address: job.fromAddress };
    }
    if (
      currentStatus === "en_route_to_destination" &&
      isValidNavCoord(job.toLat, job.toLng)
    ) {
      return { lat: job.toLat!, lng: job.toLng!, address: job.toAddress };
    }
    return null;
  }, [job, session?.isActive, isCompleted, currentStatus]);

  const totalItems =
    itemsTotal > 0
      ? itemsTotal
      : job
        ? (job.inventory?.flatMap(
            (r) =>
              r.itemsWithId ||
              r.items.map((n) => ({ id: `noid`, item_name: n })),
          ).length ?? 0) + (job.extraItems?.length ?? 0)
        : 0;

  const fetchJob = useCallback(async () => {
    const r = await fetch(`/api/crew/job/${jobType}/${id}`);
    const d = (await r.json().catch(() => ({}))) as {
      error?: string;
    } & Partial<JobDetail>;
    if (!r.ok) {
      throw new Error(
        typeof d.error === "string" && d.error.trim()
          ? d.error
          : "Job not found",
      );
    }
    setJob(d as JobDetail);
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
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fetchJob, fetchSession]);

  useEffect(() => {
    const interval = setInterval(fetchSession, 5000);
    return () => clearInterval(interval);
  }, [fetchSession]);

  useEffect(() => {
    if (!isCompleted) {
      setEquipmentCheckPending(false);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/crew/signoff/${encodeURIComponent(id)}?jobType=${encodeURIComponent(jobType)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setEquipmentCheckPending(
          !d.equipmentCheckDone && !d.equipmentTrackingUnavailable,
        );
      })
      .catch(() => {
        if (!cancelled) setEquipmentCheckPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isCompleted, id, jobType, pathname]);

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
  }, [
    currentStatus,
    walkthroughDone,
    walkthroughSkipped,
    loading,
    session?.isActive,
  ]);

  useEffect(() => {
    if (!session?.startedAt || !session?.isActive) {
      setElapsedMs(0);
      return;
    }
    const tick = () =>
      setElapsedMs(Date.now() - new Date(session.startedAt!).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [session?.startedAt, session?.isActive]);

  const { recheckPermission } = useCrewPersistentTracking({
    sessionId: session?.id,
    isActive: !!session?.isActive,
    onAutoAdvanced: fetchSession,
    onPermissionChange: setLocationPermission,
  });

  const blockedByLocation =
    locationPermission === "denied" || locationPermission === "unsupported";

  const startJob = async () => {
    setActionError("");
    const perm = await checkLocationPermissions();
    if (perm.status === "denied" || perm.status === "unsupported") {
      setActionError(perm.message || "Location is required to start this job.");
      return;
    }
    if (perm.status !== "granted" && "geolocation" in navigator) {
      const ok = await new Promise<boolean>((resolve) => {
        navigator.geolocation.getCurrentPosition(
          () => resolve(true),
          () => resolve(false),
          { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
        );
      });
      if (!ok) {
        setActionError(
          "Allow location when your browser asks—live tracking is required to start this job.",
        );
        return;
      }
      markCrewLocationAllowed();
      setLocationPermission("granted");
    }
    setAdvancing(true);
    try {
      const r = await fetch("/api/tracking/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: job?.id ?? id,
          jobType: job?.jobType ?? jobType,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Failed to start");
      await fetchSession();
      setActionError("");
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
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
    if (blockedByLocation) {
      setActionError("Turn on location access to update status.");
      return;
    }
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => doAdvance(nextStatus, p.coords.latitude, p.coords.longitude),
        () => doAdvance(nextStatus),
        { enableHighAccuracy: false, maximumAge: 60000, timeout: 5000 },
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
      setActionError("");
      setNote("");
      await fetchSession();
      if (status === "arrived_at_pickup") {
        setWalkthroughModalOpen(true);
        setWalkthroughDone(false);
        setWalkthroughSkipped(false);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdvancing(false);
    }
  };

  const handleNavigationArrived = () => {
    setNavOpen(false);
    if (currentStatus === "en_route_to_pickup") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            void doAdvance(
              "arrived_at_pickup",
              p.coords.latitude,
              p.coords.longitude,
            ),
          () => void doAdvance("arrived_at_pickup"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        void doAdvance("arrived_at_pickup");
      }
    } else if (currentStatus === "en_route_to_destination") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            void doAdvance(
              "arrived_at_destination",
              p.coords.latitude,
              p.coords.longitude,
            ),
          () => void doAdvance("arrived_at_destination"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        void doAdvance("arrived_at_destination");
      }
    }
  };

  useEffect(() => {
    if (!isNavigatingLeg) setNavOpen(false);
  }, [isNavigatingLeg]);

  useEffect(() => {
    const immersive = Boolean(navOpen && session && navDestination);
    setImmersiveNav(immersive);
    return () => setImmersiveNav(false);
  }, [navOpen, session, navDestination, setImmersiveNav]);

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
    return () => {
      lock?.release?.();
    };
  }, []);

  if (loading) {
    return (
      <PageContent className="crew-job-premium">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#5C1A33]/25 border-t-[#5C1A33] rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--tx3)]">Loading job...</p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (!job) {
    return (
      <PageContent className="crew-job-premium">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-[var(--text-base)] text-[var(--red)] mb-4">
            {error || "Job not found"}
          </p>
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-xl text-[13px] font-medium text-[#5C1A33] hover:bg-[var(--gdim)] transition-colors"
          >
            <span aria-hidden>←</span> Back to Jobs
          </Link>
        </div>
      </PageContent>
    );
  }

  // Day rate with stops — render dedicated multi-stop flow
  const isDayRate =
    job.bookingType === "day_rate" && job.stops && job.stops.length > 0;
  if (isDayRate) {
    return (
      <PageContent className="crew-job-premium max-w-[520px]">
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-lg text-[12px] font-medium text-[var(--tx3)] hover:text-[#5C1A33] hover:bg-[var(--gdim)] transition-colors"
          >
            <CaretLeft size={15} weight="regular" />
            Jobs
          </Link>
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: "#0D948820", color: "#0D9488" }}
          >
            Day Rate
          </span>
        </div>
        <DayRateStopFlow
          stops={job.stops!}
          delivery={{
            id: job.id,
            bookingType: job.bookingType ?? null,
            stopsCompleted: job.stopsCompleted ?? 0,
            totalStops: job.stops!.length,
            clientName: job.clientName,
            deliveryNumber: job.jobId,
          }}
          partnerName={job.clientName}
          vehicleType={null}
          onStopUpdated={() => {
            fetchJob();
          }}
        />
      </PageContent>
    );
  }

  const jobCompleted = ["completed", "delivered", "done"].includes(
    (job.status || "").toLowerCase(),
  );
  /** No active session yet — show primary start control on Status tab. */
  const showStartButton = !session && !jobCompleted;
  const atArrivedRequiringPhotos = [
    "arrived_at_destination",
    "arrived",
  ].includes(currentStatus);
  const blockedByPhotos = atArrivedRequiringPhotos && !canAdvanceFromArrived;
  // Walkthrough must be done (or skipped) before loading can start
  const blockedByWalkthrough =
    currentStatus === "arrived_at_pickup" &&
    !walkthroughDone &&
    !walkthroughSkipped;
  const showAdvanceButton = session?.isActive && nextStatus && !showStartButton;
  const canUseLocationActions = !blockedByLocation;

  const itemsLabel =
    itemsTotal > 0
      ? `Items (${itemsVerified}/${itemsTotal})`
      : `Items (${totalItems})`;
  const tabs: { id: TabId; label: string; icon: React.ReactNode }[] = [
    { id: "status", label: "Status", icon: <CheckCircle size={14} /> },
    { id: "details", label: "Details", icon: <FileText size={14} /> },
    { id: "items", label: itemsLabel, icon: <ClipboardText size={14} /> },
    { id: "photos", label: "Photos", icon: <Image size={14} /> },
  ];

  const hasInventory =
    (job.inventory?.length ?? 0) > 0 ||
    (job.extraItems?.length ?? 0) > 0 ||
    (jobType === "move" &&
      job.moveType === "residential" &&
      (job.inventory?.length ?? 0) === 0);
  const fromAccessDisplay = formatAccessForDisplay(job.fromAccess);
  const toAccessDisplay = formatAccessForDisplay(job.toAccess);
  const useLogisticsCopy =
    jobType === "delivery" ||
    (() => {
      const st = (job.serviceType || "").toLowerCase();
      return st === "b2b_delivery" || st === "b2b_oneoff";
    })();
  const originLabel = useLogisticsCopy ? "Origin" : "Pickup";
  const destinationLabel = useLogisticsCopy ? "Destination" : "Drop-off";

  return (
    <PageContent className="crew-job-premium max-w-[520px]">
      <Suspense fallback={null}>
        <OpenNavFromQuery setNavOpen={setNavOpen} />
      </Suspense>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-2 mb-6 pb-1 border-b border-[#5C1A33]/[0.08]">
        <Link
          href="/crew/dashboard"
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-[10px] text-[12px] font-medium text-[var(--tx3)] hover:text-[#5C1A33] hover:bg-[#5C1A33]/[0.06] transition-colors [font-family:var(--font-body)]"
        >
          <CaretLeft size={15} weight="regular" />
          Jobs
        </Link>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {(session?.isActive || isCompleted) && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-[10px] bg-[#FFFBF7]/90 border border-[#5C1A33]/[0.1] shadow-[0_1px_0_rgba(92,26,51,0.04)]">
              <Clock size={11} className="text-[#5C1A33]/50" aria-hidden />
              <span className="text-[11px] font-bold text-[var(--tx)] tabular-nums">
                {formatElapsed(
                  isCompleted && session?.completedAt && session?.startedAt
                    ? new Date(session.completedAt).getTime() -
                        new Date(session.startedAt).getTime()
                    : elapsedMs,
                )}
              </span>
            </div>
          )}
          {session && !isCompleted && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold ${
                locationPermission === "denied" ||
                locationPermission === "unsupported"
                  ? "bg-red-500/10 text-red-400 border border-red-500/25"
                  : "bg-[#2C3E2D]/10 text-[#243524] border border-[#2C3E2D]/25"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {locationPermission !== "denied" &&
                  locationPermission !== "unsupported" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#2C3E2D] opacity-40" />
                  )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    locationPermission === "denied" ||
                    locationPermission === "unsupported"
                      ? "bg-red-400"
                      : "bg-[#2C3E2D]"
                  }`}
                />
              </span>
              GPS
            </span>
          )}
          {showStartButton && (
            <>
              <CrewLocationStatusPill locationPermission={locationPermission} />
              {(locationPermission === "denied" ||
                locationPermission === "unsupported") && (
                <button
                  type="button"
                  onClick={() =>
                    recheckPermission().then((r) => {
                      setLocationPermission(r.status);
                    })
                  }
                  className="shrink-0 text-[11px] font-semibold text-[#5C1A33] underline-offset-2 hover:underline"
                >
                  Check again
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showStartButton &&
        (locationPermission === "prompt" ||
          locationPermission === "unknown") && (
          <p className="text-[11px] text-[var(--tx3)] mb-3 leading-relaxed">
            Live tracking is required for this job for safety and verification.
            Allow when prompted so dispatch
            {useLogisticsCopy ? " and the receiver " : " and the client "}
            can follow your progress.
          </p>
        )}
      {showStartButton && locationPermission === "denied" && (
        <p className="text-[11px] text-[var(--tx3)] mb-3 leading-relaxed">
          Live tracking needs location access. Turn it on in your browser or
          device settings, then tap Check again.
        </p>
      )}

      {/* ── Job header — premium card ── */}
      <div className="mb-6 rounded-2xl border border-[#5C1A33]/[0.1] bg-[#FFFBF7] shadow-[0_1px_0_rgba(92,26,51,0.06),0_12px_40px_-24px_rgba(44,62,45,0.12)] p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5C1A33]/45 mb-1 [font-family:var(--font-body)] leading-none">
              {job.jobTypeLabel}
            </p>
            <h1 className="font-hero text-[28px] font-semibold text-[#2b1810] leading-[1.12] truncate tracking-[-0.02em]">
              {job.clientName}
            </h1>
            <p className="text-[10px] text-[#5C1A33]/40 mt-1 font-mono tracking-wide">
              {job.jobId}
            </p>
            {(() => {
              const n =
                job.estCrewSize != null && Number.isFinite(job.estCrewSize)
                  ? Math.max(0, Math.round(job.estCrewSize))
                  : null;
              const badges = Array.isArray(job.complexityBadges)
                ? job.complexityBadges
                : [];
              const showCrew = n != null && n >= 3;
              const st = (job.serviceType || "").toLowerCase();
              const b2b =
                st === "b2b_delivery" ||
                st === "b2b_oneoff" ||
                (jobType === "delivery" && !!job.partnerVertical?.trim());
              if (!showCrew && badges.length === 0 && !b2b) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {b2b ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#5C1A33]/35 bg-[#5C1A33]/10 text-[#5C1A33]">
                      B2B delivery
                    </span>
                  ) : null}
                  {showCrew ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--brd)] bg-[var(--card)] text-[var(--tx2)]">
                      {n}-person crew planned
                    </span>
                  ) : null}
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[#B45309]/30 bg-[#B45309]/10 text-[#92400e]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          {isCompleted && (
            <span className="shrink-0 px-2.5 py-1 rounded-none bg-[#2C3E2D]/[0.08] text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] [font-family:var(--font-body)] leading-none">
              Complete
            </span>
          )}
        </div>
        <div className="border-t border-[#5C1A33]/[0.08] pt-4">
          <div className="flex gap-3.5">
            {/* Dot + connector column */}
            <div className="flex flex-col items-center shrink-0 pt-1">
              {/* Pickup dot — wine */}
              <div className="w-4 h-4 rounded-full border-2 border-[#5C1A33]/45 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#5C1A33]" />
              </div>
              {/* Connector line */}
              <div
                className="w-[2px] flex-1 my-1 rounded-full"
                style={{ background: "rgba(92, 26, 51, 0.14)", minHeight: 20 }}
              />
              {/* Drop-off dot — forest */}
              <div className="w-4 h-4 rounded-full border-2 border-[#2C3E2D]/40 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#2C3E2D]" />
              </div>
            </div>

            {/* Address column */}
            <div className="flex flex-col justify-between min-w-0 flex-1 gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5C1A33]/50 mb-1 [font-family:var(--font-body)] leading-none">
                  {originLabel}
                </p>
                <p className="text-[15px] text-[#3d2a22] leading-snug font-medium tracking-[-0.01em]">
                  {job.fromAddress}
                </p>
                {fromAccessDisplay && (
                  <p className="text-[11px] text-[#5C1A33]/75 mt-1 flex items-center gap-1.5 leading-snug">
                    <Lock
                      size={11}
                      className="shrink-0 text-[#5C1A33]/45"
                      aria-hidden
                    />
                    {fromAccessDisplay}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5C1A33]/50 mb-1 [font-family:var(--font-body)] leading-none">
                  {destinationLabel}
                </p>
                <p className="text-[15px] text-[#3d2a22] leading-snug font-medium tracking-[-0.01em]">
                  {job.toAddress}
                </p>
                {toAccessDisplay && (
                  <p className="text-[11px] text-[#5C1A33]/75 mt-1 flex items-center gap-1.5 leading-snug">
                    <Lock
                      size={11}
                      className="shrink-0 text-[#5C1A33]/45"
                      aria-hidden
                    />
                    {toAccessDisplay}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex justify-center border-b border-[#5C1A33]/[0.1] mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            type="button"
            className={`relative flex-1 px-3 py-3 text-[11px] font-bold tracking-[0.12em] uppercase transition-colors duration-150 whitespace-nowrap touch-manipulation [font-family:var(--font-body)] leading-none ${
              activeTab === t.id
                ? "text-[#5C1A33]"
                : "text-[var(--tx3)]/40 hover:text-[#5C1A33]/55"
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[#5C1A33]" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ STATUS TAB ══════════════ */}
      {activeTab === "status" && (
        <div className="space-y-5">
          {actionError && (
            <div className="mx-2 rounded-[10px] border border-red-200/80 bg-red-50/90 px-3 py-2.5">
              <p className="text-[11px] text-red-800 leading-relaxed">
                {actionError}
              </p>
            </div>
          )}

          {jobType === "move" &&
            job &&
            typeof job.preMoveChecklistTotal === "number" &&
            job.preMoveChecklistTotal > 0 && (
              <div
                className={`mx-2 flex items-start gap-3 rounded-2xl border px-4 py-3 ${
                  job.preMoveChecklistAllComplete
                    ? "border-[#2C3E2D]/35 bg-[#2C3E2D]/10"
                    : "border-[var(--brd)]/50 bg-[var(--card)]/40"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    job.preMoveChecklistAllComplete
                      ? "bg-[#2C3E2D]/20 text-[#243524]"
                      : "bg-[var(--gdim)]/50 text-[var(--tx3)]"
                  }`}
                >
                  <ListChecks size={22} weight="bold" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">
                    Client pre-move prep
                  </p>
                  <p className="text-[12px] text-[var(--tx2)] mt-1 leading-snug">
                    {job.preMoveChecklistAllComplete ? (
                      <>
                        Checklist complete ({job.preMoveChecklistDone}/
                        {job.preMoveChecklistTotal}
                        ).{" "}
                        {job.preMoveChecklistNotifiedAt
                          ? "Coordinator and ops were emailed when they finished."
                          : "They finished every item in their tracking link."}
                      </>
                    ) : (
                      <>
                        {job.preMoveChecklistDone ?? 0}/
                        {job.preMoveChecklistTotal} items done in their tracking
                        link — confirm access and parking with dispatch if
                        needed.
                      </>
                    )}
                  </p>
                </div>
              </div>
            )}

          {isCompleted && equipmentCheckPending && (
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}/equipment-check`}
              className="mx-2 flex items-center gap-3 rounded-2xl border border-[#5C1A33]/35 bg-[#5C1A33]/10 px-4 py-3.5 transition-colors hover:bg-[#5C1A33]/15"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#5C1A33]/20 text-[#5C1A33]">
                <Toolbox size={22} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-[var(--tx)]">
                  Truck equipment check
                </p>
                <p className="text-[11px] text-[var(--tx3)] mt-0.5 leading-snug">
                  Count gear before your next stop or end-of-day report. Client
                  sign-off is already done.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[#5C1A33] shrink-0">
                Open
              </span>
            </Link>
          )}

          {/* Location + charging note (status pill lives in top bar until job starts) */}
          <div className="px-2 space-y-3 py-1">
            {locationPermission === "granted" && showStartButton && (
              <p className="text-[11px] text-[#5C1A33]/45 text-center leading-relaxed max-w-[340px] mx-auto [font-family:var(--font-body)]">
                Keep location on for the whole job—live tracking stays active
                until you finish.
              </p>
            )}

            {session?.isActive &&
              !isCompleted &&
              isNavigatingLeg &&
              canUseLocationActions &&
              !navDestination && (
                <p className="text-[11px] text-[#3d2a22]/75 text-center leading-relaxed px-1 max-w-[380px] mx-auto [font-family:var(--font-body)]">
                  Map routing needs coordinates for this job. Open the Details
                  tab for full addresses, or ask dispatch to verify{" "}
                  {useLogisticsCopy
                    ? "origin and destination"
                    : "pickup and drop-off"}{" "}
                  pins. Use{" "}
                  <span className="text-[#5C1A33] font-semibold">
                    Navigation
                  </span>{" "}
                  in the crew menu when pins are available.
                </p>
              )}

            <p className="text-[11px] text-[#5C1A33]/40 text-center leading-relaxed max-w-[340px] mx-auto [font-family:var(--font-body)]">
              {jobType === "delivery"
                ? "Keep your device charged during deliveries for uninterrupted tracking."
                : "Keep your device charged during moves for uninterrupted tracking."}
            </p>
          </div>

          {showStartButton && (
            <div className="px-2 space-y-3">
              <button
                type="button"
                onClick={() => void startJob()}
                disabled={advancing || blockedByLocation}
                className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.12em] active:scale-[0.99] [font-family:var(--font-body)] leading-none"
              >
                {advancing ? (
                  "Starting…"
                ) : (
                  <>
                    Start job
                    <CaretRight
                      size={18}
                      weight="bold"
                      className="shrink-0 opacity-95"
                      aria-hidden
                    />
                  </>
                )}
              </button>
              {blockedByLocation && (
                <p className="text-[10px] text-[var(--tx3)] text-center leading-snug px-1">
                  Location is off or unavailable. Enable it for this site in
                  your settings, then tap Start job again.
                </p>
              )}
            </div>
          )}

          {blockedByLocation && (
            <div className="rounded-2xl border border-red-200/90 bg-red-50/80 p-4 space-y-2">
              <p className="text-[12px] font-bold text-red-900 [font-family:var(--font-body)] uppercase tracking-[0.06em]">
                Location required
              </p>
              <p className="text-[11px] text-red-900/80 leading-relaxed">
                Live tracking is required for this job and must stay on until
                the job is finished. Open Settings → Privacy → Location Services
                → your browser → Allow while using.
              </p>
            </div>
          )}

          {/* Progress */}
          <div className="px-2">
            <StageProgressBar
              stages={
                jobType === "move"
                  ? [
                      { label: "En Route" },
                      { label: "Loading" },
                      { label: "Unloading" },
                      { label: "Complete" },
                    ]
                  : [
                      { label: "En Route" },
                      { label: "Arrived" },
                      { label: "Delivering" },
                      { label: "Complete" },
                    ]
              }
              currentIndex={
                isCompleted
                  ? 3
                  : progressIdx >= 0
                    ? jobType === "move"
                      ? progressIdx <= 0
                        ? 0
                        : progressIdx <= 2
                          ? 1
                          : progressIdx <= 5
                            ? 2
                            : 3
                      : progressIdx <= 0
                        ? 0
                        : progressIdx <= 1
                          ? 1
                          : progressIdx <= 3
                            ? 2
                            : 3
                    : -1
              }
              variant="light"
              lightAccent="wine"
            />
          </div>

          {/* Optional note — attached to noteInputRef; sent with the next checkpoint API call */}
          {session?.isActive && !isCompleted && (
            <div className="px-2 space-y-1.5">
              <label
                htmlFor="crew-checkpoint-note"
                className="block text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/50"
              >
                Note for next update (optional)
              </label>
              <input
                id="crew-checkpoint-note"
                ref={noteInputRef}
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={
                  useLogisticsCopy
                    ? "e.g. Delayed at dock, site contact at loading bay…"
                    : "e.g. Delayed at gate, client at side entrance…"
                }
                className="w-full px-3.5 py-2.5 rounded-[10px] bg-[#FFFBF7] border border-[#5C1A33]/[0.1] text-[#3d2a22] placeholder:text-[#5C1A33]/35 text-[13px] outline-none focus:ring-2 focus:ring-[#5C1A33]/25 focus:ring-offset-0"
                autoComplete="off"
              />
            </div>
          )}

          {/* Walkthrough gate, shown when at pickup and walkthrough not done */}
          {currentStatus === "arrived_at_pickup" && blockedByWalkthrough && (
            <div className="rounded-2xl border border-[#5C1A33]/[0.12] bg-[#5C1A33]/[0.04] p-4 sm:p-5 space-y-3">
              <div>
                <p className="text-[12px] font-bold text-[var(--tx)]">
                  {useLogisticsCopy
                    ? "Job List Verification Required"
                    : "Inventory Walkthrough Required"}
                </p>
                <p className="text-[11px] text-[var(--tx3)]">
                  {useLogisticsCopy
                    ? jobType === "delivery"
                      ? "Complete before you leave origin for drop-off"
                      : "Complete before loading starts"
                    : "Complete before loading starts"}
                </p>
              </div>
              <p className="text-[12px] text-[var(--tx2)] leading-relaxed">
                {useLogisticsCopy ? (
                  <>
                    With the site contact or receiver, verify the job list
                    matches what&apos;s on site. Flag missing lines and add any
                    extra pieces.
                  </>
                ) : (
                  <>
                    Walk through with the client and verify the inventory
                    matches the quote. Flag missing items and add any extras.
                  </>
                )}
              </p>
              <button
                type="button"
                onClick={() => setWalkthroughModalOpen(true)}
                className="crew-premium-cta inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-[48px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none"
              >
                Start inventory check
                <CaretRight
                  size={16}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
              </button>
            </div>
          )}

          {/* Change request submitted banner */}
          {changeRequestSubmitted &&
            walkthroughResult &&
            !walkthroughResult.noChanges && (
              <div className="rounded-2xl border border-[#2C3E2D]/25 bg-[#2C3E2D]/5 px-4 py-3 flex items-start gap-2.5">
                <CheckCircle
                  size={16}
                  color="#2C3E2D"
                  className="shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[12px] font-bold text-[#243524]">
                    {jobType === "delivery"
                      ? "Walkthrough logged"
                      : "Change request submitted"}
                  </p>
                  <p className="text-[11px] text-[var(--tx2)] mt-0.5">
                    {walkthroughResult.itemsExtra > 0 &&
                      `${walkthroughResult.itemsExtra} extra item${walkthroughResult.itemsExtra !== 1 ? "s" : ""}. `}
                    {walkthroughResult.itemsMissing > 0 &&
                      `${walkthroughResult.itemsMissing} missing. `}
                    {jobType === "move" ? (
                      <>
                        Net {walkthroughResult.netDelta >= 0 ? "+" : ""}$
                        {walkthroughResult.netDelta}.{" "}
                        {useLogisticsCopy
                          ? "Ops notified."
                          : "Client notified."}
                      </>
                    ) : (
                      <>Details saved on the job for the coordinator.</>
                    )}
                  </p>
                </div>
              </div>
            )}

          {/* Advance status / Client Sign-Off button (sign-off allowed even if GPS was denied) */}
          {showAdvanceButton &&
            !blockedByPhotos &&
            !blockedByWalkthrough &&
            (nextStatus === "completed" ? (
              <Link
                href={`/crew/dashboard/job/${jobType}/${id}/signoff`}
                className="crew-premium-cta w-full inline-flex items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.1em] active:scale-[0.99] [font-family:var(--font-body)] leading-none"
              >
                <CheckCircle
                  size={16}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
                {useLogisticsCopy ? "Receiver sign-off" : "Client sign-off"}
                <CaretRight
                  size={18}
                  weight="bold"
                  className="shrink-0 opacity-95"
                  aria-hidden
                />
              </Link>
            ) : canUseLocationActions ? (
              <button
                type="button"
                onClick={advanceStatus}
                disabled={advancing}
                className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-semibold text-[11px] uppercase tracking-[0.08em] disabled:opacity-60 active:scale-[0.99] [font-family:var(--font-body)] leading-none"
              >
                {advancing ? (
                  "Updating…"
                ) : (
                  <>
                    {getCrewCheckpointDisplayLabel(
                      nextStatus!,
                      useLogisticsCopy,
                    )}
                    <CaretRight
                      size={18}
                      weight="bold"
                      className="shrink-0 opacity-95"
                      aria-hidden
                    />
                  </>
                )}
              </button>
            ) : null)}
          {showAdvanceButton && canUseLocationActions && blockedByPhotos && (
            <p className="text-center text-[11px] text-[var(--tx3)] py-2">
              Take photos in the Photos tab to advance
            </p>
          )}

          {/* Timeline */}
          <div>
            {/* Header — wine serif title + forest meta (premium crew delivery / move) */}
            <div className="flex items-center justify-between pb-3 border-b border-[#5C1A33]/[0.08]">
              <p className="font-hero text-[15px] font-semibold text-[#5C1A33] leading-none tracking-tight">
                Timeline
              </p>
              {session?.startedAt && (
                <span className="text-[10px] font-medium tabular-nums [font-family:var(--font-body)] text-[var(--tx3)]">
                  Started{" "}
                  {formatTime(session.startedAt, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            {/* Steps */}
            <div className="space-y-0 pt-3">
              {statusFlow.map((s, i) => {
                const cp = session?.checkpoints?.find((c) => c.status === s);
                const idx = statusFlow.indexOf(currentStatus as any);
                const isPast = idx > i || (idx === i && isCompleted);
                const isCurrent = currentStatus === s && !isCompleted;
                const isLast = i === statusFlow.length - 1;
                const state = isPast ? "done" : isCurrent ? "act" : "wait";

                const prevCp =
                  i > 0
                    ? session?.checkpoints?.find(
                        (c) => c.status === statusFlow[i - 1],
                      )
                    : null;
                const stepTs =
                  cp?.timestamp ??
                  (isLast && isCompleted
                    ? (session?.completedAt ?? null)
                    : null);
                const elapsed =
                  stepTs && prevCp?.timestamp
                    ? Math.round(
                        (new Date(stepTs).getTime() -
                          new Date(prevCp.timestamp).getTime()) /
                          60000,
                      )
                    : null;

                // Dot styles — Uber-style solid circles
                const DOT = 20;
                const dotBg =
                  state === "done"
                    ? isLast && isCompleted
                      ? "#2C3E2D"
                      : "rgba(44,62,45,0.18)"
                    : state === "act"
                      ? "#5C1A33"
                      : "transparent";
                const dotBorder =
                  state === "done"
                    ? isLast && isCompleted
                      ? "#2C3E2D"
                      : "rgba(44,62,45,0.5)"
                    : state === "act"
                      ? "#5C1A33"
                      : "rgba(92,26,51,0.16)";
                const dotShadow =
                  state === "act"
                    ? "0 0 0 5px rgba(92,26,51,0.2)"
                    : isLast && isCompleted
                      ? "0 0 0 4px rgba(44,62,45,0.12)"
                      : "none";

                const connectorColor =
                  state === "done"
                    ? "rgba(44,62,45,0.35)"
                    : state === "act"
                      ? "rgba(92,26,51,0.35)"
                      : "rgba(92,26,51,0.1)";

                return (
                  <div key={s} className="flex gap-3.5">
                    {/* Dot + connector column */}
                    <div
                      className="flex flex-col items-center shrink-0"
                      style={{ width: DOT }}
                    >
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
                              background:
                                isLast && isCompleted
                                  ? "rgba(255,255,255,0.9)"
                                  : "#2C3E2D",
                              opacity: isLast && isCompleted ? 1 : 0.9,
                            }}
                          />
                        )}
                        {state === "act" && (
                          <span
                            className="rounded-full animate-pulse"
                            style={{
                              width: 7,
                              height: 7,
                              background: "rgba(255,255,255,0.85)",
                            }}
                          />
                        )}
                        {state === "wait" && (
                          <span
                            className="rounded-full"
                            style={{
                              width: 6,
                              height: 6,
                              background: "rgba(92,26,51,0.12)",
                            }}
                          />
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
                    <div
                      className={`flex-1 min-w-0 ${isLast ? "pb-0" : "pb-4"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span
                            className={`text-[12px] font-semibold leading-tight block ${
                              state === "done"
                                ? "text-[var(--tx)]"
                                : state === "act"
                                  ? "text-[#5C1A33]"
                                  : "text-[var(--tx3)]/35"
                            }`}
                          >
                            {getCrewCheckpointDisplayLabel(s, useLogisticsCopy)}
                          </span>
                          {state === "act" && (
                            <span className="text-[9px] font-bold text-[#5C1A33]/70 uppercase tracking-widest block mt-0.5">
                              Now
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {elapsed !== null && elapsed > 0 && (
                            <span className="text-[10px] tabular-nums font-semibold text-[var(--tx)] [font-family:var(--font-body)]">
                              {elapsed}m
                            </span>
                          )}
                          {(() => {
                            const ts =
                              cp?.timestamp ??
                              (isLast && isCompleted
                                ? (session?.completedAt ?? null)
                                : null);
                            return ts ? (
                              <span
                                className={`text-[10px] tabular-nums font-medium [font-family:var(--font-body)] ${
                                  state === "done"
                                    ? "text-[var(--tx2)]"
                                    : "text-[var(--tx3)]"
                                }`}
                              >
                                {formatTime(ts, {
                                  hour: "numeric",
                                  minute: "2-digit",
                                })}
                              </span>
                            ) : null;
                          })()}
                        </div>
                      </div>
                      {cp?.note && (
                        <p className="mt-0.5 text-[10px] text-[var(--tx3)] italic leading-snug">
                          {cp.note}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Dispatch notes */}
          {job.internalNotes && (
            <div className="rounded-2xl border border-[#5C1A33]/[0.12] bg-gradient-to-br from-[#FAF3F5] via-[#F7EEF1] to-[#F2E6EA] p-4 sm:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[#5C1A33]/55 mb-2 [font-family:var(--font-body)] leading-none">
                Dispatch notes
              </p>
              <p className="text-[13px] text-[#3d2a26] whitespace-pre-wrap leading-relaxed">
                {job.internalNotes}
              </p>
            </div>
          )}

          {/* Quick actions — outlined wine / restrained warning (premium crew job row) */}
          {!isCompleted && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-1 flex-wrap">
              {session?.isActive && (
                <button
                  type="button"
                  onClick={() => {
                    const el = noteInputRef.current;
                    if (el) {
                      el.scrollIntoView({
                        block: "center",
                        behavior: "smooth",
                      });
                      el.focus();
                    }
                  }}
                  className="crew-job-action-chip inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 border border-[#5C1A33]/55 bg-transparent text-[12px] font-semibold tracking-[0.04em] text-[#5C1A33] hover:bg-[#5C1A33]/[0.07] hover:border-[#5C1A33]/75 active:scale-[0.98] transition-colors [font-family:var(--font-body)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5C1A33]/35"
                >
                  <PencilSimple
                    size={16}
                    weight="regular"
                    className="shrink-0 text-[#5C1A33]/85"
                    aria-hidden
                  />
                  Note
                </button>
              )}
              <button
                type="button"
                onClick={() => setReportModalOpen(true)}
                className="crew-job-action-chip inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 border border-[#92400e]/45 bg-transparent text-[12px] font-semibold tracking-[0.04em] text-[#78350f] hover:bg-[#b45309]/[0.08] hover:border-[#92400e]/55 active:scale-[0.98] transition-colors [font-family:var(--font-body)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b45309]/40"
              >
                <Warning
                  size={16}
                  weight="regular"
                  className="shrink-0 text-[#b45309]"
                  aria-hidden
                />
                Report issue
              </button>
              <a
                href={`tel:${normalizePhone(DISPATCH_PHONE)}`}
                className="crew-job-action-chip inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 border border-[#5C1A33]/55 bg-transparent text-[12px] font-semibold tracking-[0.04em] text-[#5C1A33] hover:bg-[#5C1A33]/[0.07] hover:border-[#5C1A33]/75 active:scale-[0.98] transition-colors [font-family:var(--font-body)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#5C1A33]/35"
              >
                <Phone
                  size={16}
                  weight="regular"
                  className="shrink-0 text-[#5C1A33]/85"
                  aria-hidden
                />
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
            <div className="mx-0 mb-4 px-4 py-3 rounded-2xl border border-[#5C1A33]/20 bg-[#5C1A33]/5">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[#5C1A33]/60 mb-0.5">
                Part of Project
              </p>
              <p className="text-[13px] font-semibold text-[var(--tx)]">
                {job.projectContext.projectNumber},{" "}
                {job.projectContext.projectName}
              </p>
              {job.projectContext.phaseName && (
                <p className="text-[11px] text-[#5C1A33] mt-0.5">
                  {job.projectContext.phaseName}
                </p>
              )}
            </div>
          )}
          {(job.scheduledDate || job.arrivalWindow) && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-2">
                Schedule
              </p>
              {job.scheduledDate && (
                <p className="text-[var(--text-base)] font-semibold text-[var(--tx)]">
                  {formatPlatformDisplay(job.scheduledDate + "T12:00:00", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
              {job.arrivalWindow && (
                <p className="text-[12px] text-[var(--tx3)] mt-1">
                  Window: {job.arrivalWindow}
                </p>
              )}
              {job.scheduledTime && (
                <p className="text-[12px] text-[var(--tx3)] mt-0.5">
                  Time: {job.scheduledTime}
                </p>
              )}
            </div>
          )}
          <div className="p-4">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">
              {originLabel}
            </p>
            <p className="text-[13px] font-semibold text-[var(--tx)]">
              {job.fromAddress}
            </p>
            {fromAccessDisplay && (
              <p className="text-[11px] text-[var(--tx3)] mt-1">
                Access: {fromAccessDisplay}
              </p>
            )}
          </div>
          <div className="p-4">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">
              {destinationLabel}
            </p>
            <p className="text-[13px] font-semibold text-[var(--tx)]">
              {job.toAddress}
            </p>
            {toAccessDisplay && (
              <p className="text-[11px] text-[var(--tx3)] mt-1">
                Access: {toAccessDisplay}
              </p>
            )}
          </div>
          {job.accessNotes && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-1.5">
                Access Notes
              </p>
              <p className="text-[12px] text-[var(--tx2)] whitespace-pre-wrap leading-relaxed">
                {job.accessNotes}
              </p>
            </div>
          )}
          {job.crewMembers && job.crewMembers.length > 0 && (
            <div className="p-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--tx3)]/50 mb-3">
                Crew ({job.crewMembers.length})
              </p>
              <div className="space-y-2.5">
                {job.crewMembers.map((m, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-[#5C1A33]/15 text-[#5C1A33] shrink-0">
                      {m.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-[12px] font-semibold text-[var(--tx)]">
                        {m.name}
                      </span>
                      <span className="text-[10px] text-[var(--tx3)] ml-2">
                        {m.role}
                      </span>
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
            onCountChange={(v, t) => {
              setItemsVerified(v);
              setItemsTotal(t);
            }}
            readOnly={isCompleted}
            verificationRefreshEpoch={inventoryVerifyEpoch}
          />
        </div>
      )}
      {activeTab === "items" && !hasInventory && (
        <div className="rounded-2xl border border-[var(--brd)] bg-[var(--card)] p-8 text-center">
          <p className="text-[12px] text-[var(--tx3)]">
            No inventory for this job
          </p>
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
              <p className="text-[12px] text-[var(--tx3)]">
                Start the job to capture photos
              </p>
            </div>
          )}
        </div>
      )}

      {/* Inventory Walkthrough Modal */}
      {walkthroughModalOpen && job && (
        <WalkthroughModal
          jobId={id}
          jobType={jobType}
          copyVariant={useLogisticsCopy ? "logistics" : "residential_move"}
          b2bExtraItemHints={
            job.jobType === "delivery" && Boolean(job.partnerVertical)
          }
          inventory={job.inventory || []}
          onComplete={(result) => {
            setWalkthroughDone(true);
            setWalkthroughModalOpen(false);
            setWalkthroughResult(result);
            setInventoryVerifyEpoch((n) => n + 1);
            void fetchJob();
            if (
              !result.noChanges &&
              (result.changeRequestId || jobType === "delivery")
            ) {
              setChangeRequestSubmitted(true);
            }
            // Open photo verification after walkthrough
            setPickupModalOpen(true);
          }}
          onSkip={(reason) => {
            setWalkthroughSkipped(true);
            setWalkthroughModalOpen(false);
            if (jobType === "move") {
              fetch(`/api/crew/walkthrough/${id}/skip`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ skip_reason: reason }),
              }).catch(() => {});
            }
            // Open photo verification
            setPickupModalOpen(true);
          }}
          onClose={() => setWalkthroughModalOpen(false)}
        />
      )}

      {/* Photo verification modal, shown after walkthrough */}
      {pickupModalOpen &&
        job &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/80 flex min-h-0 items-center justify-center z-[99990] animate-fade-in p-4 sm:p-5"
            data-modal-root
            data-crew-portal
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <div
              className="bg-[var(--card)] border border-[var(--brd)] rounded-t-2xl sm:rounded-2xl w-full max-w-[480px] overflow-y-auto shadow-2xl"
              data-crew-job-premium
              style={{ maxHeight: "min(90dvh, 90vh)" }}
            >
              <div className="sticky top-0 bg-[var(--card)] border-b border-[var(--brd)] px-5 py-4 z-10">
                <h3 className="font-hero text-[26px] font-bold text-[var(--tx)]">
                  Document Condition
                </h3>
                <p className="text-[12px] text-[var(--tx3)] mt-1">
                  {useLogisticsCopy
                    ? "Take photos of condition at origin before you head to drop-off."
                    : "Take photos of items and rooms before loading begins."}
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

              <div
                className="sticky bottom-0 bg-[var(--card)] border-t border-[var(--brd)] px-5 py-4 space-y-2"
                style={{
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="flex items-center justify-between text-[12px] text-[var(--tx3)] mb-1">
                  <span>
                    {pickupPhotosCount} photo
                    {pickupPhotosCount !== 1 ? "s" : ""} taken
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPickupVerificationDone(true);
                    setPickupModalOpen(false);
                  }}
                  disabled={pickupPhotosCount < 1 && totalItems > 0}
                  className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.08em] disabled:opacity-50 [font-family:var(--font-body)] leading-none"
                >
                  {pickupPhotosCount < 1 && totalItems > 0 ? (
                    "Take at least 1 photo to continue"
                  ) : (
                    <>
                      {useLogisticsCopy
                        ? "Complete, continue"
                        : "Complete, start loading"}
                      <CaretRight
                        size={18}
                        weight="bold"
                        className="shrink-0 opacity-95"
                        aria-hidden
                      />
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(false)}
                  className="crew-job-action-chip w-full py-2.5 text-[13px] font-medium text-[var(--tx3)] hover:text-[#5C1A33] hover:bg-[#5C1A33]/[0.05] transition-colors"
                >
                  Minimize
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {/* Report Modal — portaled to body so position:fixed is viewport-relative (main.tab-content uses transform animation) */}
      {reportModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[99990]"
            data-modal-root
            data-crew-portal
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
            role="presentation"
          >
            <div
              className="bg-[var(--card)] border border-[var(--brd)] rounded-2xl p-5 max-w-[360px] w-full shadow-2xl max-h-[min(90dvh,90vh)] overflow-y-auto"
              data-crew-job-premium
              role="dialog"
              aria-modal="true"
              aria-labelledby="crew-report-issue-title"
            >
              <h3
                id="crew-report-issue-title"
                className="font-hero text-[24px] font-bold text-[var(--tx)] mb-2"
              >
                Report Issue
              </h3>
              {reportSubmitted ? (
                <div className="py-4">
                  <div className="w-10 h-10 rounded-2xl bg-[#2C3E2D]/10 flex items-center justify-center mx-auto mb-3">
                    <Check size={18} color="#2C3E2D" weight="bold" />
                  </div>
                  <p className="text-[13px] text-[#243524] text-center mb-4">
                    Issue reported. Dispatch notified.
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setReportModalOpen(false);
                      setReportSubmitted(false);
                      setReportDesc("");
                      setReportUrgency(defaultUrgencyForIssue(reportType));
                    }}
                    className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[48px] font-bold text-[11px] uppercase tracking-[0.1em] [font-family:var(--font-body)] leading-none"
                  >
                    Done
                    <CaretRight
                      size={16}
                      weight="bold"
                      className="shrink-0 opacity-95"
                      aria-hidden
                    />
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                      Issue type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReportType(v);
                        setReportUrgency(defaultUrgencyForIssue(v));
                      }}
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--brd)] outline-none"
                    >
                      {MOVE_DAY_ISSUE_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                      Urgency
                    </label>
                    <select
                      value={reportUrgency}
                      onChange={(e) =>
                        setReportUrgency(
                          e.target.value as "high" | "medium" | "low",
                        )
                      }
                      className="w-full px-3 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--brd)] text-[var(--tx)] text-[13px] focus:border-[var(--brd)] outline-none"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="block text-[10px] font-semibold text-[var(--tx3)] uppercase tracking-wider mb-1">
                      Description
                    </label>
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
                      className="flex-1 py-2 border border-[var(--brd)] text-[var(--tx2)] text-[13px] font-medium hover:bg-[var(--bg)] transition-colors"
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
                              urgency: reportUrgency,
                            }),
                          });
                          if (!r.ok) throw new Error("Failed");
                          setReportSubmitted(true);
                        } catch {
                          setReportSubmitting(false);
                        }
                      }}
                      disabled={reportSubmitting}
                      className="flex-1 py-2 bg-[#B45309] text-white font-semibold disabled:opacity-50 transition-colors"
                    >
                      {reportSubmitting ? "Sending..." : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body,
        )}

      {navOpen && session && navDestination && (
        <CrewNavigation
          destination={navDestination}
          sessionId={session.id}
          jobId={jobType === "move" ? job.id : null}
          jobType={jobType}
          truckType={job.truckType ?? null}
          fuelPriceCadPerLitre={job.fuelPriceCadPerLitre ?? null}
          onExit={() => setNavOpen(false)}
          onArrived={handleNavigationArrived}
          onAutoAdvanced={fetchSession}
        />
      )}
    </PageContent>
  );
}

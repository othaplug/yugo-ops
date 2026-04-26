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
import { Yu3PortaledTokenRoot } from "@/hooks/useAdminShellTheme";
import dynamic from "next/dynamic";
import {
  CaretLeft,
  CaretRight,
  CheckCircle,
  Clock,
  Check,
  Toolbox,
  ListChecks,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatTime } from "@/lib/client-timezone";
import { formatPlatformDisplay } from "@/lib/date-format";
import {
  getNextStatus,
  getCrewCheckpointDisplayLabel,
} from "@/lib/crew-tracking-status";
import {
  getCrewStatusFlowForMove,
  getCrewStatusFlowForDelivery,
} from "@/lib/crew/service-type-flow";
import { formatPhone, normalizePhone } from "@/lib/phone";
import {
  accessLineText,
  resolveMoveAccessLines,
} from "@/lib/crew-move-access";
import PageContent from "@/app/admin/components/PageContent";
import { useCrewImmersiveNav } from "@/app/crew/components/CrewImmersiveNavContext";
import { InfoHint } from "@/components/ui/InfoHint";
import JobPhotos from "./JobPhotos";
import JobInventory from "./JobInventory";
import DayRateStopFlow from "./DayRateStopFlow";
import CrewBuildingReportCard from "@/components/crew/CrewBuildingReportCard";
import WalkthroughModal from "./WalkthroughModal";
import CrewJobTimer from "@/app/crew/components/CrewJobTimer";
import type { OperationalJobAlerts } from "@/lib/jobs/operational-alerts";
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
import { cn } from "@/lib/utils";

const CrewNavigation = dynamic(
  () =>
    import("@/components/crew/CrewNavigation").then((m) => m.CrewNavigation),
  { ssr: false },
);

const WaiverFlow = dynamic(
  () =>
    import("@/components/crew/WaiverFlow").then((m) => m.WaiverFlow),
  { ssr: false, loading: () => null },
);

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
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/90 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--yu3-ink-faint)]">
      <span className="shrink-0">Location</span>
      <span className="h-2.5 w-px shrink-0 bg-[var(--yu3-line)]/55" aria-hidden />
      <span
        className={`min-w-0 font-semibold normal-case tracking-normal ${
          locationPermission === "granted"
            ? "text-[var(--yu3-ink)]"
            : locationPermission === "denied"
              ? "text-[#B45309]"
              : "text-[var(--yu3-ink)]"
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
  viewerCrewMemberId?: string;
  viewerCrewMemberName?: string;
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
  estimatedDurationMinutes?: number | null;
  marginAlertMinutes?: number | null;
  operationalAlerts?: OperationalJobAlerts | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  partnerName?: string | null;
  partnerPhone?: string | null;
  coordinatorName?: string | null;
  coordinatorPhone?: string | null;
  /** Completed jobs: crew still owes cash / none tip report. */
  tipReportNeeded?: boolean;
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
  const [waiverFlowOpen, setWaiverFlowOpen] = useState(false);
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

  const moveStatusFlow = useMemo(
    () => getCrewStatusFlowForMove(job?.serviceType, job?.moveType),
    [job?.serviceType, job?.moveType],
  );
  const deliveryStatusFlow = useMemo(
    () => getCrewStatusFlowForDelivery(job?.serviceType, job?.bookingType),
    [job?.serviceType, job?.bookingType],
  );
  const statusFlow =
    jobType === "move" ? moveStatusFlow : deliveryStatusFlow;
  const currentStatus = session?.status || "not_started";
  const nextStatus = getNextStatus(currentStatus, jobType, {
    moveFlow: jobType === "move" ? moveStatusFlow : undefined,
    deliveryFlow: jobType === "delivery" ? deliveryStatusFlow : undefined,
  });
  const isCompleted = currentStatus === "completed";

  /** Pre-move client checklist is only relevant before the crew is on site at origin. */
  const showClientPreMovePrepBanner = useMemo(() => {
    if (jobType !== "move" || !job) return false;
    if (
      typeof job.preMoveChecklistTotal !== "number" ||
      job.preMoveChecklistTotal <= 0
    ) {
      return false;
    }
    if (currentStatus === "completed") return false;
    const flow = moveStatusFlow;
    const atPickupIdx = flow.indexOf("arrived_at_pickup");
    const atArrivedIdx = flow.indexOf("arrived");
    const originArrivedIdx =
      atPickupIdx >= 0 ? atPickupIdx : atArrivedIdx >= 0 ? atArrivedIdx : -1;
    if (originArrivedIdx < 0) return true;
    const idx = flow.indexOf(currentStatus as (typeof flow)[number]);
    if (idx < 0) return true;
    return idx < originArrivedIdx;
  }, [jobType, job, moveStatusFlow, currentStatus]);

  const isNavigatingLeg = [
    "en_route_to_pickup",
    "en_route_to_destination",
    "en_route_venue",
    "en_route_return",
    "en_route",
  ].includes(currentStatus);

  const navDestination: CrewNavDestination | null = useMemo(() => {
    if (!job || !session?.isActive || isCompleted) return null;
    if (
      currentStatus === "en_route_to_pickup" &&
      isValidNavCoord(job.fromLat, job.fromLng)
    ) {
      return { lat: job.fromLat!, lng: job.fromLng!, address: job.fromAddress };
    }
    if (
      (currentStatus === "en_route_to_destination" ||
        currentStatus === "en_route_venue") &&
      isValidNavCoord(job.toLat, job.toLng)
    ) {
      return { lat: job.toLat!, lng: job.toLng!, address: job.toAddress };
    }
    if (
      currentStatus === "en_route_return" &&
      isValidNavCoord(job.fromLat, job.fromLng)
    ) {
      return { lat: job.fromLat!, lng: job.fromLng!, address: job.fromAddress };
    }
    if (currentStatus === "en_route") {
      if (isValidNavCoord(job.toLat, job.toLng)) {
        return { lat: job.toLat!, lng: job.toLng!, address: job.toAddress };
      }
      if (isValidNavCoord(job.fromLat, job.fromLng)) {
        return { lat: job.fromLat!, lng: job.fromLng!, address: job.fromAddress };
      }
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
    if (isCompleted || !session?.isActive) return;
    const tick = () => {
      void fetchJob();
    };
    tick();
    const id = setInterval(tick, 10000);
    return () => clearInterval(id);
  }, [fetchJob, isCompleted, session?.isActive]);

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
          "Allow location when your browser asks. Live tracking is required to start this job.",
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
    } else if (currentStatus === "en_route_venue") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            void doAdvance(
              "arrived_venue",
              p.coords.latitude,
              p.coords.longitude,
            ),
          () => void doAdvance("arrived_venue"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        void doAdvance("arrived_venue");
      }
    } else if (currentStatus === "en_route_return") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            void doAdvance(
              "unloading_return",
              p.coords.latitude,
              p.coords.longitude,
            ),
          () => void doAdvance("unloading_return"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        void doAdvance("unloading_return");
      }
    } else if (currentStatus === "en_route") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (p) =>
            void doAdvance("arrived", p.coords.latitude, p.coords.longitude),
          () => void doAdvance("arrived"),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
        );
      } else {
        void doAdvance("arrived");
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

  /** Must run every render: hooks that depend on `job` / `useLogisticsCopy` cannot sit after `loading` / `!job` / day-rate early returns (React #310). */
  const useLogisticsCopy =
    jobType === "delivery" ||
    (() => {
      const st = (job?.serviceType || "").toLowerCase();
      return st === "b2b_delivery" || st === "b2b_oneoff";
    })();

  if (loading) {
    return (
      <PageContent className="crew-job-premium w-full min-w-0 max-w-[520px] mx-auto">
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--yu3-wine)]/25 border-t-[var(--yu3-wine)] rounded-full animate-spin" />
            <p className="text-[13px] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)]">Loading job...</p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (!job) {
    return (
      <PageContent className="crew-job-premium w-full min-w-0 max-w-[520px] mx-auto">
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <p className="text-[var(--text-base)] text-[var(--red)] mb-4">
            {error || "Job not found"}
          </p>
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-2 py-2.5 px-4 rounded-[var(--yu3-r-lg)] text-[13px] font-medium text-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-tint)] transition-colors [font-family:var(--font-body)]"
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
      <PageContent className="crew-job-premium w-full min-w-0 max-w-[520px] mx-auto">
        <div className="flex items-center gap-2 mb-5">
          <Link
            href="/crew/dashboard"
            className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-[var(--yu3-r-md)] text-[12px] font-medium text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-tint)] transition-colors [font-family:var(--font-body)]"
          >
            <CaretLeft size={15} weight="regular" />
            Jobs
          </Link>
          <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-teal-700 [font-family:var(--font-body)]">
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
  const finalWalkPhotoAtLoading =
    jobType === "move" && !moveStatusFlow.includes("unloading");
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
  const tabs: { id: TabId; label: string }[] = [
    { id: "status", label: "Status" },
    { id: "details", label: "Details" },
    { id: "items", label: itemsLabel },
    { id: "photos", label: "Photos" },
  ];

  const hasInventory =
    (job.inventory?.length ?? 0) > 0 ||
    (job.extraItems?.length ?? 0) > 0 ||
    (jobType === "move" &&
      job.moveType === "residential" &&
      (job.inventory?.length ?? 0) === 0);
  let { from: fromAccessRaw, to: toAccessRaw } = resolveMoveAccessLines({
    fromAccess: job.fromAccess,
    toAccess: job.toAccess,
    accessNotes: job.accessNotes,
  });
  if (!fromAccessRaw?.trim() && !toAccessRaw?.trim() && job.access?.trim()) {
    const combined = job.access.trim();
    if (combined.includes("->")) {
      const parts = combined.split("->").map((x) => x.trim());
      if (parts[0]) fromAccessRaw = fromAccessRaw || parts[0];
      if (parts[1]) toAccessRaw = toAccessRaw || parts[1];
    } else {
      fromAccessRaw = fromAccessRaw || combined;
    }
  }
  const fromAccessLine = accessLineText(fromAccessRaw);
  const toAccessLine = accessLineText(toAccessRaw);
  const originLabel = useLogisticsCopy ? "Origin" : "Pickup";
  const destinationLabel = useLogisticsCopy ? "Destination" : "Drop-off";

  return (
    <PageContent className="crew-job-premium w-full min-w-0 max-w-[520px] mx-auto">
      <Suspense fallback={null}>
        <OpenNavFromQuery setNavOpen={setNavOpen} />
      </Suspense>

      {/* ── Top bar ── */}
      <div className="flex items-center justify-between gap-2 mb-6 pb-1 border-b border-[var(--yu3-line-subtle)]">
        <Link
          href="/crew/dashboard"
          className="inline-flex items-center gap-1.5 py-1.5 px-2.5 -ml-2.5 rounded-[var(--yu3-r-md)] text-[12px] font-medium text-[var(--yu3-ink-faint)] hover:text-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-tint)] transition-colors [font-family:var(--font-body)]"
        >
          <CaretLeft size={15} weight="regular" />
          Jobs
        </Link>
        <div className="flex items-center gap-1.5 flex-wrap justify-end">
          {(session?.isActive || isCompleted) && (
            <div className="flex items-center gap-1 px-2.5 py-1 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line-subtle)] shadow-[var(--yu3-shadow-sm)]">
              <Clock size={11} className="text-[var(--yu3-wine)]/60" aria-hidden />
              <span className="text-[11px] font-bold text-[var(--yu3-ink)] tabular-nums [font-family:var(--font-body)]">
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
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold [font-family:var(--font-body)] ${
                locationPermission === "denied" ||
                locationPermission === "unsupported"
                  ? "bg-red-500/10 text-red-400 border border-red-500/25"
                  : "bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)] border border-[var(--yu3-wine)]/20"
              }`}
            >
              <span className="relative flex h-1.5 w-1.5">
                {locationPermission !== "denied" &&
                  locationPermission !== "unsupported" && (
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--yu3-wine)] opacity-35" />
                  )}
                <span
                  className={`relative inline-flex rounded-full h-1.5 w-1.5 ${
                    locationPermission === "denied" ||
                    locationPermission === "unsupported"
                      ? "bg-red-400"
                      : "bg-[var(--yu3-wine)]"
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
                  className="shrink-0 text-[11px] font-semibold text-[var(--yu3-wine)] underline-offset-2 hover:underline [font-family:var(--font-body)]"
                >
                  Check again
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {!isCompleted &&
        job &&
        job.estimatedDurationMinutes != null &&
        job.estimatedDurationMinutes > 0 && (
          <CrewJobTimer
            elapsedMs={session?.isActive ? elapsedMs : 0}
            estimatedMinutes={job.estimatedDurationMinutes}
            marginAlertMinutes={
              job.marginAlertMinutes != null && job.marginAlertMinutes > 0
                ? job.marginAlertMinutes
                : job.estimatedDurationMinutes
            }
            startedAtIso={session?.startedAt ?? null}
            operationalAlerts={job.operationalAlerts ?? null}
          />
        )}

      {showStartButton &&
        (locationPermission === "prompt" ||
          locationPermission === "unknown") && (
          <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-3 leading-relaxed [font-family:var(--font-body)]">
            Live tracking is required for this job for safety and verification.
            Allow when prompted so dispatch
            {useLogisticsCopy ? " and the receiver " : " and the client "}
            can follow your progress.
          </p>
        )}
      {showStartButton && locationPermission === "denied" && (
        <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-3 leading-relaxed [font-family:var(--font-body)]">
          Live tracking needs location access. Turn it on in your browser or
          device settings, then tap Check again.
        </p>
      )}

      {/* Job header: flat strip (no card) — route + title stay visible on all tabs */}
      <div className="mb-5 pb-4 border-b border-[var(--yu3-line-subtle)]">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="yu3-t-eyebrow text-[10px] text-[var(--yu3-wine)]/80 mb-1 [font-family:var(--font-body)] leading-none">
              {job.jobTypeLabel}
            </p>
            <h1 className="font-hero text-[28px] font-semibold text-[var(--yu3-ink-strong)] leading-[1.12] truncate tracking-[-0.02em]">
              {job.clientName}
            </h1>
            <p className="text-[12px] font-semibold text-[var(--yu3-ink-muted)] mt-1 font-mono tracking-wide">
              {job.jobId}
            </p>
            {job.scheduledDate && (
              <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-1.5 [font-family:var(--font-body)]">
                {formatPlatformDisplay(`${job.scheduledDate}T12:00:00`, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })}
              </p>
            )}
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
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--yu3-wine)]/30 bg-[var(--yu3-wine-tint)] text-[var(--yu3-wine)] [font-family:var(--font-body)]">
                      B2B delivery
                    </span>
                  ) : null}
                  {showCrew ? (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                      {n}-person crew planned
                    </span>
                  ) : null}
                  {badges.map((b) => (
                    <span
                      key={b}
                      className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-[var(--yu3-warning)]/30 bg-[var(--yu3-warning-tint)] text-[var(--yu3-warning)] [font-family:var(--font-body)]"
                    >
                      {b}
                    </span>
                  ))}
                </div>
              );
            })()}
          </div>
          {isCompleted && (
            <span className="shrink-0 rounded-md bg-[var(--yu3-forest)]/[0.1] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-forest)] [font-family:var(--font-body)] leading-none">
              Complete
            </span>
          )}
        </div>
        <div className="border-t border-[var(--yu3-line-subtle)] pt-4">
          <div className="flex gap-3.5">
            <div className="flex flex-col items-center shrink-0 pt-1">
              <div className="w-4 h-4 rounded-full border-2 border-[var(--yu3-wine)]/45 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--yu3-wine)]" />
              </div>
              <div
                className="w-[2px] flex-1 my-1 rounded-full bg-[var(--yu3-wine)]/15"
                style={{ minHeight: 20 }}
              />
              <div className="w-4 h-4 rounded-full border-2 border-[var(--yu3-forest)]/40 flex items-center justify-center shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--yu3-forest)]" />
              </div>
            </div>

            <div className="flex flex-col justify-between min-w-0 flex-1 gap-4">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)] mb-1 [font-family:var(--font-body)] leading-none">
                  {originLabel}
                </p>
                <p className="text-[15px] text-[var(--yu3-ink)] leading-snug font-medium tracking-[-0.01em]">
                  {job.fromAddress}
                </p>
                {fromAccessLine && (
                  <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1.5 leading-snug [font-family:var(--font-body)]">
                    {fromAccessLine}
                  </p>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)] mb-1 [font-family:var(--font-body)] leading-none">
                  {destinationLabel}
                </p>
                <p className="text-[15px] text-[var(--yu3-ink)] leading-snug font-medium tracking-[-0.01em]">
                  {job.toAddress}
                </p>
                {toAccessLine && (
                  <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1.5 leading-snug [font-family:var(--font-body)]">
                    {toAccessLine}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex justify-center border-b border-[var(--yu3-line-subtle)] mb-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            type="button"
            className={`relative flex-1 min-h-[44px] px-3 py-3 text-[11px] font-bold tracking-[0.12em] uppercase transition-colors duration-150 whitespace-nowrap touch-manipulation [font-family:var(--font-body)] leading-none ${
              activeTab === t.id
                ? "text-[var(--yu3-wine)]"
                : "text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-wine)]"
            }`}
          >
            {t.label}
            {activeTab === t.id && (
              <span className="absolute bottom-0 left-3 right-3 h-0.5 rounded-full bg-[var(--yu3-wine)]" />
            )}
          </button>
        ))}
      </div>

      {/* ══════════════ STATUS TAB ══════════════ */}
      {activeTab === "status" && (
        <div className="space-y-5">
          {jobCompleted && job.tipReportNeeded && (
            <div className="space-y-1.5">
              <p className="text-[12px] font-bold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                Tip report
              </p>
              <p className="text-[11px] text-[var(--yu3-ink-muted)] leading-snug [font-family:var(--font-body)]">
                Log cash or Interac tips, or confirm no tip, for this completed job.
              </p>
              <Link
                href={`/crew/dashboard/job/${jobType}/${id}/tip-report`}
                className="group inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 py-2 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] transition-colors [font-family:var(--font-body)] leading-none hover:text-[var(--yu3-wine)]"
              >
                Open tip report
                <CaretRight
                  size={14}
                  weight="bold"
                  className="shrink-0 text-[var(--yu3-ink-faint)] transition-colors group-hover:text-[var(--yu3-wine)]"
                  aria-hidden
                />
              </Link>
            </div>
          )}
          {actionError && (
            <div className="mx-2 rounded-[10px] border border-red-200/80 bg-red-50/90 px-3 py-2.5">
              <p className="text-[11px] text-red-800 leading-relaxed">
                {actionError}
              </p>
            </div>
          )}

          {showClientPreMovePrepBanner && job && (
              <div
                className={`mx-2 flex items-start gap-3 rounded-[var(--yu3-r-xl)] border px-4 py-3 ${
                  job.preMoveChecklistAllComplete
                    ? "border-[var(--yu3-forest)]/30 bg-[var(--yu3-forest)]/8"
                    : "border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-sunken)]/80"
                }`}
              >
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yu3-r-lg)] ${
                    job.preMoveChecklistAllComplete
                      ? "bg-[var(--yu3-forest)]/20 text-[var(--yu3-forest)]"
                      : "bg-[var(--yu3-wine-tint)] text-[var(--yu3-ink-muted)]"
                  }`}
                >
                  <ListChecks size={22} weight="bold" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                    Client pre-move prep
                  </p>
                  <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1 leading-snug">
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
                        link. Confirm access and parking with dispatch if
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
              className="mx-2 flex items-center gap-3 rounded-[var(--yu3-r-xl)] border border-[var(--yu3-wine)]/25 bg-[var(--yu3-wine-tint)] px-4 py-3.5 transition-colors hover:bg-[var(--yu3-wine-wash)]"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--yu3-r-lg)] bg-[var(--yu3-wine)]/15 text-[var(--yu3-wine)]">
                <Toolbox size={22} aria-hidden />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                  Truck equipment check
                </p>
                <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-0.5 leading-snug">
                  Count gear before your next stop or end-of-day report. Client
                  sign-off is already done.
                </p>
              </div>
              <span className="text-[11px] font-semibold text-[var(--yu3-wine)] shrink-0 [font-family:var(--font-body)]">
                Open
              </span>
            </Link>
          )}

          {jobCompleted && jobType === "move" && (
            <CrewBuildingReportCard
              moveId={job.id}
              address={job.toAddress}
              lat={job.toLat ?? null}
              lng={job.toLng ?? null}
            />
          )}

          {/* Live tracking tips: compact label + InfoHint so the main column stays clear */}
          {(showStartButton || (session?.isActive && !isCompleted)) && (
            <div className="px-2 flex justify-center items-center gap-2 py-0.5 min-h-0">
              <span className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)] select-none">
                Tracking tips
              </span>
              <InfoHint
                variant="crew"
                align="center"
                side="top"
                iconSize={15}
                ariaLabel="Tips for live tracking"
              >
                <div className="space-y-2 [font-family:var(--font-body)]">
                  <p>
                    Keep location on for the whole job. Live tracking stays
                    active until you finish.
                  </p>
                  <p>
                    {jobType === "delivery"
                      ? "Keep your device charged during deliveries for uninterrupted tracking."
                      : "Keep your device charged during moves for uninterrupted tracking."}
                  </p>
                </div>
              </InfoHint>
            </div>
          )}

          {session?.isActive &&
            !isCompleted &&
            isNavigatingLeg &&
            canUseLocationActions &&
            !navDestination && (
              <p className="px-2 text-[10px] text-[var(--yu3-ink-muted)] text-center leading-snug max-w-[380px] mx-auto [font-family:var(--font-body)]">
                Map routing needs coordinates for this job. Open the Details tab
                for full addresses, or ask dispatch to verify{" "}
                {useLogisticsCopy
                  ? "origin and destination"
                  : "pickup and drop-off"}{" "}
                pins. Use{" "}
                <span className="text-[var(--yu3-wine)] font-semibold">
                  Navigation
                </span>{" "}
                in the crew menu when pins are available.
              </p>
            )}

          {showStartButton && (
            <div className="px-2 space-y-3">
              <button
                type="button"
                onClick={() => void startJob()}
                disabled={advancing || blockedByLocation}
                className="crew-premium-cta inline-flex w-full items-center justify-center py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.12em] text-[#fffbf7] active:scale-[0.99] [font-family:var(--font-body)] leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/35 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--yu3-bg-canvas)]"
              >
                {advancing ? "Starting…" : "Start job"}
              </button>
              {blockedByLocation && (
                <p className="text-[10px] text-[var(--yu3-ink-muted)] text-center leading-snug px-1 [font-family:var(--font-body)]">
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

          {/* Optional note — attached to noteInputRef; sent with the next checkpoint API call */}
          {session?.isActive && !isCompleted && (
            <div className="px-2 space-y-1.5">
              <label
                htmlFor="crew-checkpoint-note"
                className="block text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]"
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
                className="w-full px-3.5 py-2.5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] text-[var(--yu3-ink)] placeholder:text-[var(--yu3-ink-muted)] text-[13px] outline-none focus:ring-2 focus:ring-[var(--yu3-wine)]/25 focus:ring-offset-0 [font-family:var(--font-body)]"
                autoComplete="off"
              />
            </div>
          )}

          {/* Walkthrough gate, shown when at pickup and walkthrough not done */}
          {currentStatus === "arrived_at_pickup" && blockedByWalkthrough && (
            <div className="rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-wine-wash)] p-4 sm:p-5 space-y-3">
              <div>
                <p className="text-[12px] font-bold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                  {useLogisticsCopy
                    ? "Job List Verification Required"
                    : "Inventory Walkthrough Required"}
                </p>
                <p className="text-[11px] text-[var(--yu3-ink-muted)]">
                  {useLogisticsCopy
                    ? jobType === "delivery"
                      ? "Complete before you leave origin for drop-off"
                      : "Complete before loading starts"
                    : "Complete before loading starts"}
                </p>
              </div>
              <p className="text-[12px] text-[var(--yu3-ink-muted)] leading-relaxed">
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
                className="crew-premium-cta inline-flex min-h-[48px] items-center justify-center px-4 py-2.5 font-bold text-[11px] uppercase tracking-[0.1em] text-[#fffbf7] [font-family:var(--font-body)] leading-none"
              >
                Start inventory check
              </button>
            </div>
          )}

          {/* Change request submitted banner */}
          {changeRequestSubmitted &&
            walkthroughResult &&
            !walkthroughResult.noChanges && (
              <div className="rounded-2xl border border-[var(--yu3-wine)]/20 bg-[var(--yu3-wine-tint)] px-4 py-3 flex items-start gap-2.5">
                <CheckCircle
                  size={16}
                  color="#5C1A33"
                  className="shrink-0 mt-0.5"
                />
                <div>
                  <p className="text-[12px] font-bold text-[var(--yu3-ink)]">
                    {jobType === "delivery"
                      ? "Walkthrough logged"
                      : "Change request submitted"}
                  </p>
                  <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-0.5">
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
                className="crew-premium-cta w-full inline-flex min-h-[52px] items-center justify-center py-3 font-bold text-[11px] uppercase tracking-[0.1em] text-[#fffbf7] active:scale-[0.99] [font-family:var(--font-body)] leading-none"
              >
                {useLogisticsCopy ? "Receiver sign-off" : "Client sign-off"}
              </Link>
            ) : canUseLocationActions ? (
              <button
                type="button"
                onClick={advanceStatus}
                disabled={advancing}
                className="crew-premium-cta inline-flex w-full min-h-[52px] items-center justify-center py-3 font-semibold text-[11px] uppercase tracking-[0.08em] text-[#fffbf7] disabled:opacity-100 disabled:bg-[var(--yu3-wine-press)] active:scale-[0.99] [font-family:var(--font-body)] leading-none"
              >
                {advancing
                  ? "Updating…"
                  : getCrewCheckpointDisplayLabel(
                      nextStatus!,
                      useLogisticsCopy,
                    )}
              </button>
            ) : null)}
          {showAdvanceButton && canUseLocationActions && blockedByPhotos && (
            <p className="text-center text-[11px] text-[var(--yu3-ink-muted)] py-2 [font-family:var(--font-body)]">
              Take photos in the Photos tab to advance
            </p>
          )}

          {/* Timeline — vertical track, Yugo type, checks for completed steps */}
          <div>
            <div className="flex items-center justify-between border-b border-[var(--yu3-line-subtle)] pb-3">
              <h2 className="font-hero text-[22px] font-semibold leading-tight tracking-tight text-[var(--yu3-wine)] sm:text-[24px]">
                Timeline
              </h2>
              {session?.startedAt && (
                <span className="text-[10px] font-medium tabular-nums text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                  Started{" "}
                  {formatTime(session.startedAt, {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
            </div>
            <div className="relative pt-3">
              <div
                className="pointer-events-none absolute bottom-5 left-[14px] top-5 w-px -translate-x-1/2 bg-[var(--yu3-line-subtle)]"
                aria-hidden
              />
              <ol
                className="m-0 list-none space-y-0 p-0"
                aria-label="Job timeline"
              >
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

                  const stepLabel = getCrewCheckpointDisplayLabel(
                    s,
                    useLogisticsCopy,
                  );

                  return (
                    <li
                      key={s}
                      className={cn(
                        "flex gap-3.5",
                        !isLast && "pb-5",
                        isLast && "pb-0",
                      )}
                      aria-current={state === "act" ? "step" : undefined}
                    >
                      <div className="relative z-[1] flex w-7 shrink-0 justify-center pt-0.5">
                        {state === "done" && (
                          <div
                            className={cn(
                              "flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2",
                              isLast && isCompleted
                                ? "border-[var(--yu3-forest)] bg-[var(--yu3-forest)] shadow-[0_0_0_4px_color-mix(in_srgb,var(--yu3-forest)_12%,transparent)]"
                                : "border-[color-mix(in_srgb,var(--yu3-forest)_50%,var(--yu3-line))] bg-[color-mix(in_srgb,var(--yu3-forest)_14%,var(--yu3-bg-surface))]",
                            )}
                          >
                            <Check
                              aria-hidden
                              className={
                                isLast && isCompleted
                                  ? "text-[#fffbf7]"
                                  : "text-[var(--yu3-forest)]"
                              }
                              size={12}
                              weight="bold"
                            />
                          </div>
                        )}
                        {state === "act" && (
                          <div
                            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[var(--yu3-wine)] bg-[var(--yu3-wine)] shadow-[0_0_0_5px_color-mix(in_srgb,var(--yu3-wine)_20%,transparent)]"
                            aria-hidden
                          >
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[rgba(255,251,247,0.9)]" />
                          </div>
                        )}
                        {state === "wait" && (
                          <div
                            className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border-2 border-[color-mix(in_srgb,var(--yu3-wine)_18%,var(--yu3-line))] bg-[var(--yu3-bg-surface)]"
                            aria-hidden
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-[color-mix(in_srgb,var(--yu3-wine)_15%,transparent)]" />
                          </div>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
                          <p className="text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
                            Step {i + 1} of {statusFlow.length}
                          </p>
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {elapsed !== null && elapsed > 0 && (
                              <span className="text-[10px] font-semibold tabular-nums text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                                {elapsed}m
                              </span>
                            )}
                          </div>
                        </div>
                        {stepTs ? (
                          <p className="mt-1.5">
                            <span className="inline-flex items-center rounded-full bg-[var(--yu3-forest)]/10 px-2 py-0.5 text-[9px] font-bold uppercase leading-none tracking-[0.1em] text-[var(--yu3-forest)] [font-family:var(--font-body)] tabular-nums">
                              {formatTime(stepTs, {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                          </p>
                        ) : null}
                        <h3
                          className={cn(
                            "mt-1.5 text-[15px] leading-snug tracking-tight",
                            state === "done" &&
                              "font-semibold text-[var(--yu3-ink-strong)]",
                            state === "act" &&
                              "font-bold text-[var(--yu3-wine)]",
                            state === "wait" &&
                              "font-medium text-[var(--yu3-ink-muted)]",
                          )}
                        >
                          {stepLabel}
                        </h3>
                        {state === "act" && (
                          <p className="mt-1 text-[9px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--yu3-wine)] [font-family:var(--font-body)]">
                            Now
                          </p>
                        )}
                        {cp?.note ? (
                          <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--yu3-ink-muted)]">
                            {cp.note}
                          </p>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>

          {/* Risk waiver (outlined) + subtle text link for report */}
          {!isCompleted && (
            <div className="pt-2 pb-1">
              <div className="flex flex-col items-center justify-center gap-1">
                {session?.isActive && jobType === "move" && (
                  <button
                    type="button"
                    onClick={() => setWaiverFlowOpen(true)}
                    className="inline-flex min-h-[36px] items-center justify-center rounded-[var(--yu3-r-md)] border border-[var(--yu3-wine)] bg-transparent px-3.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-wine)] [font-family:var(--font-body)] leading-none transition-colors hover:bg-[var(--yu3-wine)]/6 active:brightness-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]/35 touch-manipulation"
                    aria-label="Open on-site risk waiver"
                  >
                    Risk waiver
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setReportModalOpen(true)}
                  className="min-h-[36px] border-0 bg-transparent px-2 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)] leading-none transition-colors hover:text-[var(--yu3-wine)] active:text-[var(--yu3-wine)] focus-visible:rounded-[var(--yu3-r-sm)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)]/35 touch-manipulation"
                  aria-label="Report an issue to dispatch"
                >
                  Report issue
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ DETAILS TAB ══════════════ */}
      {activeTab === "details" && (
        <>
          {/* Project context banner */}
          {job.projectContext && (
            <div className="mb-5 rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-wine-tint)]/60 px-3 py-3 sm:px-4">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-wine)]/75 mb-0.5 [font-family:var(--font-body)]">
                Part of Project
              </p>
              <p className="text-[13px] font-semibold text-[var(--yu3-ink)]">
                {job.projectContext.projectNumber},{" "}
                {job.projectContext.projectName}
              </p>
              {job.projectContext.phaseName && (
                <p className="text-[11px] text-[var(--yu3-wine)] mt-0.5 [font-family:var(--font-body)]">
                  {job.projectContext.phaseName}
                </p>
              )}
            </div>
          )}
          {(job.scheduledDate || job.arrivalWindow) && (
            <div className="mb-5">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-2 [font-family:var(--font-body)]">
                Schedule
              </p>
              {job.scheduledDate && (
                <p className="text-[15px] font-semibold text-[var(--yu3-ink)]">
                  {formatPlatformDisplay(job.scheduledDate + "T12:00:00", {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              )}
              {job.arrivalWindow && (
                <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-1">
                  Window: {job.arrivalWindow}
                </p>
              )}
              {job.scheduledTime && (
                <p className="text-[12px] text-[var(--yu3-ink-muted)] mt-0.5">
                  Time: {job.scheduledTime}
                </p>
              )}
            </div>
          )}
          <div className="mb-5">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-1.5 [font-family:var(--font-body)]">
              {originLabel}
            </p>
            <p className="text-[13px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
              {job.fromAddress}
            </p>
            {fromAccessLine && (
              <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1.5 leading-snug [font-family:var(--font-body)]">
                {fromAccessLine}
              </p>
            )}
          </div>
          <div className="mb-5">
            <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-1.5 [font-family:var(--font-body)]">
              {destinationLabel}
            </p>
            <p className="text-[13px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
              {job.toAddress}
            </p>
            {toAccessLine && (
              <p className="text-[13px] font-medium text-[var(--yu3-ink)] mt-1.5 leading-snug [font-family:var(--font-body)]">
                {toAccessLine}
              </p>
            )}
          </div>
          {job.crewMembers && job.crewMembers.length > 0 && (
            <div className="mb-5">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-2 [font-family:var(--font-body)]">
                Crew ({job.crewMembers.length})
              </p>
              <div className="space-y-1.5">
                {job.crewMembers.map((m, i) => (
                  <p
                    key={i}
                    className="text-[12px] text-[var(--yu3-ink)] [font-family:var(--font-body)]"
                  >
                    <span className="font-semibold">{m.name}</span>
                    {m.role ? (
                      <span className="text-[11px] font-normal text-[var(--yu3-ink-muted)]">
                        {" "}
                        {m.role}
                      </span>
                    ) : null}
                  </p>
                ))}
              </div>
            </div>
          )}
          {(job.clientName || job.clientPhone) && (
            <div className="mb-5">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-1.5 [font-family:var(--font-body)]">
                Client
              </p>
              {job.clientName ? (
                <p className="text-[13px] font-semibold text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                  {job.clientName}
                </p>
              ) : null}
              {job.clientPhone ? (
                <a
                  href={`tel:${normalizePhone(job.clientPhone)}`}
                  className={`block w-fit text-[13px] font-medium text-[var(--yu3-ink)] [font-family:var(--font-body)] hover:underline underline-offset-2 decoration-[var(--yu3-ink)]/30 hover:decoration-[var(--yu3-wine)] ${job.clientName ? "mt-1" : "mt-0"}`}
                  aria-label={`Call ${formatPhone(job.clientPhone) || job.clientPhone}`}
                >
                  {formatPhone(job.clientPhone) || job.clientPhone}
                </a>
              ) : null}
            </div>
          )}
          {job.internalNotes && (
            <div className="mb-0">
              <p className="text-[9px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] mb-1.5 [font-family:var(--font-body)]">
                Notes
              </p>
              <p className="text-[12px] text-[var(--yu3-ink-muted)] whitespace-pre-wrap leading-relaxed [font-family:var(--font-body)]">
                {job.internalNotes}
              </p>
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
        <div className="rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-8 text-center shadow-[var(--yu3-shadow-sm)]">
          <p className="text-[12px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
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
              finalWalkPhotoAtLoading={finalWalkPhotoAtLoading}
              readOnly={isCompleted}
            />
          ) : (
            <div className="rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-8 text-center shadow-[var(--yu3-shadow-sm)]">
              <p className="text-[12px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
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
            className="fixed inset-0 z-[99990] flex min-h-0 items-center justify-center p-4 sm:p-5 animate-fade-in modal-overlay"
            data-modal-root
            data-crew-portal
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
          >
            <Yu3PortaledTokenRoot
              dataTheme="light"
              className="w-full max-w-[480px] overflow-y-auto rounded-t-[var(--yu3-r-xl)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink)] shadow-[var(--yu3-shadow-lg)] sm:rounded-[var(--yu3-r-xl)]"
              data-crew-job-premium
              style={{ maxHeight: "min(90dvh, 90vh)" }}
            >
              <div className="sticky top-0 z-10 border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-5 py-4">
                <h3 className="font-hero text-[26px] font-bold text-[var(--yu3-ink-strong)]">
                  Document Condition
                </h3>
                <p className="text-[12px] text-[var(--yu3-ink-faint)] mt-1">
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
                    finalWalkPhotoAtLoading={finalWalkPhotoAtLoading}
                  />
                )}
              </div>

              <div
                className="sticky bottom-0 space-y-2 border-t border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-5 py-4"
                style={{
                  paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
                }}
              >
                <div className="flex items-center justify-between text-[12px] text-[var(--yu3-ink-faint)] mb-1">
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
                  className="crew-premium-cta inline-flex w-full items-center justify-center gap-2 py-3 min-h-[52px] font-bold text-[11px] uppercase tracking-[0.08em] text-[#fffbf7] disabled:opacity-50 [font-family:var(--font-body)] leading-none"
                >
                  {pickupPhotosCount < 1 && totalItems > 0
                    ? "Take at least 1 photo to continue"
                    : useLogisticsCopy
                      ? "Complete, continue"
                      : "Complete, start loading"}
                </button>
                <button
                  type="button"
                  onClick={() => setPickupModalOpen(false)}
                  className="crew-job-action-chip w-full py-2.5 text-[13px] font-medium text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-wine)] hover:bg-[var(--yu3-wine-tint)] transition-colors [font-family:var(--font-body)]"
                >
                  Minimize
                </button>
              </div>
            </Yu3PortaledTokenRoot>
          </div>,
          document.body,
        )}

      {/* Report Modal — portaled to body so position:fixed is viewport-relative (main.tab-content uses transform animation) */}
      {job &&
        jobType === "move" &&
        job.viewerCrewMemberId &&
        typeof job.clientName === "string" && (
          <WaiverFlow
            open={waiverFlowOpen}
            onClose={() => setWaiverFlowOpen(false)}
            moveId={job.id}
            clientName={job.clientName}
            viewerCrewMemberId={job.viewerCrewMemberId}
            viewerCrewMemberName={job.viewerCrewMemberName ?? ""}
          />
        )}

      {reportModalOpen &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="premium-field-host fixed inset-0 z-[99990] flex items-center justify-center p-4 modal-overlay"
            data-modal-root
            data-crew-portal
            style={{
              paddingBottom: "max(1rem, env(safe-area-inset-bottom, 0px))",
            }}
            role="presentation"
          >
            <Yu3PortaledTokenRoot
              dataTheme="light"
              className="max-h-[min(90dvh,90vh)] w-full max-w-[360px] overflow-y-auto rounded-[var(--yu3-r-xl)] border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-5 text-[var(--yu3-ink)] shadow-[var(--yu3-shadow-lg)]"
              data-crew-job-premium
              role="dialog"
              aria-modal="true"
              aria-labelledby="crew-report-issue-title"
            >
              <h3
                id="crew-report-issue-title"
                className="font-hero text-[24px] font-bold text-[var(--yu3-ink-strong)] mb-2"
              >
                Report Issue
              </h3>
              {reportSubmitted ? (
                <div className="py-4">
                  <div className="w-10 h-10 rounded-2xl bg-[var(--yu3-wine-tint)] flex items-center justify-center mx-auto mb-3">
                    <Check size={18} color="#5C1A33" weight="bold" />
                  </div>
                  <p className="text-[13px] text-[var(--yu3-ink)] text-center mb-4">
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
                    className="crew-premium-cta inline-flex w-full min-h-[48px] items-center justify-center py-3 font-bold text-[11px] uppercase tracking-[0.1em] text-[#fffbf7] [font-family:var(--font-body)] leading-none"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="admin-premium-label admin-premium-label--tight">
                      Issue type
                    </label>
                    <select
                      value={reportType}
                      onChange={(e) => {
                        const v = e.target.value;
                        setReportType(v);
                        setReportUrgency(defaultUrgencyForIssue(v));
                      }}
                      className="admin-premium-input w-full text-[var(--yu3-ink)]"
                    >
                      {MOVE_DAY_ISSUE_OPTIONS.map((o) => (
                        <option key={o.code} value={o.code}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="admin-premium-label admin-premium-label--tight">
                      Urgency
                    </label>
                    <select
                      value={reportUrgency}
                      onChange={(e) =>
                        setReportUrgency(
                          e.target.value as "high" | "medium" | "low",
                        )
                      }
                      className="admin-premium-input w-full text-[var(--yu3-ink)]"
                    >
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                  <div className="mb-4">
                    <label className="admin-premium-label admin-premium-label--tight">
                      Description
                    </label>
                    <textarea
                      value={reportDesc}
                      onChange={(e) => setReportDesc(e.target.value)}
                      placeholder="Describe what happened..."
                      rows={3}
                      className="admin-premium-textarea w-full resize-none text-[var(--yu3-ink)]"
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
                      className="flex-1 py-2 rounded-[var(--yu3-r-md)] bg-[var(--yu3-wine)] text-[#fffbf7] text-[13px] font-semibold border border-[var(--yu3-wine)] hover:brightness-[0.97] active:brightness-[0.95] disabled:opacity-50 transition-[filter,opacity] [font-family:var(--font-body)]"
                    >
                      {reportSubmitting ? "Sending..." : "Submit"}
                    </button>
                  </div>
                </>
              )}
            </Yu3PortaledTokenRoot>
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

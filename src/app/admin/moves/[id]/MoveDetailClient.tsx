"use client";

import {
  useState,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import BackButton from "../../components/BackButton";
import {
  PencilSimple as Pencil,
  CaretDown as ChevronDown,
  Lock,
} from "@phosphor-icons/react";
import MoveNotifyButton from "../MoveNotifyButton";
import ResendTrackingLinkButton from "../ResendTrackingLinkButton";
import MoveContactModal from "./MoveContactModal";
import EditMoveDetailsModal from "./EditMoveDetailsModal";
import MoveInventorySection from "./MoveInventorySection";
import InventoryChangeRequestPanel from "./InventoryChangeRequestPanel";
import MoveFilesSection from "./MoveFilesSection";
import MoveModificationQuickForm from "./MoveModificationQuickForm";
import MoveSignOffSection from "./MoveSignOffSection";
import LiveTrackingMap from "../../deliveries/[id]/LiveTrackingMap";
import CollapsibleSection from "@/components/CollapsibleSection";
import IncidentsSection from "../../components/IncidentsSection";
import DistanceLogistics from "./DistanceLogistics";
import ModalOverlay from "../../components/ModalOverlay";
import SegmentedProgressBar from "../../components/SegmentedProgressBar";
import { useToast } from "../../components/Toast";
import { useRelativeTime } from "./useRelativeTime";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { PageHeader, PageMetaDivider } from "@/design-system/admin/layout";
import {
  Button,
  StatusPill,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/design-system/admin/primitives";
import {
  isPreMoveChecklistComplete,
  preMoveChecklistCounts,
} from "@/lib/pre-move-checklist";
import EstateServiceChecklistAdminRow from "./EstateServiceChecklistAdminRow";
import {
  formatMoveDate,
  formatPlatformDisplay,
  parseDateOnly,
} from "@/lib/date-format";
import { ProfitabilityBreakdownHint } from "@/components/admin/AdminContextHints";
import PostCompletionPriceEdit from "../../components/PostCompletionPriceEdit";
import MoveWaiversSection, { type MoveWaiverRow } from "./MoveWaiversSection";
import MoveResidentialProjectPanel from "./MoveResidentialProjectPanel";
import CrewJobTimer from "@/app/crew/components/CrewJobTimer";
import { capMarginAlertMinutes } from "@/lib/jobs/duration-estimate";
import type { OperationalJobAlerts } from "@/lib/jobs/operational-alerts";
import { formatMinutesAsHhMm } from "@/lib/duration-hhmm";
import { getMoveDetailPath } from "@/lib/move-code";

function isEstateTierMove(m: {
  tier_selected?: string | null;
  service_tier?: string | null;
}) {
  return (
    String(m.tier_selected || m.service_tier || "")
      .toLowerCase()
      .trim() === "estate"
  );
}

interface EtaSmsLogEntry {
  message_type: string;
  sent_at: string;
  eta_minutes: number | null;
  twilio_sid: string | null;
}

interface ReviewRequestEntry {
  id: string;
  status: string;
  email_sent_at: string | null;
  reminder_sent_at: string | null;
  review_clicked: boolean | null;
  review_clicked_at: string | null;
  client_rating: number | null;
  client_feedback: string | null;
}

type ItemWeightRow = {
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  room?: string;
  is_common: boolean;
  display_order?: number;
  active?: boolean;
};

interface MoveRecord {
  id: string;
  status: string;
  stage?: string | null;
  service_type?: string | null;
  crew_id?: string | null;
  client_name?: string | null;
  client_email?: string | null;
  customer_email?: string | null;
  client_phone?: string | null;
  preferred_contact?: string | null;
  move_code?: string | null;
  scheduled_date?: string | null;
  move_date?: string | null;
  from_address?: string | null;
  to_address?: string | null;
  from_lat?: number | null;
  from_lng?: number | null;
  to_lat?: number | null;
  to_lng?: number | null;
  estimate?: number | null;
  amount?: number | null;
  deposit_amount?: number | null;
  balance_amount?: number | null;
  assigned_members?: string[] | null;
  assigned_crew_name?: string | null;
  truck_primary?: string | null;
  truck_override?: boolean | null;
  tier_selected?: string | null;
  has_piano?: boolean | null;
  hubspot_deal_id?: string | null;
  payment_marked_paid?: boolean | null;
  payment_marked_paid_at?: string | null;
  balance_paid_at?: string | null;
  completed_at?: string | null;
  is_pm_move?: boolean | null;
  created_at?: string | null;
  updated_at?: string | null;
  contact_id?: string | null;
  from_access?: string | null;
  to_access?: string | null;
  move_size?: string | null;
  delivery_address?: string | null;
  est_crew_size?: number | null;
  est_hours?: number | null;
  truck_secondary?: string | null;
  [key: string]: any;
}

interface MoveDetailClientProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  move: any;
  crews?: { id: string; name: string; members?: string[] }[];
  isOffice?: boolean;
  userRole?: string;
  additionalFeesCents?: number;
  etaSmsLog?: EtaSmsLogEntry[];
  reviewRequest?: ReviewRequestEntry;
  itemWeights?: ItemWeightRow[];
  pendingInventoryChange?: {
    id: string;
    status: string;
    submitted_at: string;
    items_added: unknown;
    items_removed: unknown;
    auto_calculated_delta: number;
    admin_adjusted_delta: number | null;
    truck_assessment: Record<string, unknown> | null;
    admin_notes: string | null;
    decline_reason: string | null;
  };
  paymentLedger?: {
    id: string;
    label: string;
    entry_type: string;
    pre_tax_amount: number;
    hst_amount: number;
    paid_at: string;
    settlement_method: string;
    square_payment_id: string | null;
    inventory_change_request_id: string | null;
  }[];
  moveStatusEvents?: { event_type: string; created_at: string }[];
  linkedBinOrders?: Record<string, unknown>[];
  surveyPhotos?: {
    id: string;
    room: string;
    photo_url: string;
    notes: string | null;
    uploaded_at: string;
  }[];
  pendingModifications?: {
    id: string;
    type: string;
    status: string;
    price_difference: number | null;
    created_at: string;
  }[];
  canEditPostCompletionPrice?: boolean;
  postCompletionPriceEdits?: {
    id: string;
    original_price: number;
    new_price: number;
    difference: number;
    reason: string;
    edited_by_name: string;
    created_at: string;
    invoice_may_need_reissue?: boolean | null;
  }[];
  moveWaivers?: MoveWaiverRow[];
  pmLinkedPeer?: {
    id: string;
    move_code: string | null;
    scheduled_date: string | null;
    client_name: string | null;
    status: string | null;
  } | null;
  residentialMoveProject?: {
    project: Record<string, unknown>;
    phases: {
      phase_name?: string | null;
      phase_type?: string | null;
      days?: Record<string, unknown>[];
    }[];
  } | null;
}
import {
  MOVE_STATUS_OPTIONS,
  MOVE_STATUS_COLORS_ADMIN,
  MOVE_STATUS_INDEX,
  LIVE_TRACKING_STAGES,
  getStatusLabel,
  normalizeStatus,
} from "@/lib/move-status";
import RecommendedCrewPanel from "./RecommendedCrewPanel";

function tierDisplayLabel(tier: string | null | undefined): string | null {
  if (!tier) return null;
  const t = tier.toLowerCase().trim();
  const map: Record<string, string> = {
    essential: "Essential",
    signature: "Signature",
    estate: "Estate",
    essentials: "Essential",
    premier: "Signature",
  };
  return map[t] ?? tier.charAt(0).toUpperCase() + tier.slice(1);
}

function formatReviewTime(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  if (diffMin < 60) return `${diffMin} min${diffMin === 1 ? "" : "s"} ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr === 1 ? "" : "s"} ago`;
  if (diffDay < 7) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;
  return formatPlatformDisplay(d, { month: "short", day: "numeric" }, "");
}

function isMoveStatusCompleted(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "completed" || s === "delivered" || s === "done";
}

const IN_PROGRESS_STATUSES = [
  "en_route",
  "en_route_to_pickup",
  "arrived_at_pickup",
  "loading",
  "en_route_to_destination",
  "arrived_at_destination",
  "unloading",
  "in_progress",
  "in_transit",
];
function isMoveInProgress(
  status: string | null | undefined,
  stage: string | null | undefined,
): boolean {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const st = (stage || "").toLowerCase().replace(/-/g, "_");
  return IN_PROGRESS_STATUSES.includes(s) || IN_PROGRESS_STATUSES.includes(st);
}
import { stripClientMessagesFromNotes } from "@/lib/internal-notes";
import {
  formatCurrency,
  calcHST,
  contractTaxLines,
} from "@/lib/format-currency";
import { portfolioPmMoveServiceLabel, serviceTypeDisplayLabel } from "@/lib/displayLabels";
import { portfolioPmStatementInvoiceDueIso } from "@/lib/partners/portfolio-pm-statement-due-date";
import { formatAccessForDisplay, toTitleCase } from "@/lib/format-text";

const VEHICLE_LABELS: Record<string, string> = {
  sprinter: "Sprinter Van",
  "16ft": "16ft Box Truck",
  "20ft": "20ft Box Truck",
  "24ft": "24ft Box Truck",
  "26ft": "26ft Box Truck",
};
const VEHICLE_OPTIONS = Object.entries(VEHICLE_LABELS);

const BIN_ORDER_STATUS_ADMIN: Record<string, string> = {
  confirmed: "Booked",
  drop_off_scheduled: "Delivery scheduled",
  bins_delivered: "Delivered",
  in_use: "Active",
  pickup_scheduled: "Pickup scheduled",
  bins_collected: "Collected",
  completed: "Completed",
  overdue: "Late return",
  cancelled: "Cancelled",
};

function BinOrderPickupBlock({
  bin,
  userRole,
}: {
  bin: Record<string, unknown>;
  userRole: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const id = String(bin.id ?? "");
  const binCount = Math.max(1, Math.floor(Number(bin.bin_count) || 1));
  const wProv =
    bin.wardrobe_boxes_provided != null
      ? Math.max(0, Math.floor(Number(bin.wardrobe_boxes_provided)))
      : null;
  const [binsReturned, setBinsReturned] = useState(
    Math.min(binCount, Math.floor(Number(bin.bins_returned ?? binCount))),
  );
  const [missing, setMissing] = useState(
    Math.max(0, Math.floor(Number(bin.bins_missing ?? 0))),
  );
  const [wardrobeRet, setWardrobeRet] = useState(
    wProv != null
      ? Math.min(
          wProv,
          Math.floor(Number(bin.wardrobe_boxes_returned ?? wProv)),
        )
      : 0,
  );
  const [condition, setCondition] = useState(
    String(bin.pickup_condition ?? "good"),
  );
  const [saving, setSaving] = useState(false);
  const canEdit = ["owner", "admin", "coordinator"].includes(userRole);
  if (!canEdit) return null;
  const st = String(bin.status ?? "").toLowerCase();
  if (["completed", "cancelled", "bins_collected"].includes(st)) return null;

  const save = async (markCollected: boolean) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bin-orders/${id}/pickup`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bins_returned: binsReturned,
          bins_missing: missing,
          wardrobe_boxes_returned: wProv != null ? wardrobeRet : undefined,
          pickup_condition: condition,
          mark_collected: markCollected,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Save failed");
      toast(markCollected ? "Pickup recorded" : "Pickup draft saved", "check");
      router.refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "alertTriangle");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 pt-2 border-t border-[var(--yu3-line-subtle)] space-y-2">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--yu3-ink-muted)]">
        Pickup checklist
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end">
        <label className="text-[10px] text-[var(--yu3-ink-muted)]">
          Bins returned
          <input
            type="number"
            min={0}
            max={binCount}
            value={binsReturned}
            onChange={(e) =>
              setBinsReturned(
                Math.min(
                  binCount,
                  Math.max(0, parseInt(e.target.value, 10) || 0),
                ),
              )
            }
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
        <label className="text-[10px] text-[var(--yu3-ink-muted)]">
          Missing bins
          <input
            type="number"
            min={0}
            max={binCount}
            value={missing}
            onChange={(e) =>
              setMissing(
                Math.min(
                  binCount,
                  Math.max(0, parseInt(e.target.value, 10) || 0),
                ),
              )
            }
            className="mt-0.5 admin-premium-input w-full"
          />
        </label>
        {wProv != null && wProv > 0 ? (
          <label className="text-[10px] text-[var(--yu3-ink-muted)]">
            Wardrobe returned
            <input
              type="number"
              min={0}
              max={wProv}
              value={wardrobeRet}
              onChange={(e) =>
                setWardrobeRet(
                  Math.min(
                    wProv,
                    Math.max(0, parseInt(e.target.value, 10) || 0),
                  ),
                )
              }
              className="mt-0.5 admin-premium-input w-full"
            />
          </label>
        ) : (
          <span className="text-[10px] text-[var(--yu3-ink-muted)] col-span-1">
            Wardrobe: n/a
          </span>
        )}
        <label className="text-[10px] text-[var(--yu3-ink-muted)] col-span-2 sm:col-span-1">
          Condition
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="mt-0.5 admin-premium-input w-full"
          >
            <option value="good">Good</option>
            <option value="some_damaged">Some damaged</option>
            <option value="many_damaged">Many damaged</option>
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="px-3 py-1.5 rounded-lg text-[10px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink-muted)] hover:border-[var(--yu3-wine)]"
        >
          Save counts
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => save(true)}
          className="admin-btn admin-btn-sm admin-btn-primary"
        >
          Complete pickup
        </button>
      </div>
    </div>
  );
}

const MOVE_TAB_IDS = ["overview", "plan", "money", "work"] as const;
type MoveTabId = (typeof MOVE_TAB_IDS)[number];

export default function MoveDetailClient({
  move: initialMove,
  crews = [],
  isOffice,
  userRole = "viewer",
  additionalFeesCents = 0,
  etaSmsLog = [],
  reviewRequest,
  itemWeights = [],
  pendingInventoryChange,
  paymentLedger = [],
  moveStatusEvents = [],
  linkedBinOrders = [],
  surveyPhotos = [],
  pendingModifications = [],
  canEditPostCompletionPrice = false,
  postCompletionPriceEdits = [],
  moveWaivers = [],
  pmLinkedPeer = null,
  residentialMoveProject = null,
}: MoveDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const tabFromQuery = searchParams.get("tab");
  const [activeMoveTab, setActiveMoveTab] = useState<MoveTabId>(() =>
    MOVE_TAB_IDS.includes((tabFromQuery || "") as MoveTabId)
      ? ((tabFromQuery || "") as MoveTabId)
      : "overview",
  );
  useEffect(() => {
    const t = searchParams.get("tab");
    if (t && MOVE_TAB_IDS.includes(t as MoveTabId)) {
      setActiveMoveTab(t as MoveTabId);
    }
  }, [searchParams]);

  const handleMoveTab = useCallback(
    (v: string) => {
      if (!MOVE_TAB_IDS.includes(v as MoveTabId)) return;
      setActiveMoveTab(v as MoveTabId);
      const next = new URLSearchParams(searchParams.toString());
      next.set("tab", v);
      const q = next.toString();
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );
  const supabase = createClient();
  const [move, setMove] = useState(initialMove);
  useEffect(() => setMove(initialMove), [initialMove]);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [detailsModalSection, setDetailsModalSection] = useState<
    "addresses" | "notes" | null
  >(null);
  const [vehicleModalOpen, setVehicleModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingCard, setEditingCard] = useState<"status" | null>(null);
  const [restartOverrideModal, setRestartOverrideModal] = useState<{
    newStatus: string;
  } | null>(null);
  const [restartOverrideTyped, setRestartOverrideTyped] = useState("");
  const [overrideStatusModalOpen, setOverrideStatusModalOpen] = useState(false);
  const [overrideStatusNewStatus, setOverrideStatusNewStatus] =
    useState("confirmed");
  const [overrideStatusTyped, setOverrideStatusTyped] = useState("");
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [pendingCancelStatus, setPendingCancelStatus] = useState<string | null>(
    null,
  );
  const [reviewReminderLoading, setReviewReminderLoading] = useState(false);
  const selectedCrew = crews.find((c) => c.id === move.crew_id);
  const crewMembers =
    selectedCrew?.members && Array.isArray(selectedCrew.members)
      ? selectedCrew.members
      : [];
  const snapshotRoster = Array.isArray(move.assigned_members)
    ? move.assigned_members.filter(
        (x: unknown) => typeof x === "string" && String(x).trim(),
      )
    : [];
  const displayCrewName =
    selectedCrew?.name?.trim() ||
    (typeof move.assigned_crew_name === "string" &&
    move.assigned_crew_name.trim()
      ? move.assigned_crew_name.trim()
      : "") ||
    "";
  const [assignedMembers, setAssignedMembers] = useState<Set<string>>(() => {
    const assigned = Array.isArray(move.assigned_members)
      ? move.assigned_members
      : [];
    return assigned.length > 0 ? new Set(assigned) : new Set(crewMembers);
  });
  useEffect(() => {
    // Don't reset checkbox state while the modal is open — the user may be
    // editing which members to assign, and a realtime subscription update on
    // move.assigned_members would wipe their uncommitted changes.
    if (crewModalOpen) return;
    const members =
      selectedCrew?.members && Array.isArray(selectedCrew.members)
        ? selectedCrew.members
        : [];
    const assigned = Array.isArray(move.assigned_members)
      ? move.assigned_members
      : [];
    if (assigned.length > 0) {
      setAssignedMembers(new Set(assigned));
    } else if (members.length > 0) {
      setAssignedMembers(new Set(members));
    } else {
      setAssignedMembers(new Set());
    }
  }, [move.crew_id, move.assigned_members, selectedCrew?.members, crewModalOpen]);
  const estimate = Number(move.estimate ?? move.amount ?? 0);
  const depositPaid = Number(
    move.deposit_amount ?? Math.round(estimate * 0.25),
  );
  const baseBalance = Number(move.balance_amount ?? estimate - depositPaid);
  const balanceDue = baseBalance + additionalFeesCents / 100;
  const scheduledDateLocal = parseDateOnly(move.scheduled_date);
  const daysUntil = scheduledDateLocal
    ? Math.ceil((scheduledDateLocal.getTime() - Date.now()) / 86400000)
    : null;
  const balanceUnpaid = balanceDue > 0 && daysUntil !== null && daysUntil <= 1;

  /** Timestamps for each move status step, derived from status_events + move fields */
  const stepTimestamps: Record<string, string | null> = {
    confirmed: move.created_at ?? null,
    scheduled:
      moveStatusEvents?.find(
        (e) => e.event_type === "status_changed_to_scheduled",
      )?.created_at ?? null,
    paid:
      move.payment_marked_paid_at ??
      moveStatusEvents?.find(
        (e) =>
          e.event_type === "status_changed_to_paid" ||
          e.event_type === "payment_received",
      )?.created_at ??
      null,
    in_progress:
      moveStatusEvents?.find(
        (e) => e.event_type === "status_changed_to_in_progress",
      )?.created_at ?? null,
    completed:
      move.completed_at ??
      moveStatusEvents?.find(
        (e) => e.event_type === "status_changed_to_completed",
      )?.created_at ??
      null,
  };
  const lastUpdatedRelative = useRelativeTime(move.updated_at);
  const isCompleted = isMoveStatusCompleted(move.status);
  const isFinishedForTimeIntel = isCompleted || Boolean(move.completed_at);
  const isPaid = move.status === "paid" || !!move.payment_marked_paid;
  const moveInProgress = isMoveInProgress(move.status, move.stage);
  const isBalancePaid = !!move.balance_paid_at;
  const [paymentBtnLoading, setPaymentBtnLoading] = useState<
    "deposit" | "full" | "card" | null
  >(null);
  const [balanceJustSettled, setBalanceJustSettled] = useState(false);
  const [jobDuration, setJobDuration] = useState<{
    startedAt: string | null;
    completedAt: string | null;
    isActive: boolean;
  } | null>(null);
  const [jobDurationElapsed, setJobDurationElapsed] = useState(0);

  useEffect(() => {
    fetch(`/api/admin/moves/${move.id}/tracking-duration`)
      .then((r) => r.json())
      .then((d) => setJobDuration(d))
      .catch(() => {});
  }, [move.id]);

  // Live status: subscribe to moves table so crew checkpoint updates appear in real time
  useEffect(() => {
    const channel = supabase
      .channel(`move-${move.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "moves",
          filter: `id=eq.${move.id}`,
        },
        (payload) => {
          const next = payload.new as Record<string, unknown>;
          setMove((prev: any) => ({ ...prev, ...next }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [move.id]);

  // Session row updates sometimes land before the move row sync; keep admin status in sync with crew completion
  useEffect(() => {
    const channel = supabase
      .channel(`move-sess-${move.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tracking_sessions",
          filter: `job_id=eq.${move.id}`,
        },
        (payload) => {
          if (payload.eventType !== "INSERT" && payload.eventType !== "UPDATE")
            return;
          const row = payload.new as Record<string, unknown> | undefined;
          if (!row || String(row.job_type || "") !== "move") return;
          const st = String(row.status || "").toLowerCase();
          const completedAt = row.completed_at as string | null | undefined;
          const inactive = row.is_active === false;
          if (st === "completed" || (inactive && !!completedAt)) {
            setMove((prev: any) => ({
              ...prev,
              status: "completed",
              stage: "completed",
              completed_at: completedAt ?? prev.completed_at,
              updated_at: (row.updated_at as string) ?? prev.updated_at,
            }));
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [move.id]);

  // Polling fallback for live status when move is in progress (in case realtime lags)
  const isInProgress = !["completed", "delivered", "cancelled"].includes(
    (move.status || "").toLowerCase(),
  );
  useEffect(() => {
    if (!isInProgress) return;
    const poll = () =>
      fetch(`/api/admin/moves/${move.id}/stage`)
        .then((r) =>
          r.json().then((d) => ({
            ok: r.ok,
            d,
          })),
        )
        .then(({ ok, d }) => {
          if (ok && d && !(d as { error?: string }).error)
            setMove((prev: any) => ({ ...prev, ...d }));
        })
        .catch(() => {});
    poll();
    const id = setInterval(poll, 2000);
    return () => clearInterval(id);
  }, [move.id, isInProgress]);

  useEffect(() => {
    if (!jobDuration?.startedAt) {
      setJobDurationElapsed(0);
      return;
    }
    const start = new Date(jobDuration.startedAt).getTime();
    const end = jobDuration.completedAt
      ? new Date(jobDuration.completedAt).getTime()
      : Date.now();
    const tick = () =>
      setJobDurationElapsed(
        Math.max(
          0,
          (jobDuration.completedAt
            ? new Date(jobDuration.completedAt).getTime()
            : Date.now()) - start,
        ),
      );
    tick();
    if (!jobDuration.completedAt) {
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    }
  }, [jobDuration?.startedAt, jobDuration?.completedAt]);

  const jobDurationStr = jobDuration?.startedAt
    ? (() => {
        const ms =
          jobDurationElapsed ||
          (jobDuration.completedAt
            ? new Date(jobDuration.completedAt).getTime() -
              new Date(jobDuration.startedAt).getTime()
            : Date.now() - new Date(jobDuration.startedAt).getTime());
        const fullMin = Math.max(0, Math.floor(ms / 60000));
        return formatMinutesAsHhMm(fullMin);
      })()
    : null;

  /** Allocated on-site work time.
   * Priority: est_hours (always in sync with the quote's displayed ~Xh) →
   * then estimated_duration_minutes (manual admin override or legacy model value).
   * Using est_hours first ensures the move page always shows the same duration
   * as the quote page, even for older moves created before this was fixed. */
  const jobTimeTracker = useMemo((): {
    minutes: number;
    margin: number;
  } | null => {
    const parseNum = (v: unknown): number | null => {
      const n = typeof v === "string" ? Number.parseFloat(v) : Number(v);
      return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    };
    const margRaw = parseNum(move.margin_alert_minutes);

    // 1. est_hours is the authoritative quoted duration (matches quote page).
    const ehN = parseNum(
      typeof move.est_hours === "string"
        ? Number.parseFloat(move.est_hours)
        : move.est_hours,
    );
    if (ehN != null) {
      const m = ehN * 60;
      const uncapped = margRaw != null ? margRaw : m;
      return { minutes: m, margin: capMarginAlertMinutes(m, uncapped) };
    }

    // 2. Fall back to estimated_duration_minutes for moves without est_hours
    //    (manual jobs created outside the quote flow, B2B jobs, etc.).
    const rawN = parseNum(move.estimated_duration_minutes);
    if (rawN != null) {
      const uncapped = margRaw != null ? margRaw : rawN;
      return { minutes: rawN, margin: capMarginAlertMinutes(rawN, uncapped) };
    }

    return null;
  }, [move]);

  const toggleMember = (name: string) => {
    setAssignedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const prepChecklistRecord =
    (move.pre_move_checklist as Record<string, boolean> | null | undefined) ||
    undefined;
  const prepCounts = preMoveChecklistCounts(prepChecklistRecord);
  const prepAllDone = isPreMoveChecklistComplete(prepChecklistRecord);
  const prepNotifiedAt = move.pre_move_checklist_notified_at as
    | string
    | null
    | undefined;
  const prepNotifiedLabel = prepNotifiedAt
    ? formatPlatformDisplay(prepNotifiedAt, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  const operationalAlerts = (
    move as { operationalAlerts?: OperationalJobAlerts | null }
  ).operationalAlerts;

  const serviceLabel = serviceTypeDisplayLabel(move.service_type);
  const serviceEyebrow = `Operations · ${serviceLabel}`;

  const kpiTiles = useMemo(
    () => [
      { id: "id", label: "Move", value: String(move.move_code || "—") },
      {
        id: "date",
        label: "Scheduled",
        value: move.scheduled_date
          ? formatMoveDate(String(move.scheduled_date))
          : "Not set",
      },
      {
        id: "status",
        label: "Status",
        value: toTitleCase(getStatusLabel(String(move.status || "")) || "—"),
      },
      {
        id: "value",
        label: "Contract",
        value: formatCurrency(Number(move.estimate ?? move.amount ?? 0) || 0),
      },
    ],
    [
      move.move_code,
      move.scheduled_date,
      move.status,
      move.estimate,
      move.amount,
    ],
  );

  return (
    <div className="w-full min-w-0 flex flex-col gap-6 py-1 animate-fade-up">
      <div>
        <BackButton
          label="Back"
          variant="v2"
          className="text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)]"
        />
      </div>

      <PageHeader
        eyebrow={serviceEyebrow}
        title={
          <span className="inline-flex min-w-0 max-w-full items-center gap-2">
            <button
              type="button"
              onClick={() => setContactModalOpen(true)}
              className="text-left min-w-0 max-w-full break-words bg-transparent border-0 p-0 cursor-pointer font-inherit text-inherit hover:text-[var(--yu3-wine)] transition-colors group inline-flex items-center gap-1.5"
            >
              {move.client_name}
              <Pencil
                size={16}
                aria-hidden
                className="opacity-0 group-hover:opacity-60 transition-opacity shrink-0 text-[var(--yu3-ink-muted)]"
              />
            </button>
          </span>
        }
        meta={
          <div className="flex flex-wrap items-center gap-2">
            {move.move_code ? (
              <span className="yu3-num text-[12px] font-semibold text-[var(--yu3-ink)]">
                {move.move_code}
              </span>
            ) : null}
            <StatusPill tone="wine">
              {serviceLabel}
            </StatusPill>
            {(move as any).externally_booked && (
              <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                Booked externally
              </span>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {!isCompleted && (
              <>
                <MoveNotifyButton move={move} />
                <ResendTrackingLinkButton move={move} />
                <PageMetaDivider />
              </>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="text-[var(--yu3-danger)] hover:text-[var(--yu3-danger)] hover:bg-[var(--yu3-danger-tint)]"
            >
              Delete
            </Button>
          </div>
        }
      />

      <div
        className="flex flex-wrap items-start gap-2"
        role="list"
        aria-label="Move summary"
      >
        {kpiTiles.map((t) => (
          <div
            key={t.id}
            role="listitem"
            className="inline-flex min-w-[140px] max-w-full flex-nowrap items-baseline justify-center gap-1.5 whitespace-nowrap rounded-xl border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] px-4 py-2 text-sm font-medium shadow-[var(--yu3-shadow-sm)]"
          >
            <span className="shrink-0 text-[var(--yu3-ink-muted)]">{t.label}:</span>
            <span className="min-w-0 shrink tabular-nums text-[var(--yu3-ink-strong)]">
              {t.value}
            </span>
          </div>
        ))}
      </div>

      {isCompleted && (
        <div className="rounded-[var(--yu3-r-md)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-subtle)] px-4 py-2.5 text-[12px] text-[var(--yu3-ink-muted)]">
          This move is complete. Some fields are locked for transparency.
        </div>
      )}

      {!isCompleted &&
        operationalAlerts &&
        (operationalAlerts.marginBelowHalf ||
          operationalAlerts.projectedFinishAfterAllocated) && (
          <div
            className={`rounded-[var(--yu3-r-md)] border px-4 py-3 text-[12px] leading-snug ${
              operationalAlerts.marginBelowHalf
                ? "border-red-500/35 bg-red-500/[0.08] text-[var(--yu3-ink)]"
                : "border-amber-500/40 bg-amber-500/[0.08] text-[var(--yu3-ink)]"
            }`}
            role="status"
          >
            <p className="yu3-t-eyebrow text-[var(--yu3-ink-muted)] mb-1">
              Operational alert
            </p>
            {operationalAlerts.marginBelowHalf && (
              <p className="mb-1">
                Projected profit margin is below half of the planned margin at
                current pace.
              </p>
            )}
            {operationalAlerts.projectedFinishAfterAllocated && (
              <p>
                Projected job length exceeds allocated time
                {operationalAlerts.projectedTotalMinutes != null
                  ? ` (~${formatMinutesAsHhMm(Math.round(operationalAlerts.projectedTotalMinutes))} vs ${operationalAlerts.allocatedMinutes != null ? formatMinutesAsHhMm(Math.round(operationalAlerts.allocatedMinutes)) : "?"} allocated)`
                  : ""}
                .
              </p>
            )}
          </div>
        )}

      {pmLinkedPeer && (
        <div className="rounded-[var(--yu3-r-lg)] border border-[#6D28D9]/25 bg-[#6D28D9]/[0.06] px-4 py-3 text-[12px]">
          <p className="yu3-t-eyebrow text-[#5B21B6] mb-1.5">Linked move</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="yu3-num font-semibold text-[var(--yu3-ink-strong)]">
              {move.move_code || "This move"}
            </span>
            <span className="text-[var(--yu3-ink-muted)]">pairs with</span>
            <Link
              href={getMoveDetailPath(pmLinkedPeer)}
              className="yu3-num font-semibold text-[var(--yu3-wine)] hover:underline"
            >
              {pmLinkedPeer.move_code || pmLinkedPeer.id}
            </Link>
          </div>
          {pmLinkedPeer.scheduled_date ? (
            <p className="text-[11px] text-[var(--yu3-ink-muted)] mt-1">
              Other leg date: {formatMoveDate(String(pmLinkedPeer.scheduled_date))}
            </p>
          ) : null}
        </div>
      )}

      {/* Status, live stage, checklist, progress */}
      <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] overflow-hidden p-4 sm:p-5 shadow-[0_1px_0_0_rgba(0,0,0,0.03)]">
        <div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="group/card relative flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--yu3-ink-muted)]/80 shrink-0">
                Status
              </span>
              {isCompleted ? (
                <>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`dt-badge tracking-[0.04em] text-[11px] ${MOVE_STATUS_COLORS_ADMIN[move.status] || "text-[var(--yu3-wine)]"}`}
                    >
                      {getStatusLabel(move.status)}
                    </span>
                    <span
                      className="p-1 rounded-md text-red-500"
                      title="Move completed. Status is locked."
                      aria-hidden="true"
                    >
                      <Lock className="w-[11px] h-[11px]" />
                    </span>
                  </span>
                  {userRole === "owner" && (
                    <button
                      type="button"
                      onClick={() => {
                        setOverrideStatusModalOpen(true);
                        setOverrideStatusNewStatus("confirmed");
                        setOverrideStatusTyped("");
                      }}
                      className="text-[10px] font-medium text-[var(--org)] hover:underline opacity-80 hover:opacity-100"
                    >
                      Override status
                    </button>
                  )}
                </>
              ) : editingCard === "status" ? (
                <select
                  className="text-[12px] bg-[var(--yu3-bg-surface)] border border-[var(--yu3-line)] rounded-md px-2 py-1.5 text-[var(--yu3-ink)] focus:border-[var(--yu3-line)] outline-none min-w-[120px]"
                  value={(() => {
                    const s =
                      normalizeStatus(move.status) ||
                      move.status ||
                      "confirmed";
                    return s === "paid" ? "scheduled" : s;
                  })()}
                  onChange={async (e) => {
                    const v = e.target.value as string;
                    const isCurrentlyCompleted = isMoveStatusCompleted(
                      move.status,
                    );
                    const isRestarting =
                      isCurrentlyCompleted &&
                      !["completed", "delivered", "cancelled"].includes(
                        v.toLowerCase(),
                      );
                    if (isRestarting) {
                      setRestartOverrideModal({ newStatus: v });
                      setRestartOverrideTyped("");
                      return;
                    }
                    if (v.toLowerCase() === "cancelled") {
                      setPendingCancelStatus(v);
                      setCancelConfirmOpen(true);
                      return;
                    }
                    const now = new Date().toISOString();
                    const updates: Record<string, unknown> = {
                      status: v,
                      updated_at: now,
                      ...(v.toLowerCase() === "completed" && {
                        completed_at: now,
                        stage: "completed",
                      }),
                    };
                    const { data, error } = await supabase
                      .from("moves")
                      .update(updates)
                      .eq("id", move.id)
                      .select()
                      .single();
                    if (error) {
                      toast(
                        error.message || "Failed to update status",
                        "alertTriangle",
                      );
                      return;
                    }
                    if (data) setMove(data);
                    setEditingCard(null);
                    router.refresh();
                    // Log the status change so progress bar can show timestamps
                    fetch(`/api/admin/moves/${move.id}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        action: "log_status_change",
                        new_status: v,
                        previous_status: move.status,
                      }),
                    }).catch(() => {});
                    if (data && isEstateTierMove(data)) {
                      fetch(
                        `/api/admin/moves/${move.id}/sync-estate-checklist`,
                        {
                          method: "POST",
                        },
                      )
                        .then((r) => (r.ok ? r.json() : null))
                        .then((j) => {
                          if (j?.estate_service_checklist != null) {
                            setMove((p: any) => ({
                              ...p,
                              estate_service_checklist:
                                j.estate_service_checklist,
                            }));
                          }
                        })
                        .catch(() => {});
                    }
                    if (v.toLowerCase() === "completed") {
                      void fetch(`/api/admin/moves/${move.id}/notify-complete`, {
                        method: "POST",
                      })
                        .then(async (notifyRes) => {
                          if (!notifyRes.ok) {
                            try {
                              const j = await notifyRes.json();
                              toast(
                                j?.error ||
                                  "Completion email or review scheduling failed. Retry from the office or reload.",
                                "alertTriangle",
                              );
                            } catch {
                              toast(
                                "Completion email or review scheduling failed. Retry later.",
                                "alertTriangle",
                              );
                            }
                          } else {
                            router.refresh();
                          }
                        })
                        .catch(() => {
                          toast(
                            "Completion email or review scheduling failed to reach the server.",
                            "alertTriangle",
                          );
                        });
                    }
                    // Sync status to HubSpot deal (and keep deal fields in sync)
                    if (move.hubspot_deal_id) {
                      const dealProps: Record<string, string> = {
                        dealstage: v,
                      };
                      const fullName = (move.client_name || "").trim();
                      if (fullName) {
                        const first = fullName.split(/\s+/)[0]?.trim();
                        const last = fullName
                          .split(/\s+/)
                          .slice(1)
                          .join(" ")
                          .trim();
                        if (first) dealProps.firstname = first;
                        if (last) dealProps.lastname = last;
                      }
                      if (move.from_address?.trim())
                        dealProps.pick_up_address = move.from_address.trim();
                      const toAddr =
                        move.to_address?.trim() ||
                        move.delivery_address?.trim();
                      if (toAddr) dealProps.drop_off_address = toAddr;
                      if (move.from_access?.trim())
                        dealProps.access_from = move.from_access.trim();
                      if (move.to_access?.trim())
                        dealProps.access_to = move.to_access.trim();
                      if (move.service_type?.trim())
                        dealProps.service_type = move.service_type.trim();
                      if (move.move_size?.trim())
                        dealProps.move_size = move.move_size.trim();
                      if (move.scheduled_date?.trim())
                        dealProps.move_date = move.scheduled_date.trim();
                      fetch("/api/hubspot/update-deal", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          dealId: move.hubspot_deal_id,
                          properties: dealProps,
                        }),
                      }).catch(() => {});
                    }
                  }}
                >
                  {MOVE_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingCard("status")}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-dashed border-transparent hover:border-[var(--yu3-wine)]/40 hover:opacity-90 transition-all cursor-pointer group/btn w-fit"
                  aria-label="Edit status"
                >
                  <span
                    className={`dt-badge tracking-[0.04em] text-[11px] ${MOVE_STATUS_COLORS_ADMIN[move.status] || "text-[var(--yu3-wine)]"}`}
                  >
                    {getStatusLabel(move.status)}
                  </span>
                  <ChevronDown
                    weight="regular"
                    className="w-[10px] h-[10px] text-[var(--yu3-ink-muted)] opacity-60 group-hover/btn:opacity-100"
                  />
                </button>
              )}
            </div>

            <div className="group/card relative flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="inline-flex items-center gap-1.5 text-[9px] font-semibold tracking-widest uppercase text-[var(--yu3-ink-muted)]/80 shrink-0">
                <span
                  className="relative flex h-1.5 w-1.5 shrink-0"
                  aria-hidden
                >
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#22C55E] opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#22C55E]" />
                </span>
                Live stage
              </span>
              <span
                className="text-[12px] font-medium text-[var(--yu3-ink)] truncate"
                title="Updated by crew from portal"
              >
                {LIVE_TRACKING_STAGES.find((o) => o.key === move.stage)
                  ?.label ?? "Not started"}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 pt-2 sm:pt-0 sm:pl-6 sm:border-l sm:border-[var(--yu3-line-subtle)]">
              <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--yu3-ink-muted)]/80">
                Last updated
              </span>
              <span className="text-[12px] tabular-nums text-[var(--yu3-ink-muted)]">
                {lastUpdatedRelative}
              </span>
            </div>
          </div>

          <div className="mt-3 sm:mt-4 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 rounded-xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface-subtle)] px-3 py-2.5 sm:px-4">
            <span className="text-[9px] font-semibold tracking-widest uppercase text-[var(--yu3-ink-muted)]/80 shrink-0">
              Client prep checklist
            </span>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-[var(--yu3-ink)]">
              <span
                className={
                  prepAllDone
                    ? "font-bold text-emerald-700 dark:text-emerald-400"
                    : "font-semibold"
                }
              >
                {prepCounts.done}/{prepCounts.total} complete
              </span>
              {prepAllDone && prepNotifiedLabel ? (
                <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                  · Ops / coordinator notified {prepNotifiedLabel}
                </span>
              ) : null}
              {prepAllDone && !prepNotifiedLabel ? (
                <span className="text-[11px] text-[var(--yu3-ink-muted)]">
                  · Tracked complete (no notification logged)
                </span>
              ) : null}
            </div>
          </div>

          {isEstateTierMove(move) ? (
            <EstateServiceChecklistAdminRow move={move} setMove={setMove} />
          ) : null}

          {(normalizeStatus(move.status) || move.status) !== "cancelled" && (
            <div className="mt-4">
              <SegmentedProgressBar
                label="MOVE STATUS"
                steps={MOVE_STATUS_OPTIONS.filter(
                  (s) => s.value !== "cancelled",
                ).map((s) => ({
                  key: s.value,
                  label: s.label,
                  timestamp: stepTimestamps[s.value] ?? null,
                }))}
                currentIndex={Math.max(
                  0,
                  MOVE_STATUS_INDEX[
                    normalizeStatus(move.status) || move.status || "confirmed"
                  ] ?? 0,
                )}
              />
            </div>
          )}
        </div>
      </div>

      <Tabs
        value={activeMoveTab}
        onValueChange={handleMoveTab}
        className="w-full min-w-0"
      >
        <TabsList
          variant="underline"
          className="mb-0 w-full min-h-[2.5rem] flex-nowrap overflow-x-auto overscroll-x-contain gap-x-0.5 [-webkit-overflow-scrolling:touch]"
        >
          <TabsTrigger value="overview" variant="underline">
            Overview
          </TabsTrigger>
          <TabsTrigger value="plan" variant="underline">
            Schedule and details
          </TabsTrigger>
          <TabsTrigger value="money" variant="underline">
            Money
          </TabsTrigger>
          <TabsTrigger value="work" variant="underline">
            Inventory and files
          </TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-3 pt-3">
          {/* Move summary card */}
          <div className="rounded-xl border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[11px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)]">
                {serviceLabel}
              </span>
              <span
                className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: isCompleted
                    ? "color-mix(in srgb, var(--yu3-sage) 15%, transparent)"
                    : "color-mix(in srgb, var(--yu3-wine) 12%, transparent)",
                  color: isCompleted ? "var(--yu3-sage)" : "var(--yu3-wine)",
                }}
              >
                {getStatusLabel(move.status) || toTitleCase(move.status ?? "")}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-[12px]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  From
                </p>
                <p className="text-[var(--yu3-ink)] leading-snug">
                  {move.from_address || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  To
                </p>
                <p className="text-[var(--yu3-ink)] leading-snug">
                  {move.to_address || move.delivery_address || "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Date
                </p>
                <p className="text-[var(--yu3-ink)]">
                  {move.scheduled_date ? formatMoveDate(move.scheduled_date) : "—"}
                  {move.arrival_window ? (
                    <span className="text-[var(--yu3-ink-muted)] ml-1.5">
                      · {move.arrival_window}
                    </span>
                  ) : null}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Client
                </p>
                <p className="text-[var(--yu3-ink)]">{move.client_name || "—"}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Crew
                </p>
                <p className="text-[var(--yu3-ink)]">
                  {displayCrewName || "Not assigned"}
                  {(snapshotRoster.length > 0) && (
                    <span className="text-[var(--yu3-ink-muted)] ml-1.5">
                      · {snapshotRoster.join(", ")}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Est. Duration
                </p>
                <p className="text-[var(--yu3-ink)]">
                  {jobTimeTracker
                    ? formatMinutesAsHhMm(Math.round(jobTimeTracker.minutes))
                    : move.est_hours
                      ? `~${move.est_hours}h`
                      : "Not set"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Revenue
                </p>
                <p className="text-[var(--yu3-ink)] font-medium">
                  {formatCurrency(Number(move.final_amount ?? move.amount ?? move.estimate ?? 0))}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--yu3-ink-muted)] mb-0.5">
                  Deposit
                </p>
                <p className="text-[var(--yu3-ink)]">
                  {move.deposit_amount
                    ? formatCurrency(Number(move.deposit_amount))
                    : "—"}
                </p>
              </div>
            </div>
          </div>

          {typeof move.move_project_id === "string" &&
          move.move_project_id.trim() &&
          residentialMoveProject?.project &&
          residentialMoveProject.phases?.length ? (
            <MoveResidentialProjectPanel
              moveId={String(move.id)}
              moveCode={move.move_code}
              projectId={move.move_project_id.trim()}
              tree={residentialMoveProject}
            />
          ) : null}
      {/* Live Crew Tracking Map - collapsible, collapsed by default */}
      {etaSmsLog.length > 0 && (
        <CollapsibleSection
          title="SMS Updates"
          defaultCollapsed
          subtitle={`${etaSmsLog.length} sent`}
        >
          <div className="rounded-lg border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] overflow-hidden">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="border-b border-[var(--yu3-line)] bg-[var(--yu3-bg-surface-subtle)]">
                  <th className="text-left py-2 px-3 font-semibold text-[var(--yu3-ink-muted)]">
                    Type
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-[var(--yu3-ink-muted)]">
                    Sent
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-[var(--yu3-ink-muted)]">
                    ETA
                  </th>
                  <th className="text-left py-2 px-3 font-semibold text-[var(--yu3-ink-muted)]">
                    Twilio
                  </th>
                </tr>
              </thead>
              <tbody>
                {etaSmsLog.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-[var(--yu3-line-subtle)] last:border-0"
                  >
                    <td className="py-2 px-3 text-[var(--yu3-ink)]">
                      {toTitleCase(row.message_type)}
                    </td>
                    <td className="py-2 px-3 text-[var(--yu3-ink-muted)]">
                      {row.sent_at
                        ? new Date(row.sent_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2 px-3 text-[var(--yu3-ink-muted)]">
                      {row.eta_minutes != null ? `${row.eta_minutes} min` : "-"}
                    </td>
                    <td className="py-2 px-3 font-mono text-[10px] text-[var(--yu3-ink-muted)]">
                      {row.twilio_sid || "Failed"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CollapsibleSection>
      )}

      {reviewRequest && isCompleted && (
        <CollapsibleSection
          title="Review Request"
          defaultCollapsed={false}
          subtitle={
            reviewRequest.review_clicked
              ? "Clicked ✓"
              : toTitleCase(reviewRequest.status)
          }
        >
          <div className="rounded-lg border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-[var(--yu3-ink-muted)]">Status:</span>
                <span className="font-medium text-[var(--yu3-ink)]">
                  {reviewRequest.review_clicked
                    ? `Clicked ✓${reviewRequest.review_clicked_at ? ` (${new Date(reviewRequest.review_clicked_at).toLocaleString()})` : ""}`
                    : reviewRequest.status === "sent" ||
                        reviewRequest.status === "reminded"
                      ? `${toTitleCase(reviewRequest.status)}${reviewRequest.status === "reminded" && reviewRequest.reminder_sent_at ? ` (${formatReviewTime(reviewRequest.reminder_sent_at)})` : reviewRequest.email_sent_at ? ` (${formatReviewTime(reviewRequest.email_sent_at)})` : ""} · Not clicked yet`
                      : toTitleCase(reviewRequest.status)}
                </span>
              </div>
              {!reviewRequest.review_clicked &&
                (reviewRequest.status === "pending" ||
                  reviewRequest.status === "sent" ||
                  reviewRequest.status === "reminded") && (
                  <button
                    type="button"
                    disabled={reviewReminderLoading}
                    onClick={async () => {
                      setReviewReminderLoading(true);
                      try {
                        const res = await fetch(
                          `/api/admin/moves/${move.id}/review-reminder`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({
                              action:
                                reviewRequest.status === "pending"
                                  ? "send"
                                  : "remind",
                            }),
                          },
                        );
                        const data = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          toast(data?.error || "Failed", "alertTriangle");
                          return;
                        }
                        toast(
                          reviewRequest.status === "pending"
                            ? "Review request sent"
                            : "Reminder sent",
                          "check",
                        );
                        router.refresh();
                      } finally {
                        setReviewReminderLoading(false);
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold border border-[var(--yu3-wine)]/40 text-[var(--yu3-wine)] bg-[var(--yu3-wine)]/10 hover:bg-[var(--yu3-wine)]/20 transition-colors disabled:opacity-50"
                  >
                    {reviewReminderLoading
                      ? "Sending…"
                      : reviewRequest.status === "pending"
                        ? "Send request"
                        : "Remind"}
                  </button>
                )}
            </div>
            {(reviewRequest.client_rating != null &&
              reviewRequest.client_rating <= 3) ||
            (reviewRequest.client_feedback &&
              reviewRequest.client_feedback.trim()) ? (
              <div className="pt-3 border-t border-[var(--yu3-line)]">
                <p className="text-[10px] font-bold tracking-widest uppercase text-[var(--yu3-ink-muted)] mb-1.5">
                  Client feedback (from review link)
                </p>
                <div className="text-[12px] text-[var(--yu3-ink-muted)]">
                  {reviewRequest.client_rating != null &&
                    reviewRequest.client_rating <= 5 && (
                      <p className="mb-1">
                        <span className="text-[var(--yu3-ink-muted)]">Rating:</span>{" "}
                        {reviewRequest.client_rating}★
                      </p>
                    )}
                  {reviewRequest.client_feedback?.trim() && (
                    <p>
                      <span className="text-[var(--yu3-ink-muted)]">Feedback:</span>{" "}
                      {reviewRequest.client_feedback}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </CollapsibleSection>
      )}

      {isCompleted && (
        <CollapsibleSection
          title="Post-move feedback (from crew)"
          defaultCollapsed={false}
          subtitle="Client satisfaction & NPS from crew sign-off"
        >
          <MoveSignOffSection moveId={move.id} />
        </CollapsibleSection>
      )}

      {move.crew_id && (
        <CollapsibleSection
          title="Live Crew Tracking"
          defaultCollapsed
          subtitle={displayCrewName || "Crew"}
        >
          {!isInProgress && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)] mb-2">
              Move completed. Live tracking remains visible for vehicle and
              asset security.
            </p>
          )}
          <LiveTrackingMap
            crewId={move.crew_id}
            crewName={displayCrewName || undefined}
            destination={
              move.to_lat != null && move.to_lng != null
                ? { lat: move.to_lat, lng: move.to_lng }
                : undefined
            }
            pickup={
              move.from_lat != null && move.from_lng != null
                ? { lat: move.from_lat, lng: move.from_lng }
                : undefined
            }
            dropoff={
              move.to_lat != null && move.to_lng != null
                ? { lat: move.to_lat, lng: move.to_lng }
                : undefined
            }
            moveId={move.id}
            hideHeader
          />
        </CollapsibleSection>
      )}

        </TabsContent>

        <TabsContent value="plan" className="space-y-3 pt-2">

      {/* ─── Seamless info sections ─── */}
      <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] overflow-hidden px-5 mt-1">
        {/* Time Intelligence */}
        <div className="group/s relative py-4">
          {!isCompleted ? (
            <button
              type="button"
              className="absolute top-4 right-0 p-1 rounded-md hover:bg-[var(--yu3-bg-surface-subtle)] text-[var(--yu3-ink-muted)] transition-opacity opacity-50 hover:opacity-100"
              onClick={() => setDetailsModalOpen(true)}
              aria-label="Edit date, time window, and allocated job time"
            >
              <Pencil weight="regular" className="w-[13px] h-[13px]" />
            </button>
          ) : (
            <span
              className="absolute top-4 right-0 p-1 rounded-md text-red-500"
              title="Move completed. Editing is locked."
              aria-hidden="true"
            >
              <Lock className="w-[11px] h-[11px]" />
            </span>
          )}
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-2">
            Time & Intelligence
          </div>
          {!isCompleted && jobTimeTracker && (
            <div className="mb-4 max-w-[440px]">
              <CrewJobTimer
                elapsedMs={jobDuration?.startedAt ? jobDurationElapsed : 0}
                estimatedMinutes={jobTimeTracker.minutes}
                marginAlertMinutes={jobTimeTracker.margin}
                startedAtIso={jobDuration?.startedAt ?? null}
                operationalAlerts={operationalAlerts ?? null}
              />
            </div>
          )}
          {!isCompleted && !jobTimeTracker && (
            <p className="mb-4 max-w-[440px] text-[12px] text-[var(--yu3-ink-muted)] leading-relaxed">
              Set{" "}
              <span className="font-semibold text-[var(--yu3-ink)]">
                allocated job time
              </span>{" "}
              in the schedule editor (pencil) so the timer and margin alert use
              on-site work time, not the arrival window.
            </p>
          )}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Date
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {formatMoveDate(move.scheduled_date)}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Time Window
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.arrival_window || "-"}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Job duration
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)] tabular-nums">
                {jobDurationStr ?? "-"}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Estimated duration
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)] tabular-nums">
                {jobTimeTracker
                  ? formatMinutesAsHhMm(Math.round(jobTimeTracker.minutes))
                  : "Not set"}
              </div>
            </div>
            {!isFinishedForTimeIntel && (
              <div>
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                  Margin alert at
                </span>
                <div className="text-[13px] font-medium text-[var(--yu3-ink)] tabular-nums">
                  {jobTimeTracker
                    ? formatMinutesAsHhMm(Math.round(jobTimeTracker.margin))
                    : "-"}
                </div>
              </div>
            )}
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Completed at
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.completed_at
                  ? formatPlatformDisplay(
                      move.completed_at,
                      {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      },
                      "-",
                    )
                  : "-"}
              </div>
            </div>
            {!isFinishedForTimeIntel && (
              <div>
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                  Days Left
                </span>
                <div
                  className={`text-[13px] font-bold tabular-nums ${
                    daysUntil === null || daysUntil === undefined
                      ? "text-[var(--yu3-ink-muted)]"
                      : daysUntil < 0
                        ? "text-[var(--red)]"
                        : daysUntil <= 1
                          ? "text-amber-400"
                          : "text-[var(--yu3-wine)]"
                  }`}
                >
                  {daysUntil === null || daysUntil === undefined
                    ? "-"
                    : daysUntil < 0
                      ? `${Math.abs(daysUntil)}d overdue`
                      : daysUntil === 0
                        ? "Today"
                        : `${daysUntil}d`}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Addresses */}
        <div className="group/s relative border-t border-[var(--yu3-line-subtle)] py-4">
          {!isCompleted ? (
            <button
              type="button"
              className="absolute top-4 right-0 p-1 rounded-md hover:bg-[var(--yu3-bg-surface-subtle)] text-[var(--yu3-ink-muted)] transition-opacity opacity-50 hover:opacity-100"
              onClick={() => {
                setDetailsModalSection("addresses");
                setDetailsModalOpen(true);
              }}
              aria-label="Edit addresses"
            >
              <Pencil weight="regular" className="w-[13px] h-[13px]" />
            </button>
          ) : (
            <span
              className="absolute top-4 right-0 p-1 rounded-md text-red-500"
              title="Move completed. Editing is locked."
              aria-hidden="true"
            >
              <Lock className="w-[11px] h-[11px]" />
            </span>
          )}
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-2">
            Addresses
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                From
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.from_address || "-"}
              </div>
              {formatAccessForDisplay(move.from_access) && (
                <div className="text-[9px] text-[var(--yu3-ink-muted)] mt-0.5">
                  {formatAccessForDisplay(move.from_access)}
                </div>
              )}
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                To
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.to_address || move.delivery_address || "-"}
              </div>
              {formatAccessForDisplay(move.to_access) && (
                <div className="text-[9px] text-[var(--yu3-ink-muted)] mt-0.5">
                  {formatAccessForDisplay(move.to_access)}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Crew */}
        <div className="group/s relative border-t border-[var(--yu3-line-subtle)] py-4">
          {!isCompleted ? (
            <button
              type="button"
              className="absolute top-4 right-0 p-1 rounded-md hover:bg-[var(--yu3-bg-surface-subtle)] text-[var(--yu3-ink-muted)] transition-opacity opacity-50 hover:opacity-100 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              onClick={() => !moveInProgress && setCrewModalOpen(true)}
              disabled={moveInProgress}
              aria-label="Edit crew"
              title={
                moveInProgress
                  ? "Cannot reassign job in progress"
                  : "Change crew"
              }
            >
              <Pencil weight="regular" className="w-[13px] h-[13px]" />
            </button>
          ) : (
            <span
              className="absolute top-4 right-0 p-1 rounded-md text-red-500"
              title="Move completed. Editing is locked."
              aria-hidden="true"
            >
              <Lock className="w-[11px] h-[11px]" />
            </span>
          )}
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-2">
            Crew
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Crew
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {displayCrewName || "-"}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Coordinator
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.coordinator_name || "-"}
              </div>
            </div>
            {isCompleted ? (
              <div>
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                  Assigned
                </span>
                <div className="text-[13px] font-medium text-[var(--yu3-wine)]">
                  {assignedMembers.size} members
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => !moveInProgress && setCrewModalOpen(true)}
                disabled={moveInProgress}
                className={`text-left hover:opacity-90 transition-opacity ${moveInProgress ? "opacity-60 cursor-not-allowed" : ""}`}
                title={
                  moveInProgress ? "Cannot reassign job in progress" : undefined
                }
              >
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                  Assigned
                </span>
                <div className="text-[13px] font-medium text-[var(--yu3-wine)]">
                  {assignedMembers.size} members
                </div>
              </button>
            )}
          </div>
        </div>

        {/* Vehicle */}
        <div className="group/s relative border-t border-[var(--yu3-line-subtle)] py-4">
          {!isCompleted ? (
            <button
              type="button"
              className="absolute top-4 right-0 p-1 rounded-md hover:bg-[var(--yu3-bg-surface-subtle)] text-[var(--yu3-ink-muted)] transition-opacity opacity-50 hover:opacity-100"
              onClick={() => setVehicleModalOpen(true)}
              aria-label="Edit vehicle"
            >
              <Pencil weight="regular" className="w-[13px] h-[13px]" />
            </button>
          ) : (
            <span
              className="absolute top-4 right-0 p-1 rounded-md text-red-500"
              title="Move completed. Editing is locked."
              aria-hidden="true"
            >
              <Lock className="w-[11px] h-[11px]" />
            </span>
          )}
          <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-2">
            Vehicle
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Primary
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.truck_primary
                  ? VEHICLE_LABELS[move.truck_primary] || move.truck_primary
                  : "-"}
              </div>
            </div>
            <div>
              <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                Secondary
              </span>
              <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                {move.truck_secondary
                  ? VEHICLE_LABELS[move.truck_secondary] || move.truck_secondary
                  : "-"}
              </div>
            </div>
            {move.truck_notes && (
              <div className="col-span-2 sm:col-span-1">
                <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                  Notes
                </span>
                <div className="text-[10px] text-[var(--yu3-ink-muted)]">
                  {move.truck_notes}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Valuation Protection (not applicable to bin rental) */}
        {String(move.service_type || "").toLowerCase() !== "bin_rental" &&
          (move.valuation_tier ||
            move.valuation_upgrade_cost ||
            move.declaration_total) && (
            <div className="border-t border-[var(--yu3-line-subtle)] py-4">
              <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)] mb-2">
                Valuation Protection
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1">
                <div>
                  <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                    Tier
                  </span>
                  <div className="text-[13px] font-medium text-[var(--yu3-ink)]">
                    {move.valuation_tier === "full_replacement"
                      ? "Full Replacement"
                      : move.valuation_tier === "enhanced"
                        ? "Enhanced Value"
                        : "Released Value"}
                  </div>
                </div>
                {(move.valuation_upgrade_cost ?? 0) > 0 && (
                  <div>
                    <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                      Upgrade Cost
                    </span>
                    <div className="text-[13px] font-medium text-[var(--yu3-wine)]">
                      {formatCurrency(move.valuation_upgrade_cost)}
                    </div>
                  </div>
                )}
                {(move.declaration_total ?? 0) > 0 && (
                  <div>
                    <span className="text-[9px] font-semibold tracking-wider uppercase text-[var(--yu3-ink-muted)]/88">
                      Declarations
                    </span>
                    <div className="text-[13px] font-medium text-[var(--yu3-wine)]">
                      {formatCurrency(move.declaration_total)}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>
        </TabsContent>

        <TabsContent value="money" className="space-y-3 pt-2">
      {/* Financial Snapshot */}
      {(() => {
        const PAY_TOTAL_EPS = 0.05;
        const portfolioPmBilling = !!move?.is_pm_move;
        const completedAtForPortfolio =
          (typeof move.completed_at === "string" && move.completed_at.trim()
            ? move.completed_at
            : "") ||
          (typeof stepTimestamps.completed === "string" &&
          stepTimestamps.completed.trim()
            ? stepTimestamps.completed
            : "");

        let portfolioFinanceDueIso: string | null = null;
        if (
          portfolioPmBilling &&
          isCompleted &&
          completedAtForPortfolio.trim().length > 0
        ) {
          portfolioFinanceDueIso =
            portfolioPmStatementInvoiceDueIso(completedAtForPortfolio.trim());
        }
        const financeDuePortfolioLabel =
          portfolioFinanceDueIso != null && portfolioFinanceDueIso.trim()
            ? formatPlatformDisplay(
                new Date(`${portfolioFinanceDueIso}T12:00:00`),
                {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                },
                "",
              ).trim()
            : null;
        const consumerPaymentOverdueUi = portfolioPmBilling
          ? false
          : balanceUnpaid;
        const ctl = contractTaxLines(estimate, Number(move.amount ?? 0));
        const quoteTotal =
          ctl.inclusive > 0
            ? ctl.inclusive
            : estimate > 0
              ? estimate
              : depositPaid + balanceDue;
        const contractInclForLabels =
          ctl.inclusive > 0 ? ctl.inclusive : quoteTotal;
        const ledgerSumAfterTax = paymentLedger.reduce(
          (s, row) => s + Number(row.pre_tax_amount) + Number(row.hst_amount),
          0,
        );
        const totalPaidNum =
          move.total_paid != null && move.total_paid !== ""
            ? Number(move.total_paid)
            : null;
        /** Do not treat deposit-only `payment_marked_paid` as full settlement; require balance cleared or recognized totals. */
        const fullyPaid =
          balanceDue <= PAY_TOTAL_EPS &&
          (isBalancePaid ||
            (totalPaidNum != null &&
              totalPaidNum >= quoteTotal - PAY_TOTAL_EPS) ||
            ledgerSumAfterTax >= quoteTotal - PAY_TOTAL_EPS);
        const collectedAmount = fullyPaid
          ? quoteTotal
          : totalPaidNum != null
            ? totalPaidNum
            : ledgerSumAfterTax > 0
              ? ledgerSumAfterTax
              : depositPaid;
        const contractBarTarget =
          contractInclForLabels > 0 ? contractInclForLabels : quoteTotal;
        const progressPct =
          contractBarTarget > 0
            ? Math.min(
                100,
                Math.round((collectedAmount / contractBarTarget) * 100),
              )
            : 0;
        const footerRecordedAfterTax = fullyPaid
          ? quoteTotal
          : (totalPaidNum ??
            (ledgerSumAfterTax > 0 ? ledgerSumAfterTax : null));
        const depositRowsTotalAfterTax = paymentLedger
          .filter((r) => r.entry_type === "deposit")
          .reduce(
            (s, r) => s + Number(r.pre_tax_amount) + Number(r.hst_amount),
            0,
          );

        const ledgerDisplayTitle = (row: (typeof paymentLedger)[0]) => {
          if (row.entry_type === "deposit") {
            if (row.label === "Deposit" || row.label === "Contract deposit")
              return "Contract deposit";
            return row.label;
          }
          if (row.entry_type === "balance") {
            if (
              row.label === "Balance payment" ||
              row.label === "Final payment"
            )
              return "Final payment";
            return row.label;
          }
          return row.label;
        };

        const ledgerContextLine = (
          row: (typeof paymentLedger)[0],
          lineTotal: number,
        ) => {
          if (row.entry_type === "deposit") {
            return `${formatCurrency(lineTotal)} deposit on ${formatCurrency(contractInclForLabels)} contract total (incl. HST)`;
          }
          if (row.entry_type === "balance") {
            const depBase =
              depositRowsTotalAfterTax > 0
                ? depositRowsTotalAfterTax
                : Math.min(depositPaid, quoteTotal);
            return `${formatCurrency(contractInclForLabels)} contract (incl. HST) − ${formatCurrency(depBase)} deposit = ${formatCurrency(lineTotal)}`;
          }
          return null;
        };

        const finalPriceForEdit = Number(
          move.final_amount ??
            move.total_price ??
            move.estimate ??
            move.amount ??
            0,
        );

        return (
          <div className="rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] overflow-hidden">
            {/* Header strip */}
            <div className="flex items-center justify-between px-5 pt-4 pb-0 gap-2">
              <span className="text-[11px] font-bold tracking-[0.15em] uppercase text-[var(--yu3-ink-muted)] shrink-0">
                Payments
              </span>
              <div className="flex items-center gap-1.5 flex-wrap justify-end min-w-0">
                {isCompleted && canEditPostCompletionPrice ? (
                  <PostCompletionPriceEdit
                    jobType="move"
                    jobId={move.id}
                    currentPrice={finalPriceForEdit}
                    canEdit={canEditPostCompletionPrice}
                    previousEdits={postCompletionPriceEdits}
                    completed={isCompleted}
                    trigger={
                      <button
                        type="button"
                        className="shrink-0 p-1 rounded-md text-[var(--yu3-ink-muted)] hover:text-[var(--yu3-ink)] hover:bg-[var(--yu3-bg-surface-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--yu3-wine)]/25 transition-colors"
                        aria-label="Adjust final price"
                        title="Adjust final price"
                      >
                        <Pencil
                          weight="regular"
                          className="w-3.5 h-3.5"
                          aria-hidden
                        />
                      </button>
                    }
                  />
                ) : null}
                {(() => {
                  const label = tierDisplayLabel(move.tier_selected);
                  return label && !portfolioPmBilling ? (
                    <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                      {label}
                    </span>
                  ) : null;
                })()}
                {(move.service_type || portfolioPmBilling) && (
                  <span className="text-[9px] text-[var(--yu3-ink-muted)]">
                    {portfolioPmMoveServiceLabel(move)}
                  </span>
                )}
              </div>
            </div>

            {/* Main amount */}
            <div className="px-5 pt-3 pb-4">
              <div>
                {/* Status badge sits above the number */}
                <div className="mb-2">
                  {fullyPaid ? (
                    <span className="dt-badge tracking-[0.04em] text-[var(--grn)]">
                      Paid
                    </span>
                  ) : portfolioPmBilling ? (
                    <span className="dt-badge tracking-[0.04em] text-[var(--yu3-wine)]/90">
                      Partner statement
                    </span>
                  ) : consumerPaymentOverdueUi ? (
                    <span className="dt-badge tracking-[0.04em] text-[var(--red)]">
                      Overdue
                    </span>
                  ) : (
                    <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                      Pending
                    </span>
                  )}
                </div>
                <div
                  className={`font-heading text-[32px] font-bold leading-none tracking-tight ${
                    fullyPaid
                      ? "text-[var(--grn)]"
                      : portfolioPmBilling
                        ? "text-[var(--yu3-ink)]"
                        : consumerPaymentOverdueUi
                          ? "text-[var(--red)]"
                          : "text-[var(--yu3-ink)]"
                  }`}
                >
                  {fullyPaid
                    ? formatCurrency(
                        ctl.inclusive > 0 ? ctl.inclusive : quoteTotal,
                      )
                    : portfolioPmBilling
                      ? formatCurrency(contractInclForLabels || quoteTotal)
                      : formatCurrency(balanceDue)}
                </div>
                {fullyPaid && ctl.hst > 0 && (
                  <p className="mt-1.5 text-[11px] font-medium text-[var(--yu3-ink-muted)] leading-snug">
                    Subtotal {formatCurrency(ctl.preTax)} + HST{" "}
                    {formatCurrency(ctl.hst)} = {formatCurrency(ctl.inclusive)}{" "}
                    total (incl. HST, Ontario 13%)
                  </p>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="text-[10px] text-[var(--yu3-ink-muted)]/82">
                    {fullyPaid
                      ? `Total collected (incl. HST)${
                          move.balance_method ? ` · Card${move.balance_auto_charged ? " (auto)" : ""}` : ""
                        }`
                      : portfolioPmBilling && !fullyPaid && ctl.inclusive > 0
                        ? `Contract total incl. Ontario HST (${formatCurrency(ctl.preTax)} + ${formatCurrency(ctl.hst)})`
                        : `Balance due · +${formatCurrency(calcHST(balanceDue))} HST`}
                  </span>
                </div>
                {portfolioPmBilling && !fullyPaid && (
                  <p className="mt-2 text-[10px] text-[var(--yu3-ink-muted)] leading-snug max-w-md">
                    {isCompleted && financeDuePortfolioLabel
                      ? `Invoicing should show on the invoices list when completion posts, with partner payment targeting ${financeDuePortfolioLabel}.`
                      : `Invoicing posts when crew marks this move complete. Partner payment follows the portfolio 15 / 30 schedule from that completion date.`}
                  </p>
                )}
              </div>

              {/* Progress bar */}
              <div className="mt-4">
                {!portfolioPmBilling ? (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[9px] text-[var(--yu3-ink-muted)]">
                        {formatCurrency(collectedAmount)} collected
                      </span>
                      <span className="text-[9px] text-[var(--yu3-ink-muted)]">
                        {formatCurrency(contractInclForLabels)} contract (incl.
                        HST)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-[var(--yu3-line-subtle)] overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${fullyPaid ? "bg-[var(--grn)]" : consumerPaymentOverdueUi ? "bg-[var(--red)]" : "bg-[var(--admin-primary-fill)]"}`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </>
                ) : (
                  <p className="text-[9px] text-[var(--yu3-ink-muted)] leading-snug">
                    Settlement is logged when the portfolio invoice reads paid in Invoices.
                    Prefer that list over card or deposit workflows for this partner.
                  </p>
                )}
              </div>
            </div>

            {paymentLedger.length > 0 && (
              <div className="px-5 py-3 border-t border-[var(--yu3-line-subtle)]">
                <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--yu3-ink-muted)]/82 mb-2">
                  Payment transactions
                </div>
                <ul className="space-y-2">
                  {paymentLedger.map((row) => {
                    const lineTotal =
                      Number(row.pre_tax_amount) + Number(row.hst_amount);
                    const paid = new Date(row.paid_at);
                    const contextLine = ledgerContextLine(row, lineTotal);
                    return (
                      <li
                        key={row.id}
                        className="flex flex-wrap items-baseline justify-between gap-2 text-[11px] text-[var(--yu3-ink)]"
                      >
                        <div className="min-w-0">
                          <span className="font-semibold">
                            {ledgerDisplayTitle(row)}
                          </span>
                          <span className="text-[var(--yu3-ink-muted)]/88 ml-1.5">
                            ·{" "}
                            {formatPlatformDisplay(paid, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                          {row.settlement_method === "admin" && (
                            <span className="text-[9px] text-[var(--yu3-ink-muted)] ml-1">
                              (override)
                            </span>
                          )}
                          {contextLine && (
                            <div className="text-[9px] text-[var(--yu3-ink-muted)]/90 mt-1 leading-snug max-w-[min(100%,280px)]">
                              {contextLine}
                            </div>
                          )}
                        </div>
                        <div className="font-medium tabular-nums text-right">
                          <div className="text-[var(--yu3-ink)]">
                            {formatCurrency(lineTotal)}
                          </div>
                          {(Number(row.hst_amount) > 0 ||
                            Number(row.pre_tax_amount) > 0) && (
                            <div className="text-[9px] text-[var(--yu3-ink-muted)] font-normal mt-0.5 ml-auto leading-snug">
                              Subtotal {formatCurrency(row.pre_tax_amount)} +
                              tax {formatCurrency(row.hst_amount)}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
                {footerRecordedAfterTax != null && (
                  <p className="text-[10px] text-[var(--yu3-ink-muted)]/80 mt-3 pt-2 border-t border-[var(--yu3-line-subtle)]">
                    Recorded payments (after tax):{" "}
                    <span className="font-semibold text-[var(--yu3-ink)]">
                      {formatCurrency(footerRecordedAfterTax)}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* Action row, only when action is needed */}
            {!portfolioPmBilling &&
              !fullyPaid &&
              !balanceJustSettled &&
              !isBalancePaid && (
              <div className="px-4 py-3 border-t border-[var(--yu3-line-subtle)] flex flex-wrap items-center gap-2">
                {!move.deposit_paid_at && depositPaid > 0 && (
                  <button
                    type="button"
                    disabled={paymentBtnLoading !== null}
                    onClick={async () => {
                      setPaymentBtnLoading("deposit");
                      try {
                        const res = await fetch(`/api/admin/moves/${move.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "mark_deposit_collected",
                            marked_by: "admin",
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok)
                          throw new Error(
                            data.error || "Failed to record deposit",
                          );
                        if (data) setMove(data);
                        router.refresh();
                        toast("Deposit recorded", "check");
                      } catch (err) {
                        toast(
                          err instanceof Error
                            ? err.message
                            : "Failed to record deposit",
                          "alertTriangle",
                        );
                      } finally {
                        setPaymentBtnLoading(null);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--grn)]/40 bg-[var(--grn)]/8 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--grn)] hover:bg-[var(--grn)]/14 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {paymentBtnLoading === "deposit"
                      ? "RECORDING…"
                      : "MARK DEPOSIT PAID"}
                  </button>
                )}
                {!move.balance_paid_at && balanceDue > 0.005 && (
                  <button
                    type="button"
                    disabled={paymentBtnLoading !== null}
                    onClick={async () => {
                      setPaymentBtnLoading("full");
                      try {
                        const res = await fetch(`/api/admin/moves/${move.id}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            action: "mark_full_payment_collected",
                            marked_by: "admin",
                          }),
                        });
                        const data = await res.json();
                        if (!res.ok)
                          throw new Error(
                            data.error || "Failed to record full payment",
                          );
                        if (data) setMove(data);
                        router.refresh();
                        toast("Full payment recorded", "check");
                      } catch (err) {
                        toast(
                          err instanceof Error
                            ? err.message
                            : "Failed to record full payment",
                          "alertTriangle",
                        );
                      } finally {
                        setPaymentBtnLoading(null);
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-lg border border-[var(--grn)]/40 bg-[var(--grn)]/8 px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--grn)] hover:bg-[var(--grn)]/14 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                  >
                    {paymentBtnLoading === "full"
                      ? "RECORDING…"
                      : "FULL PAYMENT COLLECTED"}
                  </button>
                )}
                {balanceDue > 0 && !move.balance_auto_charged && (
                  <>
                    {move.square_card_id && (
                      <button
                        type="button"
                        disabled={paymentBtnLoading !== null}
                        onClick={async () => {
                          if (
                            !window.confirm(
                              `Charge ${formatCurrency(balanceDue)} CAD to the client's card on file?`,
                            )
                          )
                            return;
                          setPaymentBtnLoading("card");
                          try {
                            const res = await fetch(
                              `/api/admin/moves/${move.id}`,
                              {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({
                                  action: "charge_card_now",
                                  marked_by: "admin",
                                }),
                              },
                            );
                            const data = await res.json();
                            if (!res.ok)
                              throw new Error(data.error || "Failed");
                            setBalanceJustSettled(true);
                            setMove(data);
                            router.refresh();
                            toast("Card charged successfully", "check");
                          } catch (err) {
                            toast(
                              err instanceof Error
                                ? err.message
                                : "Failed to charge card",
                              "alertTriangle",
                            );
                          } finally {
                            setPaymentBtnLoading(null);
                          }
                        }}
                        className="text-[10px] font-semibold px-3 py-1.5 rounded-lg bg-[var(--yu3-wine)]/10 text-[var(--yu3-wine)] border border-[var(--yu3-wine)]/25 hover:bg-[var(--yu3-wine)]/18 transition-colors disabled:opacity-40"
                      >
                        {paymentBtnLoading === "card"
                          ? "Charging…"
                          : "Charge Card Now"}
                      </button>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        );
      })()}

      {/* Profitability, Owner Only */}
      {userRole === "owner" && <MoveProfitCard move={move} />}

        </TabsContent>

        <TabsContent value="work" className="space-y-3 pt-2">
      {/* Distance & Logistics */}
      <DistanceLogistics
        fromAddress={move.from_address}
        toAddress={move.to_address || move.delivery_address}
      />

      {linkedBinOrders.length > 0 && (
        <CollapsibleSection
          title="Bin rentals"
          subtitle={`${linkedBinOrders.length} linked`}
          defaultCollapsed={false}
        >
          <div className="space-y-3">
            {linkedBinOrders.map((raw) => {
              const b = raw as Record<string, unknown>;
              const id = String(b.id ?? "");
              const stKey = String(b.status ?? "").toLowerCase();
              const stLabel =
                BIN_ORDER_STATUS_ADMIN[stKey] ?? toTitleCase(stKey);
              return (
                <div
                  key={id}
                  className="rounded-lg border border-[var(--yu3-line-subtle)] p-3 text-[11px] space-y-2 bg-[var(--yu3-bg-surface)]/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-[var(--yu3-ink)]">
                      {String(b.order_number ?? "Bin order")}
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--yu3-ink-muted)]">
                      {stLabel}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-[var(--yu3-ink-muted)]">
                    <p>
                      <span className="text-[var(--yu3-ink-muted)]">Bundle · bins: </span>
                      {String(b.bundle_type ?? "—")} ·{" "}
                      {String(b.bin_count ?? "—")}
                    </p>
                    <p>
                      <span className="text-[var(--yu3-ink-muted)]">Drop-off: </span>
                      {b.drop_off_date
                        ? formatMoveDate(String(b.drop_off_date))
                        : "—"}
                    </p>
                    <p>
                      <span className="text-[var(--yu3-ink-muted)]">Move day: </span>
                      {b.move_date ? formatMoveDate(String(b.move_date)) : "—"}
                    </p>
                    <p>
                      <span className="text-[var(--yu3-ink-muted)]">Pickup: </span>
                      {b.pickup_date
                        ? formatMoveDate(String(b.pickup_date))
                        : "—"}
                    </p>
                  </div>
                  {(Boolean(b.delivery_address) ||
                    Boolean(b.pickup_address)) && (
                    <p className="text-[10px] text-[var(--yu3-ink-muted)] leading-snug">
                      {b.delivery_address ? (
                        <span>Deliver: {String(b.delivery_address)}</span>
                      ) : null}
                      {b.pickup_address ? (
                        <span
                          className={b.delivery_address ? " block mt-0.5" : ""}
                        >
                          Pick up: {String(b.pickup_address)}
                        </span>
                      ) : null}
                    </p>
                  )}
                  <Link
                    href={`/admin/bin-rentals/${id}`}
                    className="inline-flex text-[10px] font-bold text-[var(--yu3-wine)] hover:underline"
                  >
                    Open bin order
                  </Link>
                  <BinOrderPickupBlock bin={b} userRole={userRole} />
                </div>
              );
            })}
          </div>
        </CollapsibleSection>
      )}

      {/* Walkthrough status (move-day crew walkthrough) */}
      {(move.walkthrough_completed || move.walkthrough_skipped) && (
        <div className="rounded-xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)]/60 px-4 py-3 flex items-start gap-3">
          <div
            className={`w-2 h-2 rounded-full mt-1 shrink-0 ${move.walkthrough_skipped ? "bg-amber-400" : "bg-[#22C55E]"}`}
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold text-[var(--yu3-ink)] uppercase tracking-wider">
              Inventory Walkthrough{" "}
              {move.walkthrough_skipped ? "Skipped" : "Completed"}
            </p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
              {move.walkthrough_completed_at && (
                <span className="text-[10px] text-[var(--yu3-ink-muted)]">
                  {formatPlatformDisplay(move.walkthrough_completed_at, {
                    month: "short",
                    day: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              )}
              {move.walkthrough_crew_member && (
                <span className="text-[10px] text-[var(--yu3-ink-muted)]">by crew</span>
              )}
              {move.walkthrough_skipped && move.walkthrough_skip_reason && (
                <span className="text-[10px] text-amber-500">
                  Reason: {toTitleCase(move.walkthrough_skip_reason)}
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Pending inventory change (client or crew submitted) */}
      {pendingInventoryChange &&
        ["pending", "admin_reviewing", "client_confirming"].includes(
          pendingInventoryChange.status,
        ) && <InventoryChangeRequestPanel request={pendingInventoryChange} />}

      {pendingModifications.length > 0 && (
        <div className="rounded-xl border border-amber-500/35 bg-amber-500/[0.06] p-4 mb-6">
          <h3 className="text-[12px] font-bold text-[var(--yu3-ink)] mb-2 uppercase tracking-wide">
            Pending booking changes
          </h3>
          <ul className="text-[11px] text-[var(--yu3-ink-muted)] space-y-1.5">
            {pendingModifications.map((m) => (
              <li key={m.id}>
                <span className="font-semibold text-[var(--yu3-ink)]">
                  {toTitleCase(String(m.type || "").replace(/_/g, " "))}
                </span>
                {m.price_difference != null &&
                Number(m.price_difference) !== 0 ? (
                  <span className="text-[var(--yu3-ink-muted)]">
                    {" "}
                    · Price impact {formatCurrency(Number(m.price_difference))}
                  </span>
                ) : null}
                <span className="block text-[10px] text-amber-700/90 mt-0.5">
                  Status: awaiting client approval
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {["owner", "admin", "coordinator"].includes(userRole) && !isCompleted && (
        <MoveModificationQuickForm moveId={move.id} />
      )}

      {surveyPhotos.length > 0 && (
        <div className="rounded-xl border border-[var(--yu3-line)] bg-[var(--yu3-bg-surface)] p-4 mb-6">
          <h3 className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] mb-3">
            Pre-move photos (client survey)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(
              surveyPhotos.reduce<Record<string, typeof surveyPhotos>>(
                (acc, p) => {
                  const k = p.room || "other";
                  if (!acc[k]) acc[k] = [];
                  acc[k].push(p);
                  return acc;
                },
                {},
              ),
            ).map(([room, photos]) => (
              <div
                key={room}
                className="border border-[var(--yu3-line-subtle)] rounded-lg p-3"
              >
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--yu3-ink)] mb-2">
                  {toTitleCase(room.replace(/_/g, " "))}
                </p>
                <p className="text-[10px] text-[var(--yu3-ink-muted)] mb-2">
                  {photos.length} photo(s)
                </p>
                <a
                  href={photos[0]?.photo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-semibold text-[var(--yu3-ink)] underline"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Inventory, Files & Media */}
      <MoveInventorySection
        moveId={move.id}
        moveStatus={move.status}
        userRole={userRole}
        itemWeights={itemWeights}
        moveType={move.move_type}
      />
      <MoveFilesSection moveId={move.id} moveStatus={move.status} />

      {/* Reported Issues from crew */}
      <IncidentsSection jobId={move.id} jobType="move" />

      <MoveWaiversSection waivers={moveWaivers} />

      {/* Internal Notes, seamless */}
      <div className="group/s relative border-t border-[var(--yu3-line-subtle)] py-4">
        {!isCompleted ? (
          <button
            type="button"
            className="absolute top-4 right-0 p-1 rounded-md hover:bg-[var(--yu3-bg-surface-subtle)] text-[var(--yu3-ink-muted)] transition-opacity opacity-50 hover:opacity-100"
            onClick={() => {
              setDetailsModalSection("notes");
              setDetailsModalOpen(true);
            }}
            aria-label="Edit internal notes"
          >
            <Pencil weight="regular" className="w-[13px] h-[13px]" />
          </button>
        ) : (
          <span
            className="absolute top-4 right-0 p-1 rounded-md text-red-500"
            title="Move completed. Editing is locked."
            aria-hidden="true"
          >
            <Lock className="w-[11px] h-[11px]" />
          </span>
        )}
        <div className="t-label text-[var(--yu3-ink-muted)] mb-2">Internal Notes</div>
        {(() => {
          const notes = stripClientMessagesFromNotes(move.internal_notes);
          if (notes) {
            return (
              <p className="text-[11px] text-[var(--yu3-ink-muted)] leading-snug whitespace-pre-wrap">
                {notes}
              </p>
            );
          }
          if (isCompleted) {
            return (
              <p className="text-[11px] text-[var(--yu3-ink-muted)] leading-snug italic">
                No internal notes were added.
              </p>
            );
          }
          return (
            <button
              type="button"
              onClick={() => {
                setDetailsModalSection("notes");
                setDetailsModalOpen(true);
              }}
              className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-3 py-1.5 text-[11px] font-semibold text-[var(--yu3-ink-muted)] transition-colors hover:bg-[var(--yu3-bg-surface-subtle)] hover:text-[var(--yu3-ink)]"
            >
              <Pencil weight="regular" className="w-[11px] h-[11px]" />
              Add the first note
            </button>
          );
        })()}
      </div>

        </TabsContent>
      </Tabs>

      <MoveContactModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        moveId={move.id}
        initial={{
          client_name: move.client_name || "",
          client_email: move.client_email || move.customer_email || "",
          client_phone: move.client_phone ?? "",
          preferred_contact: move.preferred_contact ?? undefined,
        }}
        onSaved={(updates) => setMove((prev: any) => ({ ...prev, ...updates }))}
      />

      <ModalOverlay
        open={crewModalOpen}
        onClose={() => setCrewModalOpen(false)}
        title="Assign Crew"
        maxWidth="sm"
      >
        <div className="p-5 space-y-4">
          {!moveInProgress && (
            <RecommendedCrewPanel
              moveId={move.id}
              moveDate={move.move_date ?? null}
              serviceType={move.service_type ?? null}
              tierSelected={move.tier_selected ?? null}
              hasPiano={move.has_piano ?? false}
              estimate={move.estimate ?? null}
              currentCrewId={move.crew_id ?? null}
              onAssign={(_userId, name) => {
                toast(`${name} assigned to this move`, "check");
                router.refresh();
                setCrewModalOpen(false);
              }}
            />
          )}
          {moveInProgress && (
            <p className="text-[11px] text-amber-600 bg-amber-500/10 rounded-lg p-3">
              Cannot reassign: this move is in progress. Reassignment is only
              allowed before the crew has started.
            </p>
          )}
          <div>
            <label className="admin-premium-label">Select Crew</label>
            <select
              value={move.crew_id || ""}
              disabled={moveInProgress}
              onChange={async (e) => {
                if (moveInProgress) return;
                const v = e.target.value || null;
                try {
                  const res = await fetch("/api/dispatch/assign", {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      jobId: move.id,
                      jobType: "move",
                      crewId: v,
                    }),
                  });
                  const json = await res.json();
                  if (!res.ok)
                    throw new Error(json.error || "Failed to assign");
                  if (json.move) {
                    setMove(json.move);
                    setAssignedMembers(
                      new Set(
                        Array.isArray(json.move.assigned_members)
                          ? json.move.assigned_members
                          : crews.find((c) => c.id === v)?.members || [],
                      ),
                    );
                  }
                  router.refresh();
                  toast("Crew assigned", "check");
                } catch (err) {
                  toast(
                    err instanceof Error ? err.message : "Failed to assign",
                    "alertTriangle",
                  );
                }
              }}
              className="admin-premium-input w-full transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">No crew assigned</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {selectedCrew && crewMembers.length > 0 && (
            <>
              <p className="text-[11px] text-[var(--yu3-ink-muted)]">
                Check or uncheck members to assign to this move.
              </p>
              <div className="space-y-2">
                {crewMembers.map((m) => (
                  <label
                    key={m}
                    className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--yu3-line)] hover:bg-[var(--yu3-bg-surface)] cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={assignedMembers.has(m)}
                      onChange={() => toggleMember(m)}
                      className="w-4 h-4 rounded border-[var(--yu3-line)] text-[var(--yu3-wine)] focus:ring-[var(--yu3-line)]"
                    />
                    <span className="text-[13px] font-medium text-[var(--yu3-ink)]">
                      {m}
                    </span>
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={async () => {
                  const members = Array.from(assignedMembers);
                  try {
                    const res = await fetch("/api/dispatch/assign", {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        jobId: move.id,
                        jobType: "move",
                        members,
                      }),
                    });
                    const json = await res.json();
                    if (!res.ok) throw new Error(json.error || "Failed to save");
                    if (json.move) setMove(json.move);
                    router.refresh();
                    setCrewModalOpen(false);
                    toast("Assignments saved", "check");
                  } catch (err) {
                    toast(
                      err instanceof Error ? err.message : "Failed to save assignments",
                      "alertTriangle",
                    );
                  }
                }}
                className="admin-btn admin-btn-primary w-full"
              >
                Save Assignments
              </button>
            </>
          )}
          {selectedCrew && crewMembers.length === 0 && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              No members in this crew. Add members in Platform Settings → Teams.
            </p>
          )}
          {!selectedCrew && snapshotRoster.length > 0 && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              Recorded crew (job snapshot): {snapshotRoster.join(", ")}
            </p>
          )}
          {!selectedCrew && snapshotRoster.length === 0 && (
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              Select a crew above to assign members to this move.
            </p>
          )}
        </div>
      </ModalOverlay>

      <ModalOverlay
        open={vehicleModalOpen}
        onClose={() => setVehicleModalOpen(false)}
        title="Assign Vehicle"
        maxWidth="sm"
      >
        <div className="p-5 space-y-4">
          <div>
            <label className="admin-premium-label">Primary Vehicle</label>
            <select
              value={move.truck_primary || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                const isOverride = v !== move.truck_primary;
                const { data } = await supabase
                  .from("moves")
                  .update({
                    truck_primary: v,
                    truck_override: isOverride,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", move.id)
                  .select()
                  .single();
                if (data) setMove(data);
                router.refresh();
              }}
              className="admin-premium-input w-full"
            >
              <option value="">No vehicle assigned</option>
              {VEHICLE_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-premium-label">
              Secondary Vehicle (Optional)
            </label>
            <select
              value={move.truck_secondary || ""}
              onChange={async (e) => {
                const v = e.target.value || null;
                const { data } = await supabase
                  .from("moves")
                  .update({
                    truck_secondary: v,
                    updated_at: new Date().toISOString(),
                  })
                  .eq("id", move.id)
                  .select()
                  .single();
                if (data) setMove(data);
                router.refresh();
              }}
              className="admin-premium-input w-full"
            >
              <option value="">None</option>
              {VEHICLE_OPTIONS.map(([val, label]) => (
                <option key={val} value={val}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="admin-premium-label">Vehicle Notes</label>
            <textarea
              defaultValue={move.truck_notes || ""}
              onBlur={async (e) => {
                const v = e.target.value.trim() || null;
                if (v !== (move.truck_notes || null)) {
                  const { data } = await supabase
                    .from("moves")
                    .update({
                      truck_notes: v,
                      updated_at: new Date().toISOString(),
                    })
                    .eq("id", move.id)
                    .select()
                    .single();
                  if (data) setMove(data);
                }
              }}
              placeholder="e.g. Use truck #3 (newer lift gate)"
              rows={2}
              className="admin-premium-textarea w-full resize-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setVehicleModalOpen(false)}
            className="admin-btn admin-btn-primary w-full"
          >
            Done
          </button>
        </div>
      </ModalOverlay>

      {restartOverrideModal && (
        <ModalOverlay
          open
          onClose={() => {
            setRestartOverrideModal(null);
            setRestartOverrideTyped("");
            setEditingCard(null);
          }}
          title="Admin override required"
          maxWidth="sm"
        >
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--yu3-ink-muted)]">
              This move is completed. Changing status back to{" "}
              <strong>{getStatusLabel(restartOverrideModal.newStatus)}</strong>{" "}
              will RESTART the move globally:
            </p>
            <ul className="text-[11px] text-[var(--yu3-ink-muted)] list-disc list-inside space-y-1">
              <li>Live stage will be cleared</li>
              <li>Any tracking session will be ended</li>
              <li>Crew will be able to start the job again from scratch</li>
            </ul>
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              Type <strong className="text-[var(--yu3-ink-muted)]">OVERRIDE</strong> to
              confirm you are an admin and understand this action.
            </p>
            <input
              type="text"
              value={restartOverrideTyped}
              onChange={(e) => setRestartOverrideTyped(e.target.value)}
              placeholder="Type OVERRIDE"
              className="admin-premium-input w-full"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setRestartOverrideModal(null);
                  setRestartOverrideTyped("");
                  setEditingCard(null);
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  restartOverrideTyped.trim().toUpperCase() !== "OVERRIDE"
                }
                onClick={async () => {
                  if (restartOverrideTyped.trim().toUpperCase() !== "OVERRIDE")
                    return;
                  try {
                    const res = await fetch(
                      `/api/admin/moves/${move.id}/restart`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          newStatus: restartOverrideModal.newStatus,
                        }),
                      },
                    );
                    const data = await res.json();
                    if (!res.ok)
                      throw new Error(data.error || "Failed to restart");
                    if (data.move) setMove(data.move);
                    setRestartOverrideModal(null);
                    setRestartOverrideTyped("");
                    setEditingCard(null);
                    router.refresh();
                    toast("Move restarted", "check");
                  } catch (err) {
                    toast(
                      err instanceof Error ? err.message : "Failed to restart",
                      "alertTriangle",
                    );
                  }
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--org)] text-white hover:bg-[var(--org)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Override & restart
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      {overrideStatusModalOpen && (
        <ModalOverlay
          open
          onClose={() => {
            setOverrideStatusModalOpen(false);
            setOverrideStatusTyped("");
          }}
          title="Override status (admin)"
          maxWidth="sm"
        >
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--yu3-ink-muted)]">
              This move is completed. Changing status will{" "}
              <strong>restart</strong> the move globally:
            </p>
            <ul className="text-[11px] text-[var(--yu3-ink-muted)] list-disc list-inside space-y-1">
              <li>Live stage will be cleared</li>
              <li>Any tracking session will be ended</li>
              <li>Crew will be able to start the job again from scratch</li>
            </ul>
            <div>
              <label className="block text-[11px] font-semibold text-[var(--yu3-ink-muted)] mb-1.5">
                New status
              </label>
              <select
                value={overrideStatusNewStatus}
                onChange={(e) => setOverrideStatusNewStatus(e.target.value)}
                className="admin-premium-input w-full"
              >
                {MOVE_STATUS_OPTIONS.filter(
                  (s) => !["completed", "cancelled"].includes(s.value),
                ).map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-[var(--yu3-ink-muted)]">
              Type <strong className="text-[var(--yu3-ink-muted)]">OVERRIDE</strong> to
              confirm you understand this action.
            </p>
            <input
              type="text"
              value={overrideStatusTyped}
              onChange={(e) => setOverrideStatusTyped(e.target.value)}
              placeholder="Type OVERRIDE"
              className="admin-premium-input w-full"
              autoComplete="off"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setOverrideStatusModalOpen(false);
                  setOverrideStatusTyped("");
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink-muted)] hover:bg-[var(--yu3-bg-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  overrideStatusTyped.trim().toUpperCase() !== "OVERRIDE"
                }
                onClick={async () => {
                  if (overrideStatusTyped.trim().toUpperCase() !== "OVERRIDE")
                    return;
                  try {
                    const res = await fetch(
                      `/api/admin/moves/${move.id}/restart`,
                      {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          newStatus: overrideStatusNewStatus,
                        }),
                      },
                    );
                    const data = await res.json();
                    if (!res.ok)
                      throw new Error(
                        data.error || "Failed to override status",
                      );
                    if (data.move) setMove(data.move);
                    setOverrideStatusModalOpen(false);
                    setOverrideStatusTyped("");
                    router.refresh();
                    toast("Status overridden", "check");
                  } catch (err) {
                    toast(
                      err instanceof Error
                        ? err.message
                        : "Failed to override status",
                      "alertTriangle",
                    );
                  }
                }}
                className="flex-1 py-2.5 rounded-lg text-[12px] font-semibold bg-[var(--org)] text-white hover:bg-[var(--org)]/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Override & restart
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}

      <EditMoveDetailsModal
        open={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setDetailsModalSection(null);
        }}
        section={detailsModalSection}
        moveId={move.id}
        crews={crews}
        isCompleted={isCompleted}
        initial={{
          from_address: move.from_address,
          to_address: move.to_address || move.delivery_address,
          from_lat: move.from_lat,
          from_lng: move.from_lng,
          to_lat: move.to_lat,
          to_lng: move.to_lng,
          crew_id: move.crew_id,
          status: move.status,
          stage: move.stage,
          coordinator_name: move.coordinator_name,
          scheduled_date: move.scheduled_date,
          arrival_window: move.arrival_window,
          estimated_duration_minutes: move.estimated_duration_minutes ?? null,
          margin_alert_minutes: move.margin_alert_minutes ?? null,
          from_access: move.from_access,
          to_access: move.to_access,
          access_notes: move.access_notes,
          complexity_indicators: move.complexity_indicators ?? [],
          internal_notes: stripClientMessagesFromNotes(move.internal_notes),
        }}
        onSaved={(updates) => {
          setMove((prev: any) => ({ ...prev, ...updates }));
          router.refresh();
          const merged = { ...move, ...updates };
          if (
            isEstateTierMove(merged) &&
            (updates.status != null ||
              updates.stage != null ||
              updates.scheduled_date != null ||
              updates.move_size != null ||
              updates.inventory_score != null)
          ) {
            fetch(`/api/admin/moves/${move.id}/sync-estate-checklist`, {
              method: "POST",
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => {
                if (j?.estate_service_checklist != null) {
                  setMove((p: any) => ({
                    ...p,
                    estate_service_checklist: j.estate_service_checklist,
                  }));
                }
              })
              .catch(() => {});
          }
        }}
      />

      <ConfirmDialog
        open={cancelConfirmOpen}
        title="Cancel this move?"
        message="Cancelling will notify the client and lock this move. This action is difficult to undo."
        confirmLabel="Cancel Move"
        variant="danger"
        onConfirm={async () => {
          setCancelConfirmOpen(false);
          const v = pendingCancelStatus!;
          setPendingCancelStatus(null);
          const now = new Date().toISOString();
          const { data, error } = await supabase
            .from("moves")
            .update({ status: v, updated_at: now })
            .eq("id", move.id)
            .select()
            .single();
          if (error) {
            toast(error.message || "Failed to update status", "alertTriangle");
            return;
          }
          if (data) setMove(data);
          setEditingCard(null);
          router.refresh();
          if (data && isEstateTierMove(data)) {
            fetch(`/api/admin/moves/${move.id}/sync-estate-checklist`, {
              method: "POST",
            })
              .then((r) => (r.ok ? r.json() : null))
              .then((j) => {
                if (j?.estate_service_checklist != null) {
                  setMove((p: any) => ({
                    ...p,
                    estate_service_checklist: j.estate_service_checklist,
                  }));
                }
              })
              .catch(() => {});
          }
          fetch(`/api/admin/moves/${move.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              action: "log_status_change",
              new_status: v,
              previous_status: move.status,
            }),
          }).catch(() => {});
        }}
        onCancel={() => {
          setCancelConfirmOpen(false);
          setPendingCancelStatus(null);
        }}
      />
      {deleteConfirmOpen && (
        <ModalOverlay
          open
          onClose={() => setDeleteConfirmOpen(false)}
          title="Delete move?"
          maxWidth="sm"
        >
          <div className="p-5 space-y-4">
            <p className="text-[12px] text-[var(--yu3-ink-muted)]">
              This will permanently remove this move and its inventory,
              documents, and photos. This cannot be undone.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(false)}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold border border-[var(--yu3-line)] text-[var(--yu3-ink-muted)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  setDeleting(true);
                  try {
                    const res = await fetch(`/api/admin/moves/${move.id}`, {
                      method: "DELETE",
                    });
                    const data = await res.json();
                    if (!res.ok)
                      throw new Error(data.error || "Failed to delete");
                    toast("Move deleted", "check");
                    router.push(
                      isOffice
                        ? "/admin/moves/office"
                        : "/admin/moves/residential",
                    );
                  } catch (e) {
                    toast(
                      e instanceof Error ? e.message : "Failed to delete move",
                      "x",
                    );
                  } finally {
                    setDeleting(false);
                  }
                }}
                disabled={deleting}
                className="flex-1 py-2 rounded-lg text-[11px] font-semibold bg-[var(--red)] text-white disabled:opacity-50"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </ModalOverlay>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   Profitability Breakdown (Owner-Only)
   ════════════════════════════════════════ */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function MoveProfitCard({ move }: { move: any }) {
  const [costs, setCosts] = useState<{
    labour: number;
    fuel: number;
    truck: number;
    supplies: number;
    processing: number;
    totalDirect: number;
    grossProfit: number;
    grossMargin: number;
    paidWithCard?: boolean;
  } | null>(null);
  const [target, setTarget] = useState(40);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
        const to = now.toISOString().slice(0, 10);
        const res = await fetch(
          `/api/admin/profitability?from=${from}&to=${to}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        setTarget(data.summary?.targetMargin ?? 40);
        const match = (data.rows ?? []).find(
          (r: { id: string }) => r.id === move.id,
        );
        if (match) {
          setCosts({
            labour: match.labour,
            fuel: match.fuel,
            truck: match.truck,
            supplies: match.supplies,
            processing: match.processing,
            totalDirect: match.totalDirect,
            grossProfit: match.grossProfit,
            grossMargin: match.grossMargin,
            paidWithCard: match.paid_with_card === true,
          });
        }
      } catch {
        /* silent */
      }
    })();
  }, [move.id]);

  if (!costs) return null;

  const revenue = move.final_amount ?? move.estimate ?? move.amount ?? 0;
  const marginColor =
    costs.grossMargin >= target
      ? "text-emerald-400"
      : costs.grossMargin >= target - 5
        ? "text-[var(--yu3-wine)]"
        : "text-red-400";

  return (
    <div className="border-t border-[var(--yu3-line-subtle)] py-4">
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <div className="text-[11px] font-bold tracking-[0.14em] uppercase text-[var(--yu3-ink-muted)]">
          Profitability
        </div>
        <ProfitabilityBreakdownHint
          iconSize={14}
          ariaLabel="What profitability includes"
        />
        <span className="dt-badge tracking-[0.04em] text-[var(--yu3-wine)]">
          Owner Only
        </span>
      </div>
      <div className="space-y-1.5 text-[11px]">
        <div className="flex justify-between">
          <span className="text-[var(--yu3-ink-muted)]">Revenue</span>
          <span className="text-[var(--yu3-ink)] font-medium">
            {formatCurrency(revenue)}
          </span>
        </div>
        <div className="border-t border-[var(--yu3-line-subtle)] my-1" />
        <div className="flex justify-between">
          <span className="text-[var(--yu3-ink-muted)]">Labour</span>
          <span className="text-red-400/80">
            -{formatCurrency(costs.labour)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--yu3-ink-muted)]">Fuel</span>
          <span className="text-red-400/80">-{formatCurrency(costs.fuel)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--yu3-ink-muted)]">Truck</span>
          <span className="text-red-400/80">
            -{formatCurrency(costs.truck)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--yu3-ink-muted)]">Supplies</span>
          <span className="text-red-400/80">
            -{formatCurrency(costs.supplies)}
          </span>
        </div>
        {costs.paidWithCard && costs.processing > 0 ? (
          <div className="flex justify-between gap-3">
            <span className="text-[var(--yu3-ink-muted)]">
              Card processing (client-paid, est.)
            </span>
            <span className="text-[var(--yu3-ink-muted)] tabular-nums">
              {formatCurrency(costs.processing)}
            </span>
          </div>
        ) : null}
        <div className="border-t border-[var(--yu3-line-subtle)] my-1" />
        <div className="flex justify-between font-medium">
          <span className="text-[var(--yu3-ink-muted)]">Direct Cost</span>
          <span className="text-red-400">
            -{formatCurrency(costs.totalDirect)}
          </span>
        </div>
        <div className="flex justify-between font-semibold">
          <span className="text-[var(--yu3-ink)]">Gross Profit</span>
          <span className={marginColor}>
            {formatCurrency(costs.grossProfit)} ({costs.grossMargin}%)
          </span>
        </div>
      </div>
      {costs.grossMargin < target && (
        <div className="mt-3 text-[10px] text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5">
          Below target margin ({target}%)
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  PaperPlaneTilt as Send,
  MapPin,
  Clock,
  Stack as Layers,
  Users,
  FileText,
  Printer,
  Money as DollarSign,
  Warning as AlertTriangle,
  PencilSimple as Pencil,
  Trash as Trash2,
  CaretDown as ChevronDown,
  CaretRight,
  Phone,
  Envelope as Mail,
  Shield,
  ArrowSquareOut as ExternalLink,
  Folder,
  ArrowRight,
  Check,
  XCircle,
} from "@phosphor-icons/react";
import BackButton from "../../components/BackButton";
import {
  ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS,
  ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS,
} from "../../components/admin-toolbar-action-classes";
import EditDeliveryModal from "./EditDeliveryModal";
import DownloadPDFButton from "./DownloadPDFButton";
import GenerateInvoiceButton from "./GenerateInvoiceButton";
import SendB2BOneOffInvoiceButton from "./SendB2BOneOffInvoiceButton";
import { formatPhone } from "@/lib/phone";
import ContactDetailsModal from "../../components/ContactDetailsModal";
import LiveTrackingMap from "./LiveTrackingMap";
import CollapsibleSection from "@/components/CollapsibleSection";
import IncidentsSection from "../../components/IncidentsSection";
import ProofOfDeliverySection from "@/components/ProofOfDeliverySection";
import DeliveryCrewPhotosSection from "./DeliveryCrewPhotosSection";
import ModalOverlay from "../../components/ModalOverlay";
import { useToast } from "../../components/Toast";
import { formatCurrency, calcHST } from "@/lib/format-currency";
import { toTitleCase } from "@/lib/format-text";
import { normalizeDeliveryItemsForDisplay } from "@/lib/delivery-items";
import { effectiveDeliveryPrice } from "@/lib/delivery-pricing";
import { deliveryEligibleForAdminPrepaidMark } from "@/lib/delivery-prepaid-eligibility";
import { formatPlatformDisplay } from "@/lib/date-format";
import PostCompletionPriceEdit from "../../components/PostCompletionPriceEdit";

/* ═══════════════════════════════════════════════════
   Constants
   ═══════════════════════════════════════════════════ */

const STATUS_FLOW = [
  "pending",
  "confirmed",
  "in-transit",
  "delivered",
] as const;
const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  pending_approval: "Awaiting Approval",
  scheduled: "Scheduled",
  confirmed: "Confirmed",
  "in-transit": "In Transit",
  delivered: "Completed",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Status label colours: light = saturated (readable on cream); dark = lighter (readable on wine / glass). */
const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string }> =
  {
    pending: {
      dot: "bg-amber-500",
      bg: "bg-amber-500/10",
      text: "text-amber-900 dark:text-amber-200",
    },
    pending_approval: {
      dot: "bg-amber-500",
      bg: "bg-amber-500/10",
      text: "text-amber-900 dark:text-amber-200",
    },
    scheduled: {
      dot: "bg-blue-500",
      bg: "bg-blue-500/10",
      text: "text-blue-900 dark:text-blue-300",
    },
    confirmed: {
      dot: "bg-emerald-500",
      bg: "bg-emerald-500/10",
      text: "text-emerald-900 dark:text-emerald-300",
    },
    "in-transit": {
      dot: "bg-[var(--admin-primary-fill)]",
      bg: "bg-[var(--gdim)]",
      text: "text-[var(--gold)]",
    },
    delivered: {
      dot: "bg-emerald-500",
      bg: "bg-emerald-500/10",
      text: "text-emerald-900 dark:text-emerald-300",
    },
    completed: {
      dot: "bg-emerald-500",
      bg: "bg-emerald-500/10",
      text: "text-emerald-900 dark:text-emerald-300",
    },
    cancelled: {
      dot: "bg-red-500",
      bg: "bg-red-500/10",
      text: "text-red-800 dark:text-red-300",
    },
  };

const CATEGORY_BADGE: Record<
  string,
  { text: string; label: string; accent: string }
> = {
  retail: {
    text: "text-[var(--gold)]",
    label: "Retail",
    accent: "var(--gold)",
  },
  designer: { text: "text-[#B8860B]", label: "Designer", accent: "#B8860B" },
  hospitality: {
    text: "text-[#D48A29]",
    label: "Hospitality",
    accent: "#D48A29",
  },
  gallery: { text: "text-[#4A7CE5]", label: "Gallery", accent: "#4A7CE5" },
  b2c: { text: "text-[#2D9F5A]", label: "B2C", accent: "#2D9F5A" },
};

/* ═══════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════ */

function isDone(status: string | null | undefined): boolean {
  const s = (status || "").toLowerCase();
  return s === "delivered" || s === "completed" || s === "cancelled";
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
  "dispatched",
  "in_transit",
];
function isDeliveryInProgress(
  status: string | null | undefined,
  stage: string | null | undefined,
): boolean {
  const s = (status || "").toLowerCase().replace(/-/g, "_");
  const st = (stage || "").toLowerCase().replace(/-/g, "_");
  return IN_PROGRESS_STATUSES.includes(s) || IN_PROGRESS_STATUSES.includes(st);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Not set";
  return formatPlatformDisplay(
    new Date(dateStr + "T00:00:00"),
    {
      weekday: "short",
      month: "short",
      day: "numeric",
    },
    "Not set",
  );
}

/* ═══════════════════════════════════════════════════
   Micro Components
   ═══════════════════════════════════════════════════ */

function StatusDot({ status }: { status: string }) {
  const c = STATUS_COLORS[status] || STATUS_COLORS.pending;
  return <span className={`w-2 h-2 rounded-full shrink-0 ${c.dot}`} />;
}

function ProgressBar({ status }: { status: string }) {
  const idx = STATUS_FLOW.indexOf(status as (typeof STATUS_FLOW)[number]);
  return (
    <div className="flex gap-1 h-2 w-full mt-3">
      {STATUS_FLOW.map((step, i) => {
        const filled = i <= idx;
        const isCurrent = i === idx;
        return (
          <div
            key={step}
            className="flex-1 rounded-full transition-all duration-300"
            style={{
              background: filled
                ? isCurrent && status !== "delivered"
                  ? "var(--gold)"
                  : "var(--grn)"
                : "color-mix(in srgb, var(--tx) 28%, transparent)",
            }}
          />
        );
      })}
    </div>
  );
}

function MetricPill({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 min-w-0">
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${accent ? "bg-[var(--gold)]/10" : "bg-[var(--bg)]"}`}
      >
        <Icon
          className={`w-3.5 h-3.5 ${accent ? "text-[var(--gold)]" : "text-[var(--tx3)]"}`}
        />
      </div>
      <div className="min-w-0">
        <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]/82 leading-none">
          {label}
        </div>
        <div
          className={`text-[12px] font-semibold mt-0.5 truncate ${accent ? "text-[var(--gold)]" : "text-[var(--tx)]"}`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   Main Component
   ═══════════════════════════════════════════════════ */

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

export interface DeliveryStopItem {
  id?: string;
  description: string;
  quantity: number;
  weight_range?: string | null;
  is_fragile?: boolean | null;
  is_high_value?: boolean | null;
  requires_assembly?: boolean | null;
  status?: string | null;
}

export interface DeliveryStop {
  id: string;
  stop_number: number;
  address: string;
  customer_name: string | null;
  customer_phone: string | null;
  client_phone?: string | null;
  vendor_name?: string | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  access_type?: string | null;
  access_notes?: string | null;
  readiness?: string | null;
  readiness_notes?: string | null;
  items_description: string | null;
  special_instructions: string | null;
  notes?: string | null;
  stop_status?: string | null;
  stop_type?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
  is_final_destination?: boolean | null;
  stop_items?: DeliveryStopItem[] | null;
}

const ACCESS_TYPE_LABELS: Record<string, string> = {
  elevator: "Elevator",
  ground_floor: "Ground floor",
  loading_dock: "Loading dock",
  walk_up_2: "Walk-up (2 flights)",
  walk_up_3: "Walk-up (3 flights)",
  walk_up_4_plus: "Walk-up (4+ flights)",
  long_carry: "Long carry",
  narrow_stairs: "Narrow stairs",
  no_parking: "No parking",
};

const formatStopAccess = (raw: string | null | undefined) => {
  if (!raw) return "";
  return ACCESS_TYPE_LABELS[raw] || raw.replace(/_/g, " ");
};

const readinessBadge = (readiness: string | null | undefined) => {
  const r = (readiness || "confirmed").toLowerCase();
  const map: Record<string, { label: string; dot: string }> = {
    confirmed: { label: "Ready", dot: "bg-emerald-500" },
    pending: { label: "Pending", dot: "bg-amber-400" },
    partial: { label: "Partial", dot: "bg-orange-500" },
    delayed: { label: "Delayed", dot: "bg-red-500" },
  };
  return map[r] || { label: toTitleCase(r.replace(/_/g, " ")), dot: "bg-zinc-400" };
};

interface EtaSmsLogEntry {
  message_type: string;
  sent_at: string;
  eta_minutes: number | null;
  twilio_sid: string | null;
}

interface DeliveryInvoice {
  id: string;
  invoice_number: string;
  square_invoice_url: string | null;
  /** e.g. sent, paid */
  status: string;
}

export default function DeliveryDetailClient({
  delivery: initialDelivery,
  clientEmail,
  organizations = [],
  crews = [],
  stops = null,
  etaSmsLog = [],
  deliveryInvoice = null,
  isB2BPartner = false,
  linkedProject = null,
  b2bOneOffPriorCount = 0,
  b2bOneOffCohort = null,
  canEditPostCompletionPrice = false,
  postCompletionPriceEdits = [],
}: {
  delivery: any;
  clientEmail?: string | null;
  organizations?: { id: string; name: string; type: string }[];
  crews?: Crew[];
  stops?: DeliveryStop[] | null;
  etaSmsLog?: EtaSmsLogEntry[];
  deliveryInvoice?: DeliveryInvoice | null;
  isB2BPartner?: boolean;
  linkedProject?: {
    id: string;
    project_number: string;
    project_name: string;
    phase_name?: string | null;
  } | null;
  /** Count of prior one-off deliveries for same business contact (excludes current). */
  b2bOneOffPriorCount?: number;
  /** All one-offs for same contact: vertical + combined revenue for partner conversion context. */
  b2bOneOffCohort?: {
    verticalLabel: string | null;
    combinedRevenue: number;
    deliveryCount: number;
  } | null;
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
}) {
  const router = useRouter();
  const { toast } = useToast();
  const supabase = createClient();
  const [delivery, setDelivery] = useState(initialDelivery);
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [crewModalOpen, setCrewModalOpen] = useState(false);
  /** Modal: selected team and member subset (names must match crew roster strings). */
  const [crewPickCrewId, setCrewPickCrewId] = useState<string | null>(null);
  const [crewPickMembers, setCrewPickMembers] = useState<string[]>([]);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [editingStatus, setEditingStatus] = useState(false);
  const [approveDeclineLoading, setApproveDeclineLoading] = useState(false);
  const [adjustedPrice, setAdjustedPrice] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [mapPickup, setMapPickup] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [mapDropoff, setMapDropoff] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [recordPaymentLoading, setRecordPaymentLoading] = useState(false);

  useEffect(() => setDelivery(initialDelivery), [initialDelivery]);

  // Resolve pickup/dropoff coords for LiveTrackingMap (from DB or geocode)
  useEffect(() => {
    const d = delivery;
    if (!d) return;

    const hasPickupCoords = d.pickup_lat != null && d.pickup_lng != null;
    const hasDropoffCoords = d.delivery_lat != null && d.delivery_lng != null;

    if (hasPickupCoords) {
      setMapPickup({ lat: Number(d.pickup_lat), lng: Number(d.pickup_lng) });
    } else if (d.pickup_address?.trim()) {
      fetch(
        `/api/mapbox/geocode?q=${encodeURIComponent(d.pickup_address.trim())}&limit=1`,
        { credentials: "include" },
      )
        .then((res) => res.json())
        .then((data) => {
          const feat = data?.features?.[0];
          const coords = feat?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2)
            setMapPickup({ lng: coords[0], lat: coords[1] });
          else setMapPickup(null);
        })
        .catch(() => setMapPickup(null));
    } else {
      setMapPickup(null);
    }

    if (hasDropoffCoords) {
      setMapDropoff({
        lat: Number(d.delivery_lat),
        lng: Number(d.delivery_lng),
      });
    } else if (d.delivery_address?.trim()) {
      fetch(
        `/api/mapbox/geocode?q=${encodeURIComponent(d.delivery_address.trim())}&limit=1`,
        { credentials: "include" },
      )
        .then((res) => res.json())
        .then((data) => {
          const feat = data?.features?.[0];
          const coords = feat?.geometry?.coordinates;
          if (Array.isArray(coords) && coords.length >= 2)
            setMapDropoff({ lng: coords[0], lat: coords[1] });
          else setMapDropoff(null);
        })
        .catch(() => setMapDropoff(null));
    } else {
      setMapDropoff(null);
    }
  }, [
    delivery?.id,
    delivery?.pickup_lat,
    delivery?.pickup_lng,
    delivery?.pickup_address,
    delivery?.delivery_lat,
    delivery?.delivery_lng,
    delivery?.delivery_address,
  ]);

  const linkedCrew = crews.find((c) => c.id === delivery.crew_id);
  const snapMembers = Array.isArray(delivery.assigned_members)
    ? delivery.assigned_members.filter(
        (m: unknown) => typeof m === "string" && String(m).trim(),
      )
    : [];
  const snapName =
    typeof delivery.assigned_crew_name === "string" &&
    delivery.assigned_crew_name.trim()
      ? delivery.assigned_crew_name.trim()
      : "";
  const hasSnapshot = snapName.length > 0 || snapMembers.length > 0;
  /** Prefer live crew roster/name when the crew still exists so Platform edits show without reassigning. */
  const liveMembers =
    linkedCrew && Array.isArray(linkedCrew.members)
      ? linkedCrew.members.filter(
          (m: unknown) => typeof m === "string" && String(m).trim(),
        )
      : [];
  const displayCrew =
    linkedCrew || hasSnapshot
      ? {
          name: linkedCrew
            ? (linkedCrew.name || "").trim() || snapName || "Crew"
            : (snapName || "Crew (archived)").trim() || "Crew",
          members:
            snapMembers.length > 0
              ? snapMembers
              : linkedCrew
                ? liveMembers
                : snapMembers,
        }
      : null;
  const completed = isDone(delivery.status);
  const stLower = (delivery.status || "").toLowerCase();
  const isCancelledDelivery = stLower === "cancelled";
  const completedForPriceEdit =
    stLower === "delivered" || stLower === "completed";
  /** Actual job completion time; prefer over updated_at so later edits (invoice, price) do not rewrite the banner. */
  const completedAtDisplay =
    typeof delivery.completed_at === "string" && delivery.completed_at.trim()
      ? delivery.completed_at
      : typeof delivery.updated_at === "string" && delivery.updated_at.trim()
        ? delivery.updated_at
        : null;
  const deliveryInProgress = isDeliveryInProgress(
    delivery.status,
    delivery.stage,
  );
  const cat = CATEGORY_BADGE[delivery.category] || CATEGORY_BADGE.retail;
  const sc = STATUS_COLORS[delivery.status] || STATUS_COLORS.pending;
  const price = effectiveDeliveryPrice(delivery);
  const calculatedBaseline =
    Number(delivery.calculated_price) > 0
      ? Number(delivery.calculated_price)
      : Number(delivery.quoted_price) > 0
        ? Number(delivery.quoted_price)
        : 0;

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`delivery-${delivery.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "deliveries",
          filter: `id=eq.${delivery.id}`,
        },
        (payload) => {
          setDelivery((prev: any) => ({ ...prev, ...payload.new }));
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [delivery.id]);

  useEffect(() => {
    if (!crewModalOpen) return;
    const cid =
      delivery.crew_id != null && String(delivery.crew_id).trim() !== ""
        ? String(delivery.crew_id)
        : null;
    setCrewPickCrewId(cid);
    const crew = cid ? crews.find((c) => c.id === cid) : undefined;
    const roster =
      crew?.members
        ?.filter(
          (m: unknown) => typeof m === "string" && String(m).trim() !== "",
        )
        .map((m) => String(m).trim()) ?? [];
    const snap = Array.isArray(delivery.assigned_members)
      ? delivery.assigned_members
          .filter(
            (m: unknown): m is string =>
              typeof m === "string" && String(m).trim() !== "",
          )
          .map((m: string) => m.trim())
      : [];
    if (cid && snap.length > 0) {
      const valid = snap.filter((m: string) => roster.includes(m));
      setCrewPickMembers(valid.length > 0 ? valid : [...roster]);
    } else {
      setCrewPickMembers([...roster]);
    }
  }, [crewModalOpen, delivery.crew_id, delivery.assigned_members, crews]);

  const assignCrewWithMembers = async (
    crewId: string | null,
    memberNames?: string[] | null,
  ) => {
    const crew = crewId ? crews.find((c) => c.id === crewId) : null;
    try {
      const body: Record<string, unknown> = {
        crew_id: crewId,
        updated_at: new Date().toISOString(),
      };
      if (crewId && memberNames && memberNames.length > 0) {
        body.assigned_members = memberNames;
      }
      const res = await fetch(`/api/admin/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error || "Failed to assign crew", "alertTriangle");
        return;
      }
      if (result.delivery)
        setDelivery((prev: any) => ({ ...prev, ...result.delivery }));
    } catch {
      toast("Failed to assign crew", "alertTriangle");
      return;
    }
    router.refresh();
    toast(crewId ? `Assigned to ${crew?.name}` : "Crew unassigned", "check");
  };

  const handleSelectCrewForPicker = (crewId: string) => {
    setCrewPickCrewId(crewId);
    const crew = crews.find((c) => c.id === crewId);
    const roster =
      crew?.members
        ?.filter(
          (m: unknown) => typeof m === "string" && String(m).trim() !== "",
        )
        .map((m) => String(m).trim()) ?? [];
    const snap = Array.isArray(delivery.assigned_members)
      ? delivery.assigned_members
          .filter(
            (m: unknown): m is string =>
              typeof m === "string" && String(m).trim() !== "",
          )
          .map((m: string) => m.trim())
      : [];
    if (delivery.crew_id === crewId && snap.length > 0) {
      const valid = snap.filter((m: string) => roster.includes(m));
      setCrewPickMembers(valid.length > 0 ? valid : [...roster]);
    } else {
      setCrewPickMembers([...roster]);
    }
  };

  const handleToggleCrewMemberPick = (name: string) => {
    setCrewPickMembers((prev) =>
      prev.includes(name) ? prev.filter((x) => x !== name) : [...prev, name],
    );
  };

  const crewPickRoster = useMemo(() => {
    if (!crewPickCrewId) return [] as string[];
    const pickCrew = crews.find((x) => x.id === crewPickCrewId);
    return (
      pickCrew?.members
        ?.filter(
          (m: unknown) => typeof m === "string" && String(m).trim() !== "",
        )
        .map((m) => String(m).trim()) ?? []
    );
  }, [crewPickCrewId, crews]);

  const handleApplyCrewAssignment = async () => {
    if (!crewPickCrewId) {
      toast("Choose a team", "alertTriangle");
      return;
    }
    if (crewPickRoster.length === 0) {
      await assignCrewWithMembers(crewPickCrewId, null);
      setCrewModalOpen(false);
      return;
    }
    if (crewPickMembers.length === 0) {
      toast("Select at least one crew member", "alertTriangle");
      return;
    }
    if (crewPickMembers.some((m) => !crewPickRoster.includes(m))) {
      toast("Invalid member selection", "alertTriangle");
      return;
    }
    await assignCrewWithMembers(crewPickCrewId, crewPickMembers);
    setCrewModalOpen(false);
  };

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          updated_at: new Date().toISOString(),
        }),
      });
      const result = await res.json();
      if (!res.ok) {
        toast(result.error || "Failed", "alertTriangle");
        return;
      }
      if (result.delivery)
        setDelivery((prev: any) => ({ ...prev, ...result.delivery }));
    } catch {
      toast("Failed to update status", "alertTriangle");
      return;
    }
    setEditingStatus(false);
    router.refresh();
    toast("Status updated", "check");
  };

  const handleApprove = async () => {
    setApproveDeclineLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (adjustedPrice) body.adjusted_price = parseFloat(adjustedPrice);
      const res = await fetch(`/api/admin/deliveries/${delivery.id}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "Failed to approve", "alertTriangle");
      } else {
        router.refresh();
        toast("Delivery approved", "check");
      }
    } catch {
      toast("Failed to approve", "alertTriangle");
    }
    setApproveDeclineLoading(false);
  };

  const handleReject = async () => {
    setApproveDeclineLoading(true);
    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast(d.error || "Failed to decline", "alertTriangle");
      } else {
        router.refresh();
        toast("Delivery declined", "check");
      }
    } catch {
      toast("Failed to decline", "alertTriangle");
    }
    setApproveDeclineLoading(false);
    setShowRejectForm(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/deliveries/${delivery.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        toast(data.error || "Failed to delete", "alertTriangle");
        setDeleting(false);
        return;
      }
      toast("Delivery deleted", "check");
      router.push("/admin/deliveries");
      router.refresh();
    } catch {
      toast("Failed to delete", "alertTriangle");
      setDeleting(false);
    }
  };

  const items = Array.isArray(delivery.items) ? delivery.items : [];
  const isMultiStop =
    !!delivery.is_multi_stop && Array.isArray(stops) && stops.length > 0;
  const itemsDisplay = useMemo(() => {
    if (!isMultiStop || !stops) {
      return normalizeDeliveryItemsForDisplay(items);
    }
    const rows: { name: string; qty: number }[] = [];
    for (const s of stops) {
      const lineItems = s.stop_items;
      if (Array.isArray(lineItems) && lineItems.length > 0) {
        for (const it of lineItems) {
          const q = Math.max(1, Number(it.quantity) || 1);
          let name = String(it.description || "").trim() || "Item";
          const bits: string[] = [];
          if (it.is_fragile) bits.push("fragile");
          if (it.is_high_value) bits.push("high value");
          if (it.requires_assembly) bits.push("assembly");
          if (bits.length) name = `${name} (${bits.join(", ")})`;
          rows.push({ name, qty: q });
        }
      } else if (s.items_description?.trim()) {
        rows.push({ name: s.items_description.trim(), qty: 1 });
      }
    }
    return rows;
  }, [isMultiStop, stops, items]);
  const totalItems = itemsDisplay.reduce(
    (sum: number, i: { qty?: number }) => sum + (i.qty || 1),
    0,
  );
  const hasMultiRoute = !!(isMultiStop && stops && stops.length > 0);
  const pickupStopCount = hasMultiRoute
    ? stops!.filter((s) => !s.is_final_destination).length
    : 0;
  const isPartnerRequest = delivery.created_by_source === "partner_portal";
  const needsApproval =
    (delivery.status === "pending_approval" || delivery.status === "pending") &&
    isPartnerRequest;
  const isB2BOneOff =
    delivery.booking_type === "one_off" && !delivery.organization_id;

  const handleRecordPayment = async () => {
    setRecordPaymentLoading(true);
    try {
      const id = String(delivery?.id ?? "").trim();
      if (!id) {
        toast("Missing delivery reference.", "alertTriangle");
        setRecordPaymentLoading(false);
        return;
      }
      const num =
        typeof delivery.delivery_number === "string"
          ? delivery.delivery_number.trim()
          : "";
      const qs = num ? `?number=${encodeURIComponent(num)}` : "";
      const res = await fetch(
        `/api/admin/deliveries/${encodeURIComponent(id)}/record-payment${qs}`,
        {
          method: "POST",
        },
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(d.error || "Failed to record payment", "alertTriangle");
        setRecordPaymentLoading(false);
        return;
      }
      toast("Marked as paid. Tracking links sent when applicable.", "check");
      router.refresh();
    } catch {
      toast("Failed to record payment", "alertTriangle");
    }
    setRecordPaymentLoading(false);
  };

  return (
    <div className="w-full min-w-0 py-4 md:py-5 animate-fade-up">
      <div className="flex items-center gap-2 mb-1">
        <BackButton label="Back" />
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82">
          B2B Operations · Delivery
        </p>
      </div>

      {/* ─── PROJECT CONTEXT BANNER ─── */}
      {linkedProject && (
        <a
          href={`/admin/projects/${linkedProject.id}`}
          className="mt-3 mb-1 flex items-center gap-2.5 px-4 py-2.5 rounded-xl border border-[var(--gold)]/25 bg-[var(--gold)]/5 hover:bg-[var(--gold)]/10 transition-colors group"
        >
          <Folder
            size={14}
            weight="regular"
            className="shrink-0 text-[var(--gold)]"
          />
          <div className="flex-1 min-w-0">
            <span className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--gold)]/60">
              Part of Project
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] font-semibold text-[var(--tx)]">
                {linkedProject.project_number}, {linkedProject.project_name}
              </span>
              {linkedProject.phase_name && (
                <span className="dt-badge tracking-[0.04em] text-[var(--gold)]">
                  {linkedProject.phase_name}
                </span>
              )}
            </div>
          </div>
          <ArrowRight
            size={12}
            weight="regular"
            className="shrink-0 text-[var(--tx3)] transition-colors group-hover:text-[var(--gold)]"
          />
        </a>
      )}

      {/* ─── APPROVAL BANNER ─── */}
      {needsApproval && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 to-transparent p-4 md:p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[13px] font-bold text-amber-700 dark:text-amber-300">
              Partner Request, Awaiting Your Approval
            </span>
          </div>

          {delivery.total_price > 0 && (
            <div className="mb-3 space-y-2">
              <div className="rounded-lg bg-[var(--card)] border border-[var(--brd)]/50 p-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                {delivery.booking_type && (
                  <div>
                    <span className="text-[var(--tx3)] block text-[9px] uppercase tracking-wider font-semibold">
                      Type
                    </span>
                    <span className="font-medium text-[var(--tx)]">
                      {delivery.booking_type === "day_rate"
                        ? "Day Rate"
                        : "Per Delivery"}
                    </span>
                  </div>
                )}
                {delivery.base_price > 0 && (
                  <div>
                    <span className="text-[var(--tx3)] block text-[9px] uppercase tracking-wider font-semibold">
                      Base
                    </span>
                    <span className="font-medium text-[var(--tx)]">
                      {formatCurrency(delivery.base_price)}
                    </span>
                  </div>
                )}
                {(delivery.services_price > 0 ||
                  delivery.overage_price > 0) && (
                  <div>
                    <span className="text-[var(--tx3)] block text-[9px] uppercase tracking-wider font-semibold">
                      Add-ons
                    </span>
                    <span className="font-medium text-[var(--tx)]">
                      {formatCurrency(
                        (delivery.services_price || 0) +
                          (delivery.overage_price || 0),
                      )}
                    </span>
                  </div>
                )}
                <div>
                  <span className="text-[var(--tx3)] block text-[9px] uppercase tracking-wider font-semibold">
                    Total
                  </span>
                  <span className="font-bold text-[var(--gold)]">
                    {formatCurrency(delivery.total_price)}
                  </span>
                </div>
              </div>
              {Array.isArray(delivery.pricing_breakdown) &&
                delivery.pricing_breakdown.length > 0 && (
                  <div className="rounded-lg bg-[var(--bg)]/50 border border-[var(--brd)]/30 p-3 text-[11px]">
                    <div className="text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)]/88 mb-2">
                      Price breakdown
                    </div>
                    <div className="space-y-1">
                      {delivery.pricing_breakdown.map(
                        (
                          b: { label: string; amount: number; detail?: string },
                          i: number,
                        ) => (
                          <div
                            key={i}
                            className="flex justify-between text-[var(--tx)]"
                          >
                            <span>
                              {b.label}
                              {b.detail ? ` (${b.detail})` : ""}
                            </span>
                            <span
                              className={
                                b.amount < 0
                                  ? "text-emerald-800 dark:text-emerald-300"
                                  : ""
                              }
                            >
                              {formatCurrency(b.amount)}
                            </span>
                          </div>
                        ),
                      )}
                    </div>
                  </div>
                )}
            </div>
          )}

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <div className="flex-1">
              <label className="block text-[9px] font-semibold tracking-wider uppercase text-[var(--tx3)] mb-1">
                Adjust price (optional)
              </label>
              <input
                type="number"
                step="0.01"
                placeholder={
                  delivery.total_price
                    ? String(delivery.total_price)
                    : "Enter price"
                }
                value={adjustedPrice}
                onChange={(e) => setAdjustedPrice(e.target.value)}
                className="admin-premium-input w-full max-w-[200px]"
              />
            </div>
            {showRejectForm ? (
              <div className="flex-1 space-y-2">
                <textarea
                  placeholder="Reason for declining…"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={2}
                  className="admin-premium-textarea w-full resize-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleReject}
                    disabled={approveDeclineLoading}
                    className="px-4 py-2 rounded-lg text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
                  >
                    {approveDeclineLoading ? "…" : "Confirm Decline"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRejectForm(false)}
                    className="text-[11px] text-[var(--tx3)] hover:text-[var(--tx)]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={approveDeclineLoading}
                  className="px-5 py-2.5 rounded-lg text-[11px] font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {approveDeclineLoading ? "…" : "Approve & Confirm"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowRejectForm(true)}
                  disabled={approveDeclineLoading}
                  className="px-4 py-1.5 rounded text-[11px] font-bold bg-[var(--red)] text-white hover:opacity-90 disabled:opacity-50 transition-all"
                >
                  Decline
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isB2BOneOff && (
        <div className="mt-3 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 space-y-3">
          <p className="text-[11px] font-bold text-[var(--tx)]">
            B2B one-off · Payment and tracking
          </p>
          <p className="text-[12px] leading-relaxed text-[var(--tx2)] font-medium">
            Send a Square invoice so the business contact can pay by card. When
            Square marks the invoice paid, this job is recorded as prepaid and
            tracking links go out automatically. Or, if payment was collected
            outside Square, record it here to issue tracking links (email + SMS
            to the business contact).
          </p>
          <div className="flex flex-wrap gap-2">
            <SendB2BOneOffInvoiceButton
              delivery={delivery}
              pendingInvoice={
                !!deliveryInvoice &&
                String(deliveryInvoice.status).toLowerCase() !== "paid"
              }
              onSent={() => router.refresh()}
            />
            <button
              type="button"
              onClick={handleRecordPayment}
              disabled={recordPaymentLoading}
              className="admin-btn admin-btn-primary"
            >
              {recordPaymentLoading
                ? "Saving…"
                : delivery.payment_received_at
                  ? "Re-send tracking setup"
                  : "Record full payment"}
            </button>
            {delivery.tracking_token ? (
              <a
                href={`${typeof window !== "undefined" ? window.location.origin : ""}/delivery/track/${encodeURIComponent(delivery.tracking_token)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-2 rounded-lg text-[11px] font-semibold border-2 border-[color-mix(in_srgb,var(--tx)_34%,transparent)] text-[var(--tx)] hover:bg-[color-mix(in_srgb,var(--tx)_8%,transparent)]"
              >
                <ExternalLink className="w-3 h-3" /> Open business track link
              </a>
            ) : null}
          </div>
          {delivery.payment_received_at ? (
            <p className="text-[10px] text-[var(--tx3)]">
              Payment recorded{" "}
              {new Date(delivery.payment_received_at).toLocaleString("en-CA", {
                timeZone: "America/Toronto",
              })}
            </p>
          ) : null}
          {b2bOneOffPriorCount >= 1 ? (
            <div className="pt-2 border-t border-[var(--brd)] text-[11px] text-[var(--tx2)] space-y-2">
              <p>
                <strong className="text-[var(--tx)]">
                  {delivery.business_name ||
                    delivery.contact_email ||
                    "This sender"}
                </strong>{" "}
                has booked {b2bOneOffPriorCount + 1} one-off deliveries without
                a partner account.
              </p>
              {b2bOneOffCohort && b2bOneOffCohort.deliveryCount > 0 ? (
                <ul className="list-disc pl-4 space-y-0.5 text-[var(--tx3)]">
                  {b2bOneOffCohort.verticalLabel ? (
                    <li>
                      <span className="text-[var(--tx)]">Vertical:</span>{" "}
                      {b2bOneOffCohort.verticalLabel}
                    </li>
                  ) : null}
                  <li>
                    <span className="text-[var(--tx)]">
                      Total revenue (all one-offs, this contact):
                    </span>{" "}
                    {formatCurrency(b2bOneOffCohort.combinedRevenue)}
                  </li>
                </ul>
              ) : null}
              <p className="text-[10px] text-[var(--tx3)]">
                When you create the partner, choose default vertical rates or
                customize them in onboarding — their portal and quotes will then
                use those negotiated rates automatically.
              </p>
              <Link
                href="/admin/platform/workspace?tab=partners"
                className="inline-flex font-semibold text-[var(--gold)] hover:underline"
              >
                Create partner account
              </Link>
            </div>
          ) : null}
        </div>
      )}

      {/* ─── HEADER ─── */}
      <div
        className="mt-3 rounded-xl overflow-hidden border border-[color-mix(in_srgb,var(--tx)_22%,transparent)] bg-[color-mix(in_srgb,var(--card)_100%,transparent)] shadow-[inset_0_1px_0_color-mix(in_srgb,var(--tx)_08%,transparent)]"
        style={{ borderLeft: `3px solid ${cat.accent}` }}
      >
        <div className="p-4 sm:p-5">
          {/* Top: Name + badges + actions */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="font-heading text-[18px] md:text-[20px] font-bold text-[var(--tx)] hover:text-[var(--gold)] transition-colors truncate"
                >
                  {hasMultiRoute && String(delivery.project_name || "").trim()
                    ? String(delivery.project_name).trim()
                    : delivery.customer_name || delivery.delivery_number}
                </button>
                {price > 0 && (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="text-[16px] font-bold font-heading text-[var(--gold)]">
                      {formatCurrency(price)}
                    </span>
                    <span className="text-[10px] text-[var(--tx3)]">
                      +{formatCurrency(Math.round(price * 0.13))} HST
                    </span>
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2">
                <span className="dt-badge tracking-[0.04em] text-[var(--tx)] font-mono normal-case">
                  {delivery.delivery_number}
                </span>
                {delivery.booking_type === "day_rate" && (
                  <span className="dt-badge tracking-[0.04em] text-amber-700 dark:text-amber-300">
                    Day Rate
                    {delivery.num_stops != null
                      ? ` · ${delivery.num_stops} stops`
                      : ""}
                  </span>
                )}
                {hasMultiRoute && (
                  <span className="dt-badge tracking-[0.04em] text-sky-700 dark:text-sky-300">
                    Multi-stop
                    {delivery.total_stops != null
                      ? ` · ${delivery.total_stops} stops`
                      : stops
                        ? ` · ${stops.length} stops`
                        : ""}
                  </span>
                )}
                <span className={`dt-badge tracking-[0.04em] ${cat.text}`}>
                  {cat.label}
                </span>
                {delivery.special_handling && (
                  <span className="inline-flex items-center gap-1 dt-badge tracking-[0.04em] text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="w-2.5 h-2.5" weight="bold" />{" "}
                    Special Handling
                  </span>
                )}
                {isPartnerRequest && (
                  <span className="dt-badge tracking-[0.04em] text-blue-600 dark:text-sky-400">
                    Partner Portal
                  </span>
                )}
              </div>
              {hasMultiRoute &&
                (delivery.end_client_name || delivery.end_client_phone) && (
                  <p className="text-[11px] text-[var(--tx2)] mt-2 font-medium">
                    End client:{" "}
                    {delivery.end_client_name
                      ? String(delivery.end_client_name)
                      : "—"}
                    {delivery.end_client_phone
                      ? ` · ${formatPhone(String(delivery.end_client_phone))}`
                      : ""}
                  </p>
                )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setEditModalOpen(true)}
                className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
              >
                <Pencil
                  weight="regular"
                  className="w-3 h-3 shrink-0"
                  aria-hidden
                />{" "}
                Edit
                <CaretRight
                  weight="bold"
                  className="w-3 h-3 shrink-0 opacity-90"
                  aria-hidden
                />
              </button>
              <DownloadPDFButton
                delivery={delivery}
                className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
              />
              {hasMultiRoute ? (
                <a
                  href={`/admin/deliveries/${encodeURIComponent(delivery.delivery_number || delivery.id)}/manifest`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={ADMIN_TOOLBAR_SECONDARY_ACTION_CLASS}
                >
                  <Printer
                    weight="regular"
                    className="w-3 h-3 shrink-0"
                    aria-hidden
                  />{" "}
                  Print manifest
                  <CaretRight
                    weight="bold"
                    className="w-3 h-3 shrink-0 opacity-90"
                    aria-hidden
                  />
                </a>
              ) : null}
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                className={ADMIN_TOOLBAR_DESTRUCTIVE_ACTION_CLASS}
              >
                <Trash2
                  weight="regular"
                  className="w-3 h-3 shrink-0"
                  aria-hidden
                />{" "}
                Delete
              </button>
            </div>
          </div>

          {/* Status row */}
          <div className="mt-4 pt-3 border-t border-[var(--brd)]/30">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              {delivery.payment_received_at &&
              deliveryEligibleForAdminPrepaidMark(delivery) ? (
                <span className="dt-badge tracking-[0.04em] text-emerald-700 dark:text-emerald-300">
                  Paid (prepaid)
                </span>
              ) : null}
              {/* Status */}
              <div className="flex items-center gap-2">
                <StatusDot status={delivery.status} />
                {editingStatus ? (
                  <select
                    autoFocus
                    defaultValue={delivery.status}
                    onBlur={() => setEditingStatus(false)}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="text-[11px] bg-[var(--bg)] border border-[var(--brd)] rounded-md px-2 py-1.5 text-[var(--tx)] focus:border-[var(--brd)] outline-none"
                  >
                    {Object.entries(STATUS_LABELS).map(([val, label]) => (
                      <option key={val} value={val}>
                        {label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    type="button"
                    onClick={() => setEditingStatus(true)}
                    className="group inline-flex items-center gap-1"
                  >
                    <span
                      className={`dt-badge tracking-[0.04em] text-[11px] ${sc.text}`}
                    >
                      {STATUS_LABELS[delivery.status] ||
                        toTitleCase(delivery.status)}
                    </span>
                    <ChevronDown
                      weight="regular"
                      className="w-3 h-3 text-[var(--tx3)] opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                  </button>
                )}
              </div>
            </div>

            {delivery.status !== "cancelled" && (
              <ProgressBar status={delivery.status} />
            )}
          </div>
        </div>
      </div>

      {completed && (
        <div className="mt-2 rounded-lg bg-[var(--gdim)]/30 border border-[var(--brd)]/40 px-4 py-2 text-[10px] text-[var(--tx3)]">
          This delivery is {toTitleCase(delivery.status)}. Some fields are
          locked.
        </div>
      )}

      {/* ─── MAIN CONTENT ─── */}
      <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 lg:gap-8">
        {/* LEFT */}
        <div>
          {etaSmsLog.length > 0 && (
            <div className="mb-4">
              <CollapsibleSection
                title="SMS Updates"
                defaultCollapsed
                subtitle={`${etaSmsLog.length} sent`}
              >
                <div className="rounded-lg border border-[var(--brd)] bg-[var(--bg)] overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="border-b border-[var(--brd)] bg-[var(--gdim)]/30">
                        <th className="text-left py-2 px-3 font-semibold text-[var(--tx2)]">
                          Type
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--tx2)]">
                          Sent
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--tx2)]">
                          ETA
                        </th>
                        <th className="text-left py-2 px-3 font-semibold text-[var(--tx2)]">
                          Twilio
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {etaSmsLog.map((row, i) => (
                        <tr
                          key={i}
                          className="border-b border-[var(--brd)]/50 last:border-0"
                        >
                          <td className="py-2 px-3 text-[var(--tx)]">
                            {toTitleCase(row.message_type)}
                          </td>
                          <td className="py-2 px-3 text-[var(--tx2)]">
                            {row.sent_at
                              ? new Date(row.sent_at).toLocaleString()
                              : "-"}
                          </td>
                          <td className="py-2 px-3 text-[var(--tx2)]">
                            {row.eta_minutes != null
                              ? `${row.eta_minutes} min`
                              : "-"}
                          </td>
                          <td className="py-2 px-3 font-mono text-[10px] text-[var(--tx3)]">
                            {row.twilio_sid || "Failed"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </div>
          )}

          {/* Live Tracking / Completion Status, stays as card (hero) */}
          {completed ? (
            isCancelledDelivery ? (
              <div className="rounded-xl border border-red-500/25 bg-red-500/5 overflow-hidden">
                <div className="px-5 py-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <XCircle
                      size={16}
                      className="text-red-600 dark:text-red-400 shrink-0"
                      weight="bold"
                      aria-hidden
                    />
                    <span className="text-[12px] font-bold text-red-700 dark:text-red-400">
                      Cancelled
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--tx3)]">
                    {delivery.updated_at
                      ? `· ${formatPlatformDisplay(delivery.updated_at, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, "")}`
                      : ""}
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 overflow-hidden">
                <div className="px-5 py-5 text-center">
                  <div className="flex items-center justify-center gap-2 mb-2">
                    <Check
                      size={16}
                      color="#22C55E"
                      weight="bold"
                      aria-hidden
                    />
                    <span className="text-[12px] font-bold text-emerald-600 dark:text-emerald-400">
                      Delivery Complete
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--tx3)]">
                    {displayCrew ? `Completed by ${displayCrew.name}` : ""}
                    {completedAtDisplay
                      ? ` · ${formatPlatformDisplay(completedAtDisplay, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }, "")}`
                      : ""}
                  </p>
                </div>
              </div>
            )
          ) : (
            <div className="rounded-xl border border-[var(--brd)]/50 overflow-hidden bg-[var(--card)]">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--brd)]/30">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-heading text-[11px] font-bold tracking-wide uppercase text-[var(--tx)]">
                    Live Tracking
                  </span>
                </div>
                {delivery.crew_id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-[var(--tx3)]">
                      {displayCrew?.name || "Crew assigned"}
                    </span>
                    {!deliveryInProgress && (
                      <button
                        type="button"
                        onClick={() => setCrewModalOpen(true)}
                        className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                      >
                        Change
                      </button>
                    )}
                  </div>
                ) : (
                  !deliveryInProgress && (
                    <button
                      type="button"
                      onClick={() => setCrewModalOpen(true)}
                      className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                    >
                      Assign Crew
                    </button>
                  )
                )}
              </div>
              {delivery.crew_id ? (
                <LiveTrackingMap
                  crewId={delivery.crew_id}
                  crewName={displayCrew?.name}
                  deliveryId={delivery.id}
                  pickup={mapPickup ?? undefined}
                  dropoff={mapDropoff ?? undefined}
                />
              ) : (
                <div className="px-6 py-10 text-center">
                  <p className="text-[12px] font-medium text-[var(--tx2)]">
                    No crew assigned
                  </p>
                  <p className="text-[10px] text-[var(--tx3)] mt-1 mb-3">
                    Assign a crew to enable live GPS tracking
                  </p>
                  {!deliveryInProgress && (
                    <button
                      type="button"
                      onClick={() => setCrewModalOpen(true)}
                      className="admin-btn admin-btn-primary"
                    >
                      Assign Crew
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ─── Seamless sections below map ─── */}
          <div className="mt-6 space-y-0">
            {/* Route / Day rate stops / Multi-stop B2B */}
            <div className="pb-5">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-4">
                {hasMultiRoute
                  ? `Route (${pickupStopCount} pickup${pickupStopCount !== 1 ? "s" : ""} → 1 delivery)`
                  : delivery.booking_type === "day_rate" &&
                      stops &&
                      stops.length > 0
                    ? `Route · ${stops.length} stop${stops.length !== 1 ? "s" : ""}`
                    : "Route"}
              </div>
              <div className="space-y-0">
                {/* Pickup summary (hidden when multi-stop rows include each pickup) */}
                {!hasMultiRoute && (
                  <div className="flex items-start gap-3.5">
                    <div className="flex flex-col items-center shrink-0">
                      <div className="w-3 h-3 rounded-full border-2 border-emerald-500 bg-emerald-500/20" />
                      <div className="w-px h-full min-h-[32px] bg-[var(--brd)]/30" />
                    </div>
                    <div className="flex-1 min-w-0 pb-4">
                      <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-emerald-500/70 mb-0.5">
                        Pickup
                      </div>
                      <div className="text-[13px] font-semibold text-[var(--tx)] leading-snug">
                        {delivery.pickup_address || "Not set"}
                      </div>
                      {delivery.pickup_access && (
                        <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                          Access: {delivery.pickup_access}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {hasMultiRoute && stops
                  ? stops.map((stop, i) => {
                      const isFinal = !!stop.is_final_destination;
                      const sStatus = stop.stop_status || "pending";
                      const isDoneStop = sStatus === "completed";
                      const isCurrentStop = [
                        "current",
                        "arrived",
                        "in_progress",
                      ].includes(sStatus);
                      const dotColor = isFinal
                        ? "var(--gold)"
                        : isDoneStop
                          ? "#22C55E"
                          : isCurrentStop
                            ? "#F59E0B"
                            : "var(--brd)";
                      const statusIcon = isDoneStop
                        ? "done"
                        : isCurrentStop
                          ? "active"
                          : "pending";
                      const completedTime = stop.completed_at
                        ? new Date(stop.completed_at).toLocaleTimeString(
                            "en-CA",
                            { hour: "2-digit", minute: "2-digit" },
                          )
                        : null;
                      const rb = readinessBadge(stop.readiness);
                      const lineItems = stop.stop_items || [];
                      return (
                        <div key={stop.id} className="flex items-start gap-3.5">
                          <div className="flex flex-col items-center shrink-0">
                            <div
                              className="w-3 h-3 rounded-full border-2 flex items-center justify-center text-[9px]"
                              style={{
                                borderColor: dotColor,
                                backgroundColor: `${dotColor}20`,
                              }}
                            />
                            {i < stops.length - 1 && (
                              <div className="w-px h-full min-h-[32px] bg-[var(--brd)]/30" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 pb-4">
                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                              <div
                                className={`text-[9px] font-bold tracking-[0.12em] uppercase flex items-center gap-1 ${isFinal ? "text-[var(--gold)]/70" : "text-[var(--gold)]/70"}`}
                              >
                                {statusIcon === "done" && (
                                  <Check size={9} color="#22C55E" weight="bold" />
                                )}
                                {statusIcon === "active" && (
                                  <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                )}
                                {statusIcon === "pending" && (
                                  <span className="w-2 h-2 rounded-full border border-[var(--brd)] inline-block" />
                                )}
                                {isFinal
                                  ? "Delivery"
                                  : `Stop ${stop.stop_number}`}
                              </div>
                              {!isFinal && (
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--tx3)]">
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${rb.dot}`}
                                  />
                                  {rb.label}
                                </span>
                              )}
                              {stop.vendor_name ? (
                                <span className="text-[11px] font-semibold text-[var(--tx)]">
                                  {stop.vendor_name}
                                </span>
                              ) : null}
                              {isDoneStop && completedTime && (
                                <span className="text-[9px] text-[#22C55E] ml-auto">
                                  Done {completedTime}
                                </span>
                              )}
                              {isCurrentStop && (
                                <span className="text-[9px] text-[#F59E0B] ml-auto">
                                  In Progress
                                </span>
                              )}
                            </div>
                            <div className="text-[13px] font-semibold text-[var(--tx)] leading-snug">
                              {stop.address || "—"}
                            </div>
                            {(stop.contact_name || stop.contact_phone) && (
                              <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                                Contact:{" "}
                                {[stop.contact_name, stop.contact_phone]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </div>
                            )}
                            {stop.customer_name && !stop.contact_name ? (
                              <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                                {stop.customer_name}
                              </div>
                            ) : null}
                            {(stop.access_type || stop.access_notes) && (
                              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                                Access: {formatStopAccess(stop.access_type)}
                                {stop.access_notes
                                  ? ` · ${stop.access_notes}`
                                  : ""}
                              </div>
                            )}
                            {lineItems.length > 0 ? (
                              <ul className="mt-1 space-y-0.5 text-[10px] text-[var(--tx3)] list-disc pl-4">
                                {lineItems.map((it, j) => (
                                  <li key={j}>
                                    {it.quantity}× {it.description}
                                    {it.is_fragile ? " · fragile" : ""}
                                    {it.requires_assembly ? " · assembly" : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : stop.items_description ? (
                              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                                {stop.items_description}
                              </div>
                            ) : null}
                            {(stop.readiness === "partial" ||
                              stop.readiness === "delayed") &&
                              stop.readiness_notes && (
                                <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-0.5">
                                  Readiness: {stop.readiness_notes}
                                </div>
                              )}
                            {(stop.special_instructions || stop.notes) && (
                              <div className="text-[10px] text-[var(--tx3)] mt-0.5 italic">
                                Note: {stop.special_instructions || stop.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  : delivery.booking_type === "day_rate" &&
                      stops &&
                      stops.length > 0
                    ? stops.map((stop, i) => {
                        const sStatus = stop.stop_status || "pending";
                        const isDoneStop = sStatus === "completed";
                        const isCurrentStop = [
                          "current",
                          "arrived",
                          "in_progress",
                        ].includes(sStatus);
                        const dotColor = isDoneStop
                          ? "#22C55E"
                          : isCurrentStop
                            ? "#F59E0B"
                            : "var(--brd)";
                        const statusIcon = isDoneStop
                          ? "done"
                          : isCurrentStop
                            ? "active"
                            : "pending";
                        const completedTime = stop.completed_at
                          ? new Date(stop.completed_at).toLocaleTimeString(
                              "en-CA",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : null;
                        return (
                          <div key={stop.id} className="flex items-start gap-3.5">
                            <div className="flex flex-col items-center shrink-0">
                              <div
                                className="w-3 h-3 rounded-full border-2 flex items-center justify-center text-[9px]"
                                style={{
                                  borderColor: dotColor,
                                  backgroundColor: `${dotColor}20`,
                                }}
                              />
                              {i < stops.length - 1 && (
                                <div className="w-px h-full min-h-[32px] bg-[var(--brd)]/30" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0 pb-4">
                              <div className="flex items-center gap-2 mb-0.5">
                                <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--gold)]/70 flex items-center gap-1">
                                  {statusIcon === "done" && (
                                    <Check size={9} color="#22C55E" weight="bold" />
                                  )}
                                  {statusIcon === "active" && (
                                    <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
                                  )}
                                  {statusIcon === "pending" && (
                                    <span className="w-2 h-2 rounded-full border border-[var(--brd)] inline-block" />
                                  )}
                                  Stop {stop.stop_number}
                                </div>
                                {stop.stop_type && (
                                  <span className="text-[9px] uppercase font-semibold text-[var(--tx3)]/82">
                                    {stop.stop_type}
                                  </span>
                                )}
                                {isDoneStop && completedTime && (
                                  <span className="text-[9px] text-[#22C55E] ml-auto">
                                    Done {completedTime}
                                  </span>
                                )}
                                {isCurrentStop && (
                                  <span className="text-[9px] text-[#F59E0B] ml-auto">
                                    In Progress
                                  </span>
                                )}
                              </div>
                              <div className="text-[13px] font-semibold text-[var(--tx)] leading-snug">
                                {stop.address || "-"}
                              </div>
                              {stop.customer_name && (
                                <div className="text-[11px] text-[var(--tx3)] mt-0.5">
                                  {stop.customer_name}
                                </div>
                              )}
                              {stop.items_description && (
                                <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                                  {stop.items_description}
                                </div>
                              )}
                              {(stop.special_instructions || stop.notes) && (
                                <div className="text-[10px] text-[var(--tx3)] mt-0.5 italic">
                                  Note: {stop.special_instructions || stop.notes}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    : !hasMultiRoute && (
                        <div className="flex items-start gap-3.5">
                          <div className="flex flex-col items-center shrink-0">
                            <div className="w-3 h-3 rounded-full border-2 border-[var(--gold)] bg-[var(--gold)]/20" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[var(--gold)]/70 mb-0.5">
                              Drop-off
                            </div>
                            <div className="text-[13px] font-semibold text-[var(--tx)] leading-snug">
                              {delivery.delivery_address || "Not set"}
                            </div>
                            {delivery.delivery_access && (
                              <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                                Access: {delivery.delivery_access}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
              </div>
            </div>

            {/* Items, seamless */}
            {itemsDisplay.length > 0 && (
              <div className="border-t border-[var(--brd)]/30 py-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Items
                  </span>
                  <span className="text-[10px] font-semibold text-[var(--gold)]">
                    {totalItems} item{totalItems !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {itemsDisplay.map((item: any, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[9px] font-bold text-[var(--tx3)]/40 w-4 text-right shrink-0">
                          {idx + 1}
                        </span>
                        <span className="text-[12px] text-[var(--tx)] truncate">
                          {item.name}
                        </span>
                      </div>
                      {item.qty > 1 && (
                        <span className="text-[10px] font-semibold text-[var(--gold)] shrink-0">
                          ×{item.qty}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Incidents, seamless */}
            <div className="border-t border-[var(--brd)]/30 pt-5">
              <IncidentsSection jobId={delivery.id} jobType="delivery" />
            </div>

            {/* Crew photos (actual photos taken by crew) */}
            <div className="border-t border-[var(--brd)]/30 pt-5">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-3">
                Crew Photos
              </div>
              <DeliveryCrewPhotosSection deliveryId={delivery.id} />
            </div>

            {/* Proof of Delivery */}
            {isDone(delivery.status) && (
              <div className="border-t border-[var(--brd)]/30 pt-5">
                <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-3">
                  Proof of Delivery
                </div>
                <ProofOfDeliverySection
                  jobId={delivery.id}
                  jobType="delivery"
                />
              </div>
            )}

            {/* Instructions, seamless */}
            <div className="border-t border-[var(--brd)]/30 py-5">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                Instructions & Notes
              </div>
              <p className="text-[11px] text-[var(--tx2)] leading-relaxed whitespace-pre-wrap">
                {delivery.instructions ||
                  delivery.notes ||
                  "No instructions added."}
              </p>
            </div>
          </div>
        </div>

        {/* RIGHT, single seamless panel + pricing card */}
        <div>
          {/* Info panel, seamless sections with dividers */}
          <div className="space-y-0">
            {/* Schedule */}
            <div className="pb-5 -mx-3 px-3 rounded-lg hover:bg-[var(--bg)]/40 transition-colors">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-3 pt-3">
                Schedule
              </div>
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between">
                  <span className="text-[var(--tx3)] text-[11px]">Date</span>
                  <span className="font-semibold text-[var(--tx)]">
                    {formatDate(delivery.scheduled_date)}
                  </span>
                </div>
                {delivery.time_slot && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)] text-[11px]">Time</span>
                    <span className="font-medium text-[var(--tx)]">
                      {delivery.time_slot}
                    </span>
                  </div>
                )}
                {delivery.delivery_window && (
                  <div className="flex justify-between">
                    <span className="text-[var(--tx3)] text-[11px]">
                      Window
                    </span>
                    <span className="font-medium text-[var(--tx)]">
                      {delivery.delivery_window}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Crew */}
            <div className="border-t border-[var(--brd)]/30 py-5 -mx-3 px-3 rounded-lg hover:bg-[var(--bg)]/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                  Crew
                </span>
                {!deliveryInProgress && (
                  <button
                    type="button"
                    onClick={() => setCrewModalOpen(true)}
                    className="text-[9px] font-semibold text-[var(--gold)] hover:underline"
                  >
                    {delivery.crew_id ? "Change" : "Assign"}
                  </button>
                )}
              </div>
              {displayCrew ? (
                <div>
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-md border border-[var(--brd)] flex items-center justify-center text-[11px] font-bold text-[var(--tx)]">
                      {displayCrew.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-[13px] font-semibold text-[var(--tx)]">
                      {displayCrew.name}
                    </span>
                  </div>
                  {displayCrew.members && displayCrew.members.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2 pl-9">
                      {displayCrew.members.map((m: string) => (
                        <span key={m} className="text-[10px] text-[var(--tx3)]">
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[var(--tx3)]">
                  No crew assigned
                </p>
              )}
            </div>

            {/* Customer */}
            <div className="border-t border-[var(--brd)]/30 py-5 -mx-3 px-3 rounded-lg hover:bg-[var(--bg)]/40 transition-colors">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                  Customer
                </span>
                <button
                  type="button"
                  onClick={() => setContactModalOpen(true)}
                  className="text-[9px] font-semibold text-[var(--gold)] hover:underline"
                >
                  Details
                </button>
              </div>
              <div className="text-[13px] font-semibold text-[var(--tx)]">
                {delivery.customer_name || "-"}
              </div>
              {delivery.customer_email && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--tx3)] mt-1">
                  <Mail className="w-3 h-3" />
                  <span className="truncate">{delivery.customer_email}</span>
                </div>
              )}
              {delivery.customer_phone && (
                <div className="flex items-center gap-1.5 text-[11px] text-[var(--tx3)] mt-0.5">
                  <Phone className="w-3 h-3" />
                  <span>{formatPhone(delivery.customer_phone)}</span>
                </div>
              )}
            </div>
          </div>

          {/* Pricing, keeps card treatment (hero/actionable) */}
          <div
            className={`mt-5 rounded-xl p-4 ${price > 0 ? "bg-gradient-to-br from-[var(--gold)]/8 to-transparent border border-[var(--gold)]/20" : ""}`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--gold)]/60 min-w-0">
                {delivery.override_price != null &&
                Number(delivery.override_price) > 0
                  ? "Price (override)"
                  : delivery.quoted_price
                    ? "Quoted Price"
                    : "Pricing"}
              </div>
              {price > 0 &&
              completedForPriceEdit &&
              canEditPostCompletionPrice ? (
                <PostCompletionPriceEdit
                  jobType="delivery"
                  jobId={delivery.id}
                  currentPrice={price}
                  canEdit={canEditPostCompletionPrice}
                  previousEdits={postCompletionPriceEdits}
                  completed={completedForPriceEdit}
                  trigger={
                    <button
                      type="button"
                      className="shrink-0 p-1 rounded-md text-[var(--gold)]/55 hover:text-[var(--gold)] hover:bg-[var(--gold)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold)]/35 transition-colors -mt-0.5"
                      aria-label="Adjust final price"
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
            </div>
            {price > 0 ? (
              <>
                <div className="text-[24px] font-bold font-heading text-[var(--gold)]">
                  {formatCurrency(price)}
                </div>
                <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                  +{formatCurrency(calcHST(price))} HST &middot; Total{" "}
                  {formatCurrency(price + calcHST(price))}
                </div>
                {!delivery.payment_received_at &&
                  deliveryEligibleForAdminPrepaidMark(delivery) ? (
                  <div className="mt-3 pt-3 border-t border-[var(--gold)]/15 space-y-1.5">
                    <button
                      type="button"
                      onClick={handleRecordPayment}
                      disabled={recordPaymentLoading}
                      className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 rounded-lg text-[11px] font-semibold border-2 border-[color-mix(in_srgb,var(--tx)_34%,transparent)] text-[var(--tx)] hover:bg-[color-mix(in_srgb,var(--tx)_8%,transparent)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {recordPaymentLoading ? "Saving…" : "Marked as paid"}
                    </button>
                    <p className="text-[10px] text-[var(--tx3)] leading-relaxed">
                      Use when the business already paid before this job was
                      created (for example card outside Square or e-transfer).
                    </p>
                  </div>
                ) : null}
                {delivery.payment_received_at &&
                deliveryEligibleForAdminPrepaidMark(delivery) ? (
                  <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-2">
                    Marked paid{" "}
                    {new Date(delivery.payment_received_at).toLocaleString(
                      "en-CA",
                      { timeZone: "America/Toronto" },
                    )}
                  </p>
                ) : null}
                {(delivery.override_price != null &&
                  Number(delivery.override_price) > 0 &&
                  calculatedBaseline > 0 &&
                  Math.abs(
                    Number(delivery.override_price) - calculatedBaseline,
                  ) > 0.009) ||
                (delivery.admin_adjusted_price != null &&
                  Number(delivery.admin_adjusted_price) > 0 &&
                  !delivery.override_price &&
                  Math.abs(Number(delivery.admin_adjusted_price) - price) >
                    0.009) ? (
                  <div className="text-[10px] text-[var(--tx3)] mt-1">
                    Adjusted from{" "}
                    {formatCurrency(
                      calculatedBaseline ||
                        Number(delivery.total_price) ||
                        Number(delivery.quoted_price) ||
                        0,
                    )}
                  </div>
                ) : null}
                {deliveryInvoice ? (
                  <div className="mt-3 pt-3 border-t border-[var(--gold)]/15">
                    <div className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1.5 flex-wrap">
                      <span>
                        {String(deliveryInvoice.status).toLowerCase() === "paid"
                          ? "Invoice paid"
                          : "Invoice sent"}
                      </span>
                      {deliveryInvoice.square_invoice_url && (
                        <a
                          href={deliveryInvoice.square_invoice_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] text-[var(--gold)] hover:underline"
                        >
                          <ExternalLink weight="regular" className="w-3 h-3" />{" "}
                          View in Square
                        </a>
                      )}
                    </div>
                    <div className="text-[10px] text-[var(--tx3)] mt-0.5">
                      {deliveryInvoice.invoice_number}
                    </div>
                  </div>
                ) : isB2BPartner ? (
                  <div className="mt-3 pt-3 border-t border-[var(--gold)]/15">
                    <GenerateInvoiceButton
                      delivery={delivery}
                      onGenerated={() => router.refresh()}
                    />
                  </div>
                ) : null}
              </>
            ) : (
              <div>
                <div className="text-[13px] text-[var(--tx3)]">
                  No price set
                </div>
                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="mt-1.5 text-[10px] font-semibold text-[var(--gold)] hover:underline"
                >
                  Add quoted price
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── MODALS ─── */}

      {/* Crew Picker */}
      <ModalOverlay
        open={crewModalOpen}
        onClose={() => setCrewModalOpen(false)}
        title="Assign Crew"
        maxWidth="md"
      >
        <div className="p-5 space-y-2">
          {deliveryInProgress && (
            <p className="text-[11px] text-amber-600 bg-amber-500/10 rounded-lg p-3">
              Cannot reassign: this delivery is in progress. Reassignment is
              only allowed before the crew has started.
            </p>
          )}
          <button
            type="button"
            disabled={deliveryInProgress}
            onClick={() => {
              if (!deliveryInProgress) {
                assignCrewWithMembers(null);
                setCrewModalOpen(false);
              }
            }}
            className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${!delivery.crew_id ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/40"} disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="w-8 h-8 rounded-lg bg-[var(--bg)] flex items-center justify-center text-[var(--tx3)]">
              <Users weight="regular" className="w-3.5 h-3.5" />
            </div>
            <div>
              <div className="text-[12px] font-medium text-[var(--tx)]">
                Unassigned
              </div>
              <div className="text-[10px] text-[var(--tx3)]">
                Remove crew assignment
              </div>
            </div>
          </button>
          {crews.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={deliveryInProgress}
              onClick={() => {
                if (!deliveryInProgress) handleSelectCrewForPicker(c.id);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${crewPickCrewId === c.id ? "border-[var(--gold)] bg-[var(--gold)]/5" : "border-[var(--brd)] hover:border-[var(--gold)]/40"} disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="w-8 h-8 rounded-lg bg-[var(--gold)]/10 flex items-center justify-center text-[12px] font-bold text-[var(--gold)]">
                {c.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[12px] font-medium text-[var(--tx)]">
                  {c.name}
                </div>
                {c.members && c.members.length > 0 && (
                  <div className="text-[10px] text-[var(--tx3)] truncate">
                    {c.members.join(", ")}
                  </div>
                )}
              </div>
              {delivery.crew_id === c.id && (
                <span className="dt-badge tracking-[0.04em] text-emerald-600 dark:text-emerald-400">
                  Active
                </span>
              )}
            </button>
          ))}
          {crewPickCrewId && !deliveryInProgress && crewPickRoster.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-[var(--brd)] space-y-2">
              <div className="text-[10px] font-bold tracking-[0.12em] uppercase text-[var(--tx3)]">
                Who is on this job
              </div>
              <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                {crewPickRoster.map((memberName, idx) => {
                  const id = `crew-member-${crewPickCrewId}-${idx}-${memberName}`;
                  return (
                    <li key={id}>
                      <label
                        htmlFor={id}
                        className="flex items-center gap-2.5 cursor-pointer rounded-lg px-2 py-1.5 hover:bg-[var(--bg)]"
                      >
                        <input
                          id={id}
                          type="checkbox"
                          checked={crewPickMembers.includes(memberName)}
                          onChange={() =>
                            handleToggleCrewMemberPick(memberName)
                          }
                          className="rounded border-[var(--brd)]"
                        />
                        <span className="text-[12px] text-[var(--tx)]">
                          {memberName}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {!deliveryInProgress ? (
            <div className="pt-3 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--brd)]">
              <button
                type="button"
                onClick={() => setCrewModalOpen(false)}
                className="px-4 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  !crewPickCrewId ||
                  (crewPickRoster.length > 0 && crewPickMembers.length === 0)
                }
                onClick={() => void handleApplyCrewAssignment()}
                className="px-4 py-2 rounded-lg text-[11px] font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/35 hover:bg-[var(--gold)]/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply assignment
              </button>
            </div>
          ) : null}
        </div>
      </ModalOverlay>

      {/* Delete Confirmation */}
      <ModalOverlay
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        title="Delete Delivery"
        maxWidth="sm"
      >
        <div className="p-5 space-y-4">
          <p className="text-[12px] text-[var(--tx2)]">
            Are you sure you want to delete{" "}
            <strong>{delivery.delivery_number}</strong>? This action cannot be
            undone.
          </p>
          <div className="flex items-center gap-2 justify-end">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              className="px-4 py-2 rounded-lg text-[11px] font-medium text-[var(--tx3)] hover:text-[var(--tx)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="px-4 py-2 rounded-lg text-[11px] font-bold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {deleting ? "Deleting…" : "Delete Delivery"}
            </button>
          </div>
        </div>
      </ModalOverlay>

      <EditDeliveryModal
        delivery={delivery}
        organizations={organizations}
        crews={crews}
        open={editModalOpen}
        onOpenChange={setEditModalOpen}
        onSaved={(d) => setDelivery((prev: any) => ({ ...prev, ...d }))}
      />

      <ContactDetailsModal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        contact={{
          name: delivery.customer_name,
          email: delivery.customer_email,
          phone: delivery.customer_phone,
        }}
      />
    </div>
  );
}

"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  applyHubSpotSuggestRow,
  useHubSpotContactSuggest,
  type HubSpotSuggestField,
  type HubSpotSuggestRow,
} from "@/hooks/useHubSpotContactSuggest";
import { useFormDraft } from "@/hooks/useFormDraft";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import MultiStopAddressField, {
  type StopEntry,
} from "@/components/ui/MultiStopAddressField";
import DraftBanner from "@/components/ui/DraftBanner";
import { Plus, Trash as Trash2, Stack as Layers } from "@phosphor-icons/react";
import B2BMultiStopRouteSection from "@/components/admin/b2b/B2BMultiStopRouteSection";
import {
  b2bVerticalQuickAddPresets,
  normalizeB2bVerticalFormCode,
} from "@/lib/b2b-vertical-ui";
import { normalizeB2bWeightCategory } from "@/lib/pricing/weight-tiers";
import {
  createEmptyPickupStop,
  createFinalDeliveryStop,
  flattenMultiStopToLineRows,
  multiStopPayloadStops,
  newLocalId,
  type MultiStopDraftStop,
} from "@/components/admin/b2b/b2b-multi-stop-types";

interface ProjectOption {
  id: string;
  project_number: string;
  project_name: string;
  status: string;
}

interface PhaseOption {
  id: string;
  phase_name: string;
  phase_order: number;
  address: string | null;
}

interface ProjectInventoryItem {
  id: string;
  item_name: string;
  quantity: number;
  room_destination: string | null;
  vendor_name: string | null;
  vendor_pickup_address: string | null;
  handled_by: string | null;
  vendor_delivery_method: string | null;
}

interface Org {
  id: string;
  name: string;
  type: string;
  vertical?: string | null;
  email?: string;
  contact_name?: string;
  phone?: string;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

const DEFAULT_ROOMS = [
  "Living Room",
  "Bedroom",
  "Kitchen",
  "Office",
  "Garage",
  "Other",
];
const COMPLEXITY_PRESETS = [
  "White Glove",
  "High Value",
  "Fragile",
  "Artwork",
  "Antiques",
  "Storage",
  "Assembly Required",
];
const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const h12 = h > 12 ? h - 12 : h === 0 ? 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      times.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return times;
})();

const fieldInput = "field-input-compact w-full";
const accessSelectClass = `${fieldInput} text-left text-[12px] text-[var(--tx)]`;

const ROUTE_ACCESS_OPTIONS = [
  { value: "elevator", label: "Elevator" },
  { value: "ground_floor", label: "Ground Floor" },
  { value: "loading_dock", label: "Loading Dock" },
  { value: "walk_up_2nd", label: "Walk-up (2nd floor)" },
  { value: "walk_up_3rd", label: "Walk-up (3rd floor)" },
  { value: "walk_up_4th_plus", label: "Walk-up (4th+ floor)" },
  { value: "long_carry", label: "Long Carry" },
  { value: "narrow_stairs", label: "Narrow Stairs" },
  { value: "no_parking_nearby", label: "No Parking Nearby" },
];

export default function NewDeliveryForm({
  organizations,
  crews = [],
}: {
  organizations: Org[];
  crews?: Crew[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dateFromUrl = searchParams.get("date") || "";
  const typeFromUrl = searchParams.get("type") || "";
  const orgFromUrl = searchParams.get("org") || "";
  const projectIdFromUrl = searchParams.get("projectId") || "";
  const phaseIdFromUrl = searchParams.get("phaseId") || "";
  const pickupFromUrl = searchParams.get("pickup") || "";
  const deliveryFromUrl = searchParams.get("delivery") || "";
  const customerFromUrl = searchParams.get("customer") || "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [projectType, setProjectType] = useState(
    ["retail", "designer", "hospitality", "gallery"].includes(typeFromUrl)
      ? typeFromUrl
      : "retail",
  );
  const [organizationId, setOrganizationId] = useState(orgFromUrl);

  // Project linking
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [linkedProjectId, setLinkedProjectId] = useState(projectIdFromUrl);
  const [linkedPhaseId, setLinkedPhaseId] = useState(phaseIdFromUrl);
  const [phases, setPhases] = useState<PhaseOption[]>([]);
  const [projectInventory, setProjectInventory] = useState<
    ProjectInventoryItem[]
  >([]);
  const [selectedProjectItemIds, setSelectedProjectItemIds] = useState<
    Set<string>
  >(new Set());
  const [contactSearch, setContactSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [customerName, setCustomerName] = useState(customerFromUrl);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const customerPhoneInput = usePhoneInput(customerPhone, setCustomerPhone);

  const [deliveryHsActive, setDeliveryHsActive] =
    useState<HubSpotSuggestField | null>(null);
  const deliveryHsQuery = useMemo(() => {
    if (deliveryHsActive === "contact") return customerName;
    if (deliveryHsActive === "email") return customerEmail;
    if (deliveryHsActive === "phone") return customerPhone;
    return "";
  }, [deliveryHsActive, customerName, customerEmail, customerPhone]);

  const deliveryHsPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.contactName) setCustomerName(a.contactName);
    if (a.email) setCustomerEmail(a.email);
    if (a.phoneFormatted) setCustomerPhone(a.phoneFormatted);
  }, []);

  const deliveryHs = useHubSpotContactSuggest({
    query: deliveryHsQuery,
    activeField: deliveryHsActive,
    setActiveField: setDeliveryHsActive,
    onPick: deliveryHsPick,
  });
  const [pickupAddress, setPickupAddress] = useState(pickupFromUrl);
  const [deliveryAddress, setDeliveryAddress] = useState(deliveryFromUrl);
  const [extraPickupStops, setExtraPickupStops] = useState<StopEntry[]>([]);
  const [extraDeliveryStops, setExtraDeliveryStops] = useState<StopEntry[]>([]);
  const [scheduledDate, setScheduledDate] = useState(dateFromUrl);
  const [timeSlot, setTimeSlot] = useState("");
  const [deliveryWindow, setDeliveryWindow] = useState("");
  const [instructions, setInstructions] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [specialHandling, setSpecialHandling] = useState(false);
  const [quotedPrice, setQuotedPrice] = useState("");
  const [crewId, setCrewId] = useState("");
  const [pickupAccess, setPickupAccess] = useState("elevator");
  const [deliveryAccess, setDeliveryAccess] = useState("elevator");
  const [itemWeightCategory, setItemWeightCategory] = useState("standard");
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>(
    [],
  );

  const [inventory, setInventory] = useState<
    { room: string; item_name: string }[]
  >([]);
  const [newRoom, setNewRoom] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [itemsFallback, setItemsFallback] = useState("");

  const [routeMode, setRouteMode] = useState<"single" | "multi">("single");
  const [multiStops, setMultiStops] =
    useState<MultiStopDraftStop[]>(() => [
      createEmptyPickupStop(),
      createFinalDeliveryStop(),
    ]);
  const [projectName, setProjectName] = useState("");
  const [endClientName, setEndClientName] = useState("");
  const [endClientPhone, setEndClientPhone] = useState("");
  const [stagedDelivery, setStagedDelivery] = useState(false);
  const lastProjectTypeForRouteRef = useRef<string | null>(null);

  const quickAddPresets = useMemo(
    () => b2bVerticalQuickAddPresets(normalizeB2bVerticalFormCode(projectType)),
    [projectType],
  );

  const addQuickPresetToMultiStop = useCallback(
    (
      p: {
        name: string;
        weight?: string;
        fragile?: boolean;
        unit?: string;
        icon?: string;
      },
      stopLocalId: string,
    ) => {
      const wcRaw = (p.weight || "medium").toLowerCase();
      const wc = normalizeB2bWeightCategory(wcRaw);
      const item = {
        localId: newLocalId(),
        description: p.name,
        quantity: 1,
        weight_range: wc,
        fragile: !!p.fragile,
        is_high_value: false,
        requires_assembly: false,
      };
      setMultiStops((prev) =>
        prev.map((s) =>
          s.localId === stopLocalId && !s.isFinalDestination
            ? { ...s, items: [...s.items, item], collapsed: false }
            : s,
        ),
      );
    },
    [],
  );

  useEffect(() => {
    const prev = lastProjectTypeForRouteRef.current;
    if (prev !== projectType && projectType === "interior_designer") {
      setRouteMode("multi");
    }
    lastProjectTypeForRouteRef.current = projectType;
  }, [projectType]);

  const seedMultiStopsFromSingleRow = useCallback(() => {
    setMultiStops([
      {
        ...createEmptyPickupStop(),
        address: pickupAddress,
        accessType: pickupAccess || "ground_floor",
      },
      {
        ...createFinalDeliveryStop(),
        address: deliveryAddress,
        accessType: deliveryAccess || "elevator",
      },
    ]);
  }, [pickupAddress, deliveryAddress, pickupAccess, deliveryAccess]);

  const handleSetRouteMode = useCallback(
    (mode: "single" | "multi") => {
      if (mode === "multi") {
        seedMultiStopsFromSingleRow();
      }
      setRouteMode(mode);
    },
    [seedMultiStopsFromSingleRow],
  );

  // Draft auto-save
  const draftState = useMemo(
    () => ({
      projectType,
      organizationId,
      customerName,
      customerEmail,
      customerPhone,
      pickupAddress,
      deliveryAddress,
      scheduledDate,
      timeSlot,
      deliveryWindow,
      instructions,
      accessNotes,
      internalNotes,
      quotedPrice,
      crewId,
      pickupAccess,
      deliveryAccess,
      itemWeightCategory,
      itemsFallback,
      routeMode,
      projectName,
      endClientName,
      endClientPhone,
      stagedDelivery,
      multiStops,
    }),
    [
      projectType,
      organizationId,
      customerName,
      customerEmail,
      customerPhone,
      pickupAddress,
      deliveryAddress,
      scheduledDate,
      timeSlot,
      deliveryWindow,
      instructions,
      accessNotes,
      internalNotes,
      quotedPrice,
      crewId,
      pickupAccess,
      deliveryAccess,
      itemWeightCategory,
      itemsFallback,
      routeMode,
      projectName,
      endClientName,
      endClientPhone,
      stagedDelivery,
      multiStops,
    ],
  );

  const draftTitleFn = useCallback(
    (s: typeof draftState) => s.customerName || "Delivery",
    [],
  );

  const applyDeliveryDraft = useCallback((d: Record<string, unknown>) => {
    if (d.projectType) setProjectType(d.projectType as string);
    if (d.organizationId) setOrganizationId(d.organizationId as string);
    if (d.customerName) setCustomerName(d.customerName as string);
    if (d.customerEmail) setCustomerEmail(d.customerEmail as string);
    if (d.customerPhone) setCustomerPhone(d.customerPhone as string);
    if (d.pickupAddress) setPickupAddress(d.pickupAddress as string);
    if (d.deliveryAddress) setDeliveryAddress(d.deliveryAddress as string);
    if (d.scheduledDate) setScheduledDate(d.scheduledDate as string);
    if (d.timeSlot) setTimeSlot(d.timeSlot as string);
    if (d.deliveryWindow) setDeliveryWindow(d.deliveryWindow as string);
    if (d.instructions) setInstructions(d.instructions as string);
    if (d.accessNotes) setAccessNotes(d.accessNotes as string);
    if (d.internalNotes) setInternalNotes(d.internalNotes as string);
    if (d.quotedPrice) setQuotedPrice(d.quotedPrice as string);
    if (d.crewId) setCrewId(d.crewId as string);
    if (d.pickupAccess) setPickupAccess(d.pickupAccess as string);
    if (d.deliveryAccess) {
      const da = String(d.deliveryAccess);
      setDeliveryAccess(da === "no_parking" ? "no_parking_nearby" : da);
    }
    if (d.itemWeightCategory)
      setItemWeightCategory(d.itemWeightCategory as string);
    if (d.itemsFallback) setItemsFallback(d.itemsFallback as string);
    if (d.routeMode === "single" || d.routeMode === "multi") {
      setRouteMode(d.routeMode);
    }
    if (typeof d.projectName === "string") setProjectName(d.projectName);
    if (typeof d.endClientName === "string") setEndClientName(d.endClientName);
    if (typeof d.endClientPhone === "string") setEndClientPhone(d.endClientPhone);
    if (typeof d.stagedDelivery === "boolean") setStagedDelivery(d.stagedDelivery);
    if (Array.isArray(d.multiStops) && d.multiStops.length > 0) {
      setMultiStops(d.multiStops as MultiStopDraftStop[]);
    }
  }, []);

  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft(
    "delivery",
    draftState,
    draftTitleFn,
    {
      applySaved: applyDeliveryDraft as (data: typeof draftState) => void,
    },
  );

  const handleRestoreDraft = useCallback(() => {
    const d = restoreDraft();
    if (!d) return;
    applyDeliveryDraft(d as Record<string, unknown>);
  }, [restoreDraft, applyDeliveryDraft]);

  const filteredOrgs = organizations.filter((o) => {
    if (!contactSearch) return true;
    const q = contactSearch.toLowerCase();
    return (
      o.name?.toLowerCase().includes(q) ||
      o.email?.toLowerCase().includes(q) ||
      o.contact_name?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      )
        setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (organizationId) {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        if (!customerName) setCustomerName(org.contact_name || org.name || "");
        if (!customerEmail) setCustomerEmail(org.email || "");
        if (!customerPhone && org.phone)
          setCustomerPhone(formatPhone(org.phone));
      }
      // Fetch projects for this org
      setLoadingProjects(true);
      setLinkedProjectId(projectIdFromUrl);
      setLinkedPhaseId(phaseIdFromUrl);
      setProjects([]);
      setPhases([]);
      fetch(`/api/admin/projects?partner_id=${organizationId}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((data) => {
          const raw = Array.isArray(data.projects)
            ? data.projects
            : Array.isArray(data)
              ? data
              : [];
          setProjects(
            raw.filter((p: ProjectOption) => p.status !== "cancelled"),
          );
        })
        .catch(() => setProjects([]))
        .finally(() => setLoadingProjects(false));
    } else {
      setProjects([]);
      setLinkedProjectId("");
      setLinkedPhaseId("");
      setPhases([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  // Fetch phases and inventory when project is selected
  useEffect(() => {
    if (!linkedProjectId) {
      setPhases([]);
      setLinkedPhaseId("");
      setProjectInventory([]);
      setSelectedProjectItemIds(new Set());
      return;
    }
    fetch(`/api/admin/projects/${linkedProjectId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.phases) {
          setPhases(data.phases);
          if (
            phaseIdFromUrl &&
            data.phases.find((p: PhaseOption) => p.id === phaseIdFromUrl)
          ) {
            setLinkedPhaseId(phaseIdFromUrl);
          }
        } else {
          setPhases([]);
        }
        const inv = Array.isArray(data?.inventory) ? data.inventory : [];
        setProjectInventory(inv);
        setSelectedProjectItemIds(new Set());
      })
      .catch(() => {
        setPhases([]);
        setProjectInventory([]);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedProjectId]);

  // Auto-fill delivery address from phase address when phase is selected
  useEffect(() => {
    if (!linkedPhaseId) return;
    const phase = phases.find((p) => p.id === linkedPhaseId);
    const addr = phase?.address?.trim();
    if (!addr) return;
    if (routeMode === "multi") {
      setMultiStops((prev) =>
        prev.map((s) =>
          s.isFinalDestination ? { ...s, address: addr } : s,
        ),
      );
      return;
    }
    if (!deliveryAddress) {
      setDeliveryAddress(addr);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedPhaseId, phases, routeMode]);

  const addInventoryItem = () => {
    if (!newItemName.trim() || !newRoom) return;
    const name = newItemName.trim();
    const itemName = newItemQty > 1 ? `${name} x${newItemQty}` : name;
    setInventory((prev) => [...prev, { room: newRoom, item_name: itemName }]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const removeInventoryItem = (idx: number) =>
    setInventory((prev) => prev.filter((_, i) => i !== idx));

  const addBulkItems = () => {
    if (!newRoom || !bulkText.trim()) return;
    const lines = bulkText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const items = lines.map((line) => {
      const m = line.match(/^(.+?)\s+x(\d+)$/i);
      return { room: newRoom, item_name: m ? `${m[1].trim()} x${m[2]}` : line };
    });
    setInventory((prev) => [...prev, ...items]);
    setBulkText("");
  };

  const isYugoItem = (i: ProjectInventoryItem) =>
    i.handled_by === "yugo" || i.vendor_delivery_method === "yugo_pickup";
  const yugoProjectItems = projectInventory.filter(isYugoItem);

  const addFromProjectInventory = () => {
    if (selectedProjectItemIds.size === 0) return;
    const toAdd = yugoProjectItems.filter((i) =>
      selectedProjectItemIds.has(i.id),
    );
    const newItems = toAdd.flatMap((i) => {
      const room = i.room_destination || "Other";
      const name =
        (i.quantity || 1) > 1 ? `${i.item_name} x${i.quantity}` : i.item_name;
      return { room, item_name: name };
    });
    setInventory((prev) => [...prev, ...newItems]);
    setSelectedProjectItemIds(new Set());
    const firstWithPickup = toAdd.find((i) => i.vendor_pickup_address?.trim());
    if (
      firstWithPickup?.vendor_pickup_address?.trim() &&
      !pickupAddress.trim()
    ) {
      setPickupAddress(firstWithPickup.vendor_pickup_address.trim());
    }
  };

  const toggleProjectItemSelection = (id: string) => {
    setSelectedProjectItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllYugoItems = () => {
    setSelectedProjectItemIds(new Set(yugoProjectItems.map((i) => i.id)));
  };

  const toggleComplexity = (p: string) => {
    setComplexityIndicators((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError("Customer name is required");
      return;
    }
    if (routeMode === "single" && !deliveryAddress.trim()) {
      setError("Delivery address is required");
      return;
    }
    if (!scheduledDate) {
      setError("Date is required");
      return;
    }

    if (routeMode === "multi") {
      const fin = multiStops.find((s) => s.isFinalDestination);
      const pickups = multiStops.filter((s) => !s.isFinalDestination);
      if (pickups.length < 1) {
        setError("Add at least one pickup stop");
        return;
      }
      if (!fin?.address.trim()) {
        setError("Final delivery address is required");
        return;
      }
      for (const p of pickups) {
        if (!p.address.trim()) {
          setError("Each pickup stop needs an address");
          return;
        }
      }
      const flatLines = flattenMultiStopToLineRows(multiStops);
      if (flatLines.length === 0) {
        setError("Add at least one item on a pickup stop");
        return;
      }
    }

    setLoading(true);
    setError("");

    const org = organizations.find((o) => o.id === organizationId);

    const itemsListSingle =
      inventory.length > 0
        ? inventory.map((i) => `${i.room}: ${i.item_name}`)
        : itemsFallback
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean);

    const itemsListMulti = flattenMultiStopToLineRows(multiStops).map((i) =>
      `${i.description}${i.quantity > 1 ? ` ×${i.quantity}` : ""}`,
    );

    const itemsList =
      routeMode === "multi" ? itemsListMulti : itemsListSingle;

    if (routeMode === "single" && itemsList.length === 0) {
      setError("Add at least one inventory line or paste items below");
      setLoading(false);
      return;
    }

    const instructionsMerged = [
      instructions,
      accessNotes && `Access: ${accessNotes}`,
      internalNotes && `Internal: ${internalNotes}`,
      complexityIndicators.length > 0 &&
        `Complexity: ${complexityIndicators.join(", ")}`,
    ]
      .filter(Boolean)
      .join("\n");

    const firstPu =
      routeMode === "multi"
        ? multiStops.find((s) => !s.isFinalDestination)
        : null;
    const finStop =
      routeMode === "multi"
        ? multiStops.find((s) => s.isFinalDestination)
        : null;

    const maxPhase = Math.max(
      ...multiStops.map((s) => s.deliveryPhase || 1),
      1,
    );

    const payload: Record<string, unknown> = {
      organization_id: organizationId || null,
      client_name: org?.name || "",
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || null,
      customer_phone: customerPhone.trim()
        ? normalizePhone(customerPhone)
        : null,
      pickup_address:
        routeMode === "multi"
          ? (firstPu?.address ?? "").trim() || null
          : pickupAddress.trim() || null,
      delivery_address:
        routeMode === "multi"
          ? (finStop?.address ?? "").trim()
          : deliveryAddress.trim(),
      items: itemsList,
      scheduled_date: scheduledDate,
      time_slot: timeSlot || null,
      delivery_window: deliveryWindow || null,
      instructions: instructionsMerged || null,
      special_handling: specialHandling,
      quoted_price: parseNumberInput(quotedPrice) || null,
      crew_id: crewId || null,
      pickup_access:
        routeMode === "multi"
          ? firstPu?.accessType || null
          : pickupAccess || null,
      delivery_access:
        routeMode === "multi"
          ? finStop?.accessType || null
          : deliveryAccess || null,
      item_weight_category: itemWeightCategory || null,
      category: projectType || org?.vertical || org?.type || "retail",
      project_id: linkedProjectId || null,
      phase_id: linkedPhaseId || null,
      vertical_code: projectType.trim() || null,
    };

    if (routeMode === "multi") {
      payload.is_multi_stop = true;
      payload.multi_route_stops = multiStopPayloadStops(multiStops);
      payload.project_name = projectName.trim() || null;
      payload.end_client_name = endClientName.trim() || null;
      payload.end_client_phone = endClientPhone.trim()
        ? normalizePhone(endClientPhone)
        : null;
      payload.staged_delivery = stagedDelivery;
      payload.phase_count = stagedDelivery ? maxPhase : 1;
    }

    const res = await fetch("/api/admin/deliveries/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);
    const data = await res.json();

    if (res.ok && data.delivery) {
      const created = data.delivery;

      if (routeMode === "single") {
        const allExtraStops = [
          ...extraPickupStops
            .filter((s) => s.address.trim())
            .map((s, i) => ({ ...s, stop_type: "pickup", sort_order: i + 1 })),
          ...extraDeliveryStops
            .filter((s) => s.address.trim())
            .map((s, i) => ({
              ...s,
              stop_type: "dropoff",
              sort_order: i + 1,
            })),
        ];
        if (allExtraStops.length > 0) {
          fetch("/api/admin/job-stops", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              job_type: "delivery",
              job_id: created.id,
              stops: allExtraStops,
            }),
          }).catch(() => {});
        }
      }

      clearDraft();
      const path = created.delivery_number
        ? `/admin/deliveries/${encodeURIComponent(created.delivery_number)}`
        : `/admin/deliveries/${created.id}`;
      router.push(path);
      router.refresh();
    } else {
      setError(data.error || "Failed to create delivery");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {hasDraft && (
          <DraftBanner
            onRestore={handleRestoreDraft}
            onDismiss={dismissDraft}
          />
        )}
        {error && (
          <div className="px-3 py-2.5 rounded-lg bg-[rgba(209,67,67,0.1)] border border-[rgba(209,67,67,0.3)] text-[12px] text-[var(--red)]">
            {error}
          </div>
        )}

        {/* Section: Project type + Client */}
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Project & Client
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Field label="Project Type">
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className={fieldInput}
              >
                <optgroup label="Furniture & Design">
                  <option value="furniture_retailer">Furniture Retailer</option>
                  <option value="interior_designer">Interior Designer</option>
                  <option value="cabinetry">Cabinetry</option>
                  <option value="flooring">Flooring</option>
                </optgroup>
                <optgroup label="Art & Specialty">
                  <option value="art_gallery">Art Gallery</option>
                  <option value="antique_dealer">Antique Dealer</option>
                </optgroup>
                <optgroup label="Hospitality & Commercial">
                  <option value="hospitality">Hospitality</option>
                </optgroup>
                <optgroup label="Medical & Technical">
                  <option value="medical_equipment">Medical Equipment</option>
                  <option value="av_technology">AV / Technology</option>
                  <option value="appliances">Appliances</option>
                </optgroup>
              </select>
            </Field>
            <Field label="Client / Partner">
              <div className="relative" ref={dropdownRef}>
                <input
                  value={
                    contactSearch ||
                    (organizationId
                      ? organizations.find((o) => o.id === organizationId)
                          ?.name || ""
                      : "")
                  }
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setShowDropdown(true);
                    if (!e.target.value) setOrganizationId("");
                  }}
                  onFocus={() => setShowDropdown(true)}
                  placeholder="Search clients…"
                  className={fieldInput}
                />
                {showDropdown && filteredOrgs.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 top-full mt-1 bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                    {filteredOrgs.map((o) => (
                      <button
                        key={o.id}
                        type="button"
                        onClick={() => {
                          setOrganizationId(o.id);
                          setContactSearch(o.name);
                          setShowDropdown(false);
                        }}
                        className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] transition-colors"
                      >
                        <span className="font-semibold">{o.name}</span>
                        {o.contact_name && (
                          <span className="text-[var(--tx3)]">
                            {" "}
                            · {o.contact_name}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </Field>
          </div>
        </section>

        {/* Section: Link to Project (optional, shown when org is selected and has projects) */}
        {organizationId && (loadingProjects || projects.length > 0) && (
          <section className="space-y-2">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
              Link to Project
              <span className="text-[9px] font-normal text-[var(--tx3)] normal-case ml-1">
                optional
              </span>
            </h3>
            {loadingProjects ? (
              <p className="text-[11px] text-[var(--tx3)]">Loading projects…</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Project">
                  <select
                    value={linkedProjectId}
                    onChange={(e) => {
                      setLinkedProjectId(e.target.value);
                      setLinkedPhaseId("");
                    }}
                    className={fieldInput}
                  >
                    <option value="">None</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.project_number} {p.project_name}
                      </option>
                    ))}
                  </select>
                </Field>
                {linkedProjectId && phases.length > 0 && (
                  <Field label="Phase">
                    <select
                      value={linkedPhaseId}
                      onChange={(e) => setLinkedPhaseId(e.target.value)}
                      className={fieldInput}
                    >
                      <option value="">No phase</option>
                      {phases.map((ph) => (
                        <option key={ph.id} value={ph.id}>
                          {ph.phase_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                )}
              </div>
            )}
            {linkedProjectId && (
              <p className="text-[10px] text-[var(--tx3)]">
                This delivery will appear in the project&apos;s Deliveries tab
                and be included in the project invoice.
              </p>
            )}
          </section>
        )}

        {/* Section: Customer details */}
        <section ref={deliveryHs.containerRef} className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Customer / Recipient
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Name *">
              <div className="relative">
                <input
                  {...deliveryHs.bindField("contact")}
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Full name"
                  className={fieldInput}
                  autoComplete="name"
                />
                {deliveryHs.renderDropdown("contact")}
              </div>
            </Field>
            <Field label="Email">
              <div className="relative">
                <input
                  type="email"
                  {...deliveryHs.bindField("email")}
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  placeholder="email@example.com"
                  className={fieldInput}
                  autoComplete="email"
                />
                {deliveryHs.renderDropdown("email")}
              </div>
            </Field>
            <Field label="Phone">
              <div className="relative">
                <input
                  ref={customerPhoneInput.ref}
                  type="tel"
                  {...deliveryHs.bindField("phone")}
                  value={customerPhone}
                  onChange={customerPhoneInput.onChange}
                  placeholder={PHONE_PLACEHOLDER}
                  className={fieldInput}
                  autoComplete="tel"
                />
                {deliveryHs.renderDropdown("phone")}
              </div>
            </Field>
          </div>
        </section>

        {/* Section: Addresses */}
        <section className="space-y-3 rounded-xl border border-[var(--brd)] bg-[var(--card)] p-4 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
              Addresses
            </h3>
            <div
              className="inline-flex rounded-lg border border-[var(--brd)] bg-[var(--bg)] p-0.5"
              role="group"
              aria-label="Route mode"
            >
              <button
                type="button"
                onClick={() => handleSetRouteMode("single")}
                className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  routeMode === "single"
                    ? "bg-[var(--card)] text-[var(--tx)] shadow-sm"
                    : "text-[var(--tx3)]"
                }`}
              >
                Single route
              </button>
              <button
                type="button"
                onClick={() => handleSetRouteMode("multi")}
                className={`rounded-md px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ${
                  routeMode === "multi"
                    ? "bg-[var(--card)] text-[var(--tx)] shadow-sm"
                    : "text-[var(--tx3)]"
                }`}
              >
                Multi-stop project
              </button>
            </div>
          </div>
          {routeMode === "multi" ? (
            <div className="space-y-3 max-w-4xl">
              <B2BMultiStopRouteSection
                projectName={projectName}
                setProjectName={setProjectName}
                endClientName={endClientName}
                setEndClientName={setEndClientName}
                endClientPhone={endClientPhone}
                setEndClientPhone={setEndClientPhone}
                stops={multiStops}
                setStops={setMultiStops}
                stagedDelivery={stagedDelivery}
                setStagedDelivery={setStagedDelivery}
                quickAddPresets={quickAddPresets}
                onQuickAdd={addQuickPresetToMultiStop}
              />
              <Field label="Access notes (job-wide)">
                <textarea
                  value={accessNotes}
                  onChange={(e) => setAccessNotes(e.target.value)}
                  rows={2}
                  placeholder="Dock hours, buzzer codes, long carry notes…"
                  className={`${fieldInput} resize-y`}
                />
              </Field>
            </div>
          ) : (
            <div className="max-w-4xl space-y-3">
              <MultiStopAddressField
                label="Pickup"
                labelVisibility="sr-only"
                placeholder="Warehouse, store, or pickup location"
                stops={[{ address: pickupAddress }, ...extraPickupStops]}
                onChange={(stops) => {
                  setPickupAddress(stops[0]?.address ?? "");
                  setExtraPickupStops(stops.slice(1));
                }}
                inputClassName={fieldInput}
                trailingOnFirstRow={
                  <>
                    <label
                      htmlFor="new-delivery-pickup-access"
                      className="sr-only"
                    >
                      Pickup access
                    </label>
                    <select
                      id="new-delivery-pickup-access"
                      value={pickupAccess}
                      onChange={(e) => setPickupAccess(e.target.value)}
                      className={accessSelectClass}
                      aria-label="Pickup access"
                    >
                      {ROUTE_ACCESS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </>
                }
              />
              <MultiStopAddressField
                label="Delivery"
                labelVisibility="sr-only"
                placeholder="Delivery destination"
                stops={[{ address: deliveryAddress }, ...extraDeliveryStops]}
                onChange={(stops) => {
                  setDeliveryAddress(stops[0]?.address ?? "");
                  setExtraDeliveryStops(stops.slice(1));
                }}
                inputClassName={fieldInput}
                trailingOnFirstRow={
                  <>
                    <label
                      htmlFor="new-delivery-delivery-access"
                      className="sr-only"
                    >
                      Delivery access
                    </label>
                    <select
                      id="new-delivery-delivery-access"
                      value={deliveryAccess}
                      onChange={(e) => setDeliveryAccess(e.target.value)}
                      className={accessSelectClass}
                      aria-label="Delivery access"
                    >
                      {ROUTE_ACCESS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </>
                }
              />
            </div>
          )}
        </section>

        {/* Section: Schedule */}
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Schedule
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Field label="Date *">
              <input
                type="date"
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className={fieldInput}
              />
            </Field>
            <Field label="Time Slot">
              <select
                value={timeSlot}
                onChange={(e) => setTimeSlot(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select time…</option>
                {TIME_OPTIONS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Delivery Window">
              <select
                value={deliveryWindow}
                onChange={(e) => setDeliveryWindow(e.target.value)}
                className={fieldInput}
              >
                <option value="">Select window…</option>
                {TIME_WINDOW_OPTIONS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>

        {/* Section: Crew + Pricing */}
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Assignment & Pricing
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {crews.length > 0 && (
              <Field label="Assign Crew">
                <select
                  value={crewId}
                  onChange={(e) => setCrewId(e.target.value)}
                  className={fieldInput}
                >
                  <option value="">Unassigned</option>
                  {crews.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.members?.length ? ` (${c.members.length})` : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Quoted Price">
              <input
                type="text"
                value={quotedPrice}
                onChange={(e) => setQuotedPrice(e.target.value)}
                onBlur={() => {
                  const n = parseNumberInput(quotedPrice);
                  if (n > 0) setQuotedPrice(formatNumberInput(n));
                }}
                placeholder="1,234.00"
                inputMode="decimal"
                className={fieldInput}
              />
            </Field>
            <Field label="Item Weight">
              <select
                value={itemWeightCategory}
                onChange={(e) => setItemWeightCategory(e.target.value)}
                className={fieldInput}
              >
                <option value="standard">Standard (under 100 lbs)</option>
                <option value="heavy">Heavy (100–250 lbs)</option>
                <option value="very_heavy">Very Heavy (250–500 lbs)</option>
                <option value="oversized_fragile">Oversized / Fragile</option>
              </select>
            </Field>
          </div>
        </section>

        {/* Section: Inventory */}
        <section className="space-y-3">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Inventory
          </h3>
          {routeMode === "multi" ? (
            <p className="text-[11px] text-[var(--tx3)] leading-relaxed rounded-lg border border-[var(--brd)] bg-[var(--bg)] px-3 py-2.5">
              Multi-stop projects use items on each pickup stop in the route
              above. Quick-add presets follow your project type vertical.
            </p>
          ) : null}

          {/* Add from project inventory (Yugo items only) */}
          {routeMode !== "multi" &&
            linkedProjectId &&
            yugoProjectItems.length > 0 && (
            <div className="p-3 rounded-lg bg-[var(--gold)]/5 border border-[var(--gold)]/20 space-y-2">
              <div className="text-[11px] font-semibold text-[var(--tx)] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-[var(--gold)]" />
                Add from project inventory
              </div>
              <p className="text-[10px] text-[var(--tx3)]">
                Select items added by the design partner (Yugo pickup) to
                auto-fill inventory and pickup address.
              </p>
              <div className="flex flex-wrap gap-3 items-start">
                <div className="flex-1 min-w-[200px] max-h-[160px] overflow-y-auto border border-[var(--brd)] rounded-lg p-2 space-y-1.5">
                  {yugoProjectItems.map((i) => (
                    <label
                      key={i.id}
                      className="flex items-center gap-2 cursor-pointer hover:bg-[var(--bg)]/50 rounded px-2 py-1 -mx-2"
                    >
                      <input
                        type="checkbox"
                        checked={selectedProjectItemIds.has(i.id)}
                        onChange={() => toggleProjectItemSelection(i.id)}
                        className="rounded border-[var(--brd)] text-[var(--gold)]"
                      />
                      <span className="text-[11px] text-[var(--tx)]">
                        {i.room_destination || "Other"}: {i.item_name}
                        {(i.quantity || 1) > 1 ? ` ×${i.quantity}` : ""}
                        {i.vendor_name && (
                          <span className="text-[var(--tx3)]">
                            {" "}
                            · {i.vendor_name}
                          </span>
                        )}
                      </span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={selectAllYugoItems}
                    className="text-[10px] font-semibold text-[var(--gold)] hover:underline"
                  >
                    Select all
                  </button>
                  <button
                    type="button"
                    onClick={addFromProjectInventory}
                    disabled={selectedProjectItemIds.size === 0}
                    className="admin-btn admin-btn-sm admin-btn-primary"
                  >
                    <Plus className="w-[12px] h-[12px]" /> Add selected
                  </button>
                </div>
              </div>
            </div>
          )}

          {routeMode !== "multi" && inventory.length > 0 && (
            <ul className="space-y-1.5 mb-2">
              {inventory.map((item, idx) => (
                <li
                  key={idx}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--bg)] border border-[var(--brd)]"
                >
                  <span className="text-[12px] text-[var(--tx)]">
                    <span className="text-[var(--tx3)]">{item.room}:</span>{" "}
                    {item.item_name}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeInventoryItem(idx)}
                    className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                    aria-label="Remove"
                  >
                    <Trash2 className="w-[14px] h-[14px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {routeMode !== "multi" && (
            <>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => setBulkMode(false)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${!bulkMode ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"}`}
            >
              Single add
            </button>
            <button
              type="button"
              onClick={() => setBulkMode(true)}
              className={`text-[11px] font-semibold px-2.5 py-1.5 rounded-lg transition-colors ${bulkMode ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)]" : "bg-[var(--bg)] text-[var(--tx3)] hover:text-[var(--tx)]"}`}
            >
              Bulk add
            </button>
          </div>
          {bulkMode ? (
            <div className="space-y-2">
              <select
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                className={`${fieldInput} max-w-[180px]`}
              >
                <option value="">Room</option>
                {DEFAULT_ROOMS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder="One item per line, e.g. Couch x2"
                rows={3}
                className={`${fieldInput} resize-y`}
              />
              <button
                type="button"
                onClick={addBulkItems}
                disabled={!bulkText.trim() || !newRoom}
                className="admin-btn admin-btn-sm admin-btn-primary"
              >
                <Plus className="w-[14px] h-[14px]" /> Add all
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2 items-end">
              <select
                value={newRoom}
                onChange={(e) => setNewRoom(e.target.value)}
                className={`${fieldInput} w-full sm:w-[140px]`}
              >
                <option value="">Room</option>
                {DEFAULT_ROOMS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) =>
                  e.key === "Enter" && (e.preventDefault(), addInventoryItem())
                }
                placeholder="Item name"
                className={`${fieldInput} flex-1 min-w-[120px]`}
              />
              <input
                type="number"
                min={1}
                max={99}
                value={newItemQty}
                onChange={(e) =>
                  setNewItemQty(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className={`${fieldInput} w-16`}
              />
              <button
                type="button"
                onClick={addInventoryItem}
                disabled={!newItemName.trim() || !newRoom}
                className="admin-btn admin-btn-sm admin-btn-primary flex-none"
              >
                <Plus className="w-[14px] h-[14px]" /> Add
              </button>
            </div>
          )}
          <p className="text-[10px] text-[var(--tx3)]">
            Or paste a simple list below (one per line).
          </p>
          <textarea
            value={itemsFallback}
            onChange={(e) => setItemsFallback(e.target.value)}
            rows={2}
            placeholder="Sofa x2&#10;Coffee Table"
            className={`${fieldInput} resize-y`}
          />
            </>
          )}
        </section>

        {/* Section: Complexity */}
        <section className="space-y-2">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Complexity Indicators
          </h3>
          <div className="flex flex-wrap gap-2">
            {COMPLEXITY_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => toggleComplexity(p)}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold border transition-colors ${
                  complexityIndicators.includes(p)
                    ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                    : "bg-[var(--bg)] text-[var(--tx3)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/50"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2.5 cursor-pointer mt-2">
            <input
              type="checkbox"
              checked={specialHandling}
              onChange={(e) => setSpecialHandling(e.target.checked)}
              className="rounded border-[var(--brd)] text-[var(--gold)] focus:ring-[var(--brd)]"
            />
            <span className="text-[12px] text-[var(--tx)]">
              Requires special handling (fragile, high-value)
            </span>
          </label>
        </section>

        {/* Section: Notes */}
        <section className="space-y-3">
          <h3 className="text-[12px] font-bold tracking-wider uppercase text-[var(--tx)]">
            Notes & Instructions
          </h3>
          <Field label="Delivery Instructions">
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="Special delivery instructions…"
              className={`${fieldInput} resize-y`}
            />
          </Field>
          {routeMode !== "multi" ? (
            <Field label="Access Notes">
              <textarea
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                rows={2}
                placeholder="Building codes, gate access, parking…"
                className={`${fieldInput} resize-y`}
              />
            </Field>
          ) : null}
          <Field label="Internal Notes">
            <textarea
              value={internalNotes}
              onChange={(e) => setInternalNotes(e.target.value)}
              rows={2}
              placeholder="Internal team notes (not shared with client)…"
              className={`${fieldInput} resize-y`}
            />
          </Field>
        </section>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className="admin-btn admin-btn-primary w-full"
        >
          {loading ? "Creating…" : "Create Delivery"}
        </button>
      </form>
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="admin-premium-label admin-premium-label--tight">
        {label}
      </label>
      {children}
    </div>
  );
}

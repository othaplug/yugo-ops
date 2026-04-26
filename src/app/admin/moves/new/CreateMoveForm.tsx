"use client";

import React, {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
} from "react";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import { formatPhone, normalizePhone, PHONE_PLACEHOLDER } from "@/lib/phone";
import { usePhoneInput } from "@/hooks/usePhoneInput";
import {
  applyHubSpotSuggestRow,
  useHubSpotContactSuggest,
  type HubSpotSuggestField,
  type HubSpotSuggestRow,
} from "@/hooks/useHubSpotContactSuggest";
import { useFormDraft } from "@/hooks/useFormDraft";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import MultiStopAddressField, {
  type StopEntry,
} from "@/components/ui/MultiStopAddressField";
import DraftBanner from "@/components/ui/DraftBanner";
import {
  Plus,
  Trash as Trash2,
  FileText,
  CaretRight,
  Check,
} from "@phosphor-icons/react";
import InventoryInput, {
  type InventoryItemEntry,
} from "@/components/inventory/InventoryInput";
import { residentialInventoryLineScore } from "@/lib/pricing/weight-tiers";

interface Org {
  id: string;
  name: string;
  type: string;
  email?: string;
  contact_name?: string;
  phone?: string;
  address?: string;
}

interface Crew {
  id: string;
  name: string;
  members?: string[];
}

const COMPLEXITY_PRESETS = [
  "White Glove",
  "Piano",
  "High Value Client",
  "Repeat Client",
  "Artwork",
  "Antiques",
  "Storage",
];

const MOVE_SIZES = [
  "Studio",
  "1 Bedroom",
  "2 Bedroom",
  "3 Bedroom",
  "4 Bedroom",
  "5+ Bedroom",
  "Partial Move",
];
const PACKING_OPTIONS = [
  "Self-pack",
  "Partial packing",
  "Full packing & unpacking",
];
const SPECIALTY_ITEM_PRESETS = [
  "Piano (upright)",
  "Piano (grand)",
  "Pool table",
  "Safe/vault",
  "Hot tub",
  "Artwork",
  "Antiques",
  "Wine collection",
  "Gym equipment",
  "Motorcycle",
];
const ADDON_OPTIONS = [
  { value: "extra_truck", label: "Extra truck (quote when booking)" },
  { value: "storage", label: "Storage (daily rate, quote when booking)" },
  { value: "junk_removal", label: "Junk removal (quote when booking)" },
];
const BUSINESS_TYPES = [
  "Office",
  "Retail",
  "Salon/Spa",
  "Clinic/Medical",
  "Restaurant",
  "Warehouse",
  "Other",
];
const IT_DISCONNECT_OPTIONS = ["Client IT team", "Yugo coordinates", "N/A"];
const TIMING_PREFERENCES = [
  "Weekday business hours",
  "Evening/night",
  "Weekend",
  "Phased multi-day",
];
const SITE_ASSESSMENT_OPTIONS = [
  "In-person completed",
  "Virtual completed",
  "Pending",
  "Not needed",
];

// Single Item
const ITEM_CATEGORIES = [
  "Standard furniture",
  "Large/heavy",
  "Fragile/specialty",
  "Appliance",
  "Multiple (2-5 items)",
  "Oversized",
];
const WEIGHT_CLASSES = [
  "Under 50 lbs",
  "50-150 lbs",
  "150-300 lbs",
  "300-500 lbs",
  "Over 500 lbs",
];
const ASSEMBLY_OPTIONS = [
  "None",
  "Disassembly at pickup",
  "Assembly at delivery",
  "Both",
];

// White Glove
const ITEM_SOURCE_OPTIONS = [
  "Furniture retailer",
  "Private sale",
  "Designer",
  "Estate",
  "Self",
];
const WG_ASSEMBLY_OPTIONS = ["Full assembly", "Partial", "None"];

// Specialty
const PROJECT_TYPES = [
  "Art installation",
  "Trade show",
  "Estate cleanout",
  "Home staging",
  "Wine transport",
  "Medical equipment",
  "Piano move",
  "Event setup/teardown",
  "Custom",
];
const TIMELINE_OPTIONS = [
  "Half day (4hrs)",
  "Full day (8hrs)",
  "Multi-day",
  "TBD",
];
const SPECIAL_EQUIPMENT_PRESETS = [
  "A-frame cart",
  "Crating kit",
  "Climate truck",
  "Air-ride suspension",
  "Lift gate",
  "Crane",
  "Custom",
];

function AnimatedSection({
  show,
  children,
}: {
  show: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid transition-all duration-300 ease-in-out ${show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
const TIME_OPTIONS = (() => {
  const times: string[] = [];
  for (let h = 6; h <= 20; h++) {
    for (const m of [0, 30]) {
      if (h === 20 && m === 30) break;
      const h12 = h > 12 ? h - 12 : h;
      const ampm = h < 12 ? "AM" : "PM";
      times.push(`${h12}:${m.toString().padStart(2, "0")} ${ampm}`);
    }
  }
  return times;
})();

const CREATE_MOVE_FLOW_STEP_LABELS = [
  "Service & client",
  "Locations & job details",
  "Team, schedule & files",
  "Notes & create",
] as const;

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="admin-premium-label admin-premium-label--tight mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

const fieldInput = "field-input-compact w-full";

interface ItemWeightRow {
  slug: string;
  item_name: string;
  weight_score: number;
  category: string;
  room?: string;
  is_common: boolean;
  display_order?: number;
  active?: boolean;
}

export default function CreateMoveForm({
  organizations,
  crews,
  itemWeights = [],
}: {
  organizations: Org[];
  crews: Crew[];
  itemWeights?: ItemWeightRow[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [flowStep, setFlowStep] = useState(0);
  /** Prevents a double click on "Continue" from activating "Create Move" in the same spot right after the last step mounts. */
  const [createMoveUnlocked, setCreateMoveUnlocked] = useState(false);
  const flowContentRef = useRef<HTMLDivElement>(null);
  const [moveType, setMoveType] = useState<
    | "residential"
    | "office"
    | "single_item"
    | "white_glove"
    | "specialty"
    | "event"
    | "labour_only"
  >("residential");
  const [organizationId, setOrganizationId] = useState("");
  const [clientSelectedFromSearch, setClientSelectedFromSearch] =
    useState(false);
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [dbContacts, setDbContacts] = useState<
    {
      hubspot_id: string;
      name: string;
      email: string;
      phone: string;
      company?: string;
      address: string;
      postal: string;
    }[]
  >([]);
  const contactSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const clientPhoneInput = usePhoneInput(clientPhone, setClientPhone);
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [fromAccess, setFromAccess] = useState("");
  const [toAccess, setToAccess] = useState("");
  const [fromUnit, setFromUnit] = useState("");
  const [fromFloor, setFromFloor] = useState("");
  const [toUnit, setToUnit] = useState("");
  const [toFloor, setToFloor] = useState("");
  const [extraFromStops, setExtraFromStops] = useState<StopEntry[]>([]);
  const [extraToStops, setExtraToStops] = useState<StopEntry[]>([]);
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>(
    [],
  );
  const [customComplexity, setCustomComplexity] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [crewId, setCrewId] = useState("");
  const [truckPrimary, setTruckPrimary] = useState("");
  const [estCrewSize, setEstCrewSize] = useState("2");
  const [estHours, setEstHours] = useState("4");
  const [inventoryItems, setInventoryItems] = useState<InventoryItemEntry[]>(
    [],
  );
  const [teamMembers, setTeamMembers] = useState<Set<string>>(new Set());
  const selectedCrewMembers = crewId
    ? crews.find((c) => c.id === crewId)?.members || []
    : [];
  const [docFiles, setDocFiles] = useState<File[]>([]);

  // Residential-only state
  const [moveSize, setMoveSize] = useState("");
  const [packingService, setPackingService] = useState("");
  const [specialtyItems, setSpecialtyItems] = useState<string[]>([]);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState("");
  const [boxesBins, setBoxesBins] = useState("");
  const [boxCount, setBoxCount] = useState(0);
  const [addOns, setAddOns] = useState<Set<string>>(new Set());
  const [serviceTier, setServiceTier] = useState<
    "essential" | "signature" | "estate"
  >("essential");

  // Office-only state
  const [companyName, setCompanyName] = useState("");

  const [moveHsActive, setMoveHsActive] = useState<HubSpotSuggestField | null>(
    null,
  );
  const moveHsQuery = useMemo(() => {
    if (moveHsActive === "business") return companyName;
    if (moveHsActive === "contact") return clientName;
    if (moveHsActive === "email") return clientEmail;
    if (moveHsActive === "phone") return clientPhone;
    return "";
  }, [moveHsActive, companyName, clientName, clientEmail, clientPhone]);

  const moveHsPick = useCallback((row: HubSpotSuggestRow) => {
    const a = applyHubSpotSuggestRow(row);
    if (a.businessName) setCompanyName(a.businessName);
    if (a.contactName) setClientName(a.contactName);
    if (a.email) setClientEmail(a.email);
    if (a.phoneFormatted) setClientPhone(a.phoneFormatted);
  }, []);

  const moveHs = useHubSpotContactSuggest({
    query: moveHsQuery,
    activeField: moveHsActive,
    setActiveField: setMoveHsActive,
    onPick: moveHsPick,
  });

  const [businessType, setBusinessType] = useState("");
  const [squareFootage, setSquareFootage] = useState("");
  const [workstationCount, setWorkstationCount] = useState("");
  const [hasItEquipment, setHasItEquipment] = useState(false);
  const [itDetail, setItDetail] = useState("");
  const [itDisconnect, setItDisconnect] = useState("");
  const [hasConferenceRoom, setHasConferenceRoom] = useState(false);
  const [hasReceptionArea, setHasReceptionArea] = useState(false);
  const [timingPreference, setTimingPreference] = useState("");
  const [buildingCoiRequired, setBuildingCoiRequired] = useState(false);
  const [siteAssessment, setSiteAssessment] = useState("");
  const [phasingNotes, setPhasingNotes] = useState("");

  // Single Item state
  const [siItemDescription, setSiItemDescription] = useState("");
  const [siItemCategory, setSiItemCategory] = useState("");
  const [siItemDimensions, setSiItemDimensions] = useState("");
  const [siEstimatedWeight, setSiEstimatedWeight] = useState("");
  const [siItemPhoto, setSiItemPhoto] = useState<File | null>(null);
  const [siItemPhotoPreview, setSiItemPhotoPreview] = useState<string | null>(
    null,
  );
  const [siNumberOfItems, setSiNumberOfItems] = useState("1");
  const [siAssemblyNeeded, setSiAssemblyNeeded] = useState("");
  const [siStairCarry, setSiStairCarry] = useState(false);
  const [siStairFlights, setSiStairFlights] = useState("1");

  // White Glove state
  const [wgItemDescription, setWgItemDescription] = useState("");
  const [wgDeclaredValue, setWgDeclaredValue] = useState("");
  const [wgItemSource, setWgItemSource] = useState("");
  const [wgSourceCompany, setWgSourceCompany] = useState("");
  const [wgAssemblyRequired, setWgAssemblyRequired] = useState("");
  const [wgPlacementSpec, setWgPlacementSpec] = useState("");
  const [wgPackagingRemoval, setWgPackagingRemoval] = useState(true);
  const [wgPhotoDocumentation, setWgPhotoDocumentation] = useState(true);
  const [wgEnhancedInsurance, setWgEnhancedInsurance] = useState(false);

  // Specialty state
  const [spProjectType, setSpProjectType] = useState("");
  const [spProjectDescription, setSpProjectDescription] = useState("");
  const [spNumberOfPieces, setSpNumberOfPieces] = useState("");
  const [spCustomCrating, setSpCustomCrating] = useState(false);
  const [spClimateControl, setSpClimateControl] = useState(false);
  const [spTimeline, setSpTimeline] = useState("");
  const [spSiteAssessment, setSpSiteAssessment] = useState("");
  const [spSpecialEquipment, setSpSpecialEquipment] = useState<string[]>([]);
  const [spCustomEquipmentInput, setSpCustomEquipmentInput] = useState("");
  const [spInsuranceRider, setSpInsuranceRider] = useState(false);

  // Event logistics (manual create move)
  const [eventName, setEventName] = useState("");
  const [venueAddress, setVenueAddress] = useState("");
  const [eventSetupRequired, setEventSetupRequired] = useState(false);
  const [eventSetupInstructions, setEventSetupInstructions] = useState("");

  // Labour only
  const [labourDescription, setLabourDescription] = useState("");

  // Draft auto-save (track core fields only — type-specific fields are less critical)
  const draftState = useMemo(
    () => ({
      moveType,
      clientName,
      clientEmail,
      clientPhone,
      fromAddress,
      toAddress,
      estimate,
      scheduledDate,
      scheduledTime,
      arrivalWindow,
      accessNotes,
      internalNotes,
      crewId,
      estCrewSize,
      estHours,
      moveSize,
      companyName,
      serviceTier,
    }),
    [
      moveType,
      clientName,
      clientEmail,
      clientPhone,
      fromAddress,
      toAddress,
      estimate,
      scheduledDate,
      scheduledTime,
      arrivalWindow,
      accessNotes,
      internalNotes,
      crewId,
      estCrewSize,
      estHours,
      moveSize,
      companyName,
      serviceTier,
    ],
  );

  const draftTitleFn = useCallback(
    (s: typeof draftState) => s.clientName || s.companyName || "Move",
    [],
  );

  const applyMoveDraft = useCallback((d: Record<string, unknown>) => {
    type K = keyof typeof d;
    const setters: Record<string, (v: string) => void> = {
      moveType: (v) => setMoveType(v as typeof moveType),
      clientName: setClientName,
      clientEmail: setClientEmail,
      clientPhone: setClientPhone,
      fromAddress: setFromAddress,
      toAddress: setToAddress,
      estimate: setEstimate,
      scheduledDate: setScheduledDate,
      scheduledTime: setScheduledTime,
      arrivalWindow: setArrivalWindow,
      accessNotes: setAccessNotes,
      internalNotes: setInternalNotes,
      crewId: setCrewId,
      estCrewSize: setEstCrewSize,
      estHours: setEstHours,
      moveSize: setMoveSize,
      companyName: setCompanyName,
      serviceTier: (v) => {
        if (v === "essential" || v === "signature" || v === "estate")
          setServiceTier(v);
      },
    };
    for (const [key, setter] of Object.entries(setters)) {
      const val = d[key as K];
      if (val && typeof val === "string") setter(val);
    }
  }, []);

  const { hasDraft, restoreDraft, dismissDraft, clearDraft } = useFormDraft(
    "move",
    draftState,
    draftTitleFn,
    {
      applySaved: applyMoveDraft as (data: typeof draftState) => void,
    },
  );

  const handleRestoreDraft = useCallback(() => {
    const d = restoreDraft();
    if (!d) return;
    applyMoveDraft(d as Record<string, unknown>);
  }, [restoreDraft, applyMoveDraft]);

  const filteredOrgs = organizations.filter((o) => {
    const term = contactSearch.toLowerCase();
    return (
      o.name?.toLowerCase().includes(term) ||
      o.email?.toLowerCase().includes(term) ||
      o.phone?.toLowerCase().includes(term) ||
      o.contact_name?.toLowerCase().includes(term)
    );
  });

  const duplicateEmailMatch =
    clientEmail?.trim() &&
    !organizationId &&
    organizations.find(
      (o) => o.email?.toLowerCase().trim() === clientEmail.trim().toLowerCase(),
    );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(e.target as Node)
      ) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced contact search from contacts table
  useEffect(() => {
    if (contactSearchTimerRef.current)
      clearTimeout(contactSearchTimerRef.current);
    if (!contactSearch || contactSearch.length < 2) {
      setDbContacts([]);
      return;
    }
    contactSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/contacts/search?q=${encodeURIComponent(contactSearch)}`,
        );
        if (res.ok) {
          const data = await res.json();
          setDbContacts(data.contacts || []);
        }
      } catch {}
    }, 300);
    return () => {
      if (contactSearchTimerRef.current)
        clearTimeout(contactSearchTimerRef.current);
    };
  }, [contactSearch]);

  // Auto-fill when client/partner selected
  useEffect(() => {
    if (organizationId) {
      const org = organizations.find((o) => o.id === organizationId);
      if (org) {
        setClientName(org.contact_name || org.name || "");
        setClientEmail(org.email || "");
        setClientPhone(org.phone ? formatPhone(org.phone) : "");
      }
    }
  }, [organizationId, organizations]);

  const toggleTeamMember = (name: string) => {
    setTeamMembers((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  useEffect(() => {
    if (crewId) {
      const members = crews.find((c) => c.id === crewId)?.members || [];
      setTeamMembers(new Set(members));
    } else {
      setTeamMembers(new Set());
    }
  }, [crewId, crews]);

  const inventoryScore =
    inventoryItems.reduce(
      (sum, i) => sum + residentialInventoryLineScore(i),
      0,
    ) +
    boxCount * 0.3;

  useEffect(() => {
    flowContentRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [flowStep]);

  useEffect(() => {
    if (flowStep !== 3) {
      setCreateMoveUnlocked(false);
      return;
    }
    setCreateMoveUnlocked(false);
    const t = setTimeout(() => setCreateMoveUnlocked(true), 550);
    return () => clearTimeout(t);
  }, [flowStep]);

  const handleFlowBack = () => {
    setFlowStep((s) => Math.max(0, s - 1));
  };

  const handleFlowContinue = () => {
    if (flowStep === 0) {
      if (!clientName.trim()) {
        toast("Client name is required", "x");
        return;
      }
      if (moveType === "office" && !companyName.trim()) {
        toast("Company name is required for office moves", "x");
        return;
      }
      if (moveType === "single_item") {
        if (!siItemDescription.trim()) {
          toast("Item description is required", "x");
          return;
        }
        if (!siItemCategory) {
          toast("Item category is required", "x");
          return;
        }
      }
      if (moveType === "white_glove" && !wgItemDescription.trim()) {
        toast("Item description is required for white glove", "x");
        return;
      }
      if (moveType === "specialty") {
        if (!spProjectType) {
          toast("Project type is required", "x");
          return;
        }
        if (!spProjectDescription.trim()) {
          toast("Project description is required", "x");
          return;
        }
      }
      if (moveType === "labour_only" && !labourDescription.trim()) {
        toast("Describe what the crew will do", "x");
        return;
      }
      setFlowStep(1);
      return;
    }
    if (flowStep === 1) {
      if (!fromAddress.trim()) {
        toast("Pickup (from) address is required", "x");
        return;
      }
      if (!toAddress.trim()) {
        toast("Delivery (to) address is required", "x");
        return;
      }
      if (moveType === "residential" && !moveSize) {
        toast("Move size is required for residential moves", "x");
        return;
      }
      setFlowStep(2);
      return;
    }
    if (flowStep === 2) {
      if (!estCrewSize || Number(estCrewSize) < 1) {
        toast("Estimated crew size is required", "x");
        return;
      }
      if (!estHours || Number(estHours) < 0.5) {
        toast("Estimated hours is required (minimum 0.5)", "x");
        return;
      }
      setFlowStep(3);
      return;
    }
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeDoc = (idx: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const blockFormNativeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
  };

  const submitCreateMove = async () => {
    if (flowStep !== 3) {
      toast(
        "Use Continue to reach the last step before creating the move",
        "x",
      );
      return;
    }
    if (!createMoveUnlocked) {
      return;
    }
    if (!clientName.trim()) {
      toast("Client name is required", "x");
      return;
    }
    if (!fromAddress.trim()) {
      toast("Pickup (from) address is required", "x");
      return;
    }
    if (!toAddress.trim()) {
      toast("Delivery (to) address is required", "x");
      return;
    }
    if (moveType === "residential" && !moveSize) {
      toast("Move size is required for residential moves", "x");
      return;
    }
    if (!estCrewSize || Number(estCrewSize) < 1) {
      toast("Estimated crew size is required", "x");
      return;
    }
    if (!estHours || Number(estHours) < 0.5) {
      toast("Estimated hours is required (minimum 0.5)", "x");
      return;
    }

    // If no client selected and user typed manually (not chosen from dropdown), check for duplicate
    if (!organizationId && !clientSelectedFromSearch) {
      try {
        const checkRes = await fetch("/api/admin/clients/check-duplicate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_name: clientName.trim(),
            client_email: clientEmail.trim(),
            client_phone: normalizePhone(clientPhone),
          }),
        });
        const checkData = (await checkRes.json().catch(() => ({}))) as {
          exists?: boolean;
          org?: { name?: string };
          error?: string;
        };
        if (checkRes.ok && checkData.exists) {
          toast(
            `Client already exists: ${checkData.org?.name || "Existing client"}. Please select them from the dropdown.`,
            "x",
          );
          return;
        }
      } catch {
        // Proceed to create; API will return 400 if duplicate
      }
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("move_type", moveType);
      formData.append("organization_id", organizationId);
      formData.append("from_access", fromAccess);
      formData.append("to_access", toAccess);
      if (fromUnit.trim()) formData.append("from_unit", fromUnit.trim());
      if (fromFloor.trim()) formData.append("from_floor", fromFloor.trim());
      if (toUnit.trim()) formData.append("to_unit", toUnit.trim());
      if (toFloor.trim()) formData.append("to_floor", toFloor.trim());
      formData.append("client_name", clientName.trim());
      formData.append("client_email", clientEmail.trim());
      formData.append("client_phone", normalizePhone(clientPhone));
      formData.append("from_address", fromAddress.trim());
      formData.append("to_address", toAddress.trim());
      if (fromLat != null && fromLng != null) {
        formData.append("from_lat", String(fromLat));
        formData.append("from_lng", String(fromLng));
      }
      if (toLat != null && toLng != null) {
        formData.append("to_lat", String(toLat));
        formData.append("to_lng", String(toLng));
      }
      formData.append("estimate", String(parseNumberInput(estimate) || 0));
      formData.append("scheduled_date", scheduledDate);
      formData.append("scheduled_time", scheduledTime);
      formData.append("arrival_window", arrivalWindow);
      formData.append("access_notes", accessNotes);
      formData.append("internal_notes", internalNotes);
      if (extraFromStops.length > 0 || extraToStops.length > 0) {
        formData.append(
          "additional_stops",
          JSON.stringify({
            extra_pickups: extraFromStops,
            extra_dropoffs: extraToStops,
          }),
        );
      }
      formData.append(
        "complexity_indicators",
        JSON.stringify(complexityIndicators),
      );
      formData.append("preferred_contact", preferredContact);
      formData.append("coordinator_name", coordinatorName.trim());
      formData.append("tier_selected", serviceTier);
      formData.append("crew_id", crewId);
      formData.append(
        "assigned_members",
        JSON.stringify(Array.from(teamMembers)),
      );
      formData.append("truck_primary", truckPrimary || "");
      formData.append("est_crew_size", estCrewSize);
      formData.append("est_hours", estHours);
      formData.append(
        "items",
        JSON.stringify(
          inventoryItems.map((i) => ({
            slug: i.slug,
            name: i.name,
            quantity: i.quantity,
            weight_score: i.weight_score,
            room: i.room || "other",
            ...(i.weightNote ? { weightNote: i.weightNote } : {}),
          })),
        ),
      );
      formData.append("inventory_score", String(inventoryScore));
      if (boxCount > 0) formData.append("box_count", String(boxCount));
      // Residential fields
      if (moveType === "residential") {
        formData.append("move_size", moveSize);
        formData.append("packing_service", packingService);
        formData.append("specialty_items", JSON.stringify(specialtyItems));
        formData.append("boxes_bins", boxesBins);
        formData.append("addons", JSON.stringify(Array.from(addOns)));
      }
      // Office fields
      if (moveType === "office") {
        formData.append("company_name", companyName);
        formData.append("business_type", businessType);
        formData.append("square_footage", squareFootage);
        formData.append("workstation_count", workstationCount);
        formData.append("has_it_equipment", String(hasItEquipment));
        formData.append("it_detail", itDetail);
        formData.append("it_disconnect", itDisconnect);
        formData.append("has_conference_room", String(hasConferenceRoom));
        formData.append("has_reception_area", String(hasReceptionArea));
        formData.append("timing_preference", timingPreference);
        formData.append("building_coi_required", String(buildingCoiRequired));
        formData.append("site_assessment", siteAssessment);
        formData.append("phasing_notes", phasingNotes);
      }
      // Single Item fields
      if (moveType === "single_item") {
        formData.append("item_description", siItemDescription);
        formData.append("item_category", siItemCategory);
        formData.append("item_dimensions", siItemDimensions);
        formData.append("item_weight_class", siEstimatedWeight);
        if (siItemPhoto) formData.append("item_photo", siItemPhoto);
        formData.append("number_of_items", siNumberOfItems);
        formData.append("assembly_needed", siAssemblyNeeded);
        formData.append("stair_carry", String(siStairCarry));
        if (siStairCarry) formData.append("stair_flights", siStairFlights);
      }
      // White Glove fields
      if (moveType === "white_glove") {
        formData.append("item_description", wgItemDescription);
        formData.append("declared_value", wgDeclaredValue);
        formData.append("item_source", wgItemSource);
        formData.append("source_company", wgSourceCompany);
        formData.append("assembly_needed", wgAssemblyRequired);
        formData.append("placement_spec", wgPlacementSpec);
        formData.append("packaging_removal", String(wgPackagingRemoval));
        formData.append("photo_documentation", String(wgPhotoDocumentation));
        formData.append("enhanced_insurance", String(wgEnhancedInsurance));
      }
      // Specialty fields
      if (moveType === "specialty") {
        formData.append("project_type", spProjectType);
        formData.append("project_description", spProjectDescription);
        formData.append("number_of_items", spNumberOfPieces);
        formData.append("custom_crating", String(spCustomCrating));
        formData.append("climate_control", String(spClimateControl));
        formData.append("timeline", spTimeline);
        formData.append("site_assessment", spSiteAssessment);
        formData.append(
          "special_equipment",
          JSON.stringify(spSpecialEquipment),
        );
        formData.append("insurance_rider", String(spInsuranceRider));
      }
      if (moveType === "event") {
        formData.append("event_name", eventName.trim());
        formData.append(
          "venue_address",
          venueAddress.trim() || toAddress.trim(),
        );
        formData.append("setup_required", String(eventSetupRequired));
        formData.append("setup_instructions", eventSetupInstructions.trim());
      }
      if (moveType === "labour_only") {
        formData.append("labour_description", labourDescription.trim());
      }
      docFiles.forEach((f) => formData.append("documents", f));

      const res = await fetch("/api/admin/moves/create", {
        method: "POST",
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        move_code?: string;
        error?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      if (!res.ok) {
        toast(data.error || `Failed to create move (${res.status})`, "x");
        return;
      }
      clearDraft();
      if (data.emailSent) {
        toast("Move created. Client notified by email.", "mail");
      } else if (data.emailError) {
        toast(`Move created. Email not sent: ${data.emailError}`, "x");
      } else {
        toast("Move created.", "check");
      }
      router.push(
        data.move_code
          ? `/admin/moves/${data.move_code}`
          : `/admin/moves/${data.id}`,
      );
      router.refresh();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to create move", "x");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-3">
        <BackButton label="Back" />
      </div>
      <div className="w-full">
        <div className="mb-6 pb-6 border-b border-[var(--brd)]/70">
          <p className="text-[10px] font-bold tracking-[0.18em] uppercase text-[var(--tx3)]/82 mb-1.5">
            Operations
          </p>
          <h1 className="admin-page-hero text-[var(--tx)]">Create New Move</h1>
          <p className="text-[10px] text-[var(--tx3)] mt-1.5 max-w-2xl leading-relaxed">
            Move through each step in order. Earlier sections stay saved in the
            form state while you continue.
          </p>
          <nav
            className="mt-5 flex flex-wrap gap-2"
            aria-label="Create move steps"
          >
            {CREATE_MOVE_FLOW_STEP_LABELS.map((label, i) => {
              const done = i < flowStep;
              const active = i === flowStep;
              const canJumpBack = i < flowStep;
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    if (canJumpBack) setFlowStep(i);
                  }}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-all duration-300 ease-out ${
                    active
                      ? "border-[var(--yu3-wine)] bg-[var(--yu3-wine-wash)] text-[var(--tx)] shadow-sm"
                      : done
                        ? "border-[var(--brd)] bg-[var(--bg)] text-[var(--tx2)] hover:border-[var(--yu3-wine)]/40 cursor-pointer"
                        : "border-[var(--brd)]/60 text-[var(--tx3)] opacity-75 cursor-default"
                  }`}
                  disabled={!canJumpBack && !active}
                  aria-current={active ? "step" : undefined}
                >
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                      active
                        ? "bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)]"
                        : done
                          ? "bg-[var(--yu3-wine)]/85 text-[var(--yu3-on-wine)]"
                          : "bg-[var(--brd)] text-[var(--tx3)]"
                    }`}
                  >
                    {done ? (
                      <Check
                        className="w-3.5 h-3.5"
                        weight="bold"
                        aria-hidden
                      />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="text-[10px] font-bold uppercase tracking-[0.12em] leading-tight max-w-[148px] sm:max-w-[200px]">
                    {label}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>
        <form noValidate onSubmit={blockFormNativeSubmit} className="space-y-0">
          {hasDraft && (
            <div className="mb-4">
              <DraftBanner
                onRestore={handleRestoreDraft}
                onDismiss={dismissDraft}
              />
            </div>
          )}
          <div
            ref={flowContentRef}
            className="space-y-0 motion-safe:transition-opacity motion-safe:duration-300"
          >
            {flowStep === 0 && (
              <>
                {/* Move type selector */}
                <div>
                  <label className="block text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)] mb-2">
                    Service Type
                  </label>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                    {(
                      [
                        "residential",
                        "office",
                        "single_item",
                        "white_glove",
                        "specialty",
                        "event",
                        "labour_only",
                      ] as const
                    ).map((val) => {
                      const META: Record<
                        string,
                        { label: string; desc: string }
                      > = {
                        residential: {
                          label: "Residential",
                          desc: "Local or long distance home move",
                        },
                        office: {
                          label: "Office / Commercial",
                          desc: "Business, retail, salon, clinic relocation",
                        },
                        single_item: {
                          label: "Single Item",
                          desc: "One item or small batch delivery",
                        },
                        white_glove: {
                          label: "White Glove",
                          desc: "Premium handling, assembly, placement",
                        },
                        specialty: {
                          label: "Specialty",
                          desc: "Piano, art, antiques, estate, trade show",
                        },
                        event: {
                          label: "Event logistics",
                          desc: "Venue delivery, setup, and return for events",
                        },
                        labour_only: {
                          label: "Labour only",
                          desc: "Crew hours on-site; use same address if one location",
                        },
                      };
                      const { label, desc } = META[val];
                      const sel = moveType === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setMoveType(val)}
                          className={`relative min-w-[min(100%,9.5rem)] flex-1 sm:max-w-[calc(50%-0.25rem)] lg:max-w-[calc(25%-0.375rem)] text-left px-3 py-2 rounded-lg border transition-all duration-200 ${
                            sel
                              ? "bg-gradient-to-br from-[#2C3E2D] to-[#5C1A33] border-[#2C3E2D] shadow-md shadow-[#2C3E2D]/15"
                              : "bg-[var(--card)] border-[var(--brd)] hover:border-[#2C3E2D]/40 hover:bg-[var(--bg)]"
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                              <div
                                className={`text-[11px] leading-tight tracking-tight font-semibold ${sel ? "text-white" : "text-[var(--tx)]"}`}
                              >
                                {label}
                              </div>
                              <div
                                className={`text-[9px] mt-0.5 leading-snug ${sel ? "text-white/90" : "text-[var(--tx3)]"}`}
                              >
                                {desc}
                              </div>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[var(--brd)]/30 pt-3 pb-3" />

                {/* Client section */}
                <div ref={moveHs.containerRef}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Client
                    </h3>
                    <Field label="Select to auto fill">
                      <div ref={contactDropdownRef} className="relative">
                        <input
                          type="text"
                          value={
                            organizationId
                              ? organizations.find(
                                  (o) => o.id === organizationId,
                                )?.contact_name ||
                                organizations.find(
                                  (o) => o.id === organizationId,
                                )?.name ||
                                ""
                              : contactSearch
                          }
                          onChange={(e) => {
                            setContactSearch(e.target.value);
                            setOrganizationId("");
                            setClientSelectedFromSearch(false);
                            setShowContactDropdown(true);
                          }}
                          onFocus={() => setShowContactDropdown(true)}
                          placeholder="Search by name, email, or phone…"
                          className={`${fieldInput} ${organizationId ? "pr-8" : ""}`}
                        />
                        {organizationId && (
                          <button
                            type="button"
                            onClick={() => {
                              setOrganizationId("");
                              setContactSearch("");
                              setShowContactDropdown(false);
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx3)] hover:text-[var(--tx)] text-[var(--text-base)]"
                            aria-label="Clear selection"
                          >
                            ×
                          </button>
                        )}
                        {showContactDropdown && (
                          <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
                            {filteredOrgs.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">
                                  Partners / Organizations
                                </div>
                                {filteredOrgs.map((o) => (
                                  <button
                                    key={o.id}
                                    type="button"
                                    onClick={() => {
                                      setOrganizationId(o.id);
                                      setContactSearch("");
                                      setShowContactDropdown(false);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                                  >
                                    {o.contact_name || o.name}
                                    {o.email && (
                                      <span className="text-[var(--tx3)] ml-1">
                                        - {o.email}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                            {dbContacts.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[9px] font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">
                                  HubSpot Contacts
                                </div>
                                {dbContacts.map((c) => (
                                  <button
                                    key={c.hubspot_id}
                                    type="button"
                                    onClick={() => {
                                      setClientName(c.name || "");
                                      setClientEmail(c.email || "");
                                      setClientPhone(
                                        c.phone ? formatPhone(c.phone) : "",
                                      );
                                      if (c.address) setFromAddress(c.address);
                                      if (c.company?.trim())
                                        setCompanyName(c.company.trim());
                                      setContactSearch("");
                                      setShowContactDropdown(false);
                                      setDbContacts([]);
                                      setClientSelectedFromSearch(true);
                                    }}
                                    className="w-full text-left px-3 py-2 text-[12px] text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                                  >
                                    {c.name}
                                    {c.email && (
                                      <span className="text-[var(--tx3)] ml-1">
                                        - {c.email}
                                      </span>
                                    )}
                                    {c.phone && (
                                      <span className="text-[var(--tx3)] ml-1">
                                        - {formatPhone(c.phone)}
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </>
                            )}
                            {filteredOrgs.length === 0 &&
                              dbContacts.length === 0 && (
                                <div className="px-3 py-2 text-[11px] text-[var(--tx3)]">
                                  No matches
                                </div>
                              )}
                          </div>
                        )}
                      </div>
                    </Field>
                    <div className="grid sm:grid-cols-3 gap-2">
                      <Field label="Client Name *">
                        <div className="relative">
                          <input
                            {...moveHs.bindField("contact")}
                            name="client_name"
                            value={clientName}
                            onChange={(e) => {
                              setClientName(e.target.value);
                              setClientSelectedFromSearch(false);
                            }}
                            placeholder="Full name"
                            required
                            className={fieldInput}
                            autoComplete="name"
                          />
                          {moveHs.renderDropdown("contact")}
                        </div>
                      </Field>
                      <Field label="Email">
                        <div className="relative">
                          <input
                            type="email"
                            {...moveHs.bindField("email")}
                            name="client_email"
                            value={clientEmail}
                            onChange={(e) => {
                              setClientEmail(e.target.value);
                              setClientSelectedFromSearch(false);
                            }}
                            placeholder="client@example.com"
                            className={fieldInput}
                            autoComplete="email"
                          />
                          {moveHs.renderDropdown("email")}
                        </div>
                      </Field>
                      <Field label="Phone">
                        <div className="relative">
                          <input
                            ref={clientPhoneInput.ref}
                            type="tel"
                            {...moveHs.bindField("phone")}
                            name="client_phone"
                            value={clientPhone}
                            onChange={clientPhoneInput.onChange}
                            placeholder={PHONE_PLACEHOLDER}
                            className={fieldInput}
                            autoComplete="tel"
                          />
                          {moveHs.renderDropdown("phone")}
                        </div>
                      </Field>
                    </div>
                    {duplicateEmailMatch && (
                      <div className="px-3 py-2 rounded-lg bg-[var(--org)]/15 border border-[var(--org)]/40 text-[11px] font-medium text-[var(--org)]">
                        A contact with this email already exists
                      </div>
                    )}
                    <Field label="Move Coordinator (optional)">
                      <input
                        type="text"
                        name="coordinator_name"
                        value={coordinatorName}
                        onChange={(e) => setCoordinatorName(e.target.value)}
                        placeholder="Coordinator name"
                        className={fieldInput}
                      />
                    </Field>
                    <Field label="Preferred Contact">
                      <select
                        value={preferredContact}
                        onChange={(e) => setPreferredContact(e.target.value)}
                        className={fieldInput}
                      >
                        <option value="email">Email</option>
                        <option value="phone">Phone</option>
                        <option value="both">Both</option>
                      </select>
                    </Field>
                  </div>

                  {(moveType === "office" ||
                    moveType === "single_item" ||
                    moveType === "white_glove" ||
                    moveType === "specialty" ||
                    moveType === "event" ||
                    moveType === "labour_only") && (
                    <div className="border-t border-[var(--brd)]/30 pt-3 pb-3" />
                  )}

                  {/* Office: Company info */}
                  <AnimatedSection show={moveType === "office"}>
                    <div className="space-y-2">
                      <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                        Business Details
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-2">
                        <Field label="Company Name">
                          <div className="relative">
                            <input
                              {...moveHs.bindField("business")}
                              value={companyName}
                              onChange={(e) => setCompanyName(e.target.value)}
                              placeholder="Business name"
                              className={fieldInput}
                              autoComplete="organization"
                            />
                            {moveHs.renderDropdown("business")}
                          </div>
                        </Field>
                        <Field label="Business Type">
                          <select
                            value={businessType}
                            onChange={(e) => setBusinessType(e.target.value)}
                            className={fieldInput}
                          >
                            <option value="">Select…</option>
                            {BUSINESS_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </div>
                    </div>
                  </AnimatedSection>
                </div>

                {/* Single Item: item info */}
                <AnimatedSection show={moveType === "single_item"}>
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--tx2)]">
                      Item Details
                    </h3>
                    <Field label="Item Description *">
                      <input
                        value={siItemDescription}
                        onChange={(e) => setSiItemDescription(e.target.value)}
                        placeholder="e.g. Leather sectional sofa"
                        className={fieldInput}
                      />
                    </Field>
                    <div className="grid grid-cols-3 gap-2">
                      <Field label="Number of Items">
                        <input
                          type="number"
                          min={1}
                          max={5}
                          value={siNumberOfItems}
                          onChange={(e) => setSiNumberOfItems(e.target.value)}
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Category *">
                        <select
                          value={siItemCategory}
                          onChange={(e) => setSiItemCategory(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {ITEM_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Weight Class">
                        <select
                          value={siEstimatedWeight}
                          onChange={(e) => setSiEstimatedWeight(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {WEIGHT_CLASSES.map((w) => (
                            <option key={w} value={w}>
                              {w}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Dimensions (optional)">
                        <input
                          value={siItemDimensions}
                          onChange={(e) => setSiItemDimensions(e.target.value)}
                          placeholder="L × W × H"
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Item Photo">
                        <div className="flex items-center gap-2">
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files?.[0] || null;
                              setSiItemPhoto(file);
                              if (file) {
                                const reader = new FileReader();
                                reader.onload = (ev) =>
                                  setSiItemPhotoPreview(
                                    ev.target?.result as string,
                                  );
                                reader.readAsDataURL(file);
                              } else {
                                setSiItemPhotoPreview(null);
                              }
                            }}
                            className="text-[11px] text-[var(--tx3)] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-semibold file:bg-[var(--admin-primary-fill)] file:text-[var(--btn-text-on-accent)] file:cursor-pointer"
                          />
                          {siItemPhotoPreview && (
                            <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--brd)]">
                              <img
                                src={siItemPhotoPreview}
                                alt="Item preview"
                                className="w-full h-full object-cover"
                              />
                              <button
                                type="button"
                                onClick={() => {
                                  setSiItemPhoto(null);
                                  setSiItemPhotoPreview(null);
                                }}
                                className="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 flex items-center justify-center text-[10px] rounded-bl"
                              >
                                ×
                              </button>
                            </div>
                          )}
                        </div>
                      </Field>
                    </div>
                  </div>
                </AnimatedSection>

                {/* White Glove: item info */}
                <AnimatedSection show={moveType === "white_glove"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      White Glove, Item Info
                    </h3>
                    <Field label="Item Description *">
                      <input
                        value={wgItemDescription}
                        onChange={(e) => setWgItemDescription(e.target.value)}
                        placeholder="Describe the item in detail"
                        className={fieldInput}
                      />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Retail / Declared Value ($)">
                        <input
                          type="text"
                          value={wgDeclaredValue}
                          onChange={(e) => setWgDeclaredValue(e.target.value)}
                          onBlur={() => {
                            const n = parseNumberInput(wgDeclaredValue);
                            if (n > 0) setWgDeclaredValue(formatNumberInput(n));
                          }}
                          placeholder="For insurance, required for items over $2,000"
                          inputMode="decimal"
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Item Source">
                        <select
                          value={wgItemSource}
                          onChange={(e) => setWgItemSource(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {ITEM_SOURCE_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Source Company">
                      <input
                        value={wgSourceCompany}
                        onChange={(e) => setWgSourceCompany(e.target.value)}
                        placeholder="If from a retailer, helps track B2B potential"
                        className={fieldInput}
                      />
                    </Field>
                  </div>
                </AnimatedSection>

                {/* Specialty: project info */}
                <AnimatedSection show={moveType === "specialty"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Specialty Details
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Project Type *">
                        <select
                          value={spProjectType}
                          onChange={(e) => setSpProjectType(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {PROJECT_TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Number of Items / Pieces">
                        <input
                          type="number"
                          min={1}
                          value={spNumberOfPieces}
                          onChange={(e) => setSpNumberOfPieces(e.target.value)}
                          placeholder="1"
                          className={fieldInput}
                        />
                      </Field>
                    </div>
                    <Field label="Project Description *">
                      <textarea
                        value={spProjectDescription}
                        onChange={(e) =>
                          setSpProjectDescription(e.target.value)
                        }
                        rows={4}
                        placeholder="Describe scope, requirements, special considerations…"
                        className={`${fieldInput} resize-none min-h-[88px]`}
                      />
                    </Field>
                  </div>
                </AnimatedSection>

                <AnimatedSection show={moveType === "event"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Event details
                    </h3>
                    <p className="text-[10px] text-[var(--tx3)]">
                      Multi-leg event bookings from quotes become several linked
                      moves. For a manual event, use From → staging / warehouse
                      and To → venue if applicable.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Event name">
                        <input
                          value={eventName}
                          onChange={(e) => setEventName(e.target.value)}
                          placeholder="e.g. Spring gala 2026"
                          className={fieldInput}
                        />
                      </Field>
                      <Field label="Venue address (optional)">
                        <AddressAutocomplete
                          value={venueAddress}
                          onRawChange={(t) => setVenueAddress(t)}
                          onChange={(r) => setVenueAddress(r.fullAddress)}
                          placeholder="Defaults to “To” address if empty"
                          className={fieldInput}
                        />
                      </Field>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-[var(--tx2)] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={eventSetupRequired}
                        onChange={(e) =>
                          setEventSetupRequired(e.target.checked)
                        }
                        className="accent-[var(--gold)]"
                      />
                      Setup / teardown assistance required
                    </label>
                    <Field label="Setup instructions">
                      <textarea
                        value={eventSetupInstructions}
                        onChange={(e) =>
                          setEventSetupInstructions(e.target.value)
                        }
                        rows={2}
                        placeholder="Program, timing, dock, contact on-site…"
                        className={`${fieldInput} resize-none`}
                      />
                    </Field>
                  </div>
                </AnimatedSection>

                <AnimatedSection show={moveType === "labour_only"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Labour scope
                    </h3>
                    <p className="text-[10px] text-[var(--tx3)]">
                      Use the same address for From and To if all work is at one
                      site.
                    </p>
                    <Field label="What will the crew do?">
                      <textarea
                        value={labourDescription}
                        onChange={(e) => setLabourDescription(e.target.value)}
                        rows={3}
                        placeholder="e.g. Load dock unload only, rearrange floor plan, debris removal…"
                        className={`${fieldInput} resize-none`}
                      />
                    </Field>
                  </div>
                </AnimatedSection>

                {(moveType === "office" ||
                  moveType === "single_item" ||
                  moveType === "white_glove" ||
                  moveType === "specialty" ||
                  moveType === "event" ||
                  moveType === "labour_only") && (
                  <div className="border-t border-[var(--brd)]/30 pt-3 pb-3" />
                )}
              </>
            )}
            {flowStep === 1 && (
              <>
                <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

                {/* Addresses */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Addresses
                  </h3>
                  {moveType === "labour_only" && (
                    <p className="text-[10px] text-[var(--tx3)]">
                      Work site or primary location, you can use the same
                      address twice.
                    </p>
                  )}
                  {moveType === "labour_only" ? (
                    <div className="space-y-1.5">
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <div className="flex-1 min-w-0 w-full">
                          <AddressAutocomplete
                            value={fromAddress}
                            onRawChange={setFromAddress}
                            onChange={(r) => {
                              setFromAddress(r.fullAddress);
                              setFromLat(r.lat);
                              setFromLng(r.lng);
                            }}
                            placeholder="Origin address"
                            label="From"
                            required
                            className={fieldInput}
                          />
                        </div>
                        <div className="w-full sm:w-[140px] shrink-0">
                          <Field label="From Access">
                            <select
                              name="from_access"
                              value={fromAccess}
                              onChange={(e) => setFromAccess(e.target.value)}
                              className={fieldInput}
                            >
                              <option value="">Select…</option>
                              <option value="Elevator">Elevator</option>
                              <option value="Stairs">Stairs</option>
                              <option value="Loading dock">Loading dock</option>
                              <option value="Parking">Parking</option>
                              <option value="Gate / Buzz code">
                                Gate / Buzz code
                              </option>
                              <option value="Ground floor">Ground floor</option>
                              <option value="Building access required">
                                Building access required
                              </option>
                            </select>
                          </Field>
                        </div>
                      </div>
                      {[
                        "Elevator",
                        "Loading dock",
                        "Gate / Buzz code",
                      ].includes(fromAccess) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Unit / Suite">
                            <input
                              type="text"
                              value={fromUnit}
                              onChange={(e) => setFromUnit(e.target.value)}
                              placeholder="e.g. 1204"
                              className={fieldInput}
                            />
                          </Field>
                          <Field label="Floor">
                            <input
                              type="text"
                              value={fromFloor}
                              onChange={(e) => setFromFloor(e.target.value)}
                              placeholder="e.g. 12"
                              className={fieldInput}
                            />
                          </Field>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-2 items-start">
                        <div className="flex-1 min-w-0 w-full">
                          <AddressAutocomplete
                            value={toAddress}
                            onRawChange={setToAddress}
                            onChange={(r) => {
                              setToAddress(r.fullAddress);
                              setToLat(r.lat);
                              setToLng(r.lng);
                            }}
                            placeholder="Destination address"
                            label="To"
                            required
                            className={fieldInput}
                          />
                        </div>
                        <div className="w-full sm:w-[140px] shrink-0">
                          <Field label="To Access">
                            <select
                              name="to_access"
                              value={toAccess}
                              onChange={(e) => setToAccess(e.target.value)}
                              className={fieldInput}
                            >
                              <option value="">Select…</option>
                              <option value="Elevator">Elevator</option>
                              <option value="Stairs">Stairs</option>
                              <option value="Loading dock">Loading dock</option>
                              <option value="Parking">Parking</option>
                              <option value="Gate / Buzz code">
                                Gate / Buzz code
                              </option>
                              <option value="Ground floor">Ground floor</option>
                              <option value="Building access required">
                                Building access required
                              </option>
                            </select>
                          </Field>
                        </div>
                      </div>
                      {[
                        "Elevator",
                        "Loading dock",
                        "Gate / Buzz code",
                      ].includes(toAccess) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Unit / Suite">
                            <input
                              type="text"
                              value={toUnit}
                              onChange={(e) => setToUnit(e.target.value)}
                              placeholder="e.g. 804"
                              className={fieldInput}
                            />
                          </Field>
                          <Field label="Floor">
                            <input
                              type="text"
                              value={toFloor}
                              onChange={(e) => setToFloor(e.target.value)}
                              placeholder="e.g. 8"
                              className={fieldInput}
                            />
                          </Field>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="flex-1 min-w-0 w-full max-w-2xl">
                          <MultiStopAddressField
                            label="From"
                            placeholder="Origin address"
                            stops={[
                              {
                                address: fromAddress,
                                lat: fromLat,
                                lng: fromLng,
                              },
                              ...extraFromStops,
                            ]}
                            onChange={(stops) => {
                              const first = stops[0];
                              setFromAddress(first?.address ?? "");
                              setFromLat(first?.lat ?? null);
                              setFromLng(first?.lng ?? null);
                              setExtraFromStops(stops.slice(1));
                            }}
                            inputClassName={fieldInput}
                          />
                        </div>
                        <div className="w-full sm:w-[140px] shrink-0">
                          <Field label="From Access">
                            <select
                              name="from_access"
                              value={fromAccess}
                              onChange={(e) => setFromAccess(e.target.value)}
                              className={fieldInput}
                            >
                              <option value="">Select…</option>
                              <option value="Elevator">Elevator</option>
                              <option value="Stairs">Stairs</option>
                              <option value="Loading dock">Loading dock</option>
                              <option value="Parking">Parking</option>
                              <option value="Gate / Buzz code">
                                Gate / Buzz code
                              </option>
                              <option value="Ground floor">Ground floor</option>
                              <option value="Building access required">
                                Building access required
                              </option>
                            </select>
                          </Field>
                        </div>
                      </div>
                      {[
                        "Elevator",
                        "Loading dock",
                        "Gate / Buzz code",
                      ].includes(fromAccess) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Unit / Suite">
                            <input
                              type="text"
                              value={fromUnit}
                              onChange={(e) => setFromUnit(e.target.value)}
                              placeholder="e.g. 1204"
                              className={fieldInput}
                            />
                          </Field>
                          <Field label="Floor">
                            <input
                              type="text"
                              value={fromFloor}
                              onChange={(e) => setFromFloor(e.target.value)}
                              placeholder="e.g. 12"
                              className={fieldInput}
                            />
                          </Field>
                        </div>
                      )}
                      <div className="flex flex-col sm:flex-row gap-3 items-start">
                        <div className="flex-1 min-w-0 w-full max-w-2xl">
                          <MultiStopAddressField
                            label="To"
                            placeholder="Destination address"
                            stops={[
                              { address: toAddress, lat: toLat, lng: toLng },
                              ...extraToStops,
                            ]}
                            onChange={(stops) => {
                              const first = stops[0];
                              setToAddress(first?.address ?? "");
                              setToLat(first?.lat ?? null);
                              setToLng(first?.lng ?? null);
                              setExtraToStops(stops.slice(1));
                            }}
                            inputClassName={fieldInput}
                          />
                        </div>
                        <div className="w-full sm:w-[140px] shrink-0">
                          <Field label="To Access">
                            <select
                              name="to_access"
                              value={toAccess}
                              onChange={(e) => setToAccess(e.target.value)}
                              className={fieldInput}
                            >
                              <option value="">Select…</option>
                              <option value="Elevator">Elevator</option>
                              <option value="Stairs">Stairs</option>
                              <option value="Loading dock">Loading dock</option>
                              <option value="Parking">Parking</option>
                              <option value="Gate / Buzz code">
                                Gate / Buzz code
                              </option>
                              <option value="Ground floor">Ground floor</option>
                              <option value="Building access required">
                                Building access required
                              </option>
                            </select>
                          </Field>
                        </div>
                      </div>
                      {[
                        "Elevator",
                        "Loading dock",
                        "Gate / Buzz code",
                      ].includes(toAccess) && (
                        <div className="grid grid-cols-2 gap-2">
                          <Field label="Unit / Suite">
                            <input
                              type="text"
                              value={toUnit}
                              onChange={(e) => setToUnit(e.target.value)}
                              placeholder="e.g. 804"
                              className={fieldInput}
                            />
                          </Field>
                          <Field label="Floor">
                            <input
                              type="text"
                              value={toFloor}
                              onChange={(e) => setToFloor(e.target.value)}
                              placeholder="e.g. 8"
                              className={fieldInput}
                            />
                          </Field>
                        </div>
                      )}
                      {(extraFromStops.some((s) => s.address.trim()) ||
                        extraToStops.some((s) => s.address.trim())) && (
                        <div className="rounded-lg border border-[var(--brd)]/60 bg-[var(--bg2)]/40 p-3 space-y-1.5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--tx3)]">
                            Multi-location move
                          </p>
                          <p className="text-[10px] text-[var(--tx3)] leading-snug">
                            Extra stops are recorded on this move. For full
                            project scheduling with phased days, per-location
                            pricing, pack day planning, and the client timeline,
                            use{" "}
                            <a
                              href="/admin/quotes/new"
                              className="font-semibold text-[var(--yu-accent)] underline underline-offset-2"
                            >
                              Generate Quote
                            </a>{" "}
                            and enable the multi-day planner.
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

                {/* Residential-only fields */}
                <AnimatedSection show={moveType === "residential"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Residential Details
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Move Size *">
                        <select
                          value={moveSize}
                          onChange={(e) => setMoveSize(e.target.value)}
                          className={`${fieldInput} ${moveType === "residential" && !moveSize ? "border-amber-400/60" : ""}`}
                          required={moveType === "residential"}
                        >
                          <option value="">Select size…</option>
                          {MOVE_SIZES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Service Tier *">
                        <select
                          value={serviceTier}
                          onChange={(e) =>
                            setServiceTier(
                              e.target.value as
                                | "essential"
                                | "signature"
                                | "estate",
                            )
                          }
                          className={fieldInput}
                          required={moveType === "residential"}
                        >
                          <option value="essential">Essential</option>
                          <option value="signature">Signature</option>
                          <option value="estate">Estate</option>
                        </select>
                      </Field>
                      <Field label="Packing Service">
                        <select
                          value={packingService}
                          onChange={(e) => setPackingService(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {PACKING_OPTIONS.map((p) => (
                            <option key={p} value={p}>
                              {p}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label="Specialty Items">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {SPECIALTY_ITEM_PRESETS.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() =>
                              setSpecialtyItems((prev) =>
                                prev.includes(item)
                                  ? prev.filter((i) => i !== item)
                                  : [...prev, item],
                              )
                            }
                            className={`max-w-full whitespace-normal text-left leading-snug px-2.5 py-1.5 rounded-md text-[10px] font-semibold border transition-colors ${
                              specialtyItems.includes(item)
                                ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                                : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                            }`}
                            title={item}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={customSpecialtyInput}
                          onChange={(e) =>
                            setCustomSpecialtyInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              customSpecialtyInput.trim()
                            ) {
                              e.preventDefault();
                              if (
                                !specialtyItems.includes(
                                  customSpecialtyInput.trim(),
                                )
                              ) {
                                setSpecialtyItems((prev) => [
                                  ...prev,
                                  customSpecialtyInput.trim(),
                                ]);
                              }
                              setCustomSpecialtyInput("");
                            }
                          }}
                          placeholder="Add custom item (press Enter)"
                          className={`flex-1 ${fieldInput}`}
                        />
                      </div>
                      {specialtyItems.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {specialtyItems.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() =>
                                  setSpecialtyItems((prev) =>
                                    prev.filter((i) => i !== item),
                                  )
                                }
                                className="hover:text-[var(--red)]"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </Field>

                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Boxes / Bins Needed">
                        <input
                          type="number"
                          min={0}
                          value={boxesBins}
                          onChange={(e) => setBoxesBins(e.target.value)}
                          placeholder="0"
                          className={fieldInput}
                        />
                      </Field>
                    </div>

                    <Field label="Add-Ons">
                      <div className="space-y-2">
                        {ADDON_OPTIONS.map((addon) => (
                          <label
                            key={addon.value}
                            className="flex items-center gap-2.5 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={addOns.has(addon.value)}
                              onChange={() =>
                                setAddOns((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(addon.value))
                                    next.delete(addon.value);
                                  else next.add(addon.value);
                                  return next;
                                })
                              }
                              className="accent-[var(--gold)] w-3.5 h-3.5"
                            />
                            <span className="text-[12px] text-[var(--tx)]">
                              {addon.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </Field>
                  </div>
                </AnimatedSection>

                {/* Office-only detail fields */}
                <AnimatedSection show={moveType === "office"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Office / Commercial Details
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Field label="Square Footage">
                        <input
                          type="number"
                          min={0}
                          value={squareFootage}
                          onChange={(e) => setSquareFootage(e.target.value)}
                          placeholder="e.g. 2500"
                          className={`${fieldInput} min-w-0`}
                        />
                      </Field>
                      <Field label="Workstations">
                        <input
                          type="number"
                          min={0}
                          value={workstationCount}
                          onChange={(e) => setWorkstationCount(e.target.value)}
                          placeholder="e.g. 20"
                          className={`${fieldInput} min-w-0`}
                        />
                      </Field>
                      <Field label="Timing Preference">
                        <select
                          value={timingPreference}
                          onChange={(e) => setTimingPreference(e.target.value)}
                          className={`${fieldInput} min-w-0`}
                        >
                          <option value="">Select…</option>
                          {TIMING_PREFERENCES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          IT Equipment
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hasItEquipment}
                          onClick={() => setHasItEquipment(!hasItEquipment)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${hasItEquipment ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasItEquipment ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <AnimatedSection show={hasItEquipment}>
                        <div className="space-y-2 pt-1">
                          <Field label="IT Detail">
                            <textarea
                              value={itDetail}
                              onChange={(e) => setItDetail(e.target.value)}
                              rows={3}
                              placeholder="Describe server racks, networking, printers…"
                              className={`${fieldInput} resize-none`}
                            />
                          </Field>
                          <Field label="IT Disconnect / Reconnect">
                            <select
                              value={itDisconnect}
                              onChange={(e) => setItDisconnect(e.target.value)}
                              className={fieldInput}
                            >
                              <option value="">Select…</option>
                              {IT_DISCONNECT_OPTIONS.map((o) => (
                                <option key={o} value={o}>
                                  {o}
                                </option>
                              ))}
                            </select>
                          </Field>
                        </div>
                      </AnimatedSection>
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Conference Room
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hasConferenceRoom}
                          onClick={() =>
                            setHasConferenceRoom(!hasConferenceRoom)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${hasConferenceRoom ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasConferenceRoom ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Reception Area
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={hasReceptionArea}
                          onClick={() => setHasReceptionArea(!hasReceptionArea)}
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${hasReceptionArea ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasReceptionArea ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Building COI Required
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={buildingCoiRequired}
                          onClick={() =>
                            setBuildingCoiRequired(!buildingCoiRequired)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${buildingCoiRequired ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${buildingCoiRequired ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Site Assessment">
                        <select
                          value={siteAssessment}
                          onChange={(e) => setSiteAssessment(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {SITE_ASSESSMENT_OPTIONS.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>

                    <Field label="Phasing Notes">
                      <textarea
                        value={phasingNotes}
                        onChange={(e) => setPhasingNotes(e.target.value)}
                        rows={3}
                        placeholder="Multi-day phasing plan, after-hours notes…"
                        className={`${fieldInput} resize-none`}
                      />
                    </Field>
                  </div>
                </AnimatedSection>

                {/* Single Item: after-address fields */}
                <AnimatedSection show={moveType === "single_item"}>
                  <div className="space-y-3">
                    <h3 className="text-[11px] font-bold tracking-[0.08em] uppercase text-[var(--tx2)]">
                      Handling & Assembly
                    </h3>
                    <div className="flex flex-wrap items-end gap-3">
                      <Field label="Assembly">
                        <select
                          value={siAssemblyNeeded}
                          onChange={(e) => setSiAssemblyNeeded(e.target.value)}
                          className={`${fieldInput} min-w-0`}
                        >
                          <option value="">Select…</option>
                          {ASSEMBLY_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold text-[var(--tx2)]">
                            Stair Carry
                          </span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={siStairCarry}
                            onClick={() => setSiStairCarry(!siStairCarry)}
                            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${siStairCarry ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                          >
                            <span
                              className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${siStairCarry ? "translate-x-4" : ""}`}
                            />
                          </button>
                        </div>
                        {siStairCarry && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[9px] font-bold uppercase text-[var(--tx3)]">
                              Flights
                            </span>
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={siStairFlights}
                              onChange={(e) =>
                                setSiStairFlights(e.target.value)
                              }
                              className={`${fieldInput} w-14 py-1`}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </AnimatedSection>

                {/* White Glove: after-address fields */}
                <AnimatedSection show={moveType === "white_glove"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      White Glove, Service Details
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Assembly Required">
                        <select
                          value={wgAssemblyRequired}
                          onChange={(e) =>
                            setWgAssemblyRequired(e.target.value)
                          }
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {WG_ASSEMBLY_OPTIONS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      </Field>
                    </div>
                    <Field label="Placement Specification">
                      <textarea
                        value={wgPlacementSpec}
                        onChange={(e) => setWgPlacementSpec(e.target.value)}
                        rows={3}
                        placeholder="Exact room, wall, position…"
                        className={`${fieldInput} resize-none`}
                      />
                    </Field>
                    <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-medium text-[var(--tx)]">
                            Packaging Removal
                          </span>
                          <p className="text-[9px] text-[var(--tx3)]">
                            Remove all packaging on-site
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wgPackagingRemoval}
                          onClick={() =>
                            setWgPackagingRemoval(!wgPackagingRemoval)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors ${wgPackagingRemoval ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgPackagingRemoval ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-[11px] font-medium text-[var(--tx)]">
                            Photo Documentation
                          </span>
                          <p className="text-[9px] text-[var(--tx3)]">
                            Before, during, after photos
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wgPhotoDocumentation}
                          onClick={() =>
                            setWgPhotoDocumentation(!wgPhotoDocumentation)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors ${wgPhotoDocumentation ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgPhotoDocumentation ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2">
                        <div>
                          <span className="text-[11px] font-medium text-[var(--tx)]">
                            Enhanced Insurance
                          </span>
                          <p className="text-[9px] text-[var(--tx3)]">
                            Full replacement value, recommended for items
                            &gt;$5K
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={wgEnhancedInsurance}
                          onClick={() =>
                            setWgEnhancedInsurance(!wgEnhancedInsurance)
                          }
                          className={`relative w-9 h-5 rounded-full transition-colors ${wgEnhancedInsurance ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgEnhancedInsurance ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                  </div>
                </AnimatedSection>

                {/* Specialty: after-address fields */}
                <AnimatedSection show={moveType === "specialty"}>
                  <div className="space-y-2">
                    <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                      Specialty, Logistics
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <Field label="Timeline">
                        <select
                          value={spTimeline}
                          onChange={(e) => setSpTimeline(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {TIMELINE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Site Assessment">
                        <select
                          value={spSiteAssessment}
                          onChange={(e) => setSpSiteAssessment(e.target.value)}
                          className={fieldInput}
                        >
                          <option value="">Select…</option>
                          {SITE_ASSESSMENT_OPTIONS.concat(["Required"]).map(
                            (s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ),
                          )}
                        </select>
                      </Field>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-x-3 gap-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Custom Crating Needed
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={spCustomCrating}
                          onClick={() => setSpCustomCrating(!spCustomCrating)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${spCustomCrating ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spCustomCrating ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-medium text-[var(--tx)]">
                          Climate Control Required
                        </span>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={spClimateControl}
                          onClick={() => setSpClimateControl(!spClimateControl)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${spClimateControl ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spClimateControl ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center justify-between sm:col-span-2">
                        <div>
                          <span className="text-[11px] font-medium text-[var(--tx)]">
                            Insurance Rider
                          </span>
                          <p className="text-[9px] text-[var(--tx3)]">
                            Fine art or high-value rider
                          </p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={spInsuranceRider}
                          onClick={() => setSpInsuranceRider(!spInsuranceRider)}
                          className={`relative w-9 h-5 rounded-full transition-colors ${spInsuranceRider ? "bg-[var(--admin-primary-fill)]" : "bg-[var(--brd)]"}`}
                        >
                          <span
                            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spInsuranceRider ? "translate-x-4" : ""}`}
                          />
                        </button>
                      </div>
                    </div>
                    <Field label="Special Equipment">
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {SPECIAL_EQUIPMENT_PRESETS.map((item) => (
                          <button
                            key={item}
                            type="button"
                            onClick={() =>
                              setSpSpecialEquipment((prev) =>
                                prev.includes(item)
                                  ? prev.filter((i) => i !== item)
                                  : [...prev, item],
                              )
                            }
                            className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors ${
                              spSpecialEquipment.includes(item)
                                ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]"
                                : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"
                            }`}
                          >
                            {item}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={spCustomEquipmentInput}
                          onChange={(e) =>
                            setSpCustomEquipmentInput(e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (
                              e.key === "Enter" &&
                              spCustomEquipmentInput.trim()
                            ) {
                              e.preventDefault();
                              if (
                                !spSpecialEquipment.includes(
                                  spCustomEquipmentInput.trim(),
                                )
                              ) {
                                setSpSpecialEquipment((prev) => [
                                  ...prev,
                                  spCustomEquipmentInput.trim(),
                                ]);
                              }
                              setSpCustomEquipmentInput("");
                            }
                          }}
                          placeholder="Add custom equipment (press Enter)"
                          className={`flex-1 ${fieldInput}`}
                        />
                      </div>
                      {spSpecialEquipment.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {spSpecialEquipment.map((item) => (
                            <span
                              key={item}
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                            >
                              {item}
                              <button
                                type="button"
                                onClick={() =>
                                  setSpSpecialEquipment((prev) =>
                                    prev.filter((i) => i !== item),
                                  )
                                }
                                className="hover:text-[var(--red)]"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </Field>
                  </div>
                </AnimatedSection>
              </>
            )}
            {flowStep === 2 && (
              <>
                <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

                {/* Schedule & estimate */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <Field label="Scheduled Date">
                    <input
                      type="date"
                      name="scheduled_date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className={fieldInput}
                    />
                  </Field>
                  <Field label="Scheduled Time">
                    <select
                      name="scheduled_time"
                      value={scheduledTime}
                      onChange={(e) => setScheduledTime(e.target.value)}
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
                  <Field label="Arrival Window">
                    <select
                      name="arrival_window"
                      value={arrivalWindow}
                      onChange={(e) => setArrivalWindow(e.target.value)}
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
                  <Field label="Estimate ($)">
                    <input
                      type="text"
                      name="estimate"
                      value={estimate}
                      onChange={(e) => setEstimate(e.target.value)}
                      onBlur={() => {
                        const n = parseNumberInput(estimate);
                        if (n > 0) setEstimate(formatNumberInput(n));
                      }}
                      placeholder="1,234.00"
                      inputMode="decimal"
                      className={fieldInput}
                    />
                  </Field>
                </div>

                <div className="border-t border-[var(--brd)]/30 pt-3 pb-3" />

                {/* Crew / team */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Move Team
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <Field label="Crew">
                      <select
                        name="crew_id"
                        value={crewId}
                        onChange={(e) => setCrewId(e.target.value)}
                        className={fieldInput}
                      >
                        <option value="">Select crew…</option>
                        {crews.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Vehicle">
                      <select
                        name="truck_primary"
                        value={truckPrimary}
                        onChange={(e) => setTruckPrimary(e.target.value)}
                        className={fieldInput}
                      >
                        <option value="">Auto-assign by size…</option>
                        <option value="sprinter">Sprinter Van</option>
                        <option value="16ft">16ft Box Truck</option>
                        <option value="20ft">20ft Box Truck</option>
                        <option value="24ft">24ft Box Truck</option>
                        <option value="26ft">26ft Box Truck</option>
                      </select>
                    </Field>
                    <Field label="Est. Crew Size *">
                      <select
                        value={estCrewSize}
                        onChange={(e) => setEstCrewSize(e.target.value)}
                        className={fieldInput}
                        required
                      >
                        {[2, 3, 4, 5, 6].map((n) => (
                          <option key={n} value={n}>
                            {n} crew members
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Est. Hours *">
                      <select
                        value={estHours}
                        onChange={(e) => setEstHours(e.target.value)}
                        className={fieldInput}
                        required
                      >
                        {[
                          2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7, 8, 9, 10, 12,
                        ].map((h) => (
                          <option key={h} value={h}>
                            {h} hrs
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                  <Field label="Team Members">
                    {selectedCrewMembers.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedCrewMembers.map((m) => (
                          <label
                            key={m}
                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--brd)] cursor-pointer hover:border-[#2C3E2D]/40 transition-colors"
                          >
                            <input
                              type="checkbox"
                              checked={teamMembers.has(m)}
                              onChange={() => toggleTeamMember(m)}
                              className="accent-[#2C3E2D]"
                            />
                            <span className="text-[11px]">{m}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-[var(--tx3)]">
                        Select a crew above to see and assign members.
                      </p>
                    )}
                  </Field>
                </div>

                {moveType !== "specialty" &&
                  moveType !== "event" &&
                  moveType !== "labour_only" && (
                    <>
                      <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />
                      {/* Inventory */}
                      {itemWeights.length > 0 ? (
                        <InventoryInput
                          itemWeights={itemWeights}
                          value={inventoryItems}
                          onChange={setInventoryItems}
                          moveSize={moveSize}
                          fromAccess={fromAccess}
                          toAccess={toAccess}
                          showLabourEstimate={!!moveSize}
                          boxCount={boxCount}
                          onBoxCountChange={setBoxCount}
                          mode={
                            moveType === "office" ? "commercial" : "residential"
                          }
                        />
                      ) : (
                        <div className="space-y-2">
                          <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                            Client Inventory (optional)
                          </h3>
                          <p className="text-[10px] text-[var(--tx3)]">
                            Add items from the move detail page after creating.
                          </p>
                        </div>
                      )}
                      <div className="border-t border-[var(--brd)]/30 pt-3 pb-3" />
                    </>
                  )}

                {/* Documents */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Documents & Invoices (optional)
                  </h3>
                  <p className="text-[10px] text-[var(--tx3)]">
                    Upload PDFs now or add them later from the move detail page.
                  </p>
                  {docFiles.length > 0 && (
                    <ul className="space-y-1.5 mb-2">
                      {docFiles.map((f, idx) => (
                        <li
                          key={idx}
                          className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)]"
                        >
                          <FileText className="w-[12px] h-[12px] text-[var(--tx3)]" />
                          <span className="text-[11px] truncate flex-1">
                            {f.name}
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDoc(idx)}
                            className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                          >
                            <Trash2
                              weight="regular"
                              className="w-[12px] h-[12px]"
                            />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div>
                    <input
                      id="move-doc-upload"
                      type="file"
                      accept=".pdf,image/*,application/pdf"
                      onChange={handleDocChange}
                      multiple
                      className="hidden"
                    />
                    <label
                      htmlFor="move-doc-upload"
                      className="admin-btn admin-btn-sm admin-btn-primary cursor-pointer"
                    >
                      <Plus weight="regular" className="w-[12px] h-[12px]" />
                      Upload PDF
                    </label>
                  </div>
                </div>
              </>
            )}
            {flowStep === 3 && (
              <>
                <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

                {/* Complexity indicators */}
                <div className="space-y-2">
                  <h3 className="text-[10px] font-bold tracking-[0.14em] uppercase text-[var(--tx3)]">
                    Complexity Indicators
                  </h3>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {COMPLEXITY_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() =>
                          setComplexityIndicators((prev) =>
                            prev.includes(preset)
                              ? prev.filter((p) => p !== preset)
                              : [...prev, preset],
                          )
                        }
                        className={`px-2.5 py-1 rounded-md text-[9px] font-semibold border transition-colors ${complexityIndicators.includes(preset) ? "bg-[var(--admin-primary-fill)] text-[var(--btn-text-on-accent)] border-[var(--admin-primary-fill)]" : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--admin-primary-fill)]/40"}`}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={customComplexity}
                      onChange={(e) => setCustomComplexity(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && customComplexity.trim()) {
                          e.preventDefault();
                          setComplexityIndicators((prev) =>
                            prev.includes(customComplexity.trim())
                              ? prev
                              : [...prev, customComplexity.trim()],
                          );
                          setCustomComplexity("");
                        }
                      }}
                      placeholder="Add custom (press Enter)"
                      className={`flex-1 ${fieldInput}`}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (
                          customComplexity.trim() &&
                          !complexityIndicators.includes(
                            customComplexity.trim(),
                          )
                        ) {
                          setComplexityIndicators((prev) => [
                            ...prev,
                            customComplexity.trim(),
                          ]);
                          setCustomComplexity("");
                        }
                      }}
                      className="px-3 py-2 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[#2C3E2D]/45"
                    >
                      Add
                    </button>
                  </div>
                  {complexityIndicators.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {complexityIndicators.map((ind) => (
                        <span
                          key={ind}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9px] font-semibold border border-[var(--brd)] text-[var(--tx2)]"
                        >
                          {ind}
                          <button
                            type="button"
                            onClick={() =>
                              setComplexityIndicators((prev) =>
                                prev.filter((p) => p !== ind),
                              )
                            }
                            className="hover:text-[var(--red)]"
                            aria-label={`Remove ${ind}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

                {/* Notes */}
                <div className="grid sm:grid-cols-2 gap-2">
                  <Field label="Access Notes">
                    <textarea
                      name="access_notes"
                      value={accessNotes}
                      onChange={(e) => setAccessNotes(e.target.value)}
                      rows={4}
                      placeholder="Elevator, parking, building access, loading"
                      className={`${fieldInput} resize-none min-h-[88px]`}
                    />
                  </Field>
                  <Field label="Internal Notes">
                    <textarea
                      name="internal_notes"
                      value={internalNotes}
                      onChange={(e) => setInternalNotes(e.target.value)}
                      rows={4}
                      placeholder="Internal notes for coordinators"
                      className={`${fieldInput} resize-none min-h-[88px]`}
                    />
                  </Field>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-6 mt-6 border-t border-[var(--brd)]/50">
            {flowStep > 0 ? (
              <button
                type="button"
                onClick={handleFlowBack}
                className="flex-1 py-2.5 rounded-lg text-[11px] font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[#2C3E2D]/45 hover:text-[var(--tx)] transition-colors"
              >
                Back
              </button>
            ) : (
              <button
                type="button"
                onClick={() => router.back()}
                className="admin-btn admin-btn-secondary flex-1"
              >
                Cancel
              </button>
            )}
            {flowStep < 3 ? (
              <button
                type="button"
                onClick={handleFlowContinue}
                className="admin-btn admin-btn-secondary flex-1"
              >
                Continue
                <CaretRight className="w-3.5 h-3.5" weight="bold" aria-hidden />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void submitCreateMove();
                }}
                disabled={loading || !createMoveUnlocked}
                className="admin-btn admin-btn-primary flex-1 disabled:pointer-events-none disabled:opacity-50"
              >
                {loading ? "Creating…" : "Create Move"}
              </button>
            )}
          </div>
        </form>
      </div>
    </>
  );
}

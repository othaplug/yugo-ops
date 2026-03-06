"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import BackButton from "../../components/BackButton";
import { useToast } from "../../components/Toast";
import { TIME_WINDOW_OPTIONS } from "@/lib/time-windows";
import { formatNumberInput, parseNumberInput } from "@/lib/format-currency";
import { formatPhone, normalizePhone } from "@/lib/phone";
import AddressAutocomplete from "@/components/ui/AddressAutocomplete";
import { Plus, Trash2, FileText, Home, Building2, ArrowUpRight, Gem, Star, Truck } from "lucide-react";

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

const DEFAULT_ROOMS = ["Living Room", "Bedroom", "Kitchen", "Bathroom", "Office", "Other"];
const COMPLEXITY_PRESETS = ["White Glove", "Piano", "High Value Client", "Repeat Client", "Artwork", "Antiques", "Storage"];

const MOVE_SIZES = ["Studio", "1 Bedroom", "2 Bedroom", "3 Bedroom", "4 Bedroom", "5+ Bedroom", "Partial Move"];
const PACKING_OPTIONS = ["Self-pack", "Partial packing", "Full packing & unpacking"];
const SPECIALTY_ITEM_PRESETS = [
  "Piano (upright)", "Piano (grand)", "Pool table", "Safe/vault", "Hot tub",
  "Artwork", "Antiques", "Wine collection", "Gym equipment", "Motorcycle",
];
const ADDON_OPTIONS = [
  { value: "extra_truck", label: "Extra truck" },
  { value: "storage", label: "Storage" },
  { value: "junk_removal", label: "Junk removal" },
  { value: "cleaning", label: "Cleaning service" },
];
const BUSINESS_TYPES = ["Office", "Retail", "Salon/Spa", "Clinic/Medical", "Restaurant", "Warehouse", "Other"];
const IT_DISCONNECT_OPTIONS = ["Client IT team", "Yugo coordinates", "N/A"];
const TIMING_PREFERENCES = ["Weekday business hours", "Evening/night", "Weekend", "Phased multi-day"];
const SITE_ASSESSMENT_OPTIONS = ["In-person completed", "Virtual completed", "Pending", "Not needed"];

// Single Item
const ITEM_CATEGORIES = ["Standard furniture", "Large/heavy", "Fragile/specialty", "Appliance", "Multiple (2-5 items)", "Oversized"];
const WEIGHT_CLASSES = ["Under 50 lbs", "50-150 lbs", "150-300 lbs", "300-500 lbs", "Over 500 lbs"];
const ASSEMBLY_OPTIONS = ["None", "Disassembly at pickup", "Assembly at delivery", "Both"];

// White Glove
const ITEM_SOURCE_OPTIONS = ["Furniture retailer", "Private sale", "Designer", "Estate", "Self"];
const WG_ASSEMBLY_OPTIONS = ["Full assembly", "Partial", "None"];

// Specialty
const PROJECT_TYPES = ["Art installation", "Trade show", "Estate cleanout", "Home staging", "Wine transport", "Medical equipment", "Piano move", "Event setup/teardown", "Custom"];
const TIMELINE_OPTIONS = ["Half day (4hrs)", "Full day (8hrs)", "Multi-day", "TBD"];
const SPECIAL_EQUIPMENT_PRESETS = ["A-frame cart", "Crating kit", "Climate truck", "Air-ride suspension", "Lift gate", "Crane", "Custom"];

// B2B One-Off
const B2B_DELIVERY_TYPES = ["Threshold only", "Room placement", "White glove (full assembly)"];

function AnimatedSection({ show, children }: { show: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid transition-all duration-300 ease-in-out ${show ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-section font-bold tracking-wider uppercase text-[var(--tx3)] mb-1">{label}</label>
      {children}
    </div>
  );
}

const fieldInput =
  "w-full text-ui bg-[var(--bg)] border border-[var(--brd)] rounded-lg px-3 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] focus:border-[var(--gold)] outline-none transition-colors";

export default function CreateMoveForm({
  organizations,
  crews,
}: {
  organizations: Org[];
  crews: Crew[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [moveType, setMoveType] = useState<"residential" | "office" | "single_item" | "white_glove" | "specialty" | "b2b_oneoff">("residential");
  const [organizationId, setOrganizationId] = useState("");
  const [contactSearch, setContactSearch] = useState("");
  const [showContactDropdown, setShowContactDropdown] = useState(false);
  const contactDropdownRef = useRef<HTMLDivElement>(null);
  const [dbContacts, setDbContacts] = useState<{ hubspot_id: string; name: string; email: string; phone: string; address: string; postal: string }[]>([]);
  const contactSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [fromAddress, setFromAddress] = useState("");
  const [toAddress, setToAddress] = useState("");
  const [fromLat, setFromLat] = useState<number | null>(null);
  const [fromLng, setFromLng] = useState<number | null>(null);
  const [toLat, setToLat] = useState<number | null>(null);
  const [toLng, setToLng] = useState<number | null>(null);
  const [fromAccess, setFromAccess] = useState("");
  const [toAccess, setToAccess] = useState("");
  const [estimate, setEstimate] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [preferredTime, setPreferredTime] = useState("");
  const [arrivalWindow, setArrivalWindow] = useState("");
  const [accessNotes, setAccessNotes] = useState("");
  const [internalNotes, setInternalNotes] = useState("");
  const [complexityIndicators, setComplexityIndicators] = useState<string[]>([]);
  const [customComplexity, setCustomComplexity] = useState("");
  const [preferredContact, setPreferredContact] = useState("email");
  const [coordinatorName, setCoordinatorName] = useState("");
  const [crewId, setCrewId] = useState("");
  const [truckPrimary, setTruckPrimary] = useState("");
  const [inventory, setInventory] = useState<{ room: string; item_name: string }[]>([]);
  const [newRoom, setNewRoom] = useState("");
  const [newItemName, setNewItemName] = useState("");
  const [newItemQty, setNewItemQty] = useState(1);
  const [inventoryBulkMode, setInventoryBulkMode] = useState(false);
  const [inventoryBulkText, setInventoryBulkText] = useState("");
  const [teamMembers, setTeamMembers] = useState<Set<string>>(new Set());
  const selectedCrewMembers = crewId ? (crews.find((c) => c.id === crewId)?.members || []) : [];
  const [docFiles, setDocFiles] = useState<File[]>([]);

  // Residential-only state
  const [moveSize, setMoveSize] = useState("");
  const [packingService, setPackingService] = useState("");
  const [specialtyItems, setSpecialtyItems] = useState<string[]>([]);
  const [customSpecialtyInput, setCustomSpecialtyInput] = useState("");
  const [boxesBins, setBoxesBins] = useState("");
  const [addOns, setAddOns] = useState<Set<string>>(new Set());

  // Office-only state
  const [companyName, setCompanyName] = useState("");
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
  const [siItemPhotoPreview, setSiItemPhotoPreview] = useState<string | null>(null);
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

  // B2B One-Off state
  const [b2bSourceBusiness, setB2bSourceBusiness] = useState("");
  const [b2bEndCustomerName, setB2bEndCustomerName] = useState("");
  const [b2bEndCustomerPhone, setB2bEndCustomerPhone] = useState("");
  const [b2bDeliveryType, setB2bDeliveryType] = useState("");
  const [b2bItemDetails, setB2bItemDetails] = useState("");
  const [b2bNumberOfItems, setB2bNumberOfItems] = useState("1");

  const filteredOrgs = organizations.filter((o) => {
    const term = contactSearch.toLowerCase();
    return (
      (o.name?.toLowerCase().includes(term) ||
        o.email?.toLowerCase().includes(term) ||
        o.phone?.toLowerCase().includes(term) ||
        o.contact_name?.toLowerCase().includes(term))
    );
  });

  const duplicateEmailMatch =
    clientEmail?.trim() &&
    !organizationId &&
    organizations.find((o) => o.email?.toLowerCase().trim() === clientEmail.trim().toLowerCase());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contactDropdownRef.current && !contactDropdownRef.current.contains(e.target as Node)) {
        setShowContactDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Debounced contact search from contacts table
  useEffect(() => {
    if (contactSearchTimerRef.current) clearTimeout(contactSearchTimerRef.current);
    if (!contactSearch || contactSearch.length < 2) { setDbContacts([]); return; }
    contactSearchTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/contacts/search?q=${encodeURIComponent(contactSearch)}`);
        if (res.ok) {
          const data = await res.json();
          setDbContacts(data.contacts || []);
        }
      } catch {}
    }, 300);
    return () => { if (contactSearchTimerRef.current) clearTimeout(contactSearchTimerRef.current); };
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

  const addInventoryItem = () => {
    if (!newItemName.trim() || !newRoom) return;
    const name = newItemName.trim();
    const itemName = newItemQty > 1 ? `${name} x${newItemQty}` : name;
    setInventory((prev) => [...prev, { room: newRoom, item_name: itemName }]);
    setNewItemName("");
    setNewItemQty(1);
  };

  const removeInventoryItem = (idx: number) => {
    setInventory((prev) => prev.filter((_, i) => i !== idx));
  };

  const parseBulkInventoryLines = (text: string): string[] => {
    return text
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const m = line.match(/^(.+?)\s+x(\d+)$/i);
        return m ? `${m[1].trim()} x${m[2]}` : line;
      });
  };

  const addBulkInventoryItems = () => {
    if (!newRoom || !inventoryBulkText.trim()) return;
    const itemNames = parseBulkInventoryLines(inventoryBulkText);
    if (itemNames.length === 0) return;
    const newItems = itemNames.map((item_name) => ({ room: newRoom, item_name }));
    setInventory((prev) => [...prev, ...newItems]);
    setInventoryBulkText("");
  };

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setDocFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removeDoc = (idx: number) => {
    setDocFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!clientName.trim()) {
      alert("Please fill in client name.");
      return;
    }
    if (!fromAddress.trim()) {
      alert("Please fill in the pickup (from) address.");
      return;
    }
    if (!toAddress.trim()) {
      alert("Please fill in the delivery (to) address.");
      return;
    }

    // If no client selected, check for existing match and auto-link
    if (!organizationId) {
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
        const checkData = await checkRes.json();
        if (checkData.exists && checkData.org?.id) {
          setOrganizationId(checkData.org.id);
        }
      } catch {}
    }

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("move_type", moveType);
      formData.append("organization_id", organizationId);
      formData.append("from_access", fromAccess);
      formData.append("to_access", toAccess);
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
      formData.append("preferred_time", preferredTime);
      formData.append("arrival_window", arrivalWindow);
      formData.append("access_notes", accessNotes);
      formData.append("internal_notes", internalNotes);
      formData.append("complexity_indicators", JSON.stringify(complexityIndicators));
      formData.append("preferred_contact", preferredContact);
      formData.append("coordinator_name", coordinatorName.trim());
      formData.append("crew_id", crewId);
      formData.append("assigned_members", JSON.stringify(Array.from(teamMembers)));
      formData.append("truck_primary", truckPrimary || "");
      formData.append("inventory", JSON.stringify(inventory));
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
        formData.append("special_equipment", JSON.stringify(spSpecialEquipment));
        formData.append("insurance_rider", String(spInsuranceRider));
      }
      // B2B One-Off fields
      if (moveType === "b2b_oneoff") {
        formData.append("source_company", b2bSourceBusiness);
        formData.append("end_customer_name", b2bEndCustomerName);
        formData.append("end_customer_phone", normalizePhone(b2bEndCustomerPhone));
        formData.append("delivery_type", b2bDeliveryType);
        formData.append("item_description", b2bItemDetails);
        formData.append("number_of_items", b2bNumberOfItems);
      }
      docFiles.forEach((f) => formData.append("documents", f));

      const res = await fetch("/api/admin/moves/create", { method: "POST", body: formData });
      const data = (await res.json().catch(() => ({}))) as { id?: string; move_code?: string; error?: string; emailSent?: boolean; emailError?: string };
      if (!res.ok) throw new Error(data.error || `Failed to create move (${res.status})`);
      if (data.emailSent) {
        toast("Move created. Client notified by email.", "mail");
      } else if (data.emailError) {
        toast(`Move created. Email not sent: ${data.emailError}`, "x");
      } else {
        toast("Move created.", "check");
      }
      router.push(data.move_code ? `/admin/moves/${data.move_code}` : `/admin/moves/${data.id}`);
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to create move");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="mb-4">
        <BackButton label="Back" />
      </div>
      <div className="bg-[var(--card)] border border-[var(--brd)] rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--brd)]">
          <h1 className="font-heading text-h3-lg font-bold text-[var(--tx)]">Create New Move</h1>
          <p className="text-caption text-[var(--tx3)] mt-0.5">
            Choose a service type, then fill in the details. Select a client to auto-fill, or enter details to create a new one.
          </p>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-0">
          {/* Move type selector */}
          <div>
            <label className="block text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50 mb-2">Service Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {([
                { value: "residential", Icon: Home, label: "Residential", desc: "Local or long distance home move" },
                { value: "office", Icon: Building2, label: "Office / Commercial", desc: "Business, retail, salon, clinic relocation" },
                { value: "single_item", Icon: ArrowUpRight, label: "Single Item", desc: "One item or small batch delivery" },
                { value: "white_glove", Icon: Gem, label: "White Glove", desc: "Premium handling, assembly, placement" },
                { value: "specialty", Icon: Star, label: "Specialty / Event", desc: "Art, piano, trade show, staging, estate" },
                { value: "b2b_oneoff", Icon: Truck, label: "B2B One-Off", desc: "One-off delivery from a business source" },
              ] as const).map((card) => {
                const selected = moveType === card.value;
                return (
                  <button
                    key={card.value}
                    type="button"
                    onClick={() => setMoveType(card.value)}
                    className={`relative text-left px-4 py-3 rounded-xl border-2 transition-all ${
                      selected
                        ? "bg-[#FAF7F2] dark:bg-[#2A2520] border-[#B8962E] shadow-sm"
                        : "bg-[var(--card)] border-[var(--brd)] hover:shadow-md hover:-translate-y-0.5"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`shrink-0 mt-0.5 w-8 h-8 flex items-center justify-center rounded-lg ${selected ? "bg-[#B8962E]/15" : "bg-[var(--bg)]"}`}>
                        <card.Icon className={`w-4 h-4 ${selected ? "text-[#B8962E]" : "text-[var(--tx3)]"}`} strokeWidth={1.8} />
                      </div>
                      <div className="min-w-0">
                        <div className={`text-body leading-tight tracking-tight ${selected ? "font-extrabold text-[#B8962E]" : "font-semibold text-[var(--tx)]"}`}>
                          {card.label}
                        </div>
                        <div className={`text-label mt-0.5 leading-snug ${selected ? "text-[#B8962E]/70" : "text-[var(--tx3)]"}`}>
                          {card.desc}
                        </div>
                      </div>
                    </div>
                    {card.value === "b2b_oneoff" && (
                      <div className="mt-1.5 text-micro text-[var(--tx3)] italic pl-[44px]">For recurring partners, use B2B Partners → Create Project</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Client section */}
          <div className="space-y-3">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Client</h3>
            <Field label="Select to auto fill">
              <div ref={contactDropdownRef} className="relative">
                <input
                  type="text"
                  value={organizationId ? (organizations.find((o) => o.id === organizationId)?.contact_name || organizations.find((o) => o.id === organizationId)?.name || "") : contactSearch}
                  onChange={(e) => {
                    setContactSearch(e.target.value);
                    setOrganizationId("");
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
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx3)] hover:text-[var(--tx)] text-title"
                    aria-label="Clear selection"
                  >
                    ×
                  </button>
                )}
                {showContactDropdown && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 max-h-[240px] overflow-y-auto bg-[var(--card)] border border-[var(--brd)] rounded-lg shadow-lg">
                    {filteredOrgs.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-section font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">Partners / Organizations</div>
                        {filteredOrgs.map((o) => (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => {
                              setOrganizationId(o.id);
                              setContactSearch("");
                              setShowContactDropdown(false);
                            }}
                            className="w-full text-left px-3 py-2 text-ui text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                          >
                            {o.contact_name || o.name}
                            {o.email && <span className="text-[var(--tx3)] ml-1">— {o.email}</span>}
                          </button>
                        ))}
                      </>
                    )}
                    {dbContacts.length > 0 && (
                      <>
                        <div className="px-3 py-1.5 text-section font-bold tracking-wider uppercase text-[var(--tx3)] bg-[var(--bg)]">HubSpot Contacts</div>
                        {dbContacts.map((c) => (
                          <button
                            key={c.hubspot_id}
                            type="button"
                            onClick={() => {
                              setClientName(c.name || "");
                              setClientEmail(c.email || "");
                              setClientPhone(c.phone ? formatPhone(c.phone) : "");
                              if (c.address) setFromAddress(c.address);
                              setContactSearch("");
                              setShowContactDropdown(false);
                              setDbContacts([]);
                            }}
                            className="w-full text-left px-3 py-2 text-ui text-[var(--tx)] hover:bg-[var(--bg)] border-b border-[var(--brd)] last:border-0"
                          >
                            {c.name}
                            {c.email && <span className="text-[var(--tx3)] ml-1">— {c.email}</span>}
                            {c.phone && <span className="text-[var(--tx3)] ml-1">— {c.phone}</span>}
                          </button>
                        ))}
                      </>
                    )}
                    {filteredOrgs.length === 0 && dbContacts.length === 0 && (
                      <div className="px-3 py-2 text-caption text-[var(--tx3)]">No matches</div>
                    )}
                  </div>
                )}
              </div>
            </Field>
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="Client Name *">
                <input
                  name="client_name"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Full name"
                  required
                  className={fieldInput}
                />
              </Field>
              <Field label="Email">
                <input
                  type="email"
                  name="client_email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="client@example.com"
                  className={fieldInput}
                />
              </Field>
              <Field label="Phone">
                <input
                  type="tel"
                  name="client_phone"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  onBlur={() => setClientPhone(formatPhone(clientPhone))}
                  placeholder="(123) 456-7890"
                  className={fieldInput}
                />
              </Field>
            </div>
            {duplicateEmailMatch && (
              <div className="px-3 py-2 rounded-lg bg-[var(--org)]/15 border border-[var(--org)]/40 text-caption font-medium text-[var(--org)]">
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

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Office: Company info */}
          <AnimatedSection show={moveType === "office"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Business Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Company Name">
                  <input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Business name" className={fieldInput} />
                </Field>
                <Field label="Business Type">
                  <select value={businessType} onChange={(e) => setBusinessType(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {BUSINESS_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
            </div>
          </AnimatedSection>

          {/* Single Item: item info */}
          <AnimatedSection show={moveType === "single_item"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Item Details</h3>
              <Field label="Item Description *">
                <input value={siItemDescription} onChange={(e) => setSiItemDescription(e.target.value)} placeholder="e.g. Leather sectional sofa" className={fieldInput} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Item Category *">
                  <select value={siItemCategory} onChange={(e) => setSiItemCategory(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {ITEM_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="Estimated Weight">
                  <select value={siEstimatedWeight} onChange={(e) => setSiEstimatedWeight(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {WEIGHT_CLASSES.map((w) => <option key={w} value={w}>{w}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Item Dimensions">
                  <input value={siItemDimensions} onChange={(e) => setSiItemDimensions(e.target.value)} placeholder="L × W × H (optional)" className={fieldInput} />
                </Field>
                <Field label="Number of Items">
                  <input type="number" min={1} max={5} value={siNumberOfItems} onChange={(e) => setSiNumberOfItems(e.target.value)} className={fieldInput} />
                </Field>
              </div>
              <Field label="Item Photo">
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setSiItemPhoto(file);
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = (ev) => setSiItemPhotoPreview(ev.target?.result as string);
                        reader.readAsDataURL(file);
                      } else { setSiItemPhotoPreview(null); }
                    }}
                    className="text-caption text-[var(--tx3)] file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-label file:font-semibold file:bg-[var(--gold)] file:text-[var(--btn-text-on-accent)] file:cursor-pointer"
                  />
                  {siItemPhotoPreview && (
                    <div className="relative w-16 h-16 rounded-lg overflow-hidden border border-[var(--brd)]">
                      <img src={siItemPhotoPreview} alt="Item preview" className="w-full h-full object-cover" />
                      <button type="button" onClick={() => { setSiItemPhoto(null); setSiItemPhotoPreview(null); }} className="absolute top-0 right-0 bg-black/60 text-white w-5 h-5 flex items-center justify-center text-label rounded-bl">×</button>
                    </div>
                  )}
                </div>
              </Field>
            </div>
          </AnimatedSection>

          {/* White Glove: item info */}
          <AnimatedSection show={moveType === "white_glove"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">White Glove — Item Info</h3>
              <Field label="Item Description *">
                <input value={wgItemDescription} onChange={(e) => setWgItemDescription(e.target.value)} placeholder="Describe the item in detail" className={fieldInput} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Retail / Declared Value ($)">
                  <input
                    type="text"
                    value={wgDeclaredValue}
                    onChange={(e) => setWgDeclaredValue(e.target.value)}
                    onBlur={() => { const n = parseNumberInput(wgDeclaredValue); if (n > 0) setWgDeclaredValue(formatNumberInput(n)); }}
                    placeholder="For insurance — required for items over $2,000"
                    inputMode="decimal"
                    className={fieldInput}
                  />
                </Field>
                <Field label="Item Source">
                  <select value={wgItemSource} onChange={(e) => setWgItemSource(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {ITEM_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Source Company">
                <input value={wgSourceCompany} onChange={(e) => setWgSourceCompany(e.target.value)} placeholder="If from a retailer — helps track B2B potential" className={fieldInput} />
              </Field>
            </div>
          </AnimatedSection>

          {/* Specialty: project info */}
          <AnimatedSection show={moveType === "specialty"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty / Event Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Project Type *">
                  <select value={spProjectType} onChange={(e) => setSpProjectType(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Number of Items / Pieces">
                  <input type="number" min={1} value={spNumberOfPieces} onChange={(e) => setSpNumberOfPieces(e.target.value)} placeholder="1" className={fieldInput} />
                </Field>
              </div>
              <Field label="Project Description *">
                <textarea value={spProjectDescription} onChange={(e) => setSpProjectDescription(e.target.value)} rows={4} placeholder="Describe scope, requirements, special considerations…" className={`${fieldInput} resize-none min-h-[88px]`} />
              </Field>
            </div>
          </AnimatedSection>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* B2B One-Off: business info */}
          <AnimatedSection show={moveType === "b2b_oneoff"}>
            <div className="space-y-3">
              <div className="px-3 py-2 rounded-lg bg-[var(--gold)]/10 border border-[var(--gold)]/30 text-caption text-[var(--gold)]">
                For one-off business deliveries. For recurring partner deliveries, use <span className="font-bold">B2B Partners → Create Project</span>.
              </div>
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">B2B One-Off Delivery</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Source Business Name">
                  <input value={b2bSourceBusiness} onChange={(e) => setB2bSourceBusiness(e.target.value)} placeholder="Company the item is coming from" className={fieldInput} />
                </Field>
                <Field label="Delivery Type">
                  <select value={b2bDeliveryType} onChange={(e) => setB2bDeliveryType(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {B2B_DELIVERY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="End Customer Name">
                  <input value={b2bEndCustomerName} onChange={(e) => setB2bEndCustomerName(e.target.value)} placeholder="Person receiving the delivery" className={fieldInput} />
                </Field>
                <Field label="End Customer Phone">
                  <input type="tel" value={b2bEndCustomerPhone} onChange={(e) => setB2bEndCustomerPhone(e.target.value)} onBlur={() => setB2bEndCustomerPhone(formatPhone(b2bEndCustomerPhone))} placeholder="(123) 456-7890" className={fieldInput} />
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Number of Items">
                  <input type="number" min={1} value={b2bNumberOfItems} onChange={(e) => setB2bNumberOfItems(e.target.value)} className={fieldInput} />
                </Field>
              </div>
              <Field label="Item Details">
                <textarea value={b2bItemDetails} onChange={(e) => setB2bItemDetails(e.target.value)} rows={3} placeholder="Describe items, dimensions, special handling…" className={`${fieldInput} resize-none`} />
              </Field>
            </div>
          </AnimatedSection>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Addresses */}
          <div className="space-y-2">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Addresses</h3>
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 items-end">
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
                    label="From Address"
                    required
                    className={fieldInput}
                  />
                </div>
                <div className="w-full sm:w-[140px]">
                  <Field label="Access">
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
                    <option value="Gate / Buzz code">Gate / Buzz code</option>
                    <option value="Ground floor">Ground floor</option>
                    <option value="Building access required">Building access required</option>
                  </select>
                  </Field>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-3 items-end">
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
                    label="To Address"
                    required
                    className={fieldInput}
                  />
                </div>
                <div className="w-full sm:w-[140px]">
                  <Field label="Access">
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
                    <option value="Gate / Buzz code">Gate / Buzz code</option>
                    <option value="Ground floor">Ground floor</option>
                    <option value="Building access required">Building access required</option>
                  </select>
                  </Field>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Residential-only fields */}
          <AnimatedSection show={moveType === "residential"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Residential Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Move Size">
                  <select value={moveSize} onChange={(e) => setMoveSize(e.target.value)} className={fieldInput}>
                    <option value="">Select size…</option>
                    {MOVE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Packing Service">
                  <select value={packingService} onChange={(e) => setPackingService(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {PACKING_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Specialty Items">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SPECIALTY_ITEM_PRESETS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSpecialtyItems((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item])}
                      className={`px-2.5 py-1 rounded-full text-section font-semibold border transition-colors ${
                        specialtyItems.includes(item)
                          ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
                          : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={customSpecialtyInput}
                    onChange={(e) => setCustomSpecialtyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && customSpecialtyInput.trim()) {
                        e.preventDefault();
                        if (!specialtyItems.includes(customSpecialtyInput.trim())) {
                          setSpecialtyItems((prev) => [...prev, customSpecialtyInput.trim()]);
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
                      <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-section font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                        {item}
                        <button type="button" onClick={() => setSpecialtyItems((prev) => prev.filter((i) => i !== item))} className="hover:text-[var(--red)]">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Boxes / Bins Needed">
                  <input type="number" min={0} value={boxesBins} onChange={(e) => setBoxesBins(e.target.value)} placeholder="0" className={fieldInput} />
                </Field>
              </div>

              <Field label="Add-Ons">
                <div className="space-y-2">
                  {ADDON_OPTIONS.map((addon) => (
                    <label key={addon.value} className="flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addOns.has(addon.value)}
                        onChange={() => setAddOns((prev) => {
                          const next = new Set(prev);
                          if (next.has(addon.value)) next.delete(addon.value); else next.add(addon.value);
                          return next;
                        })}
                        className="accent-[var(--gold)] w-3.5 h-3.5"
                      />
                      <span className="text-ui text-[var(--tx)]">{addon.label}</span>
                    </label>
                  ))}
                </div>
              </Field>
            </div>
          </AnimatedSection>

          {/* Office-only detail fields */}
          <AnimatedSection show={moveType === "office"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Office / Commercial Details</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Square Footage">
                  <input type="number" min={0} value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} placeholder="e.g. 2500" className={fieldInput} />
                </Field>
                <Field label="Number of Workstations">
                  <input type="number" min={0} value={workstationCount} onChange={(e) => setWorkstationCount(e.target.value)} placeholder="e.g. 20" className={fieldInput} />
                </Field>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">IT Equipment</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={hasItEquipment}
                    onClick={() => setHasItEquipment(!hasItEquipment)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${hasItEquipment ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasItEquipment ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <AnimatedSection show={hasItEquipment}>
                  <div className="space-y-3 pt-1">
                    <Field label="IT Detail">
                      <textarea value={itDetail} onChange={(e) => setItDetail(e.target.value)} rows={3} placeholder="Describe server racks, networking, printers…" className={`${fieldInput} resize-none`} />
                    </Field>
                    <Field label="IT Disconnect / Reconnect">
                      <select value={itDisconnect} onChange={(e) => setItDisconnect(e.target.value)} className={fieldInput}>
                        <option value="">Select…</option>
                        {IT_DISCONNECT_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </Field>
                  </div>
                </AnimatedSection>
              </div>

              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Conference Room</span>
                  <button type="button" role="switch" aria-checked={hasConferenceRoom} onClick={() => setHasConferenceRoom(!hasConferenceRoom)} className={`relative w-9 h-5 rounded-full transition-colors ${hasConferenceRoom ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasConferenceRoom ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Reception Area</span>
                  <button type="button" role="switch" aria-checked={hasReceptionArea} onClick={() => setHasReceptionArea(!hasReceptionArea)} className={`relative w-9 h-5 rounded-full transition-colors ${hasReceptionArea ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${hasReceptionArea ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Building COI Required</span>
                  <button type="button" role="switch" aria-checked={buildingCoiRequired} onClick={() => setBuildingCoiRequired(!buildingCoiRequired)} className={`relative w-9 h-5 rounded-full transition-colors ${buildingCoiRequired ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${buildingCoiRequired ? "translate-x-4" : ""}`} />
                  </button>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Timing Preference">
                  <select value={timingPreference} onChange={(e) => setTimingPreference(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {TIMING_PREFERENCES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Site Assessment">
                  <select value={siteAssessment} onChange={(e) => setSiteAssessment(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {SITE_ASSESSMENT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>

              <Field label="Phasing Notes">
                <textarea value={phasingNotes} onChange={(e) => setPhasingNotes(e.target.value)} rows={3} placeholder="Multi-day phasing plan, after-hours notes…" className={`${fieldInput} resize-none`} />
              </Field>
            </div>
          </AnimatedSection>

          {/* Single Item: after-address fields */}
          <AnimatedSection show={moveType === "single_item"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Handling & Assembly</h3>
              <Field label="Assembly Needed">
                <select value={siAssemblyNeeded} onChange={(e) => setSiAssemblyNeeded(e.target.value)} className={fieldInput}>
                  <option value="">Select…</option>
                  {ASSEMBLY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Stair Carry</span>
                  <button type="button" role="switch" aria-checked={siStairCarry} onClick={() => setSiStairCarry(!siStairCarry)} className={`relative w-9 h-5 rounded-full transition-colors ${siStairCarry ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${siStairCarry ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <AnimatedSection show={siStairCarry}>
                  <div className="pt-1">
                    <Field label="Number of Flights">
                      <input type="number" min={1} max={10} value={siStairFlights} onChange={(e) => setSiStairFlights(e.target.value)} className={fieldInput} />
                    </Field>
                  </div>
                </AnimatedSection>
              </div>
            </div>
          </AnimatedSection>

          {/* White Glove: after-address fields */}
          <AnimatedSection show={moveType === "white_glove"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">White Glove — Service Details</h3>
              <Field label="Assembly Required">
                <select value={wgAssemblyRequired} onChange={(e) => setWgAssemblyRequired(e.target.value)} className={fieldInput}>
                  <option value="">Select…</option>
                  {WG_ASSEMBLY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Placement Specification">
                <textarea value={wgPlacementSpec} onChange={(e) => setWgPlacementSpec(e.target.value)} rows={3} placeholder="Exact room, wall, position…" className={`${fieldInput} resize-none`} />
              </Field>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-caption font-medium text-[var(--tx)]">Packaging Removal</span>
                    <p className="text-section text-[var(--tx3)]">Remove all packaging on-site</p>
                  </div>
                  <button type="button" role="switch" aria-checked={wgPackagingRemoval} onClick={() => setWgPackagingRemoval(!wgPackagingRemoval)} className={`relative w-9 h-5 rounded-full transition-colors ${wgPackagingRemoval ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgPackagingRemoval ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-caption font-medium text-[var(--tx)]">Photo Documentation</span>
                    <p className="text-section text-[var(--tx3)]">Before, during, after photos</p>
                  </div>
                  <button type="button" role="switch" aria-checked={wgPhotoDocumentation} onClick={() => setWgPhotoDocumentation(!wgPhotoDocumentation)} className={`relative w-9 h-5 rounded-full transition-colors ${wgPhotoDocumentation ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgPhotoDocumentation ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <div>
                    <span className="text-caption font-medium text-[var(--tx)]">Enhanced Insurance</span>
                    <p className="text-section text-[var(--tx3)]">Full replacement value — recommended for items &gt;$5K</p>
                  </div>
                  <button type="button" role="switch" aria-checked={wgEnhancedInsurance} onClick={() => setWgEnhancedInsurance(!wgEnhancedInsurance)} className={`relative w-9 h-5 rounded-full transition-colors ${wgEnhancedInsurance ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${wgEnhancedInsurance ? "translate-x-4" : ""}`} />
                  </button>
                </div>
              </div>
            </div>
          </AnimatedSection>

          {/* Specialty: after-address fields */}
          <AnimatedSection show={moveType === "specialty"}>
            <div className="space-y-3">
              <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Specialty — Logistics</h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label="Timeline">
                  <select value={spTimeline} onChange={(e) => setSpTimeline(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {TIMELINE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </Field>
                <Field label="Site Assessment">
                  <select value={spSiteAssessment} onChange={(e) => setSpSiteAssessment(e.target.value)} className={fieldInput}>
                    <option value="">Select…</option>
                    {SITE_ASSESSMENT_OPTIONS.concat(["Required"]).map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </Field>
              </div>
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Custom Crating Needed</span>
                  <button type="button" role="switch" aria-checked={spCustomCrating} onClick={() => setSpCustomCrating(!spCustomCrating)} className={`relative w-9 h-5 rounded-full transition-colors ${spCustomCrating ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spCustomCrating ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-caption font-medium text-[var(--tx)]">Climate Control Required</span>
                  <button type="button" role="switch" aria-checked={spClimateControl} onClick={() => setSpClimateControl(!spClimateControl)} className={`relative w-9 h-5 rounded-full transition-colors ${spClimateControl ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spClimateControl ? "translate-x-4" : ""}`} />
                  </button>
                </div>
                <div className="flex items-center justify-between sm:col-span-2">
                  <div>
                    <span className="text-caption font-medium text-[var(--tx)]">Insurance Rider</span>
                    <p className="text-section text-[var(--tx3)]">Fine art or high-value rider</p>
                  </div>
                  <button type="button" role="switch" aria-checked={spInsuranceRider} onClick={() => setSpInsuranceRider(!spInsuranceRider)} className={`relative w-9 h-5 rounded-full transition-colors ${spInsuranceRider ? "bg-[var(--gold)]" : "bg-[var(--brd)]"}`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${spInsuranceRider ? "translate-x-4" : ""}`} />
                  </button>
                </div>
              </div>
              <Field label="Special Equipment">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {SPECIAL_EQUIPMENT_PRESETS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setSpSpecialEquipment((prev) => prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item])}
                      className={`px-2.5 py-1 rounded-full text-section font-semibold border transition-colors ${
                        spSpecialEquipment.includes(item)
                          ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]"
                          : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"
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
                    onChange={(e) => setSpCustomEquipmentInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && spCustomEquipmentInput.trim()) {
                        e.preventDefault();
                        if (!spSpecialEquipment.includes(spCustomEquipmentInput.trim())) {
                          setSpSpecialEquipment((prev) => [...prev, spCustomEquipmentInput.trim()]);
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
                      <span key={item} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-section font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                        {item}
                        <button type="button" onClick={() => setSpSpecialEquipment((prev) => prev.filter((i) => i !== item))} className="hover:text-[var(--red)]">×</button>
                      </span>
                    ))}
                  </div>
                )}
              </Field>
            </div>
          </AnimatedSection>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Schedule & estimate */}
          <div className="grid sm:grid-cols-2 gap-3">
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
              <input
                type="time"
                name="scheduled_time"
                value={scheduledTime}
                onChange={(e) => setScheduledTime(e.target.value)}
                className={fieldInput}
              />
            </Field>
            <Field label="Preferred Time">
              <input
                type="time"
                name="preferred_time"
                value={preferredTime}
                onChange={(e) => setPreferredTime(e.target.value)}
                className={fieldInput}
              />
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
                  <option key={w} value={w}>{w}</option>
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

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Crew / team */}
          <div className="space-y-3">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Move Team</h3>
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
                <option value="">Auto-assign…</option>
                <option value="sprinter">Sprinter Van</option>
                <option value="16ft">16ft Box Truck</option>
                <option value="20ft">20ft Box Truck</option>
                <option value="24ft">24ft Box Truck</option>
                <option value="26ft">26ft Box Truck</option>
              </select>
            </Field>
            <Field label="Team Members">
              {selectedCrewMembers.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {selectedCrewMembers.map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[var(--brd)] cursor-pointer hover:border-[var(--gold)] transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={teamMembers.has(m)}
                        onChange={() => toggleTeamMember(m)}
                        className="accent-[var(--gold)]"
                      />
                      <span className="text-caption">{m}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="text-label text-[var(--tx3)]">Select a crew above to see and assign members.</p>
              )}
            </Field>
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Inventory */}
          <div className="space-y-3">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
              Client Inventory (optional)
            </h3>
            <p className="text-label text-[var(--tx3)]">Add items now or later from the move detail page.</p>
            {inventory.length > 0 && (
              <ul className="space-y-1.5 mb-3">
                {inventory.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--brd)]"
                  >
                    <span className="text-caption">
                      <span className="text-[var(--tx3)]">{item.room}:</span> {item.item_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeInventoryItem(idx)}
                      className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                    >
                      <Trash2 className="w-[12px] h-[12px]" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInventoryBulkMode(false)}
                  className={`text-label font-semibold px-2 py-1 rounded ${!inventoryBulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
                >
                  Single
                </button>
                <button
                  type="button"
                  onClick={() => setInventoryBulkMode(true)}
                  className={`text-label font-semibold px-2 py-1 rounded ${inventoryBulkMode ? "bg-[var(--gold)] text-[var(--btn-text-on-accent)]" : "text-[var(--tx3)] hover:text-[var(--tx)]"}`}
                >
                  Bulk add
                </button>
              </div>
              {inventoryBulkMode ? (
                <div className="flex flex-col gap-2">
                  <div>
                    <label className="block text-micro text-[var(--tx3)] mb-0.5">Room</label>
                    <select
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      className="text-caption bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                    >
                      <option value="">Select Room</option>
                      {DEFAULT_ROOMS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-micro text-[var(--tx3)] mb-0.5">Items (one per line, e.g. Couch x2)</label>
                    <textarea
                      value={inventoryBulkText}
                      onChange={(e) => setInventoryBulkText(e.target.value)}
                      placeholder={"Couch x2\nCoffee Table\nBox 1 x5"}
                      rows={4}
                      className="w-full text-caption bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)] placeholder:text-[var(--tx3)] resize-y"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addBulkInventoryItems}
                    disabled={!inventoryBulkText.trim() || !newRoom}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-label font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50 self-start"
                  >
                    <Plus className="w-[12px] h-[12px]" /> Add all
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <label className="block text-micro text-[var(--tx3)] mb-0.5">Room</label>
                    <select
                      value={newRoom}
                      onChange={(e) => setNewRoom(e.target.value)}
                      className="text-caption bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                    >
                      <option value="">Select Room</option>
                      {DEFAULT_ROOMS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-micro text-[var(--tx3)] mb-0.5">Item</label>
                    <input
                      type="text"
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addInventoryItem())}
                      placeholder="e.g. Couch x2"
                      className="w-full text-caption bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                    />
                  </div>
                  <div className="w-14">
                    <label className="block text-micro text-[var(--tx3)] mb-0.5">Qty</label>
                    <input
                      type="number"
                      min={1}
                      max={99}
                      value={newItemQty}
                      onChange={(e) => setNewItemQty(Math.max(1, Math.min(99, parseInt(e.target.value, 10) || 1)))}
                      className="w-full text-caption bg-[var(--bg)] border border-[var(--brd)] rounded px-2 py-1.5 text-[var(--tx)]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={addInventoryItem}
                    disabled={!newItemName.trim() || !newRoom}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-label font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] disabled:opacity-50"
                  >
                    <Plus className="w-[12px] h-[12px]" /> Add
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Documents */}
          <div className="space-y-3">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">
              Documents & Invoices (optional)
            </h3>
            <p className="text-label text-[var(--tx3)]">
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
                    <span className="text-caption truncate flex-1">{f.name}</span>
                    <button
                      type="button"
                      onClick={() => removeDoc(idx)}
                      className="p-1 rounded text-[var(--tx3)] hover:text-[var(--red)]"
                    >
                      <Trash2 className="w-[12px] h-[12px]" />
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-label font-semibold bg-[var(--gold)] text-[var(--btn-text-on-accent)] cursor-pointer hover:bg-[var(--gold2)]"
              >
                <Plus className="w-[12px] h-[12px]" />
                Upload PDF
              </label>
            </div>
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Complexity indicators */}
          <div className="space-y-3">
            <h3 className="text-section font-bold tracking-[0.14em] uppercase text-[var(--tx3)]/50">Complexity Indicators</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMPLEXITY_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setComplexityIndicators((prev) => (prev.includes(preset) ? prev.filter((p) => p !== preset) : [...prev, preset]))}
                  className={`px-2.5 py-1 rounded-full text-section font-semibold border transition-colors ${complexityIndicators.includes(preset) ? "bg-[var(--gold)]/20 text-[var(--gold)] border-[var(--gold)]" : "bg-[var(--bg)] text-[var(--tx2)] border-[var(--brd)] hover:border-[var(--gold)]/40"}`}
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
                    setComplexityIndicators((prev) => (prev.includes(customComplexity.trim()) ? prev : [...prev, customComplexity.trim()]));
                    setCustomComplexity("");
                  }
                }}
                placeholder="Add custom (press Enter)"
                className={`flex-1 ${fieldInput}`}
              />
              <button
                type="button"
                onClick={() => {
                  if (customComplexity.trim() && !complexityIndicators.includes(customComplexity.trim())) {
                    setComplexityIndicators((prev) => [...prev, customComplexity.trim()]);
                    setCustomComplexity("");
                  }
                }}
                className="px-3 py-2 rounded-lg text-caption font-semibold border border-[var(--brd)] text-[var(--tx)] hover:border-[var(--gold)]"
              >
                Add
              </button>
            </div>
            {complexityIndicators.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {complexityIndicators.map((ind) => (
                  <span key={ind} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-section font-semibold bg-[var(--gold)]/15 text-[var(--gold)] border border-[var(--gold)]/30">
                    {ind}
                    <button type="button" onClick={() => setComplexityIndicators((prev) => prev.filter((p) => p !== ind))} className="hover:text-[var(--red)]" aria-label={`Remove ${ind}`}>×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-[var(--brd)]/30 pt-5 pb-5" />

          {/* Notes */}
          <div className="grid sm:grid-cols-2 gap-3">
            <Field label="Access Notes">
              <textarea
                name="access_notes"
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
                rows={4}
                placeholder="Elevator, parking, building access…"
                className={`${fieldInput} resize-none min-h-[88px]`}
              />
            </Field>
            <Field label="Internal Notes">
              <textarea
                name="internal_notes"
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                rows={4}
                placeholder="Internal notes…"
                className={`${fieldInput} resize-none min-h-[88px]`}
              />
            </Field>
          </div>

          <div className="flex gap-3 pt-5 border-t border-[var(--brd)]/30">
            <button
              type="button"
              onClick={() => router.back()}
              className="flex-1 py-2.5 rounded-lg text-caption font-semibold border border-[var(--brd)] text-[var(--tx2)] hover:border-[var(--gold)] hover:text-[var(--gold)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 rounded-lg text-caption font-bold bg-[var(--gold)] text-[var(--btn-text-on-accent)] hover:bg-[var(--gold2)] disabled:opacity-50"
            >
              {loading ? "Creating…" : "Create Move"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

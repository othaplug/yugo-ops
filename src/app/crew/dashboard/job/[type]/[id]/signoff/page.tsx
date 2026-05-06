"use client";

import { useState, useEffect, useRef, use, useCallback } from "react";
import {
  Star as PhStar,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  PencilSimple,
  Check,
} from "@phosphor-icons/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import PageContent from "@/app/admin/components/PageContent";
import YugoLogo from "@/components/YugoLogo";
import { useCrewImmersiveNav } from "@/app/crew/components/CrewImmersiveNavContext";
import { WINE } from "@/app/quote/[quoteId]/quote-shared";
import JobPhotos from "../JobPhotos";

/** yu3 tokens for inline `style` props; Phosphor icons still use WINE hex. */
const FOREST_PRIMARY = "var(--yu3-forest)";
const FOREST = "var(--yu3-forest)";
const INK = "var(--yu3-ink)";
const MUTED = "var(--yu3-ink-muted)";
const BG = "var(--yu3-bg-canvas)";
const BORDER = "var(--yu3-line-subtle)";
const NOTE_FILL = "var(--yu3-bg-surface)";

/** Primary forward / submit actions — wine shell matches crew job flow. */
const SIGNOFF_SOLID_WINE_CTA =
  "crew-premium-cta w-full inline-flex min-h-[48px] items-center justify-center gap-2 border border-[#3d1426] px-4 py-3 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-[var(--yu3-on-wine)] transition-colors [font-family:var(--font-body)] disabled:pointer-events-none disabled:opacity-40 active:scale-[0.99]";

/** Back navigation (thank-you + already-signed) */
const SIGNOFF_BACK_LINK =
  "inline-flex items-center justify-center gap-2 py-2 text-[11px] font-bold uppercase leading-none tracking-[0.1em] text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] hover:text-[var(--yu3-wine)]/90 active:scale-[0.99]";

const RATING_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Fair",
  3: "Good",
  4: "Great",
  5: "Exceptional",
};

const NPS_LABELS: Record<number, string> = {
  0: "Not at all likely",
  1: "Very unlikely",
  2: "Unlikely",
  3: "Somewhat unlikely",
  4: "Neutral",
  5: "Neutral",
  6: "Somewhat likely",
  7: "Likely",
  8: "Very likely",
  9: "Extremely likely",
  10: "Absolutely!",
};

// ── Delivery copy keyed by partner vertical ───────────────────────────────
type DeliveryCopy = {
  thankYouSub: string;
  thankYouNote: string;
  noIssuesLabel: string;
  preExistingLabel: string;
  itemsConfirmSubtitle: string;
  legalNote: string;
};

function getDeliveryCopy(vertical: string | null): DeliveryCopy {
  const base: DeliveryCopy = {
    thankYouSub: "Your delivery has been completed.",
    thankYouNote:
      "A signed delivery record has been saved. If you notice any concealed damage within 24 hours, please contact us immediately.",
    noIssuesLabel: "No issues experienced during this delivery",
    preExistingLabel: "Pre-existing conditions were noted before the delivery",
    itemsConfirmSubtitle:
      "Review and confirm all items were received in good condition.",
    legalNote:
      "By signing, I confirm all items listed were received as described. I understand I have 24 hours from this sign-off to report any concealed damage not visible during the walkthrough.",
  };

  const v = (vertical || "").toLowerCase();

  if (v === "interior_designer" || v === "designer") {
    return {
      ...base,
      thankYouSub: "Your client's pieces have been placed as directed.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all pieces were placed per your client's plan.",
    };
  }

  if (v === "art_gallery" || v === "gallery" || v === "antique_dealer") {
    return {
      ...base,
      thankYouSub:
        "Your piece has been delivered and placed with the care it deserves.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any damage or concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm each piece was received in the expected condition.",
      legalNote:
        "By signing, I confirm all items were received as described. Any concealed damage must be reported within 24 hours.",
    };
  }

  if (v === "cabinetry") {
    return {
      ...base,
      thankYouSub: "Your cabinetry has been delivered and placed.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any damage within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all cabinetry components were received in good condition.",
    };
  }

  if (v === "flooring") {
    return {
      ...base,
      thankYouSub: "Your materials have been delivered.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all materials were received in good condition.",
    };
  }

  if (v === "hospitality") {
    return {
      ...base,
      thankYouSub: "Your items have been delivered and set in place.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all items were received and placed correctly.",
    };
  }

  if (v === "medical_equipment") {
    return {
      ...base,
      thankYouSub: "Your equipment has been delivered and positioned.",
      thankYouNote:
        "A signed delivery record has been saved. Please verify equipment condition and report any concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all equipment was received and positioned correctly.",
    };
  }

  if (v === "av_technology") {
    return {
      ...base,
      thankYouSub: "Your AV equipment has been delivered and positioned.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any concerns within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all AV equipment was received in good condition.",
    };
  }

  if (v === "appliances") {
    return {
      ...base,
      thankYouSub: "Your appliances have been delivered and placed.",
      thankYouNote:
        "A signed delivery record has been saved. Please report any damage within 24 hours.",
      noIssuesLabel: "No issues experienced during this delivery",
      preExistingLabel:
        "Pre-existing conditions were noted before this delivery",
      itemsConfirmSubtitle:
        "Confirm all appliances were received in good condition.",
    };
  }

  // furniture_retailer / retail / default delivery
  return {
    ...base,
    thankYouSub: "Your pieces have been carefully delivered and placed.",
    thankYouNote:
      "A signed delivery record has been saved. If you notice any damage within 24 hours, please contact us immediately.",
    noIssuesLabel: "No issues experienced during this delivery",
    preExistingLabel: "Pre-existing conditions were noted before this delivery",
    itemsConfirmSubtitle:
      "Review and confirm all items were received in good condition.",
  };
}
// ─────────────────────────────────────────────────────────────────────────────

const SKIP_REASONS = [
  { value: "client_not_home", label: "Client not home, doing another route" },
  { value: "client_refused", label: "Client refused to sign" },
  { value: "client_requested_delay", label: "Client requested delay" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
] as const;

interface PhotoItem {
  id: string;
  url: string;
  category: string;
  note?: string;
}

interface ItemCondition {
  item_name: string;
  condition: "pristine" | "minor_scuff" | "pre_existing_damage" | "new_damage";
  notes: string;
  photo_url?: string;
}

const CONDITION_OPTIONS = [
  { value: "pristine" as const, label: "Pristine" },
  { value: "minor_scuff" as const, label: "Minor Scuff" },
  { value: "pre_existing_damage" as const, label: "Pre-existing" },
  { value: "new_damage" as const, label: "New Damage" },
];

function StarIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <PhStar size={size} color={WINE} weight={filled ? "fill" : "regular"} />
  );
}

function ChevronLeft({
  size = 16,
  color = MUTED,
}: {
  size?: number;
  color?: string;
}) {
  return <PhCaretLeft size={size} weight="bold" color={color} />;
}

function PenLine({ size = 14 }: { size?: number }) {
  return <PencilSimple size={size} />;
}

function CheckMark({ size = 10 }: { size?: number }) {
  return <Check size={size} weight="bold" />;
}

function YugoWordmark() {
  return (
    <span
      className="font-hero text-[20px] font-semibold tracking-tight"
      style={{ color: WINE }}
    >
      yugo
    </span>
  );
}

function ToggleCard({
  checked,
  onChange,
  label,
  sublabel,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  sublabel?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`w-full flex items-start gap-3.5 p-4 border text-left transition-all duration-200 ${
        checked
          ? "border-[var(--yu3-wine)] bg-[var(--yu3-bg-surface)]"
          : "border-[var(--yu3-wine)]/15 bg-[var(--yu3-bg-surface)] hover:bg-[var(--yu3-wine)]/[0.03]"
      }`}
    >
      <div
        className={`mt-0.5 w-5 h-5 shrink-0 flex items-center justify-center border transition-all duration-200 ${
          checked
            ? "border-[var(--yu3-wine)] bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)]"
            : "border-[var(--yu3-wine)]/28 bg-transparent text-transparent"
        }`}
      >
        <CheckMark size={9} />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="text-[13px] font-medium leading-snug [font-family:var(--font-body)]"
          style={{ color: checked ? INK : MUTED }}
        >
          {label}
        </span>
        {sublabel && (
          <p
            className="text-[11px] mt-0.5 leading-snug [font-family:var(--font-body)]"
            style={{ color: MUTED, opacity: 0.85 }}
          >
            {sublabel}
          </p>
        )}
      </div>
    </button>
  );
}

export default function ClientSignOffPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";

  // Phase: 1–4 client sign-off, 5=crew tip report, 6=thank you, 7=skip form
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<{ id: string } | null>(null);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  const [jobPhotos, setJobPhotos] = useState<PhotoItem[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  /** Live tracking session for photo uploads on this screen */
  const [crewSession, setCrewSession] = useState<{
    id: string | null;
    status: string;
  } | null>(null);

  // Item conditions (Prompt 75)
  const [itemConditions, setItemConditions] = useState<ItemCondition[]>([]);
  const [inventoryItems, setInventoryItems] = useState<string[]>([]);

  // Phase 1
  const [photosReviewedByClient, setPhotosReviewedByClient] = useState(false);
  const [inventoryReviewedByClient, setInventoryReviewedByClient] =
    useState(false);
  const [allItemsReceived, setAllItemsReceived] = useState(true);
  const [itemsLeftBehind, setItemsLeftBehind] = useState("");
  const [conditionAccepted, setConditionAccepted] = useState(true);
  const [walkthroughConductedByClient, setWalkthroughConductedByClient] =
    useState(false);
  const [clientPresentDuringUnloading, setClientPresentDuringUnloading] =
    useState(false);
  const [preExistingConditionsNoted, setPreExistingConditionsNoted] =
    useState(false);
  const [exceptions, setExceptions] = useState("");

  // Phase 2
  const [rating, setRating] = useState<number | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [noIssuesDuringMove, setNoIssuesDuringMove] = useState(false);
  const [noDamages, setNoDamages] = useState(false);
  const [walkthroughCompleted, setWalkthroughCompleted] = useState(false);
  const [crewConductedProfessionally, setCrewConductedProfessionally] =
    useState(false);
  const [crewWoreProtection, setCrewWoreProtection] = useState(false);
  const [furnitureReassembled, setFurnitureReassembled] = useState<
    boolean | null
  >(null);
  const [itemsPlacedCorrectly, setItemsPlacedCorrectly] = useState(false);
  const [propertyLeftClean, setPropertyLeftClean] = useState(false);
  const [noPropertyDamage, setNoPropertyDamage] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");

  // Partner vertical (for delivery language)
  const [partnerVertical, setPartnerVertical] = useState<string | null>(null);

  // Phase 3
  const [clientName, setClientName] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Skip
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [skipSubmitting, setSkipSubmitting] = useState(false);
  const [skipError, setSkipError] = useState("");

  const [tipMethod, setTipMethod] = useState<"none" | "cash" | "interac">(
    "none",
  );
  const [tipAmount, setTipAmount] = useState("");
  const [tipSubmitting, setTipSubmitting] = useState(false);
  const [tipError, setTipError] = useState("");

  const router = useRouter();
  const { setImmersiveNav } = useCrewImmersiveNav();

  useEffect(() => {
    setImmersiveNav(true);
    return () => setImmersiveNav(false);
  }, [setImmersiveNav]);

  const refetchJobPhotos = useCallback(async () => {
    try {
      const r = await fetch(`/api/crew/photos/${id}?jobType=${jobType}`);
      const d = (await r.json().catch(() => ({}))) as {
        photos?: PhotoItem[];
      };
      if (d.photos) setJobPhotos(d.photos);
    } catch {
      // keep existing list
    }
  }, [id, jobType]);

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLat(pos.coords.latitude);
          setGeoLng(pos.coords.longitude);
        },
        () => {},
      );
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = FOREST;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [phase]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const [signoffRes, photosRes, inventoryRes, sessionRes] = await Promise.all([
          fetch(`/api/crew/signoff/${id}?jobType=${jobType}`),
          fetch(`/api/crew/photos/${id}?jobType=${jobType}`),
          fetch(`/api/crew/signoff/${id}/inventory?jobType=${jobType}`),
          fetch(`/api/crew/session/${jobType}/${id}`),
        ]);
        if (cancelled) return;
        const signoffData = signoffRes.ok ? await signoffRes.json() : null;
        const photosData = photosRes.ok
          ? await photosRes.json()
          : { photos: [] };
        const invData = inventoryRes.ok
          ? await inventoryRes.json()
          : { items: [] };
        if (signoffData?.id) setExisting(signoffData);
        if (signoffData?.partnerVertical)
          setPartnerVertical(signoffData.partnerVertical);
        const photos = Array.isArray(photosData)
          ? photosData
          : photosData?.photos || [];
        setJobPhotos(photos);
        const items: string[] = invData?.items || [];
        setInventoryItems(items);
        if (items.length > 0) {
          setItemConditions(
            items.map((name: string) => ({
              item_name: name,
              condition: "pristine" as const,
              notes: "",
            })),
          );
        }

        const sessionJson = sessionRes.ok
          ? await sessionRes.json().catch(() => null)
          : null;
        const sess = sessionJson?.session as
          | { id?: string; status?: string }
          | null
          | undefined;
        const defaultStatus =
          jobType === "move" ? "unloading" : "arrived_at_destination";
        if (sess && typeof sess.id === "string") {
          setCrewSession({
            id: sess.id,
            status:
              typeof sess.status === "string" && sess.status.trim()
                ? sess.status
                : defaultStatus,
          });
        } else {
          setCrewSession({ id: null, status: defaultStatus });
        }
      } catch {
        if (!cancelled) {
          setCrewSession({
            id: null,
            status: jobType === "move" ? "unloading" : "arrived_at_destination",
          });
        }
      } finally {
        if (!cancelled) {
          setPhotosLoading(false);
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, jobType]);

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x =
      ("touches" in e
        ? e.touches[0].clientX - rect.left
        : (e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y =
      ("touches" in e
        ? e.touches[0].clientY - rect.top
        : (e as React.MouseEvent).clientY - rect.top) * scaleY;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x =
      ("touches" in e
        ? e.touches[0].clientX - rect.left
        : (e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y =
      ("touches" in e
        ? e.touches[0].clientY - rect.top
        : (e as React.MouseEvent).clientY - rect.top) * scaleY;
    ctx.lineTo(x, y);
    ctx.stroke();
    e.preventDefault();
  };

  const stopDrawing = () => {
    isDrawing.current = false;
    const canvas = canvasRef.current;
    if (canvas) setSignature(canvas.toDataURL("image/png"));
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setSignature("");
      }
    }
  };

  const handleSubmit = async () => {
    const canvas = canvasRef.current;
    const dataUrl = canvas?.toDataURL("image/png") || signature;
    if (!clientName.trim() || !dataUrl) {
      setError("Please enter your name and sign");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/crew/signoff/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobType,
          signedBy: clientName.trim(),
          signatureDataUrl: dataUrl,
          signedLat: geoLat,
          signedLng: geoLng,
          allItemsReceived,
          conditionAccepted,
          walkthroughConductedByClient,
          clientPresentDuringUnloading,
          preExistingConditionsNoted,
          photosReviewedByClient:
            jobPhotos.length > 0 ? photosReviewedByClient : true,
          satisfactionRating: rating,
          npsScore,
          noIssuesDuringMove,
          noDamages,
          walkthroughCompleted,
          crewConductedProfessionally,
          crewWoreProtection,
          furnitureReassembled:
            furnitureReassembled === null ? null : furnitureReassembled,
          itemsPlacedCorrectly,
          propertyLeftClean,
          noPropertyDamage,
          feedbackNote: feedbackNote.trim() || null,
          exceptions:
            [
              itemsLeftBehind.trim()
                ? `Items not received / left behind: ${itemsLeftBehind.trim()}`
                : null,
              exceptions.trim() || null,
            ]
              .filter(Boolean)
              .join("\n\n") || null,
          itemConditions:
            itemConditions.length > 0 ? itemConditions : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.code === "SCHEMA_UPDATE_REQUIRED"
            ? "A system update is needed. Please contact your dispatch or try again in a few minutes."
            : data.error || "Failed to submit",
        );
        setSubmitting(false);
        return;
      }
      setPhase(6); // client sees thank-you first; crew reports tip via button on that screen
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  const handleSkipSubmit = async () => {
    if (!skipReason) return;
    setSkipSubmitting(true);
    setSkipError("");
    try {
      const res = await fetch("/api/crew/signoff/skip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          jobType,
          skipReason,
          skipNote: skipNote.trim() || null,
          locationLat: geoLat,
          locationLng: geoLng,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        setSkipError(
          typeof data.error === "string"
            ? data.error
            : "Could not confirm skip. Try again.",
        );
        return;
      }
      if (data.ok !== true) {
        setSkipError("Could not confirm skip. Try again.");
        return;
      }
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
      router.refresh();
    } catch {
      setSkipError("Connection error. Check your signal and try again.");
    } finally {
      setSkipSubmitting(false);
    }
  };

  // When crew presses "Report tip" from the thank-you screen (phase 6 → 5),
  // check if tip was already reported; if so skip straight back to dashboard.
  const [tipAlreadyReported, setTipAlreadyReported] = useState(false);
  useEffect(() => {
    if (phase !== 6) return;
    let cancelled = false;
    fetch(
      `/api/crew/tips/report?jobId=${encodeURIComponent(id)}&jobType=${encodeURIComponent(jobType)}`,
    )
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { needsReport?: boolean } | null) => {
        if (cancelled) return;
        if (d && d.needsReport === false) setTipAlreadyReported(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [phase, id, jobType]);

  const handleTipSubmit = async () => {
    const amountDollars =
      tipMethod === "none"
        ? 0
        : Number.parseFloat(tipAmount.replace(/,/g, "")) || 0;
    if (tipMethod !== "none" && amountDollars <= 0) {
      setTipError("Enter the tip amount or choose no tip");
      return;
    }
    setTipSubmitting(true);
    setTipError("");
    try {
      const res = await fetch("/api/crew/tips/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          jobType,
          method: tipMethod,
          amountDollars,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setTipError(
          typeof data.error === "string" ? data.error : "Could not save",
        );
        setTipSubmitting(false);
        return;
      }
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
    } catch {
      setTipError("Connection error");
    }
    setTipSubmitting(false);
  };

  const updateItemCondition = (
    index: number,
    field: keyof ItemCondition,
    value: string,
  ) => {
    setItemConditions((prev) =>
      prev.map((ic, i) => (i === index ? { ...ic, [field]: value } : ic)),
    );
  };

  const hasNewDamage = itemConditions.some(
    (ic) => ic.condition === "new_damage",
  );
  const itemConditionsValid =
    itemConditions.length === 0 ||
    itemConditions.every(
      (ic) => ic.condition !== "new_damage" || ic.notes.trim().length > 0,
    );

  const copy = jobType === "delivery" ? getDeliveryCopy(partnerVertical) : null;

  if (loading) {
    return (
      <PageContent className="w-full min-w-0 max-w-full">
        <div className="flex min-h-[40vh] items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--yu3-wine)]/25 border-t-[var(--yu3-wine)]" />
            <p className="text-[14px] text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
              Loading
            </p>
          </div>
        </div>
      </PageContent>
    );
  }

  if (existing) {
    return (
      <PageContent className="mx-auto w-full min-w-0 max-w-lg">
        <div className="flex min-h-[50vh] flex-col items-center justify-center pt-4 text-center">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--yu3-wine-tint)]">
            <Check size={24} color={WINE} weight="bold" />
          </div>
          <h1 className="font-hero mb-2 text-[26px] font-normal tracking-tight text-[var(--yu3-wine)] sm:text-[28px]">
            Already signed
          </h1>
          <p className="mx-auto mb-8 max-w-[280px] text-[14px] leading-relaxed text-[var(--yu3-ink-muted)] [font-family:var(--font-body)]">
            This job has already been signed off.
          </p>
          <Link
            href={`/crew/dashboard/job/${jobType}/${id}`}
            className={SIGNOFF_BACK_LINK}
          >
            <PhCaretLeft
              size={14}
              weight="bold"
              color={WINE}
              className="shrink-0 opacity-90"
              aria-hidden
            />
            Back to job
          </Link>
        </div>
      </PageContent>
    );
  }

  const phase1Valid =
    itemConditionsValid && (itemConditions.length === 0 || true);

  const phase2Valid =
    (jobPhotos.length === 0 || photosReviewedByClient) &&
    inventoryReviewedByClient &&
    walkthroughConductedByClient &&
    ((allItemsReceived && conditionAccepted) ||
      exceptions.trim().length > 0 ||
      itemsLeftBehind.trim().length > 0);

  const allConfirmed =
    noIssuesDuringMove &&
    noDamages &&
    noPropertyDamage &&
    walkthroughCompleted &&
    crewConductedProfessionally &&
    crewWoreProtection &&
    itemsPlacedCorrectly &&
    propertyLeftClean &&
    furnitureReassembled !== false;
  const hasIssuesOrConcerns =
    !noIssuesDuringMove ||
    !noDamages ||
    !noPropertyDamage ||
    !walkthroughCompleted ||
    !crewConductedProfessionally ||
    !crewWoreProtection ||
    !itemsPlacedCorrectly ||
    !propertyLeftClean ||
    furnitureReassembled === false;
  const phase3Valid =
    !!rating &&
    npsScore !== null &&
    (allConfirmed
      ? true
      : hasIssuesOrConcerns && feedbackNote.trim().length > 0);

  const STEP_LABELS =
    jobType === "delivery"
      ? ["Condition", "Items", "Sign"]
      : ["Condition", "Items", "Experience", "Sign"];

  return (
    <main className="min-h-[100dvh] bg-[var(--yu3-bg-canvas)] [font-family:var(--font-body)]">
      <style>{`
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes popIn {
          0%   { opacity: 0; transform: scale(0.85); }
          60%  { transform: scale(1.06); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes sparkleRing {
          0%   { transform: scale(0.75); opacity: 0; }
          50%  { transform: scale(1.1); opacity: 0.35; }
          100% { transform: scale(1.55); opacity: 0; }
        }
        .phase-enter { animation: fadeSlideUp 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .pop-in      { animation: popIn 0.32s cubic-bezier(0.34,1.56,0.64,1) both; }
      `}</style>

      <div className="max-w-[420px] mx-auto px-4 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/crew/dashboard/job/${jobType}/${id}`}
            className="flex items-center gap-1.5 text-[12px] font-semibold py-1.5 pr-3 -ml-1 text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] hover:opacity-90"
          >
            <ChevronLeft size={15} color={WINE} /> Back
          </Link>
          <YugoLogo size={22} variant="wine" onLightBackground />
          <div className="w-14" />
        </div>

        {/* Step progress (phases 1–4, client-facing sign-off only) */}
        {phase >= 1 && phase <= 4 && (
          <div className="flex items-center gap-1.5 mb-8">
            {STEP_LABELS.map((label, i) => {
              const step = i + 1;
              // For deliveries phase 4 maps to visual step 3 (no experience step)
              const currentStep =
                jobType === "delivery" && phase === 4 ? 3 : phase;
              const done = currentStep > step;
              const active = currentStep === step;
              return (
                <div
                  key={label}
                  className="flex items-center gap-1.5 flex-1 last:flex-none"
                >
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                        done
                          ? "bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)]"
                          : active
                            ? "bg-[var(--yu3-wine)] text-[var(--yu3-on-wine)] shadow-sm"
                            : "border border-[var(--yu3-wine)]/20 bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink-muted)]"
                      }`}
                    >
                      {done ? <CheckMark size={9} /> : step}
                    </div>
                    <span
                      className="text-[9px] mt-1 font-bold tracking-wide uppercase"
                      style={{ color: active ? WINE : "var(--yu3-ink-faint)" }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className="flex-1 h-px transition-colors duration-300 mt-[-14px]"
                      style={{
                        backgroundColor:
                          currentStep > step ? "rgba(92, 26, 51, 0.35)" : BORDER,
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Phase 1: Item Condition Assessment ── */}
        {phase === 1 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                Step 1 of 4
              </p>
              <h1
                className="font-hero text-[26px] sm:text-[28px] font-normal leading-tight tracking-tight"
                style={{ color: WINE }}
              >
                Item Condition
              </h1>
              <p
                className="text-[13px] mt-2 leading-relaxed [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                Assess the condition of each item at delivery.
              </p>
            </div>

            {itemConditions.length === 0 ? (
              <div className="text-center py-10">
                <p
                  className="text-[13px] [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  No inventory items found for this job.
                </p>
                <p
                  className="text-[11px] mt-1 [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  You can continue to the next step.
                </p>
              </div>
            ) : (
              <div className="space-y-3 mb-6">
                {itemConditions.map((ic, idx) => (
                  <div
                    key={idx}
                    className="p-4 border bg-[var(--yu3-bg-surface)]"
                    style={{
                      borderColor:
                        ic.condition === "new_damage" ? "#F87171" : BORDER,
                    }}
                  >
                    <div
                      className="font-hero text-[20px] sm:text-[22px] font-normal leading-snug mb-3 tracking-tight"
                      style={{ color: WINE }}
                    >
                      {ic.item_name}
                    </div>
                    <div
                      className="text-[9px] font-bold uppercase tracking-[0.14em] mb-2.5 [font-family:var(--font-body)] leading-none"
                      style={{ color: MUTED }}
                    >
                      Condition at delivery
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      {CONDITION_OPTIONS.map((opt) => {
                        const selected = ic.condition === opt.value;
                        const isNewDamage = opt.value === "new_damage";
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() =>
                              updateItemCondition(idx, "condition", opt.value)
                            }
                            className={`px-3 py-2.5 text-left text-[11px] font-semibold transition-colors border flex items-center gap-2 [font-family:var(--font-body)] leading-snug ${
                              selected
                                ? isNewDamage
                                  ? "border-red-600 bg-red-50 text-red-800"
                                  : "border-[var(--yu3-wine)] bg-[var(--yu3-wine)]/[0.07] text-[var(--yu3-wine)]"
                                : "border-[var(--yu3-wine)]/22 bg-[var(--yu3-bg-surface)] text-[var(--yu3-ink-muted)] hover:border-[var(--yu3-wine)]/40"
                            }`}
                          >
                            {selected ? (
                              <Check
                                size={14}
                                weight="bold"
                                className="shrink-0"
                                style={{
                                  color: isNewDamage ? "#991B1B" : WINE,
                                }}
                                aria-hidden
                              />
                            ) : (
                              <span
                                className="w-3.5 h-3.5 shrink-0 border border-[var(--yu3-wine)]/28"
                                aria-hidden
                              />
                            )}
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {ic.condition === "new_damage" && (
                      <div className="mt-2">
                        <textarea
                          value={ic.notes}
                          onChange={(e) =>
                            updateItemCondition(idx, "notes", e.target.value)
                          }
                          placeholder="Describe the damage (required)…"
                          className="w-full p-3 border text-[12px] outline-none [font-family:var(--font-body)] focus:border-red-400"
                          style={{
                            color: INK,
                            backgroundColor: "#FEF2F2",
                            borderColor: "rgba(220, 38, 38, 0.35)",
                          }}
                          rows={2}
                        />
                      </div>
                    )}
                    {ic.condition !== "new_damage" && (
                      <input
                        type="text"
                        value={ic.notes}
                        onChange={(e) =>
                          updateItemCondition(idx, "notes", e.target.value)
                        }
                        placeholder="Optional notes…"
                        className="w-full px-3 py-2.5 border text-[12px] outline-none mt-1 [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/50"
                        style={{
                          color: INK,
                          backgroundColor: BG,
                          borderColor: BORDER,
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            )}

            {hasNewDamage && (
              <div className="p-3.5 mb-4 border border-red-300 bg-red-50">
                <p className="text-[11px] font-semibold text-red-800 [font-family:var(--font-body)] leading-snug">
                  New damage detected, this will be flagged for a potential
                  claim.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPhase(2)}
              disabled={!phase1Valid}
              className={SIGNOFF_SOLID_WINE_CTA}
            >
              Continue to confirmation
              <PhCaretRight
                size={14}
                weight="bold"
                color="rgba(255, 251, 247, 0.92)"
                className="shrink-0"
                aria-hidden
              />
            </button>
          </div>
        )}

        {/* ── Phase 2: Items Confirmation ── */}
        {phase === 2 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                Step 2 of 4
              </p>
              <h1
                className="font-hero text-[26px] sm:text-[28px] font-normal leading-tight tracking-tight"
                style={{ color: WINE }}
              >
                Items Confirmation
              </h1>
              <p
                className="text-[13px] mt-2 leading-relaxed [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                {copy?.itemsConfirmSubtitle ??
                  "Review and confirm all belongings were received in good condition."}
              </p>
            </div>

            {/* Crew: final walkthrough uploads (tags walkthrough_final; shows in gallery below) */}
            <div className="mb-6 rounded-[var(--yu3-r-lg)] border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] p-4 shadow-[var(--yu3-shadow-sm)]">
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] mb-2 [font-family:var(--font-body)]"
              >
                Final walkthrough
              </p>
              <p
                className="text-[12px] text-[var(--yu3-ink-muted)] mb-4 leading-relaxed [font-family:var(--font-body)]"
              >
                Add final placement photos here. They appear in the gallery below for the
                client to review.
              </p>
              <div
                data-theme="light"
                className="crew-signoff-photos [font-family:var(--font-body)] text-[var(--yu3-ink)]"
              >
                <JobPhotos
                  jobId={id}
                  jobType={jobType}
                  sessionId={crewSession?.id ?? null}
                  currentStatus={
                    crewSession?.status ??
                    (jobType === "move" ? "unloading" : "arrived_at_destination")
                  }
                  uploadOverride={
                    jobType === "move"
                      ? {
                          category: "walkthrough_final",
                          checkpoint: "unloading",
                        }
                      : {
                          category: "walkthrough_final",
                          checkpoint: "arrived_at_destination",
                        }
                  }
                  onPhotoTaken={refetchJobPhotos}
                  finalWalkPhotoAtLoading={false}
                  readOnly={false}
                />
              </div>
            </div>

            {/* Photo gallery */}
            {!photosLoading && jobPhotos.length > 0 && (
              <div className="mb-5">
                <p
                  className="text-[10px] font-bold uppercase tracking-widest mb-2.5"
                  style={{ color: MUTED }}
                >
                  Crew Photos ({jobPhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {jobPhotos.slice(0, 9).map((p) => (
                    <div
                      key={p.id}
                      className="aspect-square overflow-hidden border border-[var(--yu3-wine)]/12"
                      style={{ background: NOTE_FILL }}
                    >
                      <img
                        src={p.url}
                        alt={p.category}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {jobPhotos.length > 9 && (
                    <div
                      className="aspect-square flex items-center justify-center text-[12px] font-semibold border border-[var(--yu3-wine)]/12"
                      style={{ background: NOTE_FILL, color: MUTED }}
                    >
                      +{jobPhotos.length - 9}
                    </div>
                  )}
                </div>
                <ToggleCard
                  checked={photosReviewedByClient}
                  onChange={setPhotosReviewedByClient}
                  label="I have reviewed the crew photos above"
                />
              </div>
            )}

            <div className="space-y-2.5 mb-6">
              <ToggleCard
                checked={inventoryReviewedByClient}
                onChange={setInventoryReviewedByClient}
                label="I have reviewed the inventory list"
                sublabel="Every item is confirmed present at this location"
              />
              <ToggleCard
                checked={allItemsReceived}
                onChange={setAllItemsReceived}
                label="All items received"
              />
              {!allItemsReceived && (
                <div className="pl-2">
                  <p
                    className="text-[11px] font-semibold mb-1.5"
                    style={{ color: MUTED }}
                  >
                    Items not received or left behind
                  </p>
                  <textarea
                    value={itemsLeftBehind}
                    onChange={(e) => setItemsLeftBehind(e.target.value)}
                    placeholder="List any items not received or left behind…"
                    className="w-full p-3.5 border bg-[var(--yu3-bg-surface)] text-[13px] outline-none transition-colors [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/40"
                    style={{ color: INK, borderColor: BORDER }}
                    rows={3}
                  />
                </div>
              )}
              <ToggleCard
                checked={conditionAccepted}
                onChange={setConditionAccepted}
                label="Everything in good condition"
              />
              <ToggleCard
                checked={walkthroughConductedByClient}
                onChange={setWalkthroughConductedByClient}
                label="Walkthrough conducted by client"
              />
              <ToggleCard
                checked={clientPresentDuringUnloading}
                onChange={setClientPresentDuringUnloading}
                label="I was present during unloading"
              />
              <ToggleCard
                checked={preExistingConditionsNoted}
                onChange={setPreExistingConditionsNoted}
                label={
                  copy?.preExistingLabel ??
                  "Pre-existing conditions were noted before the move"
                }
              />
              {!conditionAccepted && (
                <textarea
                  value={exceptions}
                  onChange={(e) => setExceptions(e.target.value)}
                  placeholder="Describe any damage or condition issues…"
                  className="w-full p-3.5 border bg-[var(--yu3-bg-surface)] text-[13px] outline-none transition-colors [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/40"
                  style={{ color: INK, borderColor: BORDER }}
                  rows={3}
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => setPhase(jobType === "delivery" ? 4 : 3)}
              disabled={!phase2Valid}
              className={SIGNOFF_SOLID_WINE_CTA}
            >
              {jobType === "delivery" ? "Continue to sign" : "Continue to rating"}
              <PhCaretRight
                size={14}
                weight="bold"
                color="rgba(255, 251, 247, 0.92)"
                className="shrink-0"
                aria-hidden
              />
            </button>
          </div>
        )}

        {/* ── Phase 3: Experience + NPS (moves only; deliveries skip to phase 4) ── */}
        {phase === 3 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                Step 3 of 4
              </p>
              <h1
                className="font-hero text-[26px] sm:text-[28px] font-normal leading-tight tracking-tight"
                style={{ color: WINE }}
              >
                How was your experience?
              </h1>
              <p
                className="text-[13px] mt-2 leading-relaxed [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                Your feedback helps us keep our standards high.
              </p>
            </div>

            {/* Star rating */}
            <div className="mb-6">
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: MUTED }}
              >
                Overall Rating
              </p>
              <div className="flex justify-center gap-3 mb-2.5">
                {[1, 2, 3, 4, 5].map((n) => {
                  const isFilled = rating != null && n <= rating;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(n)}
                      className={`transition-transform duration-150 ${rating === n ? "scale-125" : "hover:scale-110"}`}
                    >
                      <StarIcon filled={isFilled} size={34} />
                    </button>
                  );
                })}
              </div>
              {rating && (
                <p
                  className="text-center text-[13px] font-semibold pop-in"
                  style={{ color: WINE }}
                >
                  {RATING_LABELS[rating]}
                </p>
              )}
            </div>

            {/* NPS */}
            <div className="mb-6">
              <p
                className="text-[13px] font-semibold mb-0.5"
                style={{ color: INK }}
              >
                How likely are you to recommend us?
              </p>
              <p className="text-[11px] mb-3.5" style={{ color: MUTED }}>
                0 = Not at all &nbsp;·&nbsp; 10 = Absolutely
              </p>
              <div className="flex flex-nowrap justify-center gap-1">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                  const isSelected = npsScore === n;
                  let bg = NOTE_FILL;
                  let textC = MUTED;
                  let bd = "1px solid rgba(44, 62, 45, 0.15)";
                  if (isSelected) {
                    bd = "1px solid transparent";
                    if (n <= 6) {
                      bg = "#EF4444";
                      textC = "var(--yu3-on-wine)";
                    } else if (n <= 8) {
                      bg = "#B45309";
                      textC = "var(--yu3-on-wine)";
                    } else {
                      bg = WINE;
                      textC = "var(--yu3-on-wine)";
                    }
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNpsScore(n)}
                      className={`shrink-0 w-7 h-7 text-[11px] font-bold transition-all [font-family:var(--font-body)] ${isSelected ? "scale-110 shadow-sm" : "hover:opacity-80"}`}
                      style={{ backgroundColor: bg, color: textC, border: bd }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {npsScore !== null && (
                <p
                  className="text-center text-[11px] mt-2 font-semibold pop-in"
                  style={{
                    color:
                      npsScore >= 9
                        ? WINE
                        : npsScore >= 7
                          ? "#B45309"
                          : "#EF4444",
                  }}
                >
                  {NPS_LABELS[npsScore]}
                </p>
              )}
            </div>

            {/* Confirmation checkboxes */}
            <div className="mb-5">
              <p
                className="text-[10px] font-bold uppercase tracking-widest mb-3"
                style={{ color: MUTED }}
              >
                Please confirm the following
              </p>
              <p className="text-[11px] mb-3" style={{ color: MUTED }}>
                Uncheck any box or select &quot;No&quot; if something
                wasn&apos;t as expected, you&apos;ll be asked to describe below.
              </p>
              <div className="space-y-2.5">
                <ToggleCard
                  checked={noIssuesDuringMove}
                  onChange={setNoIssuesDuringMove}
                  label={
                    copy?.noIssuesLabel ??
                    "No issues experienced during my move"
                  }
                />
                <ToggleCard
                  checked={noDamages}
                  onChange={setNoDamages}
                  label="No damages to my belongings"
                />
                <ToggleCard
                  checked={noPropertyDamage}
                  onChange={setNoPropertyDamage}
                  label="No damage to walls, floors, or doorways"
                />
                <ToggleCard
                  checked={walkthroughCompleted}
                  onChange={setWalkthroughCompleted}
                  label="Walkthrough completed with the crew"
                />
                <ToggleCard
                  checked={crewConductedProfessionally}
                  onChange={setCrewConductedProfessionally}
                  label="Crew conducted themselves professionally"
                />
                <ToggleCard
                  checked={crewWoreProtection}
                  onChange={setCrewWoreProtection}
                  label="Crew used floor and wall protection"
                />

                {/* Furniture reassembly */}
                <div className="flex flex-col gap-4 py-3">
                  <p
                    className="text-[15px] font-semibold"
                    style={{ color: INK }}
                  >
                    All disassembled furniture was reassembled
                  </p>
                  <div className="flex items-center gap-6">
                    {(["yes", "no", "na"] as const).map((opt) => {
                      const value =
                        opt === "yes" ? true : opt === "no" ? false : null;
                      const isSelected = furnitureReassembled === value;
                      const label =
                        opt === "yes" ? "Yes" : opt === "no" ? "No" : "N/A";
                      return (
                        <label
                          key={opt}
                          className="flex items-center gap-3 cursor-pointer"
                        >
                          <input
                            type="radio"
                            name="furniture-reassembled"
                            checked={isSelected}
                            onChange={() => setFurnitureReassembled(value)}
                            className="w-5 h-5 appearance-none outline-none cursor-pointer border border-[var(--yu3-wine)]/28"
                            style={{
                              backgroundColor: isSelected ? WINE : NOTE_FILL,
                              boxShadow: isSelected
                                ? "inset 0 0 0 2px var(--yu3-on-wine)"
                                : "none",
                            }}
                          />
                          <span
                            className="text-[15px] font-medium"
                            style={{ color: INK }}
                          >
                            {label}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <ToggleCard
                  checked={itemsPlacedCorrectly}
                  onChange={setItemsPlacedCorrectly}
                  label="All items placed in the correct rooms"
                />
                <ToggleCard
                  checked={propertyLeftClean}
                  onChange={setPropertyLeftClean}
                  label="Property left clean and free of debris"
                />
              </div>
            </div>

            {hasIssuesOrConcerns ? (
              <div className="mb-5">
                <p
                  className="text-[12px] font-semibold mb-2"
                  style={{ color: INK }}
                >
                  Please describe your concerns (required)
                </p>
                <textarea
                  value={feedbackNote}
                  onChange={(e) => setFeedbackNote(e.target.value)}
                  placeholder="Describe what happened so we can follow up (e.g. damage, missing items, walkthrough not done, property not left clean…)"
                  className="w-full p-3.5 border bg-[var(--yu3-bg-surface)] text-[13px] outline-none transition-colors [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/40"
                  style={{ color: INK, borderColor: BORDER }}
                  rows={3}
                />
              </div>
            ) : (
              <textarea
                value={feedbackNote}
                onChange={(e) => setFeedbackNote(e.target.value)}
                placeholder="Optional feedback or comments…"
                className="w-full p-3.5 border bg-[var(--yu3-bg-surface)] text-[13px] outline-none transition-colors mb-5 [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/40"
                style={{ color: INK, borderColor: BORDER }}
                rows={2}
              />
            )}

            <button
              type="button"
              onClick={() => setPhase(4)}
              disabled={!phase3Valid}
              className={SIGNOFF_SOLID_WINE_CTA}
            >
              Continue to sign
              <PhCaretRight
                size={14}
                weight="bold"
                color="rgba(255, 251, 247, 0.92)"
                className="shrink-0"
                aria-hidden
              />
            </button>
          </div>
        )}

        {/* ── Phase 4: Signature ── */}
        {phase === 4 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p
                className="text-[9px] font-bold tracking-[0.14em] uppercase mb-2 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                {jobType === "delivery" ? "Step 3 of 3" : "Step 4 of 4"}
              </p>
              <h1
                className="font-hero text-[26px] sm:text-[28px] font-normal leading-tight tracking-tight"
                style={{ color: WINE }}
              >
                Sign to confirm
              </h1>
              <p
                className="text-[13px] mt-2 leading-relaxed [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                Your signature finalizes the sign-off record.
              </p>
            </div>

            <div className="mb-5">
              <label
                className="block text-[10px] font-bold uppercase tracking-widest mb-2"
                style={{ color: MUTED }}
              >
                Your full name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full px-0 py-2.5 bg-transparent border-0 border-b border-solid rounded-none text-[var(--text-base)] outline-none transition-[border-color] [font-family:var(--font-body)] border-b-[rgba(44,62,45,0.28)] focus:border-b-[var(--yu3-wine)]/70 placeholder:text-[rgba(90,107,94,0.75)]"
                style={{ color: INK }}
              />
            </div>

            {/* Signature canvas, ink-on-paper look */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label
                  className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest"
                  style={{ color: MUTED }}
                >
                  <PenLine size={11} /> Signature
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[11px] font-semibold transition-opacity hover:opacity-60"
                  style={{ color: WINE }}
                >
                  Clear
                </button>
              </div>
              <div
                className="relative overflow-hidden border border-[var(--yu3-wine)]/15"
                style={{
                  backgroundColor: "var(--yu3-on-wine)",
                  boxShadow: "inset 0 1px 6px rgba(0,0,0,0.04)",
                }}
              >
                {/* Lined paper guide */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent, transparent 31px, ${BORDER} 31px, ${BORDER} 32px)`,
                    backgroundPositionY: "10px",
                    opacity: 0.55,
                  }}
                />
                <canvas
                  ref={canvasRef}
                  width={680}
                  height={200}
                  className="w-full touch-none"
                  style={{ height: "100px", display: "block" }}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
              </div>
              <p
                className="flex items-center gap-1.5 text-[11px] mt-1.5"
                style={{ color: MUTED }}
              >
                <PenLine size={10} /> Sign with your finger or stylus
              </p>
            </div>

            {/* Legal disclosure */}
            <div className="p-4 mb-5 border border-[var(--yu3-wine)]/18 bg-[var(--yu3-bg-surface)]">
              <p
                className="text-[11px] leading-relaxed"
                style={{ color: FOREST }}
              >
                {copy?.legalNote ? (
                  <>
                    {copy.legalNote} I understand I have{" "}
                    <strong style={{ color: INK }}>24 hours</strong> from this
                    sign-off to report any damage. After this period, the
                    condition of items is considered accepted.
                  </>
                ) : (
                  <>
                    By signing, I confirm all items listed were received as
                    described. I understand I have{" "}
                    <strong style={{ color: INK }}>24 hours</strong> from this
                    sign-off to report any concealed damage not visible during
                    the walkthrough. After this period, the condition of items
                    is considered accepted.
                  </>
                )}
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3.5 bg-red-50 border border-red-200">
                <p className="text-[12px] text-red-700 font-semibold">
                  {error}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim()}
              className={SIGNOFF_SOLID_WINE_CTA}
            >
              {submitting ? (
                "Submitting…"
              ) : (
                <>
                  Confirm and sign off
                  <PhCaretRight
                    size={14}
                    weight="bold"
                    color="rgba(255, 251, 247, 0.92)"
                    className="shrink-0"
                    aria-hidden
                  />
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Phase 5: Crew tip (crew-only, after client sees thank-you at phase 6) ── */}
        {phase === 5 && (
          <div className="phase-enter space-y-4">
            <div>
              <p
                className="text-[9px] font-bold uppercase tracking-[0.12em] mb-2 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                Crew
              </p>
              <h1
                className="font-hero text-[24px] sm:text-[26px] font-semibold tracking-tight text-[var(--yu3-wine)] mb-2"
              >
                Tip report
              </h1>
              <p className="text-[12px] text-[var(--yu3-ink-muted)] leading-relaxed [font-family:var(--font-body)]">
                Did the client tip the crew? This is for tracking only. Report
                the total amount the team received.
              </p>
            </div>

            <fieldset className="space-y-2">
              <legend className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] mb-2 block">
                Method
              </legend>
              <div className="flex flex-col gap-2">
                {(
                  [
                    { value: "none" as const, label: "No tip" },
                    { value: "cash" as const, label: "Cash" },
                    { value: "interac" as const, label: "Interac e-Transfer" },
                  ] as const
                ).map((m) => (
                  <label
                    key={m.value}
                    className="flex items-center gap-2.5 rounded-xl border border-[var(--yu3-line-subtle)] bg-[var(--yu3-bg-surface)] px-3 py-2.5 cursor-pointer"
                  >
                    <input
                      type="radio"
                      name="signoff-tip-method"
                      checked={tipMethod === m.value}
                      onChange={() => {
                        setTipMethod(m.value);
                        if (m.value === "none") setTipAmount("");
                        setTipError("");
                      }}
                      className="h-4 w-4 accent-[var(--yu3-wine)]"
                    />
                    <span className="text-[13px] text-[var(--yu3-ink)] [font-family:var(--font-body)]">
                      {m.label}
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>

            {tipMethod !== "none" && (
              <div>
                <label
                  htmlFor="signoff-tip-amount"
                  className="text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-faint)] [font-family:var(--font-body)] block mb-1.5"
                >
                  Amount (CAD)
                </label>
                <input
                  id="signoff-tip-amount"
                  type="text"
                  inputMode="decimal"
                  value={tipAmount}
                  onChange={(e) => setTipAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3.5 py-2.5 rounded-[var(--yu3-r-md)] bg-[var(--yu3-bg-surface-sunken)] border border-[var(--yu3-line-subtle)] text-[var(--yu3-ink)] text-[15px] outline-none focus:ring-2 focus:ring-[var(--yu3-wine)]/25 [font-family:var(--font-body)]"
                  autoComplete="off"
                />
              </div>
            )}

            {tipError && (
              <p className="text-[12px] text-red-700 [font-family:var(--font-body)]">
                {tipError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleTipSubmit()}
              disabled={tipSubmitting}
              className="group inline-flex w-full min-h-[44px] items-center justify-center gap-1.5 border-0 bg-transparent py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--yu3-ink-muted)] transition-colors [font-family:var(--font-body)] leading-none hover:text-[var(--yu3-wine)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--yu3-wine)] disabled:opacity-50"
            >
              {tipSubmitting ? (
                "Saving…"
              ) : (
                <>
                  {tipMethod === "none" ? "Continue (no tip)" : "Save and continue"}
                  <PhCaretRight
                    size={18}
                    weight="bold"
                    className="shrink-0 text-[var(--yu3-ink-faint)] transition-colors group-hover:text-[var(--yu3-wine)]"
                    aria-hidden
                  />
                </>
              )}
            </button>
          </div>
        )}

        {/* ── Phase 6: Thank You (client) ── */}
        {phase === 6 && (
          <div className="phase-enter text-center py-12">
            {/* Animated success ring */}
            <div className="relative inline-flex items-center justify-center mb-7">
              <div
                className="absolute w-20 h-20 rounded-full"
                style={{
                  backgroundColor: "rgba(92, 26, 51, 0.14)",
                  animation: "sparkleRing 2s ease-out 0.15s infinite",
                }}
              />
              <div
                className="absolute w-20 h-20 rounded-full"
                style={{
                  backgroundColor: "rgba(92, 26, 51, 0.08)",
                  animation: "sparkleRing 2s ease-out 0.7s infinite",
                }}
              />
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center pop-in"
                style={{ backgroundColor: WINE }}
              >
                <Check size={26} color="#FFFBF7" weight="bold" />
              </div>
            </div>

            <h1
              className="font-hero text-[30px] sm:text-[32px] font-normal mb-3 tracking-tight"
              style={{ color: WINE }}
            >
              Thank you{clientName ? `, ${clientName.split(" ")[0]}` : ""}!
            </h1>
            {copy ? (
              <>
                <p
                  className="text-[15px] mb-1 leading-snug [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  {copy.thankYouSub}
                </p>
                <p
                  className="text-[12px] mt-5 mb-8 max-w-[280px] mx-auto leading-relaxed [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  {copy.thankYouNote}
                </p>
              </>
            ) : (
              <>
                <p
                  className="text-[15px] mb-1 leading-snug [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  We hope you love your new space.
                </p>
                <p
                  className="text-[14px] font-semibold [font-family:var(--font-body)]"
                  style={{ color: WINE }}
                >
                  Welcome home.
                </p>
                <p
                  className="text-[12px] mt-5 mb-8 max-w-[280px] mx-auto leading-relaxed [font-family:var(--font-body)]"
                  style={{ color: MUTED }}
                >
                  A confirmation receipt has been generated. If you notice any
                  concealed damage within 24 hours, please contact us
                  immediately.
                </p>
              </>
            )}
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}`}
              className={SIGNOFF_BACK_LINK}
            >
              <PhCaretLeft
                size={14}
                weight="bold"
                color={WINE}
                className="shrink-0 opacity-90"
                aria-hidden
              />
              Back to job
            </Link>

            {/* Crew-only tip reporting — appears below the client thank-you */}
            {!tipAlreadyReported && (
              <div className="mt-10 pt-8 border-t border-[var(--yu3-line-subtle)]">
                <p
                  className="text-[9px] font-bold uppercase tracking-[0.14em] mb-3 [font-family:var(--font-body)] leading-none"
                  style={{ color: MUTED }}
                >
                  Crew only
                </p>
                <button
                  type="button"
                  onClick={() => setPhase(5)}
                  className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--yu3-wine)] transition-colors [font-family:var(--font-body)] hover:opacity-80"
                >
                  Report tip received
                  <PhCaretRight size={12} weight="bold" color={WINE} aria-hidden />
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Phase 7: Skip Form ── */}
        {phase === 7 && (
          <div className="phase-enter">
            <div className="mb-7">
              <h1
                className="font-hero text-[26px] sm:text-[28px] font-normal tracking-tight"
                style={{ color: WINE }}
              >
                Skip sign-off
              </h1>
              <p
                className="text-[13px] mt-2 leading-relaxed [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                Please provide a reason for skipping the client sign-off.
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              <label
                className="block text-[9px] font-bold uppercase tracking-[0.14em] mb-3 [font-family:var(--font-body)] leading-none"
                style={{ color: MUTED }}
              >
                Reason
              </label>
              {SKIP_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSkipReason(r.value)}
                  className={`w-full flex items-center gap-3.5 p-4 border text-left transition-all [font-family:var(--font-body)] ${
                    skipReason === r.value
                      ? "border-red-300 bg-red-50"
                      : "border-[var(--yu3-wine)]/12 bg-[var(--yu3-bg-surface)] hover:border-red-200/60"
                  }`}
                >
                  <div
                    className={`w-[18px] h-[18px] shrink-0 flex items-center justify-center border ${
                      skipReason === r.value
                        ? "border-red-600 bg-red-600"
                        : "border-[var(--yu3-wine)]/25 bg-[var(--yu3-bg-surface)]"
                    }`}
                  >
                    {skipReason === r.value && (
                      <Check
                        size={10}
                        weight="bold"
                        color="#FFFBF7"
                        aria-hidden
                      />
                    )}
                  </div>
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: skipReason === r.value ? "#B91C1C" : INK }}
                  >
                    {r.label}
                  </span>
                </button>
              ))}
            </div>

            <textarea
              value={skipNote}
              onChange={(e) => setSkipNote(e.target.value)}
              placeholder="Additional details (required for 'Other')…"
              className="w-full p-3.5 border bg-[var(--yu3-bg-surface)] text-[13px] outline-none transition-colors mb-4 [font-family:var(--font-body)] focus:border-[var(--yu3-wine)]/40"
              style={{ color: INK, borderColor: BORDER }}
              rows={3}
            />

            {geoLat && (
              <p
                className="text-[10px] mb-4 [font-family:var(--font-body)]"
                style={{ color: MUTED }}
              >
                Location captured ({geoLat.toFixed(4)}, {geoLng?.toFixed(4)})
              </p>
            )}

            {skipError && (
              <div
                className="mb-4 rounded-[var(--yu3-r-md)] border border-red-200 bg-red-50 p-3.5"
                role="alert"
              >
                <p className="text-[12px] font-semibold leading-snug text-red-800 [font-family:var(--font-body)]">
                  {skipError}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleSkipSubmit()}
              disabled={
                skipSubmitting ||
                !skipReason ||
                (skipReason === "other" && !skipNote.trim())
              }
              className="w-full inline-flex items-center justify-center gap-2 min-h-[48px] px-4 py-3 mb-3 border border-red-700/80 text-[10px] font-bold tracking-[0.12em] uppercase text-red-800 bg-[var(--yu3-bg-surface)] hover:bg-red-50 transition-colors disabled:opacity-40 disabled:pointer-events-none [font-family:var(--font-body)] leading-none active:scale-[0.99]"
            >
              {skipSubmitting ? (
                "Submitting…"
              ) : (
                <>
                  Confirm skip
                  <PhCaretRight
                    size={14}
                    weight="bold"
                    className="shrink-0 opacity-70"
                    aria-hidden
                  />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setPhase(1)}
              className="w-full border border-[var(--yu3-wine)]/22 bg-[var(--yu3-bg-surface)] py-2.5 text-[13px] font-medium text-[var(--yu3-ink-muted)] transition-colors [font-family:var(--font-body)] hover:bg-[var(--yu3-wine-tint)]/40 hover:text-[var(--yu3-wine)]"
            >
              Go back
            </button>
          </div>
        )}

        {/* Skip link, visible during client sign-off steps only */}
        {phase >= 1 && phase <= 4 && (
          <p className="text-center mt-8">
            <button
              type="button"
              onClick={() => {
                setSkipError("");
                setPhase(7);
              }}
              className="text-[11px] transition-colors hover:text-[var(--yu3-wine)] underline underline-offset-2"
              style={{ color: MUTED }}
            >
              Client not around? Skip and do another route
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

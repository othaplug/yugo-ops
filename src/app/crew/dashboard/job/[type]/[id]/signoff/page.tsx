"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

const GOLD = "#C9A962";
const FOREST = "#2A3D2E";
const INK = "#1A1A1A";
const MUTED = "#6B7A6E";
const BG = "#FAF8F4";
const BORDER = "#E8E4DC";

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

const SKIP_REASONS = [
  { value: "client_not_home", label: "Client not home" },
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

function StarIcon({ filled, size = 28 }: { filled: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? GOLD : "none"} stroke={GOLD} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}

function ChevronLeft({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

function PenLine({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CheckMark({ size = 10 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function YugoWordmark() {
  return (
    <span className="font-hero text-[20px] font-semibold tracking-tight" style={{ color: GOLD }}>
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
      className={`w-full flex items-start gap-3.5 p-4 rounded-2xl border text-left transition-all duration-200 ${
        checked
          ? "border-[#C9A962]/40 bg-[#C9A962]/5 shadow-[0_1px_8px_rgba(201,169,98,0.10)]"
          : "border-[#E8E4DC] bg-white hover:border-[#C9A962]/25"
      }`}
    >
      <div
        className={`mt-0.5 w-5 h-5 rounded-full shrink-0 flex items-center justify-center transition-all duration-200 ${
          checked ? "bg-[#C9A962] text-[#1A1A1A]" : "bg-[#F0EDE8] border border-[#D8D3CA] text-transparent"
        }`}
      >
        <CheckMark size={9} />
      </div>
      <div className="min-w-0 flex-1">
        <span
          className="text-[13px] font-medium leading-snug"
          style={{ color: checked ? INK : MUTED }}
        >
          {label}
        </span>
        {sublabel && (
          <p className="text-[11px] mt-0.5 leading-snug" style={{ color: MUTED, opacity: 0.7 }}>
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

  // Phase: 1=items, 2=experience+NPS, 3=signature, 4=thank you, 5=skip form
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<{ id: string } | null>(null);

  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  const [jobPhotos, setJobPhotos] = useState<PhotoItem[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);

  // Phase 1
  const [photosReviewedByClient, setPhotosReviewedByClient] = useState(false);
  const [inventoryReviewedByClient, setInventoryReviewedByClient] = useState(false);
  const [allItemsReceived, setAllItemsReceived] = useState(true);
  const [itemsLeftBehind, setItemsLeftBehind] = useState("");
  const [conditionAccepted, setConditionAccepted] = useState(true);
  const [walkthroughConductedByClient, setWalkthroughConductedByClient] = useState(false);
  const [clientPresentDuringUnloading, setClientPresentDuringUnloading] = useState(false);
  const [preExistingConditionsNoted, setPreExistingConditionsNoted] = useState(false);
  const [exceptions, setExceptions] = useState("");

  // Phase 2
  const [rating, setRating] = useState<number | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [noIssuesDuringMove, setNoIssuesDuringMove] = useState(false);
  const [noDamages, setNoDamages] = useState(false);
  const [walkthroughCompleted, setWalkthroughCompleted] = useState(false);
  const [crewConductedProfessionally, setCrewConductedProfessionally] = useState(false);
  const [crewWoreProtection, setCrewWoreProtection] = useState(false);
  const [furnitureReassembled, setFurnitureReassembled] = useState<boolean | null>(null);
  const [itemsPlacedCorrectly, setItemsPlacedCorrectly] = useState(false);
  const [propertyLeftClean, setPropertyLeftClean] = useState(false);
  const [noPropertyDamage, setNoPropertyDamage] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");

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

  const router = useRouter();

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => { setGeoLat(pos.coords.latitude); setGeoLng(pos.coords.longitude); },
        () => {}
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
        const [signoffRes, photosRes] = await Promise.all([
          fetch(`/api/crew/signoff/${id}?jobType=${jobType}`),
          fetch(`/api/crew/photos/${id}?jobType=${jobType}`),
        ]);
        if (cancelled) return;
        const signoffData = signoffRes.ok ? await signoffRes.json() : null;
        const photosData = photosRes.ok ? await photosRes.json() : { photos: [] };
        if (signoffData?.id) setExisting(signoffData);
        const photos = Array.isArray(photosData) ? photosData : photosData?.photos || [];
        setJobPhotos(photos);
      } catch {
        // continue with empty state
      } finally {
        if (!cancelled) { setPhotosLoading(false); setLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
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
    const x = ("touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y = ("touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top) * scaleY;
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
    const x = ("touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left) * scaleX;
    const y = ("touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top) * scaleY;
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
      if (ctx) { ctx.clearRect(0, 0, canvas.width, canvas.height); setSignature(""); }
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
          photosReviewedByClient: jobPhotos.length > 0 ? photosReviewedByClient : true,
          satisfactionRating: rating,
          npsScore,
          noIssuesDuringMove,
          noDamages,
          walkthroughCompleted,
          crewConductedProfessionally,
          crewWoreProtection,
          furnitureReassembled: furnitureReassembled === null ? null : furnitureReassembled,
          itemsPlacedCorrectly,
          propertyLeftClean,
          noPropertyDamage,
          feedbackNote: feedbackNote.trim() || null,
          exceptions: [
            itemsLeftBehind.trim() ? `Items not received / left behind: ${itemsLeftBehind.trim()}` : null,
            exceptions.trim() || null,
          ].filter(Boolean).join("\n\n") || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(
          data.code === "SCHEMA_UPDATE_REQUIRED"
            ? "A system update is needed. Please contact your dispatch or try again in a few minutes."
            : data.error || "Failed to submit"
        );
        setSubmitting(false);
        return;
      }
      setPhase(4);
    } catch {
      setError("Connection error");
    }
    setSubmitting(false);
  };

  const handleSkipSubmit = async () => {
    if (!skipReason) return;
    setSkipSubmitting(true);
    try {
      await fetch("/api/crew/signoff/skip", {
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
      router.push(`/crew/dashboard/job/${jobType}/${id}`);
    } catch {
      setSkipSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center" style={{ background: BG }}>
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#C9A962]/30 border-t-[#C9A962] animate-spin" />
          <p className="text-[13px]" style={{ color: MUTED }}>Loading…</p>
        </div>
      </main>
    );
  }

  if (existing) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4" style={{ background: BG }}>
        <div className="text-center max-w-sm">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-5"
            style={{ backgroundColor: `${GOLD}15` }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={GOLD} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className="font-hero text-[26px] font-semibold mb-2" style={{ color: INK }}>Already Signed</h1>
          <p className="text-[14px] mb-6" style={{ color: MUTED }}>This job has already been signed off.</p>
          <Link
            href={`/crew/dashboard/job/${jobType}/${id}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-[13px] transition-opacity hover:opacity-85"
            style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
          >
            <ChevronLeft size={14} /> Back to Job
          </Link>
        </div>
      </main>
    );
  }

  const phase1Valid =
    (jobPhotos.length === 0 || photosReviewedByClient) &&
    inventoryReviewedByClient &&
    walkthroughConductedByClient &&
    ((allItemsReceived && conditionAccepted) || exceptions.trim().length > 0 || itemsLeftBehind.trim().length > 0);

  const phase2Valid =
    !!rating &&
    noIssuesDuringMove &&
    noDamages &&
    walkthroughCompleted &&
    crewConductedProfessionally &&
    noPropertyDamage &&
    itemsPlacedCorrectly &&
    propertyLeftClean &&
    npsScore !== null;

  const STEP_LABELS = ["Items", "Experience", "Sign"];

  return (
    <main className="min-h-screen" style={{ background: BG, fontFamily: "'DM Sans', sans-serif" }}>
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

      <div className="max-w-[420px] mx-auto px-4 py-6 pb-16">

        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/crew/dashboard/job/${jobType}/${id}`}
            className="flex items-center gap-1 text-[13px] font-medium py-1.5 pr-3 -ml-1 rounded-lg transition-colors hover:opacity-70"
            style={{ color: MUTED }}
          >
            <ChevronLeft size={15} /> Back
          </Link>
          <YugoWordmark />
          <div className="w-14" />
        </div>

        {/* Step progress (phases 1–3) */}
        {phase >= 1 && phase <= 3 && (
          <div className="flex items-center gap-1.5 mb-8">
            {STEP_LABELS.map((label, i) => {
              const step = i + 1;
              const done = phase > step;
              const active = phase === step;
              return (
                <div key={label} className="flex items-center gap-1.5 flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                        done
                          ? "bg-[#C9A962] text-[#1A1A1A]"
                          : active
                          ? "bg-[#1A1A1A] text-white shadow-sm"
                          : "bg-[#E8E4DC] text-[#AAA]"
                      }`}
                    >
                      {done ? <CheckMark size={9} /> : step}
                    </div>
                    <span
                      className="text-[9px] mt-1 font-bold tracking-wide uppercase"
                      style={{ color: active ? INK : "#BBB6AD" }}
                    >
                      {label}
                    </span>
                  </div>
                  {i < STEP_LABELS.length - 1 && (
                    <div
                      className="flex-1 h-px transition-colors duration-300 mt-[-14px]"
                      style={{ backgroundColor: phase > step ? `${GOLD}60` : BORDER }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Phase 1: Items Confirmation ── */}
        {phase === 1 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: `${GOLD}AA` }}>
                Step 1 of 3
              </p>
              <h1 className="font-hero text-[28px] font-semibold leading-tight" style={{ color: INK }}>
                Items Confirmation
              </h1>
              <p className="text-[13px] mt-1.5 leading-snug" style={{ color: MUTED }}>
                Review and confirm all belongings were received in good condition.
              </p>
            </div>

            {/* Photo gallery */}
            {!photosLoading && jobPhotos.length > 0 && (
              <div className="mb-5">
                <p className="text-[10px] font-bold uppercase tracking-widest mb-2.5" style={{ color: MUTED }}>
                  Crew Photos ({jobPhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {jobPhotos.slice(0, 9).map((p) => (
                    <div key={p.id} className="aspect-square rounded-xl overflow-hidden" style={{ background: BORDER }}>
                      <img src={p.url} alt={p.category} className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {jobPhotos.length > 9 && (
                    <div
                      className="aspect-square rounded-xl flex items-center justify-center text-[12px] font-semibold"
                      style={{ background: BORDER, color: MUTED }}
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
                  <p className="text-[11px] font-semibold mb-1.5" style={{ color: MUTED }}>Items not received or left behind</p>
                  <textarea
                    value={itemsLeftBehind}
                    onChange={(e) => setItemsLeftBehind(e.target.value)}
                    placeholder="List any items not received or left behind…"
                    className="w-full p-3.5 rounded-xl border bg-white text-[13px] outline-none transition-colors"
                    style={{ color: INK, borderColor: BORDER }}
                    rows={3}
                  />
                </div>
              )}
              <ToggleCard checked={conditionAccepted} onChange={setConditionAccepted} label="Everything in good condition" />
              <ToggleCard checked={walkthroughConductedByClient} onChange={setWalkthroughConductedByClient} label="Walkthrough conducted by client" />
              <ToggleCard checked={clientPresentDuringUnloading} onChange={setClientPresentDuringUnloading} label="I was present during unloading" />
              <ToggleCard checked={preExistingConditionsNoted} onChange={setPreExistingConditionsNoted} label="Pre-existing conditions were noted before the move" />
              {!conditionAccepted && (
                <textarea
                  value={exceptions}
                  onChange={(e) => setExceptions(e.target.value)}
                  placeholder="Describe any damage or condition issues…"
                  className="w-full p-3.5 rounded-xl border bg-white text-[13px] outline-none transition-colors"
                  style={{ color: INK, borderColor: BORDER }}
                  rows={3}
                />
              )}
            </div>

            <button
              onClick={() => setPhase(2)}
              disabled={!phase1Valid}
              className="w-full py-3.5 rounded-full font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              Continue to Rating
            </button>
          </div>
        )}

        {/* ── Phase 2: Experience + NPS ── */}
        {phase === 2 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: `${GOLD}AA` }}>
                Step 2 of 3
              </p>
              <h1 className="font-hero text-[28px] font-semibold leading-tight" style={{ color: INK }}>
                How was your experience?
              </h1>
              <p className="text-[13px] mt-1.5" style={{ color: MUTED }}>
                Your feedback helps us keep our standards high.
              </p>
            </div>

            {/* Star rating */}
            <div className="mb-6">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>Overall Rating</p>
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
                <p className="text-center text-[13px] font-semibold pop-in" style={{ color: GOLD }}>
                  {RATING_LABELS[rating]}
                </p>
              )}
            </div>

            {/* NPS */}
            <div className="mb-6 p-4 rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
              <p className="text-[13px] font-semibold mb-0.5" style={{ color: INK }}>
                How likely are you to recommend us?
              </p>
              <p className="text-[11px] mb-3.5" style={{ color: MUTED }}>0 = Not at all &nbsp;·&nbsp; 10 = Absolutely</p>
              <div className="flex flex-nowrap justify-between gap-1 overflow-x-auto pb-1">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                  const isSelected = npsScore === n;
                  let bg = BORDER;
                  let textC = MUTED;
                  if (isSelected) {
                    if (n <= 6) { bg = "#EF4444"; textC = "white"; }
                    else if (n <= 8) { bg = "#F59E0B"; textC = "white"; }
                    else { bg = "#22C55E"; textC = "white"; }
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNpsScore(n)}
                      className={`shrink-0 w-8 h-8 rounded-full text-[12px] font-bold transition-all ${isSelected ? "scale-115 shadow-sm" : "hover:opacity-80"}`}
                      style={{ backgroundColor: bg, color: textC }}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {npsScore !== null && (
                <p
                  className="text-center text-[11px] mt-2 font-semibold pop-in"
                  style={{ color: npsScore >= 9 ? "#22C55E" : npsScore >= 7 ? "#F59E0B" : "#EF4444" }}
                >
                  {NPS_LABELS[npsScore]}
                </p>
              )}
            </div>

            {/* Confirmation checkboxes */}
            <div className="mb-5">
              <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
                Please confirm the following
              </p>
              <div className="space-y-2.5">
                <ToggleCard checked={noIssuesDuringMove} onChange={setNoIssuesDuringMove} label="No issues experienced during my move" />
                <ToggleCard checked={noDamages} onChange={setNoDamages} label="No damages to my belongings" />
                <ToggleCard checked={noPropertyDamage} onChange={setNoPropertyDamage} label="No damage to walls, floors, or doorways" />
                <ToggleCard checked={walkthroughCompleted} onChange={setWalkthroughCompleted} label="Walkthrough completed with the crew" />
                <ToggleCard checked={crewConductedProfessionally} onChange={setCrewConductedProfessionally} label="Crew conducted themselves professionally" />
                <ToggleCard checked={crewWoreProtection} onChange={setCrewWoreProtection} label="Crew used floor and wall protection" />

                {/* Furniture reassembly */}
                <div className="p-4 rounded-2xl border bg-white" style={{ borderColor: BORDER }}>
                  <p className="text-[13px] font-medium mb-3" style={{ color: INK }}>
                    All disassembled furniture was reassembled
                  </p>
                  <div className="flex gap-2">
                    {(["yes", "no", "na"] as const).map((opt) => {
                      const value = opt === "yes" ? true : opt === "no" ? false : null;
                      const isSelected = furnitureReassembled === value;
                      const label = opt === "yes" ? "Yes" : opt === "no" ? "No" : "N/A";
                      return (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFurnitureReassembled(value)}
                          className={`flex-1 py-2 rounded-full text-[12px] font-semibold transition-all border ${
                            isSelected ? "border-transparent" : "border-[#E8E4DC]"
                          }`}
                          style={
                            isSelected
                              ? { backgroundColor: GOLD, color: "#1A1A1A" }
                              : { color: MUTED }
                          }
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <ToggleCard checked={itemsPlacedCorrectly} onChange={setItemsPlacedCorrectly} label="All items placed in the correct rooms" />
                <ToggleCard checked={propertyLeftClean} onChange={setPropertyLeftClean} label="Property left clean and free of debris" />
              </div>
            </div>

            <textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Optional feedback or comments…"
              className="w-full p-3.5 rounded-xl border bg-white text-[13px] outline-none transition-colors mb-5"
              style={{ color: INK, borderColor: BORDER }}
              rows={2}
            />

            <button
              onClick={() => setPhase(3)}
              disabled={!phase2Valid}
              className="w-full py-3.5 rounded-full font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              Continue to Sign
            </button>
          </div>
        )}

        {/* ── Phase 3: Signature ── */}
        {phase === 3 && (
          <div className="phase-enter">
            <div className="mb-7">
              <p className="text-[10px] font-bold tracking-[0.12em] uppercase mb-1.5" style={{ color: `${GOLD}AA` }}>
                Step 3 of 3
              </p>
              <h1 className="font-hero text-[28px] font-semibold leading-tight" style={{ color: INK }}>
                Sign to confirm
              </h1>
              <p className="text-[13px] mt-1.5" style={{ color: MUTED }}>
                Your signature finalizes the sign-off record.
              </p>
            </div>

            <div className="mb-5">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-2" style={{ color: MUTED }}>
                Your full name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="e.g. Jane Smith"
                className="w-full px-4 py-3 rounded-xl border bg-white text-[14px] outline-none transition-colors"
                style={{ color: INK, borderColor: BORDER }}
              />
            </div>

            {/* Signature canvas — ink-on-paper look */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest" style={{ color: MUTED }}>
                  <PenLine size={11} /> Signature
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-[11px] font-semibold transition-opacity hover:opacity-60"
                  style={{ color: GOLD }}
                >
                  Clear
                </button>
              </div>
              <div
                className="relative rounded-2xl overflow-hidden border-2"
                style={{
                  borderColor: BORDER,
                  backgroundColor: "#FDFCF8",
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
              <p className="flex items-center gap-1.5 text-[11px] mt-1.5" style={{ color: MUTED }}>
                <PenLine size={10} /> Sign with your finger or stylus
              </p>
            </div>

            {/* Legal disclosure */}
            <div
              className="p-4 rounded-2xl mb-5"
              style={{ backgroundColor: `${GOLD}08`, border: `1px solid ${GOLD}28` }}
            >
              <p className="text-[11px] leading-relaxed" style={{ color: FOREST }}>
                By signing, I confirm all items listed were received as described. I understand I have{" "}
                <strong style={{ color: INK }}>24 hours</strong> from this sign-off to report any concealed damage not visible during the walkthrough. After this period, the condition of items is considered accepted.
              </p>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200">
                <p className="text-[12px] text-red-700 font-semibold">{error}</p>
              </div>
            )}

            <button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim()}
              className="w-full py-3.5 rounded-full font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              {submitting ? "Submitting…" : "Confirm & Sign Off"}
            </button>
          </div>
        )}

        {/* ── Phase 4: Thank You ── */}
        {phase === 4 && (
          <div className="phase-enter text-center py-12">
            {/* Animated success ring */}
            <div className="relative inline-flex items-center justify-center mb-7">
              <div
                className="absolute w-20 h-20 rounded-full"
                style={{ backgroundColor: `${GOLD}18`, animation: "sparkleRing 2s ease-out 0.15s infinite" }}
              />
              <div
                className="absolute w-20 h-20 rounded-full"
                style={{ backgroundColor: `${GOLD}10`, animation: "sparkleRing 2s ease-out 0.7s infinite" }}
              />
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center pop-in text-[#1A1A1A]"
                style={{ backgroundColor: GOLD }}
              >
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            </div>

            <h1 className="font-hero text-[32px] font-semibold mb-2" style={{ color: INK }}>
              Thank you{clientName ? `, ${clientName.split(" ")[0]}` : ""}!
            </h1>
            <p className="text-[15px] mb-1" style={{ color: MUTED }}>
              We hope you love your new space.
            </p>
            <p className="text-[14px] font-semibold" style={{ color: FOREST }}>
              Welcome home.
            </p>
            <p className="text-[11px] mt-5 mb-8 max-w-[270px] mx-auto leading-relaxed" style={{ color: MUTED }}>
              A confirmation receipt has been generated. If you notice any concealed damage within 24 hours, please contact us immediately.
            </p>
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}`}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-[14px] transition-opacity hover:opacity-85"
              style={{ backgroundColor: GOLD, color: "#1A1A1A" }}
            >
              <ChevronLeft size={14} /> Back to Job
            </Link>
          </div>
        )}

        {/* ── Phase 5: Skip Form ── */}
        {phase === 5 && (
          <div className="phase-enter">
            <div className="mb-7">
              <h1 className="font-hero text-[28px] font-semibold" style={{ color: INK }}>Skip Sign-Off</h1>
              <p className="text-[13px] mt-1.5" style={{ color: MUTED }}>
                Please provide a reason for skipping the client sign-off.
              </p>
            </div>

            <div className="space-y-2.5 mb-5">
              <label className="block text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: MUTED }}>
                Reason
              </label>
              {SKIP_REASONS.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setSkipReason(r.value)}
                  className={`w-full flex items-center gap-3.5 p-4 rounded-2xl border text-left transition-all ${
                    skipReason === r.value
                      ? "border-red-400/50 bg-red-50"
                      : "border-[#E8E4DC] bg-white hover:border-red-200"
                  }`}
                >
                  <div
                    className={`w-4.5 h-4.5 w-[18px] h-[18px] rounded-full shrink-0 border-2 flex items-center justify-center ${
                      skipReason === r.value ? "border-red-400 bg-red-400" : "border-[#D8D3CA]"
                    }`}
                  >
                    {skipReason === r.value && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                  </div>
                  <span
                    className="text-[13px] font-medium"
                    style={{ color: skipReason === r.value ? "#DC2626" : INK }}
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
              className="w-full p-3.5 rounded-xl border bg-white text-[13px] outline-none transition-colors mb-4"
              style={{ color: INK, borderColor: BORDER }}
              rows={3}
            />

            {geoLat && (
              <p className="text-[10px] mb-4" style={{ color: MUTED }}>
                Location captured ({geoLat.toFixed(4)}, {geoLng?.toFixed(4)})
              </p>
            )}

            <button
              onClick={handleSkipSubmit}
              disabled={skipSubmitting || !skipReason || (skipReason === "other" && !skipNote.trim())}
              className="w-full py-3.5 rounded-full font-semibold text-[14px] transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-40 bg-red-500 text-white mb-3"
            >
              {skipSubmitting ? "Submitting…" : "Confirm Skip"}
            </button>

            <button
              type="button"
              onClick={() => setPhase(1)}
              className="w-full py-3 rounded-full font-medium text-[13px] border transition-colors"
              style={{ color: MUTED, borderColor: BORDER }}
            >
              Go back
            </button>
          </div>
        )}

        {/* Skip link — visible in phases 1–3 */}
        {phase >= 1 && phase <= 3 && (
          <p className="text-center mt-8">
            <button
              type="button"
              onClick={() => setPhase(5)}
              className="text-[11px] transition-colors hover:text-[#C9A962]"
              style={{ color: MUTED }}
            >
              Client not available — skip sign-off
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

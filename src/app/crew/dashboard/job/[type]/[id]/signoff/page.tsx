"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";

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

function Checkbox({
  checked,
  onChange,
  label,
  textColor,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  textColor: string;
}) {
  return (
    <label className="flex items-center gap-3 p-4 rounded-xl border border-[#E0DDD8] bg-white">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-5 h-5 rounded"
      />
      <span style={{ color: textColor }}>{label}</span>
    </label>
  );
}

export default function ClientSignOffPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";

  // Phase: 1=photos+items, 2=experience+NPS, 3=signature, 4=thank you, 5=skip form
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<{ id: string } | null>(null);

  // Geolocation
  const [geoLat, setGeoLat] = useState<number | null>(null);
  const [geoLng, setGeoLng] = useState<number | null>(null);

  // Photo gate
  const [jobPhotos, setJobPhotos] = useState<PhotoItem[]>([]);
  const [photosLoading, setPhotosLoading] = useState(true);
  const [photosReviewedByClient, setPhotosReviewedByClient] = useState(false);

  // Phase 1: Items confirmation
  const [clientName, setClientName] = useState("");
  const [allItemsReceived, setAllItemsReceived] = useState(true);
  const [conditionAccepted, setConditionAccepted] = useState(true);
  const [walkthroughConductedByClient, setWalkthroughConductedByClient] = useState(false);
  const [clientPresentDuringUnloading, setClientPresentDuringUnloading] = useState(false);
  const [preExistingConditionsNoted, setPreExistingConditionsNoted] = useState(false);
  const [exceptions, setExceptions] = useState("");

  // Phase 2: Experience + new checkboxes
  const [rating, setRating] = useState<number | null>(null);
  const [npsScore, setNpsScore] = useState<number | null>(null);
  const [noIssuesDuringMove, setNoIssuesDuringMove] = useState(false);
  const [noDamages, setNoDamages] = useState(false);
  const [walkthroughCompleted, setWalkthroughCompleted] = useState(false);
  const [crewConductedProfessionally, setCrewConductedProfessionally] = useState(false);
  const [crewWoreProtection, setCrewWoreProtection] = useState(false);
  /** true = Yes, false = No, null = N/A (does not apply) */
  const [furnitureReassembled, setFurnitureReassembled] = useState<boolean | null>(null);
  const [itemsPlacedCorrectly, setItemsPlacedCorrectly] = useState(false);
  const [propertyLeftClean, setPropertyLeftClean] = useState(false);
  const [noPropertyDamage, setNoPropertyDamage] = useState(false);
  const [feedbackNote, setFeedbackNote] = useState("");

  // Phase 3: Signature
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Skip tracking (Phase 5)
  const [skipping, setSkipping] = useState(false);
  const [skipReason, setSkipReason] = useState("");
  const [skipNote, setSkipNote] = useState("");
  const [skipSubmitting, setSkipSubmitting] = useState(false);

  const router = useRouter();

  // Request geolocation on mount
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGeoLat(pos.coords.latitude);
          setGeoLng(pos.coords.longitude);
        },
        () => {}
      );
    }
  }, []);

  // Init canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [phase]);

  // Check existing sign-off + load photos
  useEffect(() => {
    Promise.all([
      fetch(`/api/crew/signoff/${id}?jobType=${jobType}`).then((r) => r.json()),
      fetch(`/api/crew/photos/${id}?jobType=${jobType}`).then((r) => r.json()).catch(() => []),
    ])
      .then(([signoffData, photosData]) => {
        if (signoffData?.id) setExisting(signoffData);
        const photos = Array.isArray(photosData) ? photosData : photosData?.photos || [];
        setJobPhotos(photos);
        setPhotosLoading(false);
      })
      .catch(() => { setPhotosLoading(false); })
      .finally(() => setLoading(false));
  }, [id, jobType]);

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    isDrawing.current = true;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
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
    const x = "touches" in e ? e.touches[0].clientX - rect.left : (e as React.MouseEvent).clientX - rect.left;
    const y = "touches" in e ? e.touches[0].clientY - rect.top : (e as React.MouseEvent).clientY - rect.top;
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
          photosReviewedByClient,
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
          exceptions: exceptions.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to submit");
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
      <main className="min-h-screen bg-[#FAF8F4] flex items-center justify-center">
        <p className="text-[#555]">Loading…</p>
      </main>
    );
  }

  if (existing) {
    return (
      <main className="min-h-screen bg-[#FAF8F4] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <h1 className="font-hero text-2xl text-[#1A1A1A] mb-2">Already Signed</h1>
          <p className="text-[#555] mb-6">This job has already been signed off.</p>
          <Link
            href={`/crew/dashboard/job/${jobType}/${id}`}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-[#C9A962] hover:bg-[#D4B56C]"
          >
            <span aria-hidden>←</span> Back to Job
          </Link>
        </div>
      </main>
    );
  }

  const bg = "#FAF8F4";
  const textColor = "#1A1A1A";
  const mutedColor = "#555";

  const phase1Valid =
    (allItemsReceived && conditionAccepted) || exceptions.trim().length > 0;

  const phase2Valid =
    !!rating &&
    noIssuesDuringMove &&
    noDamages &&
    walkthroughCompleted &&
    crewConductedProfessionally &&
    noPropertyDamage &&
    npsScore !== null;

  return (
    <main className="min-h-screen" style={{ background: bg, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[420px] mx-auto px-4 py-8">
        <Link
          href={`/crew/dashboard/job/${jobType}/${id}`}
          className="inline-flex items-center gap-2 py-2.5 px-3 -ml-3 rounded-lg text-[13px] font-medium mb-4 border border-transparent hover:border-[#C9A962]/40 transition-colors"
          style={{ color: mutedColor }}
        >
          <span aria-hidden>←</span> Back to Job
        </Link>

        {/* ── Phase 1: Photo Review + Items Confirmation ── */}
        {phase === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="font-hero text-2xl mb-1" style={{ color: textColor }}>
                Items Confirmation
              </h1>
              <p className="text-sm mt-2" style={{ color: mutedColor }}>
                Review photos and confirm all items were received.
              </p>
            </div>

            {/* Photo gallery gate */}
            {!photosLoading && jobPhotos.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase mb-2" style={{ color: mutedColor }}>
                  Crew-documented photos ({jobPhotos.length})
                </p>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {jobPhotos.slice(0, 9).map((p) => (
                    <div
                      key={p.id}
                      className="aspect-square rounded-lg overflow-hidden bg-[#E0DDD8]"
                    >
                      <img
                        src={p.url}
                        alt={p.category}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                  {jobPhotos.length > 9 && (
                    <div className="aspect-square rounded-lg bg-[#E0DDD8] flex items-center justify-center text-sm font-medium" style={{ color: mutedColor }}>
                      +{jobPhotos.length - 9} more
                    </div>
                  )}
                </div>
                <Checkbox
                  checked={photosReviewedByClient}
                  onChange={setPhotosReviewedByClient}
                  label="I have reviewed the photos taken by the crew"
                  textColor={textColor}
                />
              </div>
            )}

            <div className="space-y-3 mb-6">
              <Checkbox checked={allItemsReceived} onChange={setAllItemsReceived} label="All items received" textColor={textColor} />
              <Checkbox checked={conditionAccepted} onChange={setConditionAccepted} label="Everything in good condition" textColor={textColor} />
              <Checkbox checked={walkthroughConductedByClient} onChange={setWalkthroughConductedByClient} label="Walkthrough conducted by client" textColor={textColor} />
              <Checkbox checked={clientPresentDuringUnloading} onChange={setClientPresentDuringUnloading} label="I was present during unloading" textColor={textColor} />
              <Checkbox checked={preExistingConditionsNoted} onChange={setPreExistingConditionsNoted} label="Pre-existing conditions were noted before the move" textColor={textColor} />

              {(!allItemsReceived || !conditionAccepted) && (
                <textarea
                  value={exceptions}
                  onChange={(e) => setExceptions(e.target.value)}
                  placeholder="Please describe any issues..."
                  className="w-full p-4 rounded-xl border border-[#E0DDD8] bg-white text-sm"
                  style={{ color: textColor }}
                  rows={3}
                />
              )}
            </div>

            <button
              onClick={() => setPhase(2)}
              disabled={!phase1Valid}
              className="w-full py-4 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              Continue to Rating
            </button>
          </div>
        )}

        {/* ── Phase 2: Experience + NPS + Confirmation Checkboxes ── */}
        {phase === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="font-hero text-2xl mb-1" style={{ color: textColor }}>
                How was your experience?
              </h1>
            </div>

            {/* Star rating */}
            <div className="flex justify-center gap-2 mb-3">
              {[1, 2, 3, 4, 5].map((n) => {
                const isFilled = rating != null && n <= rating;
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    className={`w-12 h-12 rounded-full text-xl transition-transform ${
                      isFilled
                        ? "bg-[#C9A962] text-[var(--btn-text-on-accent)]"
                        : "bg-[#E0DDD8] hover:bg-[#C9A962]/30"
                    } ${rating === n ? "scale-110" : ""}`}
                    style={!isFilled ? { color: mutedColor } : undefined}
                  >
                    {isFilled ? "★" : "☆"}
                  </button>
                );
              })}
            </div>
            {rating && (
              <p className="text-center text-sm mb-5" style={{ color: mutedColor }}>
                {RATING_LABELS[rating]}
              </p>
            )}

            {/* NPS Score - single horizontal row */}
            <div className="mb-5">
              <p className="text-sm font-medium mb-2" style={{ color: textColor }}>
                How likely are you to recommend us? (0–10)
              </p>
              <div className="flex flex-nowrap justify-center gap-1 overflow-x-auto pb-1">
                {Array.from({ length: 11 }, (_, i) => i).map((n) => {
                  const isSelected = npsScore === n;
                  let bg_color = "bg-[#E0DDD8]";
                  if (isSelected) {
                    if (n <= 6) bg_color = "bg-red-400";
                    else if (n <= 8) bg_color = "bg-yellow-400";
                    else bg_color = "bg-green-500";
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setNpsScore(n)}
                      className={`shrink-0 w-9 h-9 rounded-lg text-sm font-medium transition-all ${bg_color} ${
                        isSelected ? "text-white scale-110 ring-2 ring-offset-1 ring-[#C9A962]" : ""
                      }`}
                      style={!isSelected ? { color: mutedColor } : undefined}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              {npsScore !== null && (
                <p className="text-center text-xs mt-1.5" style={{ color: mutedColor }}>
                  {NPS_LABELS[npsScore]}
                </p>
              )}
              <div className="flex justify-between text-[10px] mt-1 px-1" style={{ color: mutedColor }}>
                <span>Not likely</span>
                <span>Extremely likely</span>
              </div>
            </div>

            {/* Confirmation checkboxes */}
            <div className="space-y-3 mb-4">
              <p className="text-sm font-medium" style={{ color: textColor }}>
                Please confirm the following:
              </p>
              <Checkbox checked={noIssuesDuringMove} onChange={setNoIssuesDuringMove} label="I did not experience any issues during my move" textColor={textColor} />
              <Checkbox checked={noDamages} onChange={setNoDamages} label="No damages to my belongings to report" textColor={textColor} />
              <Checkbox checked={noPropertyDamage} onChange={setNoPropertyDamage} label="No damage to walls, floors, doorways, or stairwells" textColor={textColor} />
              <Checkbox checked={walkthroughCompleted} onChange={setWalkthroughCompleted} label="I completed the walkthrough with the crew" textColor={textColor} />
              <Checkbox checked={crewConductedProfessionally} onChange={setCrewConductedProfessionally} label="The crew conducted themselves professionally" textColor={textColor} />
              <Checkbox checked={crewWoreProtection} onChange={setCrewWoreProtection} label="The crew used floor/wall protection during the move" textColor={textColor} />
              {/* Furniture reassembled: Yes / No / N/A */}
              <div className="p-4 rounded-xl border border-[#E0DDD8] bg-white">
                <p className="text-sm font-medium mb-2" style={{ color: textColor }}>
                  All disassembled furniture was reassembled
                </p>
                <div className="flex flex-wrap gap-2">
                  {(["yes", "no", "na"] as const).map((opt) => {
                    const value = opt === "yes" ? true : opt === "no" ? false : null;
                    const isSelected = furnitureReassembled === value;
                    const label = opt === "yes" ? "Yes" : opt === "no" ? "No" : "N/A — Does not apply";
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setFurnitureReassembled(value)}
                        className={`px-4 py-2.5 rounded-xl border-2 font-medium transition-colors ${
                          isSelected ? "border-[#C9A962] bg-[#C9A962]/10 text-[#C9A962]" : "border-[#E0DDD8]"
                        }`}
                        style={!isSelected ? { color: mutedColor } : undefined}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>
              <Checkbox checked={itemsPlacedCorrectly} onChange={setItemsPlacedCorrectly} label="All items were placed in the correct rooms" textColor={textColor} />
              <Checkbox checked={propertyLeftClean} onChange={setPropertyLeftClean} label="The crew left the property clean and free of debris" textColor={textColor} />
            </div>

            <textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Optional feedback..."
              className="w-full p-4 rounded-xl border border-[#E0DDD8] bg-white text-sm mb-6"
              style={{ color: textColor }}
              rows={2}
            />

            <button
              onClick={() => setPhase(3)}
              disabled={!phase2Valid}
              className="w-full py-4 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              Continue to Sign
            </button>
          </div>
        )}

        {/* ── Phase 3: Signature ── */}
        {phase === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="font-hero text-2xl mb-1" style={{ color: textColor }}>
                Almost done — sign to confirm
              </h1>
            </div>
            <div className="mb-4">
              <label
                className="block text-xs font-semibold mb-2 uppercase"
                style={{ color: mutedColor }}
              >
                Your name
              </label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl border border-[#E0DDD8] bg-white"
                style={{ color: textColor }}
              />
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label
                  className="text-xs font-semibold uppercase"
                  style={{ color: mutedColor }}
                >
                  Signature
                </label>
                <button
                  type="button"
                  onClick={clearSignature}
                  className="text-xs text-[#C9A962] font-medium"
                >
                  Clear
                </button>
              </div>
              <canvas
                ref={canvasRef}
                width={340}
                height={120}
                className="w-full border-2 border-[#E0DDD8] rounded-xl bg-white touch-none"
                style={{ maxWidth: "100%" }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
              <p className="text-xs mt-1" style={{ color: mutedColor }}>
                Sign with your finger or stylus
              </p>
            </div>

            {/* Legal disclosure */}
            <div className="p-3 rounded-xl bg-[#E0DDD8]/30 mb-4">
              <p className="text-[11px] leading-relaxed" style={{ color: mutedColor }}>
                By signing, I confirm all items listed were received as described. I understand I
                have <strong>24 hours</strong> from this sign-off to report any concealed damage not
                visible during the walkthrough. After this period, the condition of items is
                considered accepted.
              </p>
            </div>

            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim()}
              className="w-full py-4 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting…" : "Confirm & Sign Off"}
            </button>
          </div>
        )}

        {/* ── Phase 4: Thank You ── */}
        {phase === 4 && (
          <div className="text-center py-12 animate-fade-in">
            <h1
              className="font-hero text-2xl font-semibold mb-2"
              style={{ color: textColor }}
            >
              Thank you{clientName ? `, ${clientName.split(" ")[0]}` : ""}!
            </h1>
            <p className="mb-4" style={{ color: mutedColor }}>
              We hope you love your new space. Welcome home.
            </p>
            <p className="text-xs mb-8" style={{ color: mutedColor }}>
              A confirmation receipt has been generated. If you notice any concealed damage within
              24 hours, please contact us immediately.
            </p>
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}`}
              className="inline-flex items-center gap-2 mt-4 px-6 py-3 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-[#C9A962] hover:bg-[#D4B56C]"
            >
              <span aria-hidden>←</span> Back to Job
            </Link>
          </div>
        )}

        {/* ── Phase 5: Skip Form ── */}
        {phase === 5 && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="font-hero text-2xl mb-1" style={{ color: textColor }}>
                Skip Sign-Off
              </h1>
              <p className="text-sm mt-2" style={{ color: mutedColor }}>
                Please provide a reason for skipping the client sign-off.
              </p>
            </div>

            <div className="space-y-3 mb-4">
              <label className="block text-xs font-semibold uppercase" style={{ color: mutedColor }}>
                Reason
              </label>
              {SKIP_REASONS.map((r) => (
                <label
                  key={r.value}
                  className={`flex items-center gap-3 p-4 rounded-xl border bg-white transition-colors ${
                    skipReason === r.value ? "border-[#C9A962]" : "border-[#E0DDD8]"
                  }`}
                >
                  <input
                    type="radio"
                    name="skipReason"
                    value={r.value}
                    checked={skipReason === r.value}
                    onChange={() => setSkipReason(r.value)}
                    className="w-5 h-5"
                  />
                  <span style={{ color: textColor }}>{r.label}</span>
                </label>
              ))}
            </div>

            <textarea
              value={skipNote}
              onChange={(e) => setSkipNote(e.target.value)}
              placeholder="Additional details (required for 'Other')..."
              className="w-full p-4 rounded-xl border border-[#E0DDD8] bg-white text-sm mb-4"
              style={{ color: textColor }}
              rows={3}
            />

            {geoLat && (
              <p className="text-[10px] mb-3" style={{ color: mutedColor }}>
                Location captured ({geoLat.toFixed(4)}, {geoLng?.toFixed(4)})
              </p>
            )}

            <button
              onClick={handleSkipSubmit}
              disabled={
                skipSubmitting ||
                !skipReason ||
                (skipReason === "other" && !skipNote.trim())
              }
              className="w-full py-4 rounded-xl font-semibold text-[var(--btn-text-on-accent)] bg-red-500 hover:bg-red-600 disabled:opacity-50 transition-colors"
            >
              {skipSubmitting ? "Submitting…" : "Confirm Skip"}
            </button>

            <button
              type="button"
              onClick={() => setPhase(1)}
              className="w-full py-3 mt-3 rounded-xl font-medium border border-[#E0DDD8] transition-colors"
              style={{ color: mutedColor }}
            >
              Go back
            </button>
          </div>
        )}

        {/* Skip link — visible in phases 1-3 */}
        {phase >= 1 && phase <= 3 && (
          <p className="text-center mt-8">
            <button
              type="button"
              onClick={() => setPhase(5)}
              className="text-xs hover:text-[#C9A962] disabled:opacity-50"
              style={{ color: mutedColor }}
            >
              Client not available — skip
            </button>
          </p>
        )}
      </div>
    </main>
  );
}

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

export default function ClientSignOffPage({
  params,
}: {
  params: Promise<{ type: string; id: string }>;
}) {
  const { type, id } = use(params);
  const jobType = type === "delivery" ? "delivery" : "move";
  const [phase, setPhase] = useState(1);
  const [loading, setLoading] = useState(true);
  const [existing, setExisting] = useState<{ id: string } | null>(null);
  const [clientName, setClientName] = useState("");
  const [allItemsReceived, setAllItemsReceived] = useState(true);
  const [conditionAccepted, setConditionAccepted] = useState(true);
  const [exceptions, setExceptions] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [feedbackNote, setFeedbackNote] = useState("");
  const [signature, setSignature] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [skipped, setSkipped] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1A1A1A";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, [phase]);

  useEffect(() => {
    fetch(`/api/crew/signoff/${id}?jobType=${jobType}`)
      .then((r) => r.json())
      .then((d) => {
        if (d?.id) setExisting(d);
      })
      .catch(() => {})
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
          allItemsReceived,
          conditionAccepted,
          satisfactionRating: rating,
          wouldRecommend,
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
          <h1 className="font-serif text-2xl text-[#1A1A1A] mb-2">Already Signed</h1>
          <p className="text-[#555] mb-6">This job has already been signed off.</p>
          <Link href={`/crew/dashboard/job/${jobType}/${id}`} className="text-[#C9A962] font-semibold hover:underline">
            ← Back to Job
          </Link>
        </div>
      </main>
    );
  }

  const bg = "#FAF8F4";
  const text = "#1A1A1A";
  const muted = "#555";

  return (
    <main className="min-h-screen" style={{ background: bg, fontFamily: "'DM Sans', sans-serif" }}>
      <div className="max-w-[420px] mx-auto px-4 py-8">
        {phase === 1 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="font-serif text-2xl text-[text] mb-1">Y U G O</h1>
              <div className="w-16 h-0.5 bg-[#C9A962] mx-auto my-3" />
              <h2 className="text-lg font-semibold text-[text]">Items Confirmation</h2>
              <p className="text-sm text-[muted] mt-2">Confirm that all items were received as described.</p>
            </div>
            <div className="space-y-4 mb-6">
              <label className="flex items-center gap-3 p-4 rounded-xl border border-[#E0DDD8] bg-white">
                <input
                  type="checkbox"
                  checked={allItemsReceived}
                  onChange={(e) => setAllItemsReceived(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-[text]">All items received</span>
              </label>
              <label className="flex items-center gap-3 p-4 rounded-xl border border-[#E0DDD8] bg-white">
                <input
                  type="checkbox"
                  checked={conditionAccepted}
                  onChange={(e) => setConditionAccepted(e.target.checked)}
                  className="w-5 h-5 rounded"
                />
                <span className="text-[text]">Everything in good condition</span>
              </label>
              {(!allItemsReceived || !conditionAccepted) && (
                <textarea
                  value={exceptions}
                  onChange={(e) => setExceptions(e.target.value)}
                  placeholder="Please describe any issues..."
                  className="w-full p-4 rounded-xl border border-[#E0DDD8] bg-white text-[text] placeholder:text-[muted] text-sm"
                  rows={3}
                />
              )}
            </div>
            <button
              onClick={() => setPhase(2)}
              disabled={(!allItemsReceived || !conditionAccepted) && !exceptions.trim()}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              Continue to Rating
            </button>
          </div>
        )}

        {phase === 2 && (
          <div className="animate-fade-in">
            <div className="text-center mb-8">
              <h1 className="font-serif text-2xl text-[text] mb-1">Y U G O</h1>
              <div className="w-16 h-0.5 bg-[#C9A962] mx-auto my-3" />
              <h2 className="text-lg font-semibold text-[text]">How was your experience?</h2>
            </div>
            <div className="flex justify-center gap-2 mb-4">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className={`w-12 h-12 rounded-full text-xl transition-transform ${
                    rating === n ? "bg-[#C9A962] text-white scale-110" : "bg-[#E0DDD8] text-[muted] hover:bg-[#C9A962]/30"
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            {rating && <p className="text-center text-sm text-[muted] mb-4">{RATING_LABELS[rating]}</p>}
            <div className="mb-4">
              <p className="text-sm font-medium text-[text] mb-2">Would you recommend Yugo?</p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWouldRecommend(true)}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium transition-colors ${
                    wouldRecommend === true ? "border-[#C9A962] bg-[#C9A962]/10 text-[#C9A962]" : "border-[#E0DDD8] text-[muted]"
                  }`}
                >
                  Absolutely
                </button>
                <button
                  type="button"
                  onClick={() => setWouldRecommend(false)}
                  className={`flex-1 py-3 rounded-xl border-2 font-medium transition-colors ${
                    wouldRecommend === false ? "border-[#C9A962] bg-[#C9A962]/10 text-[#C9A962]" : "border-[#E0DDD8] text-[muted]"
                  }`}
                >
                  Not sure
                </button>
              </div>
            </div>
            <textarea
              value={feedbackNote}
              onChange={(e) => setFeedbackNote(e.target.value)}
              placeholder="Optional feedback..."
              className="w-full p-4 rounded-xl border border-[#E0DDD8] bg-white text-[text] placeholder:text-[muted] text-sm mb-6"
              rows={2}
            />
            <button
              onClick={() => setPhase(3)}
              disabled={!rating}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              Continue to Sign
            </button>
          </div>
        )}

        {phase === 3 && (
          <div className="animate-fade-in">
            <div className="text-center mb-6">
              <h1 className="font-serif text-2xl text-[text] mb-1">Y U G O</h1>
              <div className="w-16 h-0.5 bg-[#C9A962] mx-auto my-3" />
              <h2 className="text-lg font-semibold text-[text]">Almost done — sign to confirm</h2>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-semibold text-[muted] mb-2 uppercase">Your name</label>
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl border border-[#E0DDD8] bg-white text-[text] placeholder:text-[muted]"
              />
            </div>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label className="text-xs font-semibold text-[muted] uppercase">Signature</label>
                <button type="button" onClick={clearSignature} className="text-xs text-[#C9A962] font-medium">
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
              <p className="text-xs text-[muted] mt-1">Sign with your finger or stylus</p>
            </div>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={submitting || !clientName.trim()}
              className="w-full py-4 rounded-xl font-semibold text-white bg-[#C9A962] hover:bg-[#D4B56C] disabled:opacity-50 transition-colors"
            >
              {submitting ? "Submitting…" : "Confirm & Sign Off"}
            </button>
            <p className="text-xs text-[muted] mt-4 text-center">
              By signing, you confirm the items listed were received as described.
            </p>
          </div>
        )}

        {phase === 4 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="text-5xl mb-4">🎉</div>
            <h1 className="text-2xl font-semibold text-[text] mb-2">Thank you{clientName ? `, ${clientName.split(" ")[0]}` : ""}!</h1>
            <p className="text-[muted] mb-6">We hope you love your new space. Welcome home.</p>
            <div className="w-16 h-0.5 bg-[#C9A962] mx-auto my-4" />
            <p className="font-serif text-[#C9A962]">Y U G O</p>
            <p className="text-xs text-[muted] mt-1">The art of moving.</p>
            <Link
              href={`/crew/dashboard/job/${jobType}/${id}`}
              className="inline-block mt-8 px-6 py-3 rounded-xl font-semibold text-white bg-[#C9A962] hover:bg-[#D4B56C]"
            >
              Back to Job
            </Link>
          </div>
        )}

        <p className="text-center mt-8">
          <button
            type="button"
            onClick={async () => {
              setSkipping(true);
              try {
                await fetch("/api/crew/signoff/skip", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ jobId: id, jobType }),
                });
                router.push(`/crew/dashboard/job/${jobType}/${id}`);
              } catch {
                setSkipping(false);
              }
            }}
            disabled={skipping}
            className="text-xs text-[muted] hover:text-[#C9A962] disabled:opacity-50"
          >
            {skipping ? "Skipping…" : "Client not available — skip"}
          </button>
        </p>
      </div>
    </main>
  );
}

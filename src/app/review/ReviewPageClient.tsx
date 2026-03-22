"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { WINE, GOLD, CREAM, FOREST } from "@/lib/client-theme";
import { Star } from "@phosphor-icons/react";

const STAR_SIZE = 36;

function StarIcon({ filled, size = 24 }: { filled: boolean; size?: number }) {
  return (
    <Star
      size={size}
      weight={filled ? "fill" : "regular"}
      className="text-current transition-colors"
      aria-hidden
    />
  );
}

type State = {
  googleReviewUrl: string;
  clientRating: number | null;
  clientFeedback: string | null;
  reviewClicked: boolean;
};

export default function ReviewPageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [state, setState] = useState<State | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) {
      setInvalid(true);
      setLoading(false);
      return;
    }
    const ratingFromUrl = searchParams.get("rating");
    const urlRating =
      ratingFromUrl != null ? parseInt(ratingFromUrl, 10) : NaN;
    const validUrlRating = Number.isInteger(urlRating) && urlRating >= 1 && urlRating <= 5 ? urlRating : null;

    fetch(`/api/review/state?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInvalid(true);
          return;
        }
        setState({
          googleReviewUrl: data.googleReviewUrl || "https://g.page/r/CU67iDN6TgMIEB0/review/",
          clientRating: data.clientRating ?? null,
          clientFeedback: data.clientFeedback ?? null,
          reviewClicked: data.reviewClicked ?? false,
        });
        if (data.clientRating != null) setSelectedRating(data.clientRating);
        else if (validUrlRating != null) setSelectedRating(validUrlRating);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token, searchParams]);

  const saveRating = useCallback(
    async (rating: number, feedbackText?: string) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch("/api/review/experience-rating", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, rating, ...(feedbackText != null && { feedback: feedbackText }) }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError((data.error as string) || "Could not save.");
          return false;
        }
        setState((prev) =>
          prev
            ? {
                ...prev,
                clientRating: rating,
                ...(feedbackText != null && { clientFeedback: feedbackText }),
                ...(rating >= 4 && { reviewClicked: true }),
              }
            : null
        );
        if (rating >= 4 && data.redirectUrl) {
          window.location.href = data.redirectUrl;
          return true;
        }
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [token]
  );

  const handleLeaveReviewClick = useCallback(async () => {
    if (selectedRating == null || selectedRating < 4 || !state) return;
    const ok = await saveRating(selectedRating);
    if (ok && state.googleReviewUrl) {
      window.location.href = state.googleReviewUrl;
    }
  }, [selectedRating, state, saveRating]);

  const handleSubmitFeedback = useCallback(async () => {
    if (selectedRating == null || selectedRating < 1 || selectedRating > 3) return;
    const ok = await saveRating(selectedRating, feedback.trim());
    if (ok) setFeedbackSubmitted(true);
  }, [selectedRating, feedback, saveRating]);

  const getStarFromClientX = useCallback((clientX: number): number => {
    const el = starsRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = rect.width;
    if (w <= 0) return 1;
    const ratio = Math.min(1, Math.max(0, x / w));
    return Math.min(5, Math.max(1, Math.ceil(ratio * 5)));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: "linear-gradient(180deg, #0F0F0F 0%, #1a1a1a 100%)" }}>
        <Image src="/images/yugo-logo-cream.png" alt="Yugo" width={120} height={36} className="opacity-90 mb-6" />
        <p className="text-[var(--text-base)]" style={{ color: CREAM }}>Loading…</p>
      </div>
    );
  }

  if (invalid || !state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center" style={{ background: "linear-gradient(180deg, #0F0F0F 0%, #1a1a1a 100%)" }}>
        <Image src="/images/yugo-logo-cream.png" alt="Yugo" width={120} height={36} className="opacity-90 mb-6" />
        <h1 className="font-semibold text-[18px] mb-2" style={{ color: CREAM }}>Invalid or expired link</h1>
        <p className="text-[13px] max-w-[280px]" style={{ color: "rgba(250,247,242,0.8)" }}>
          This review link may have expired. If you received this from Yugo, please use the latest link from your email.
        </p>
      </div>
    );
  }

  // Only lock stars after 4–5 star + "Leave a Review on Google" clicked; otherwise allow changing selection
  const showFilledStarsOnly =
    state.clientRating != null && state.clientRating >= 4 && state.reviewClicked;
  const isInteractive = !showFilledStarsOnly;
  const rating = isInteractive
    ? (selectedRating ?? state.clientRating)
    : (state.clientRating ?? selectedRating);
  const isHighRating = rating != null && rating >= 4;
  const isLowRating = rating != null && rating <= 3;

  return (
    <div className="min-h-screen flex flex-col items-center px-4 py-8" style={{ background: "linear-gradient(180deg, #0F0F0F 0%, #1a1a1a 100%)" }}>
      <Image src="/images/yugo-logo-cream.png" alt="Yugo" width={120} height={36} className="opacity-95 mb-6" priority />
      <div
        className="flex flex-col items-center text-center w-full max-w-[340px] rounded-2xl p-6 sm:p-8"
        style={{ backgroundColor: "rgba(250,247,242,0.06)", border: `1px solid rgba(184,181,176,0.2)` }}
      >
        <h1
          className="font-hero text-[20px] font-semibold leading-tight mb-1"
          style={{ color: CREAM }}
        >
          How was your experience?
        </h1>
        <p className="text-[12px] mb-5" style={{ color: "rgba(250,247,242,0.7)" }}>Your feedback helps us improve</p>

        <div
          ref={starsRef}
          className="flex items-center justify-center gap-1.5 mb-2 select-none"
          role={showFilledStarsOnly ? "img" : "group"}
          onPointerDown={
            isInteractive
              ? (e) => {
                  const value =
                    (e.target as HTMLElement).closest("[data-star-value]")?.getAttribute("data-star-value");
                  setSelectedRating(value ? Number(value) : getStarFromClientX(e.clientX));
                  setError(null);
                }
              : undefined
          }
          onPointerMove={
            isInteractive && "buttons" in (window?.event ?? {})
              ? (e) => {
                  if (e.buttons === 1) setSelectedRating(getStarFromClientX(e.clientX));
                }
              : undefined
          }
          style={{ touchAction: "none" }}
        >
          {[1, 2, 3, 4, 5].map((value) => {
            const filled =
              showFilledStarsOnly
                ? value <= (state.clientRating ?? 0)
                : rating != null && value <= rating;
            const isCurrent = rating === value;
            return (
              <button
                key={value}
                type="button"
                data-star-value={value}
                disabled={!isInteractive || submitting}
                onClick={() => {
                  if (!isInteractive) return;
                  setSelectedRating(value);
                  setError(null);
                }}
                className="p-2 rounded-full transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-[var(--gold)] disabled:opacity-70 touch-manipulation min-w-[44px] min-h-[44px] flex items-center justify-center"
                style={{
                  color: filled ? GOLD : "rgba(250,247,242,0.4)",
                  backgroundColor: "transparent",
                  transform: isCurrent && isInteractive ? "scale(1.15)" : "scale(1)",
                  cursor: isInteractive ? "pointer" : "default",
                }}
                aria-label={`${value} star${value === 1 ? "" : "s"}`}
              >
                <StarIcon filled={filled} size={STAR_SIZE} />
              </button>
            );
          })}
        </div>

        {error && <p className="text-[11px] text-red-500 mb-2">{error}</p>}

        {rating != null && (
          <div className="mt-4 w-full space-y-3">
            {isHighRating && (
              <>
                <p className="text-[13px] font-medium" style={{ color: CREAM }}>
                  We&apos;re glad you had a great experience!
                </p>
                {state.reviewClicked ? (
                  <p className="text-[11px] opacity-70" style={{ color: CREAM }}>
                    Thanks for leaving a review!
                  </p>
                ) : (
                  <button
                    type="button"
                    onClick={handleLeaveReviewClick}
                    disabled={submitting}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold text-[12px] py-2.5 px-4 border-2 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                    style={{ borderColor: GOLD, color: GOLD, backgroundColor: "transparent" }}
                  >
                    <StarIcon filled size={14} />
                    {submitting ? "Saving…" : "Leave a Review on Google"}
                  </button>
                )}
              </>
            )}

            {isLowRating && (
              <>
                <p className="text-[13px] font-medium" style={{ color: CREAM }}>
                  We&apos;re sorry to hear that. How can we improve?
                </p>
                {!feedbackSubmitted ? (
                  <>
                    <textarea
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      placeholder="Tell us what we could do better (optional)"
                      rows={4}
                      className="w-full rounded-xl border px-3 py-2.5 text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 placeholder:opacity-60"
                      style={{ backgroundColor: "rgba(250,247,242,0.08)", borderColor: "rgba(184,181,176,0.3)", color: CREAM }}
                    />
                    <button
                      type="button"
                      onClick={handleSubmitFeedback}
                      disabled={submitting}
                      className="w-full rounded-xl font-semibold text-[13px] py-3 px-4 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                      style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
                    >
                      {submitting ? "Submitting…" : "Submit feedback"}
                    </button>
                  </>
                ) : (
                  <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                    Thanks for your feedback. We&apos;ll use it to improve.
                  </p>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

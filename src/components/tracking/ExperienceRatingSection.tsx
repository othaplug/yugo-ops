"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { WINE, FOREST, GOLD } from "@/lib/client-theme";
import { GoogleLogo, Star } from "@phosphor-icons/react";

interface ExperienceRatingSectionProps {
  moveId: string;
  token: string;
}

type FetchState = {
  reviewRequestId: string | null;
  googleReviewUrl: string;
  clientRating: number | null;
  clientFeedback: string | null;
  reviewClicked: boolean;
};

const STAR_SIZE = 36;

/** Parse response as JSON without throwing on HTML (e.g. 404/500 pages). */
async function safeJson(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  try {
    const t = text.trim();
    if (t.startsWith("{") || t.startsWith("[")) return JSON.parse(t) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return {};
}

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

export default function ExperienceRatingSection({ moveId, token }: ExperienceRatingSectionProps) {
  const [fetchState, setFetchState] = useState<FetchState | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedRating, setSelectedRating] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const starsRef = useRef<HTMLDivElement>(null);

  const fetchReviewState = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/review-request?token=${encodeURIComponent(token)}`
      );
      const data = await safeJson(res);
      if (!res.ok) {
        setFetchState({
          reviewRequestId: null,
          googleReviewUrl: "https://g.page/r/CU67iDN6TgMIEB0/review/",
          clientRating: null,
          clientFeedback: null,
          reviewClicked: false,
        });
        return;
      }
      const reviewRequestId = typeof data.reviewRequestId === "string" ? data.reviewRequestId : null;
      const googleReviewUrl = typeof data.googleReviewUrl === "string" ? data.googleReviewUrl : "https://g.page/r/CU67iDN6TgMIEB0/review/";
      const clientRating = typeof data.clientRating === "number" ? data.clientRating : null;
      const clientFeedback = typeof data.clientFeedback === "string" ? data.clientFeedback : null;
      setFetchState({
        reviewRequestId,
        googleReviewUrl,
        clientRating,
        clientFeedback,
        reviewClicked: data.reviewClicked === true,
      });
      if (clientRating != null) setSelectedRating(clientRating);
    } finally {
      setLoading(false);
    }
  }, [moveId, token]);

  useEffect(() => {
    fetchReviewState();
  }, [fetchReviewState]);

  /** Save rating to server (called when user clicks Google or submits feedback). */
  const saveRating = useCallback(
    async (rating: number, feedbackText?: string) => {
      setError(null);
      setSubmitting(true);
      try {
        const res = await fetch(
          `/api/track/moves/${moveId}/experience-rating?token=${encodeURIComponent(token)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rating, ...(feedbackText != null && { feedback: feedbackText }) }),
          }
        );
        const data = await safeJson(res);
        if (!res.ok) {
          setError((data.error as string) || "Could not save.");
          return false;
        }
        setFetchState((prev) =>
          prev
            ? {
                ...prev,
                reviewRequestId: (data.reviewRequestId as string) ?? prev.reviewRequestId,
                clientRating: rating,
                ...(feedbackText != null && { clientFeedback: feedbackText }),
              }
            : null
        );
        return true;
      } catch {
        setError("Something went wrong.");
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [moveId, token]
  );

  /** Resolve star index from x position (for swipe). Equal segments so star 5 is easy to hit. */
  const getStarFromClientX = useCallback((clientX: number): number => {
    const el = starsRef.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    const w = rect.width;
    if (w <= 0) return 1;
    const ratio = Math.min(1, Math.max(0, x / w));
    const index = Math.min(5, Math.max(1, Math.ceil(ratio * 5)));
    return index;
  }, []);

  const handlePointerDown = useCallback(
    (e: React.PointerEvent) => {
      const value = "target" in e && (e.target as HTMLElement).closest("[data-star-value]")
        ? Number((e.target as HTMLElement).closest("[data-star-value]")?.getAttribute("data-star-value"))
        : getStarFromClientX(e.clientX);
      setSelectedRating(value);
      setError(null);
    },
    [getStarFromClientX]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons !== 1) return;
      const value = getStarFromClientX(e.clientX);
      setSelectedRating(value);
    },
    [getStarFromClientX]
  );

  const handleLeaveReviewClick = useCallback(async () => {
    if (selectedRating == null || selectedRating < 4 || !fetchState?.googleReviewUrl) return;
    // Open in same user gesture to avoid popup blockers; then save rating
    window.open(fetchState.googleReviewUrl, "_blank", "noopener,noreferrer");
    const ok = await saveRating(selectedRating);
    if (ok) {
      setFetchState((prev) => (prev ? { ...prev, reviewClicked: true } : null));
    }
  }, [selectedRating, fetchState?.googleReviewUrl, saveRating]);

  const handleSubmitFeedback = useCallback(async () => {
    if (selectedRating == null || selectedRating < 1 || selectedRating > 3) return;
    const ok = await saveRating(selectedRating, feedback.trim());
    if (ok) setFeedbackSubmitted(true);
  }, [selectedRating, feedback, saveRating]);

  if (loading || !fetchState) {
    return (
      <div className="flex justify-center py-6">
        <div className="text-[12px] opacity-50" style={{ color: FOREST }}>
          Loading…
        </div>
      </div>
    );
  }

  // Only lock stars after 4–5 star + "Leave a Review on Google" clicked; otherwise allow changing selection
  const showFilledStarsOnly =
    fetchState.clientRating != null &&
    fetchState.clientRating >= 4 &&
    fetchState.reviewClicked;
  const isInteractive = !showFilledStarsOnly;
  // When interactive, prefer local selection so clicking a different star updates the UI
  const rating = isInteractive
    ? (selectedRating ?? fetchState.clientRating)
    : (fetchState.clientRating ?? selectedRating);
  const isHighRating = rating != null && rating >= 4;
  const isLowRating = rating != null && rating <= 3;

  return (
    <div className="flex flex-col items-center text-center max-w-[320px] mx-auto w-full py-4">
      <h3
        className="font-hero text-[20px] font-semibold leading-tight mb-4"
        style={{ color: WINE }}
      >
        How was your experience?
      </h3>

      {/* Stars row: swipe/tap to select; persist only when user clicks Google or submits feedback */}
      <div
        ref={starsRef}
        className="flex items-center justify-center gap-1.5 mb-2 select-none"
        role={showFilledStarsOnly ? "img" : "group"}
        aria-label={
          showFilledStarsOnly
            ? `Rated ${fetchState.clientRating} out of 5 stars`
            : "Rate your experience 1 to 5 stars"
        }
        onPointerDown={isInteractive ? handlePointerDown : undefined}
        onPointerMove={isInteractive ? handlePointerMove : undefined}
        onPointerLeave={isInteractive ? () => {} : undefined}
        style={{ touchAction: "none" }}
      >
        {[1, 2, 3, 4, 5].map((value) => {
          const filled =
            showFilledStarsOnly
              ? value <= (fetchState.clientRating ?? 0)
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
                color: filled ? GOLD : `${FOREST}40`,
                backgroundColor: "transparent",
                transform: isCurrent && isInteractive ? "scale(1.15)" : "scale(1)",
                ...(isInteractive ? { cursor: "pointer" } : { cursor: "default" }),
              }}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
            >
              <StarIcon filled={filled} size={STAR_SIZE} />
            </button>
          );
        })}
      </div>

      {error && (
        <p className="text-[11px] text-red-600 mb-2">{error}</p>
      )}

      {/* After star selection: 4-5 show Google CTA (saves on click); 1-3 show feedback form */}
      {rating != null && (
        <div className="mt-4 w-full space-y-3">
          {isHighRating && (
            <>
              <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                We&apos;re glad you had a great experience!
              </p>
              {fetchState.reviewClicked ? (
                <p className="text-[11px] opacity-70" style={{ color: FOREST }}>
                  Thanks for leaving a review!
                </p>
              ) : (selectedRating ?? 0) >= 4 ? (
                <button
                  type="button"
                  onClick={handleLeaveReviewClick}
                  disabled={submitting}
                  className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-[12px] font-semibold border transition-all hover:opacity-80 disabled:opacity-60"
                  style={{ borderColor: `${GOLD}40`, color: GOLD, backgroundColor: `${GOLD}08` }}
                >
                  <GoogleLogo size={14} className="shrink-0" aria-hidden />
                  {submitting ? "Saving…" : "Leave a Google Review"}
                </button>
              ) : null}
            </>
          )}

          {isLowRating && (
            <>
              <p className="text-[13px] font-medium" style={{ color: FOREST }}>
                We&apos;re sorry to hear that. How can we improve?
              </p>
              {!feedbackSubmitted ? (
                <>
                  <textarea
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    placeholder="Your feedback (optional)"
                    rows={3}
                    className="w-full rounded-lg border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-offset-0"
                    style={{
                      borderColor: `${FOREST}25`,
                      color: FOREST,
                      backgroundColor: "white",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSubmitFeedback}
                    disabled={submitting}
                    className="w-full rounded-lg font-semibold text-[12px] py-2.5 px-4 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                    style={{ backgroundColor: GOLD, color: "#FAF7F2" }}
                  >
                    {submitting ? "Submitting…" : "Submit Feedback"}
                  </button>
                </>
              ) : (
                <p className="text-[11px] opacity-70" style={{ color: FOREST }}>
                  Thanks for your feedback. We&apos;ll use it to improve.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

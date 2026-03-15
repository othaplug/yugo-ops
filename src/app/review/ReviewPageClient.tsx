"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { WINE, GOLD, CREAM } from "@/lib/client-theme";

const STAR_SIZE = 36;

function StarIcon({ filled, size = 24 }: { filled: boolean; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="transition-colors"
    >
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
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
    fetch(`/api/review/state?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setInvalid(true);
          return;
        }
        setState({
          googleReviewUrl: data.googleReviewUrl || "https://g.page/r/yugo-moving/review",
          clientRating: data.clientRating ?? null,
          clientFeedback: data.clientFeedback ?? null,
          reviewClicked: data.reviewClicked ?? false,
        });
        if (data.clientRating != null) setSelectedRating(data.clientRating);
      })
      .catch(() => setInvalid(true))
      .finally(() => setLoading(false));
  }, [token]);

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
      <div className="min-h-screen flex items-center justify-center bg-[#0F0F0F] px-4">
        <p className="text-[14px] text-[#B8B5B0]">Loading…</p>
      </div>
    );
  }

  if (invalid || !state) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#0F0F0F] px-4 text-center">
        <h1 className="font-semibold text-[18px] text-[#F5F5F3] mb-2">Invalid or expired link</h1>
        <p className="text-[13px] text-[#B8B5B0]">
          This review link may have expired. If you received this from Yugo, please use the latest link from your email.
        </p>
      </div>
    );
  }

  const rating = state.clientRating ?? selectedRating;
  const isHighRating = rating != null && rating >= 4;
  const isLowRating = rating != null && rating <= 3;
  const showFilledStarsOnly =
    state.clientRating != null && state.clientRating >= 4 && state.reviewClicked;
  const isInteractive = !showFilledStarsOnly && state.clientRating == null;

  return (
    <div className="min-h-screen bg-[#0F0F0F] flex flex-col items-center justify-center px-4 py-8">
      <div className="flex flex-col items-center text-center max-w-[320px] w-full">
        <h1
          className="font-hero text-[20px] font-semibold leading-tight mb-4"
          style={{ color: WINE }}
        >
          How was your experience?
        </h1>

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
                      placeholder="Your feedback (optional)"
                      rows={3}
                      className="w-full rounded-lg border px-3 py-2 text-[12px] resize-none focus:outline-none focus:ring-2 focus:ring-offset-0 bg-white border-[#2A2A2A] text-[#1a1a1a]"
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
                  <p className="text-[11px] opacity-70" style={{ color: CREAM }}>
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

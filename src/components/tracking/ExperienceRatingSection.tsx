"use client";

import { useState, useEffect, useCallback } from "react";
import { WINE, FOREST, TEXT_MUTED_ON_LIGHT } from "@/lib/client-theme";
import { CaretRight } from "@phosphor-icons/react";

interface ExperienceRatingSectionProps {
  moveId: string;
  token: string;
}

const FALLBACK_GOOGLE = "https://g.page/r/CU67iDN6TgMIEB0/review/";

function safeJson(res: Response): Promise<Record<string, unknown>> {
  return res
    .text()
    .then((t) => (t.startsWith("{") || t.startsWith("[") ? (JSON.parse(t) as Record<string, unknown>) : {}))
    .catch(() => ({}));
}

/**
 * Review prompt on the tracking page. No star rating and no gate (Google policy):
 * one "Leave a Google review" link, shown to everyone. Private feedback comes by
 * replying to our text or email. Previously this was a star gate that routed 4-5
 * to Google and 1-3 to a private form.
 */
export default function ExperienceRatingSection({ moveId, token }: ExperienceRatingSectionProps) {
  const [googleUrl, setGoogleUrl] = useState<string>(FALLBACK_GOOGLE);

  const load = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/track/moves/${moveId}/review-request?token=${encodeURIComponent(token)}`,
      );
      const data = await safeJson(res);
      if (typeof data.googleReviewUrl === "string" && data.googleReviewUrl.trim()) {
        setGoogleUrl(data.googleReviewUrl);
      }
    } catch {
      /* keep fallback */
    }
  }, [moveId, token]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ borderColor: `${FOREST}12`, background: "#fff" }}
    >
      <div className="px-5 py-5">
        <div className="text-[11px] font-bold uppercase tracking-[0.12em]" style={{ color: `${FOREST}99` }}>
          A note of thanks
        </div>
        <h3 className="font-hero mt-1.5" style={{ fontSize: 20, color: WINE, lineHeight: 1.3 }}>
          How was your move?
        </h3>
        <p className="text-[13px] leading-relaxed mt-2" style={{ color: TEXT_MUTED_ON_LIGHT }}>
          A moment to share your experience on Google would mean the world to our team, and help
          another family feel this same peace of mind.
        </p>

        <a
          href={googleUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl py-3 text-[13px] font-bold transition-opacity hover:opacity-90 active:scale-[0.99]"
          style={{ background: WINE, color: "#F9EDE4" }}
        >
          Leave a Google review
          <CaretRight size={14} weight="bold" />
        </a>

        <p className="text-[11px] leading-relaxed mt-3" style={{ color: TEXT_MUTED_ON_LIGHT }}>
          If anything could have been better, simply reply to our text or email. It comes straight
          to us.
        </p>
      </div>
    </div>
  );
}

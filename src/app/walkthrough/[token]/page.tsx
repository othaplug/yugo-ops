"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { CheckCircle, CircleNotch, Check, ArrowRight } from "@phosphor-icons/react";

interface WalkthroughItem {
  id: string;
  room: string | null;
  itemName: string;
  quantity: number;
}

interface WalkthroughData {
  moveId: string;
  clientName: string | null;
  status: string | null;
  alreadyConfirmed: boolean;
  crewNotes: string | null;
  items: WalkthroughItem[];
  trackUrl: string;
}

type PageState = "loading" | "error" | "ready" | "confirmed";

export default function RemoteWalkthroughPage() {
  const { token } = useParams<{ token: string }>();

  const [pageState, setPageState] = useState<PageState>("loading");
  const [data, setData] = useState<WalkthroughData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/walkthrough/${token}`);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "This link is invalid or has expired.");
      }
      const json = (await res.json()) as WalkthroughData;
      setData(json);
      setPageState(json.alreadyConfirmed ? "confirmed" : "ready");
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      setPageState("error");
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirm = async () => {
    if (!confirmed || submitting) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/walkthrough/${token}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmed: true }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not submit confirmation. Please try again.");
      }
      setPageState("confirmed");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Submission failed.");
    } finally {
      setSubmitting(false);
    }
  };

  const firstName = data?.clientName?.split(" ")[0] ?? null;

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center">
        <CircleNotch size={28} className="animate-spin text-[#5C1A33]/40" aria-hidden />
      </div>
    );
  }

  if (pageState === "error") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-xl font-bold tracking-[4px] text-[#2B0416] mb-6">YUGO</p>
          <p className="text-base font-medium text-[#2B0416] mb-2">Link not found</p>
          <p className="text-sm text-gray-500">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (pageState === "confirmed") {
    return (
      <div className="min-h-screen bg-[#FAF7F2] flex items-center justify-center p-6">
        <div className="max-w-sm w-full text-center">
          <p className="text-xl font-bold tracking-[4px] text-[#2B0416] mb-8">YUGO</p>
          <div className="w-16 h-16 rounded-full bg-[#2C3E2D]/10 flex items-center justify-center mx-auto mb-5">
            <CheckCircle size={32} weight="fill" className="text-[#2C3E2D]" aria-hidden />
          </div>
          <h2 className="text-lg font-medium text-[#2B0416] mb-2">
            {firstName ? `Thank you, ${firstName}` : "Confirmed"}
          </h2>
          <p className="text-sm text-gray-500 mb-8">
            Your crew has been notified and your move is underway.
          </p>
          {data?.trackUrl && (
            <a
              href={data.trackUrl}
              className="inline-flex items-center gap-2 px-5 py-3 border border-[#5C1A33] text-[#5C1A33] rounded-lg text-sm font-medium"
            >
              Track your move
              <ArrowRight size={15} weight="bold" aria-hidden />
            </a>
          )}
        </div>
      </div>
    );
  }

  const itemsByRoom = (data?.items ?? []).reduce<Record<string, WalkthroughItem[]>>((acc, item) => {
    const room = item.room ?? "Other";
    if (!acc[room]) acc[room] = [];
    acc[room].push(item);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-[#FAF7F2] p-5 pb-10">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="text-center mb-7 pt-4">
          <p className="text-xl font-bold tracking-[4px] text-[#2B0416]">YUGO</p>
          <p className="text-xs text-gray-400 mt-1 tracking-wide uppercase">Move walkthrough</p>
        </div>

        <h1 className="text-xl font-serif text-[#2B0416] mb-2">
          {firstName ? `Hi ${firstName}, your crew has arrived` : "Your crew has arrived"}
        </h1>
        <p className="text-sm text-gray-500 leading-relaxed mb-6">
          Since you were not able to be there in person, please review your item list and confirm your crew can proceed. This takes about 2 minutes.
        </p>

        {/* Crew notes */}
        {data?.crewNotes && (
          <div className="mb-5 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-amber-700 mb-1">
              Note from your crew
            </p>
            <p className="text-sm text-amber-800 leading-relaxed">{data.crewNotes}</p>
          </div>
        )}

        {/* Item list */}
        {data && data.items.length > 0 && (
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400 mb-3">
              Items being moved
            </p>
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden divide-y divide-gray-50">
              {Object.entries(itemsByRoom).map(([room, roomItems]) => (
                <div key={room}>
                  <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                    {room}
                  </p>
                  {roomItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-2.5"
                    >
                      <span className="text-sm text-gray-700">{item.itemName}</span>
                      <span className="text-sm text-gray-400 ml-3 shrink-0">
                        {item.quantity > 1 ? `x${item.quantity}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {data && data.items.length === 0 && (
          <div className="mb-6 p-4 bg-white border border-gray-100 rounded-xl text-sm text-gray-500 text-center">
            No inventory list on file. Your coordinator will handle details.
          </div>
        )}

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 mb-5 cursor-pointer select-none">
          <button
            type="button"
            role="checkbox"
            aria-checked={confirmed}
            onClick={() => setConfirmed((v) => !v)}
            className={`mt-0.5 w-5 h-5 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${
              confirmed
                ? "bg-[#2C3E2D] border-[#2C3E2D]"
                : "bg-white border-gray-300"
            }`}
          >
            {confirmed && <Check size={12} weight="bold" color="white" aria-hidden />}
          </button>
          <span className="text-sm text-gray-600 leading-relaxed">
            I confirm the items and details above are correct. The crew may proceed with my move.
          </span>
        </label>

        {submitError && (
          <p className="text-sm text-red-600 mb-3">{submitError}</p>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={() => void handleConfirm()}
          disabled={!confirmed || submitting}
          className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-[0.08em] transition-all bg-[#5C1A33] text-[#FAF7F2] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <CircleNotch size={16} className="animate-spin shrink-0" aria-hidden />
              Confirming...
            </>
          ) : (
            <>
              Confirm and proceed
              <ArrowRight size={15} weight="bold" aria-hidden />
            </>
          )}
        </button>

        <p className="text-xs text-center text-gray-400 mt-5">
          If you have questions, please contact your coordinator directly.
        </p>
      </div>
    </div>
  );
}

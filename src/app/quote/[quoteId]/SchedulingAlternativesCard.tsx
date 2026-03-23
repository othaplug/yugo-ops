"use client";

import { useState, useEffect } from "react";
import { CalendarCheck, CircleNotch, CheckCircle, WarningCircle, Phone } from "@phosphor-icons/react";

interface SchedulingAlternative {
  id: string;
  alt_date: string;
  alt_window: string;
  team_name: string | null;
}

interface SchedulingAlternativesCardProps {
  moveId: string;
  accentColor?: string;
  forestColor?: string;
}

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

export default function SchedulingAlternativesCard({
  moveId,
  accentColor = "#C9A962",
  forestColor = "#1B3A2D",
}: SchedulingAlternativesCardProps) {
  const [status, setStatus] = useState<"loading" | "available" | "partial" | "unavailable" | "selected" | "none">("loading");
  const [alternatives, setAlternatives] = useState<SchedulingAlternative[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    fetch(`/api/client/scheduling-status?moveId=${moveId}`, { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { status: string; alternatives?: SchedulingAlternative[] }) => {
        if (d.status === "partial" && d.alternatives?.length) {
          setAlternatives(d.alternatives);
          setStatus("partial");
        } else if (d.status === "unavailable") {
          setStatus("unavailable");
        } else if (d.status === "available") {
          setStatus("available");
        } else {
          setStatus("none");
        }
      })
      .catch(() => setStatus("none"));
  }, [moveId]);

  async function handleSelect() {
    if (!selected) return;
    setSubmitting(true);
    try {
      await fetch("/api/client/select-scheduling-alternative", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ moveId, alternativeId: selected }),
      });
      setSubmitted(true);
      setStatus("selected");
    } catch {
      // silently fail
    } finally {
      setSubmitting(false);
    }
  }

  if (status === "loading") {
    return (
      <div className="mt-4 flex items-center gap-2 text-[12px]" style={{ color: `${forestColor}60` }}>
        <CircleNotch size={14} className="animate-spin" />
        Checking your time slot…
      </div>
    );
  }

  if (status === "none" || status === "available") return null;

  if (status === "selected" || submitted) {
    return (
      <div
        className="mt-6 rounded-2xl border-2 p-6 text-center"
        style={{ borderColor: `${accentColor}40`, backgroundColor: `${accentColor}08` }}
      >
        <CheckCircle size={28} className="mx-auto mb-3" style={{ color: accentColor }} />
        <p className="text-[14px] font-bold mb-1" style={{ color: forestColor }}>
          Time slot confirmed
        </p>
        <p className="text-[12px]" style={{ color: `${forestColor}70` }}>
          We have your preferred time. You&apos;ll receive a confirmation email shortly.
        </p>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div
        className="mt-6 rounded-2xl border p-5"
        style={{ borderColor: `${forestColor}20`, backgroundColor: `${forestColor}05` }}
      >
        <div className="flex items-start gap-3">
          <WarningCircle size={20} className="shrink-0 mt-0.5" style={{ color: accentColor }} />
          <div>
            <p className="text-[13px] font-bold mb-1" style={{ color: forestColor }}>
              Time slot update needed
            </p>
            <p className="text-[12px] leading-relaxed" style={{ color: `${forestColor}70` }}>
              Your move is confirmed! Our coordinator is finalizing your crew and time slot.
              You&apos;ll hear from us within 2 hours.
            </p>
            <a
              href="tel:+16473704525"
              className="inline-flex items-center gap-1.5 mt-3 text-[12px] font-semibold"
              style={{ color: accentColor }}
            >
              <Phone size={13} />
              If urgent, call (647) 370-4525
            </a>
          </div>
        </div>
      </div>
    );
  }

  // partial — show alternatives
  return (
    <div
      className="mt-6 rounded-2xl border p-5"
      style={{ borderColor: `${accentColor}30`, backgroundColor: `${accentColor}05` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <CalendarCheck size={18} style={{ color: accentColor }} />
        <p className="text-[13px] font-bold" style={{ color: forestColor }}>
          Select an available time slot
        </p>
      </div>
      <p className="text-[12px] mb-4" style={{ color: `${forestColor}70` }}>
        Your preferred time has limited availability. Please choose one of the alternatives below:
      </p>

      <div className="space-y-2 mb-4">
        {alternatives.map((alt) => (
          <label
            key={alt.id}
            className="flex items-center gap-3 p-3.5 rounded-xl cursor-pointer transition-all"
            style={{
              border: selected === alt.id ? `2px solid ${accentColor}` : `1px solid ${forestColor}20`,
              backgroundColor: selected === alt.id ? `${accentColor}10` : "transparent",
            }}
          >
            <div
              className="w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0"
              style={{
                borderColor: selected === alt.id ? accentColor : `${forestColor}40`,
                backgroundColor: selected === alt.id ? accentColor : "transparent",
              }}
            >
              {selected === alt.id && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
            </div>
            <input
              type="radio"
              className="sr-only"
              name="alt-slot"
              value={alt.id}
              checked={selected === alt.id}
              onChange={() => setSelected(alt.id)}
            />
            <div className="flex-1">
              <span className="text-[13px] font-semibold block" style={{ color: forestColor }}>
                {fmtDate(alt.alt_date)}
              </span>
              <span className="text-[11px]" style={{ color: `${forestColor}60` }}>
                {alt.alt_window}
                {alt.team_name ? ` · ${alt.team_name}` : ""}
              </span>
            </div>
          </label>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          disabled={!selected || submitting}
          onClick={handleSelect}
          className="w-full py-3 rounded-xl text-[13px] font-bold transition-opacity disabled:opacity-40"
          style={{ backgroundColor: accentColor, color: "#fff" }}
        >
          {submitting ? "Confirming…" : "Confirm Selection"}
        </button>
        <a
          href="tel:+16473704525"
          className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium"
          style={{ color: `${forestColor}50` }}
        >
          <Phone size={12} />
          Call us for other options: (647) 370-4525
        </a>
      </div>
    </div>
  );
}

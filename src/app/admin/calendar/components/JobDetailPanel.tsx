"use client";

import { useState } from "react";
import { formatPlatformDisplay } from "@/lib/date-format";
import type { CalendarEvent } from "@/lib/calendar/types";
import { formatTime12, TIME_SLOTS_15MIN } from "@/lib/calendar/types";
import { toTitleCase, formatAddressForDisplay } from "@/lib/format-text";
import { Icon } from "@/components/AppIcons";
import Link from "next/link";
import {
  CaretDown,
  CaretRight,
  X,
  Phone,
  EnvelopeSimple,
  User,
} from "@phosphor-icons/react";
import { formatPhone } from "@/lib/phone";
import { useTheme } from "@/app/admin/components/ThemeContext";

interface Props {
  event: CalendarEvent | null;
  crews: { id: string; name: string; memberCount: number }[];
  onClose: () => void;
  onRescheduled?: () => void;
}

const TYPE_LABELS: Record<string, string> = {
  move: "Move",
  delivery: "Delivery",
  bin_delivery: "Bin delivery",
  bin_pickup: "Bin pickup",
  project_phase: "Project Phase",
  project: "Project",
  move_project_day: "Move project day",
  blocked: "Blocked Time",
};

const REASSIGNABLE = ["move", "delivery", "blocked"];

/** Premium panel tokens (Yugo quote system: wine / forest / cream) */
const WINE = "#5C1A33";
const FOREST = "#2C3E2D";
const CREAM_INK = "rgba(255,251,247,0.92)";
const CREAM_MUTED = "rgba(255,251,247,0.62)";

const EYEBROW_LIGHT =
  "font-[family-name:var(--font-body)] text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[var(--tx3)]";

/** Completed jobs can only be edited if they have no time and no team assigned */
function canEditEvent(ev: CalendarEvent): boolean {
  if (ev.calendarStatus !== "completed") return true;
  const hasTime = !!(ev.start || ev.end);
  const hasTeam = !!ev.crewId;
  return !hasTime && !hasTeam;
}

export default function JobDetailPanel({
  event,
  crews,
  onClose,
  onRescheduled,
}: Props) {
  const { theme } = useTheme();
  const wineMode = theme === "dark";

  const [showReassign, setShowReassign] = useState(false);
  const [reassignCrewId, setReassignCrewId] = useState("");
  const [reassignDate, setReassignDate] = useState("");
  const [reassignStart, setReassignStart] = useState("08:00");
  const [reassignEnd, setReassignEnd] = useState("14:00");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [lastEventId, setLastEventId] = useState<string | null>(null);
  if (event && event.id !== lastEventId) {
    setLastEventId(event.id);
    setShowReassign(false);
    setReassignCrewId(event.crewId || "");
    setReassignDate(event.date || "");
    setReassignStart(event.start || "08:00");
    setReassignEnd(event.end || "14:00");
    setSaveError(null);
  }

  if (!event) return null;

  const timeStr = event.start
    ? event.end
      ? `${formatTime12(event.start)} – ${formatTime12(event.end)}`
      : formatTime12(event.start)
    : "Time not set";

  const canReassign =
    (REASSIGNABLE.includes(event.type) && canEditEvent(event)) ||
    (event.type === "move_project_day" &&
      !!event.moveProjectId &&
      event.calendarStatus !== "cancelled" &&
      event.calendarStatus !== "completed");

  const hasContact = !!(
    event.clientName?.trim() ||
    event.clientPhone?.trim() ||
    event.clientEmail?.trim()
  );

  const deliveryPartnerLine =
    event.type === "delivery" &&
    event.clientName?.trim() &&
    event.name?.trim() &&
    event.name.trim() !== event.clientName.trim()
      ? event.name.trim()
      : null;

  const handleSaveReassign = async () => {
    if (!reassignDate) return;
    if (event.type === "move_project_day" && event.moveProjectId) {
      if (!reassignStart || !reassignEnd) return;
      setSaving(true);
      setSaveError(null);
      try {
        const res = await fetch(
          `/api/admin/move-projects/${event.moveProjectId}/days/${event.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              crew_ids: reassignCrewId ? [reassignCrewId] : [],
              date: reassignDate,
              start_time: reassignStart,
              end_time: reassignEnd,
            }),
          },
        );
        const data = await res.json();
        if (!res.ok) {
          setSaveError(data.error || "Failed to update project day");
        } else {
          onRescheduled?.();
          onClose();
        }
      } catch {
        setSaveError("Network error");
      } finally {
        setSaving(false);
      }
      return;
    }

    if (!reassignCrewId || !reassignStart || !reassignEnd) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/admin/calendar/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id:
            event.type === "blocked"
              ? event.scheduleBlockId || event.id
              : event.id,
          event_type: event.type,
          crew_id: reassignCrewId,
          date: reassignDate,
          start: reassignStart,
          end: reassignEnd,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Failed to reassign");
      } else {
        onRescheduled?.();
        onClose();
      }
    } catch {
      setSaveError("Network error");
    } finally {
      setSaving(false);
    }
  };

  const cardSurface = wineMode
    ? "rounded-xl border border-[rgba(201,139,168,0.32)] bg-[#4A1428] shadow-[0_4px_20px_rgba(0,0,0,0.22)]"
    : "rounded-xl border border-[#2C3E2D]/12 bg-[#FFFBF7] shadow-sm";
  const ink = wineMode ? "text-[#FCF8F5]" : "text-[#1c1917]";
  const inkMuted = wineMode ? "text-[#D4C4CF]" : "text-[#57534e]";
  const inkLabel = wineMode ? "text-[#E8D4DF]/90" : "text-[#78716c]";
  const eyebrowCls = wineMode
    ? "font-[family-name:var(--font-body)] text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[#E8D4DF]/78"
    : EYEBROW_LIGHT;
  const partnerLineCls = wineMode ? "text-[#F0D0E3]" : "text-[#5C1A33]/85";
  const accentIcon = wineMode ? "#F0D0E3" : FOREST;
  const linkStrong = wineMode
    ? "inline-flex items-center gap-2 text-[13px] font-semibold text-[#FAF2F7] hover:underline"
    : "inline-flex items-center gap-2 text-[13px] font-semibold text-[var(--tx)] hover:underline";
  const linkSub = wineMode
    ? "inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#E8D4DF] hover:underline"
    : "inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tx2)] hover:underline";
  const fieldClass = wineMode
    ? "w-full bg-[#3A0820] border border-[rgba(201,139,168,0.38)] rounded-lg px-3 py-2.5 text-[13px] text-[#FCF8F5] outline-none focus:ring-2 focus:ring-[rgba(240,208,227,0.25)]"
    : "w-full bg-white border border-[#2C3E2D]/20 rounded-lg px-3 py-2.5 text-[13px] text-[#1c1917] outline-none focus:ring-2 focus:ring-[#2C3E2D]/25";
  const reassignHover = wineMode
    ? "hover:bg-white/[0.06]"
    : "hover:bg-[#2C3E2D]/[0.04]";
  const recurringNote = wineMode
    ? "text-[11px] text-[#D4C4CF] bg-[rgba(58,8,32,0.55)] rounded-lg px-3 py-2 border border-[rgba(201,139,168,0.25)]"
    : "text-[11px] text-[#57534e] bg-[#FAF7F2] rounded-lg px-3 py-2 border border-[#2C3E2D]/10";

  return (
    <div
      className={`w-full min-h-full flex flex-col animate-slide-in-right ${wineMode ? "bg-[#2B0416]" : "bg-[#FAF7F2]"}`}
      style={{ fontFamily: "var(--font-body)" }}
    >
      {/* Wine hero — premium quote shell */}
      <div
        className="sticky top-0 z-10 shrink-0 px-5 pt-5 pb-4 border-b border-black/10"
        style={{
          background: `linear-gradient(165deg, ${WINE} 0%, #3d1122 92%)`,
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span
                className="w-2 h-2 rounded-full shrink-0 ring-2 ring-white/20"
                style={{ backgroundColor: event.color }}
              />
              <span className="font-[family-name:var(--font-body)] text-[10px] font-bold uppercase tracking-[0.12em] text-[rgba(255,251,247,0.85)]">
                {TYPE_LABELS[event.type] || event.type}
              </span>
              <span
                className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded border"
                style={{
                  color: CREAM_INK,
                  borderColor: "rgba(255,251,247,0.35)",
                }}
              >
                {toTitleCase(event.calendarStatus)}
              </span>
              {event.isRecurring && (
                <span className="text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded border border-emerald-400/40 text-emerald-100/95">
                  Recurring
                </span>
              )}
            </div>
            <h2 className="font-hero text-[1.35rem] sm:text-[1.5rem] leading-tight text-[#FFFBF7] pr-2">
              {event.name}
            </h2>
            {event.description && (
              <p
                className="text-[13px] mt-1.5 leading-snug"
                style={{ color: CREAM_MUTED }}
              >
                {event.type === "delivery"
                  ? event.description
                  : toTitleCase(event.description)}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg shrink-0 transition-colors hover:bg-white/10 text-[rgba(255,251,247,0.85)]"
            aria-label="Close panel"
          >
            <X size={20} weight="regular" aria-hidden />
          </button>
        </div>
      </div>

      <div className="px-5 py-5 space-y-5 flex-1">
        {/* Time */}
        <section className={`${cardSurface} px-4 py-3.5`}>
          <div className={`${eyebrowCls} mb-2`}>Time</div>
          <div className={`text-[15px] font-semibold ${ink}`}>{timeStr}</div>
          {event.durationHours != null && (
            <div className={`text-[12px] mt-0.5 ${inkMuted}`}>
              {event.durationHours} hours estimated
            </div>
          )}
          <div className={`text-[12px] mt-1 ${inkMuted}`}>
            {formatPlatformDisplay(new Date(event.date + "T12:00:00"), {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </div>
        </section>

        {/* Contact */}
        {hasContact && (
          <section className={`${cardSurface} px-4 py-3.5`}>
            <div className={`${eyebrowCls} mb-2`}>Contact</div>
            {event.clientName?.trim() && (
              <div
                className={`flex items-start gap-2.5 text-[14px] font-semibold mb-2 ${ink}`}
              >
                <User
                  className="w-4 h-4 shrink-0 mt-0.5"
                  style={{ color: accentIcon }}
                  weight="bold"
                  aria-hidden
                />
                <span className="min-w-0 break-words">
                  {event.clientName.trim()}
                </span>
              </div>
            )}
            {deliveryPartnerLine && (
              <p className={`text-[12px] mb-2 pl-[26px] ${partnerLineCls}`}>
                Partner · {deliveryPartnerLine}
              </p>
            )}
            {event.clientPhone?.trim() && (
              <div className="flex flex-wrap gap-2 mb-1.5">
                <a
                  href={`tel:${String(event.clientPhone).replace(/[^\d+]/g, "")}`}
                  className={linkStrong}
                >
                  <Phone
                    className="w-4 h-4 shrink-0"
                    weight="bold"
                    aria-hidden
                  />
                  {formatPhone(event.clientPhone)}
                </a>
                <a
                  href={`sms:${String(event.clientPhone).replace(/[^\d+]/g, "")}`}
                  className={linkSub}
                >
                  SMS
                  <CaretRight
                    className="w-3.5 h-3.5"
                    weight="bold"
                    aria-hidden
                  />
                </a>
              </div>
            )}
            {event.clientEmail?.trim() && (
              <a
                href={`mailto:${event.clientEmail.trim()}`}
                className={`${linkStrong} break-all`}
              >
                <EnvelopeSimple
                  className="w-4 h-4 shrink-0"
                  weight="bold"
                  aria-hidden
                />
                {event.clientEmail.trim()}
              </a>
            )}
          </section>
        )}

        {/* Team & Truck */}
        {(event.type === "move_project_day" || event.crewName || event.truckName) && (
          <section className={`${cardSurface} px-4 py-3.5`}>
            <div className={`${eyebrowCls} mb-2`}>Assignment</div>
            {event.type === "move_project_day" && !event.crewName && (
              <div className={`text-[13px] ${inkMuted}`}>No crew assigned yet</div>
            )}
            {event.crewName && (
              <div className={`flex items-center gap-2 text-[14px] ${ink}`}>
                <Icon
                  name="users"
                  className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current"
                  style={{ color: accentIcon }}
                />
                <span className="font-semibold">{event.crewName}</span>
              </div>
            )}
            {event.truckName && (
              <div
                className={`flex items-center gap-2 text-[14px] mt-1 ${ink}`}
              >
                <Icon
                  name="mapPin"
                  className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current"
                  style={{ color: accentIcon }}
                />
                {event.truckName}
              </div>
            )}
          </section>
        )}

        {/* Addresses */}
        {(event.fromAddress || event.toAddress || event.deliveryAddress) && (
          <section className={`${cardSurface} px-4 py-3.5`}>
            <div className={`${eyebrowCls} mb-2`}>Location</div>
            {event.fromAddress && (
              <div className={`text-[13px] leading-snug ${ink}`}>
                <span className={inkLabel}>From:</span>{" "}
                {formatAddressForDisplay(event.fromAddress)}
              </div>
            )}
            {event.toAddress && (
              <div className={`text-[13px] leading-snug mt-1 ${ink}`}>
                <span className={inkLabel}>To:</span>{" "}
                {formatAddressForDisplay(event.toAddress)}
              </div>
            )}
            {event.deliveryAddress && (
              <div className={`text-[13px] leading-snug mt-1 ${ink}`}>
                <span className={inkLabel}>Deliver to:</span>{" "}
                {formatAddressForDisplay(event.deliveryAddress)}
              </div>
            )}
          </section>
        )}

        {/* Details */}
        {(event.moveSize || event.itemCount || event.category) && (
          <section className={`${cardSurface} px-4 py-3.5`}>
            <div className={`${eyebrowCls} mb-2`}>Details</div>
            {event.moveSize && (
              <div className={`text-[13px] ${ink}`}>Size: {event.moveSize}</div>
            )}
            {event.itemCount != null && (
              <div className={`text-[13px] ${ink}`}>
                Items: {event.itemCount}
              </div>
            )}
            {event.category && (
              <div className={`text-[13px] ${ink}`}>
                Category: {toTitleCase(event.category)}
              </div>
            )}
          </section>
        )}

        {event.calendarStatus === "completed" && !canEditEvent(event) && (
          <div
            className={
              wineMode
                ? "rounded-xl px-3 py-2.5 bg-amber-500/15 border border-amber-400/30 text-[12px] text-amber-100"
                : "rounded-xl px-3 py-2.5 bg-amber-500/10 border border-amber-500/25 text-[12px] text-amber-800"
            }
          >
            This completed job has time and team assigned and cannot be edited.
          </div>
        )}

        {canReassign && (
          <div
            className={
              wineMode
                ? "rounded-xl border border-[rgba(201,139,168,0.32)] overflow-hidden bg-[#4A1428] shadow-[0_4px_20px_rgba(0,0,0,0.22)]"
                : "rounded-xl border border-[#2C3E2D]/18 overflow-hidden bg-[#FFFBF7] shadow-sm"
            }
          >
            <button
              type="button"
              onClick={() => setShowReassign((v) => !v)}
              className={`w-full flex items-center justify-between px-4 py-3.5 text-left transition-colors ${reassignHover}`}
            >
              <span
                className={`inline-flex items-center gap-2 font-[family-name:var(--font-body)] text-[11px] font-bold uppercase tracking-[0.12em] ${wineMode ? "text-[#FCF8F5]" : "text-[var(--tx)]"}`}
              >
                <Icon
                  name="calendar"
                  className="w-4 h-4 shrink-0 stroke-[1.75] stroke-current"
                  style={{ color: accentIcon }}
                />
                {event.type === "move_project_day" ? "Update project day" : "Reassign / Reschedule"}
              </span>
              <CaretDown
                size={16}
                weight="bold"
                className={`${wineMode ? "text-[#D4C4CF]" : "text-[var(--tx2)]"} transition-transform shrink-0 ${showReassign ? "rotate-180" : ""}`}
                aria-hidden
              />
            </button>

            {showReassign && (
              <div
                className={`px-4 pb-4 pt-1 space-y-3 border-t ${wineMode ? "border-[rgba(201,139,168,0.28)]" : "border-[#2C3E2D]/10"}`}
              >
                {event.isRecurring && (
                  <p className={recurringNote}>
                    Changing team updates the recurring schedule; all instances
                    will use the new team.
                  </p>
                )}
                <div>
                  <label className={`${eyebrowCls} mb-1.5 block`}>Team</label>
                  <select
                    value={reassignCrewId}
                    onChange={(e) => setReassignCrewId(e.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Select team…</option>
                    {crews.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`${eyebrowCls} mb-1.5 block`}>Date</label>
                  <input
                    type="date"
                    value={reassignDate}
                    onChange={(e) => setReassignDate(e.target.value)}
                    className={fieldClass}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={`${eyebrowCls} mb-1.5 block`}>
                      Start
                    </label>
                    <select
                      value={reassignStart}
                      onChange={(e) => setReassignStart(e.target.value)}
                      className={fieldClass}
                    >
                      {TIME_SLOTS_15MIN.map((t) => (
                        <option key={t} value={t}>
                          {formatTime12(t)}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={`${eyebrowCls} mb-1.5 block`}>End</label>
                    <select
                      value={reassignEnd}
                      onChange={(e) => setReassignEnd(e.target.value)}
                      className={fieldClass}
                    >
                      {TIME_SLOTS_15MIN.filter((t) => t > reassignStart).map(
                        (t) => (
                          <option key={t} value={t}>
                            {formatTime12(t)}
                          </option>
                        ),
                      )}
                    </select>
                  </div>
                </div>

                {saveError && (
                  <div
                    className={
                      wineMode
                        ? "text-[12px] text-red-200 bg-red-950/40 border border-red-500/35 rounded-lg px-3 py-2"
                        : "text-[12px] text-red-700 bg-red-500/10 border border-red-500/25 rounded-lg px-3 py-2"
                    }
                  >
                    {saveError}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleSaveReassign}
                  disabled={
                    saving ||
                    !reassignDate ||
                    !reassignStart ||
                    !reassignEnd ||
                    (event.type !== "move_project_day" && !reassignCrewId)
                  }
                  className={
                    wineMode
                      ? "w-full py-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] bg-[#6E2442] text-[#FCF8F5] hover:bg-[#823052] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                      : "w-full py-3 rounded-lg text-[11px] font-bold uppercase tracking-[0.12em] bg-[#2C3E2D] text-[#FFFBF7] hover:bg-[#243829] transition-colors disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
                  }
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Saving…
                    </>
                  ) : (
                    <>
                      {event.type === "move_project_day" ? "Save project day" : "Confirm reassignment"}
                      <CaretRight
                        className="w-4 h-4"
                        weight="bold"
                        aria-hidden
                      />
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {event.href && (
          <Link
            href={event.href}
            className={
              wineMode
                ? "inline-flex w-full items-center justify-center gap-2 py-2.5 rounded-lg border-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[#FCF8F5] hover:bg-[rgba(255,255,255,0.06)] transition-colors"
                : "inline-flex w-full items-center justify-center gap-2 py-2.5 rounded-lg border-0 text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--tx)] hover:bg-[var(--hover)] transition-colors"
            }
          >
            View full details
            <CaretRight
              className="w-4 h-4 shrink-0"
              weight="bold"
              aria-hidden
            />
          </Link>
        )}
      </div>
    </div>
  );
}

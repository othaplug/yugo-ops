import "server-only";
import { callGCal, getGCalId, isGCalConfigured } from "./client";
import { getAppTimezone } from "@/lib/business-timezone";
import { serviceTypeDisplayLabel } from "@/lib/displayLabels";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type GCalJobType = "move" | "delivery";

export interface GCalJobInput {
  jobType: GCalJobType;
  jobId: string;
  jobCode: string;
  clientName: string;
  serviceType: string;
  status: string;
  scheduledDate: string | null;
  startTime: string | null;
  estimatedDurationMinutes: number | null;
  fromAddress: string | null;
  toAddress: string | null;
  crewName: string | null;
  notes: string | null;
  existingEventId: string | null;
}

export interface GCalSyncResult {
  eventId: string | null;
  action: "created" | "updated" | "deleted" | "skipped" | "error";
  error?: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const BOOKABLE_STATUSES = new Set([
  "confirmed",
  "booked",
  "scheduled",
  "deposit_paid",
  "deposit_received",
  "paid",
  "in_progress",
  "pending",
]);

const CANCELLED_STATUSES = new Set([
  "cancelled",
  "canceled",
  "refunded",
  "declined",
  "expired",
  "lost",
]);

const DEFAULT_START_HOUR = 8;
const DEFAULT_DURATION_MINUTES = 240;

/* ── Helpers ─────────────────────────────────────────────────────────────────── */

function buildEventTitle(input: GCalJobInput): string {
  const svcLabel = serviceTypeDisplayLabel(input.serviceType) || input.serviceType;
  const prefix = input.jobType === "move" ? "MV" : "DLV";
  const code = input.jobCode.replace(/^(MV-|DLV-|YG-)/, "");
  return `${prefix}-${code} · ${input.clientName} | ${svcLabel}`;
}

function buildDescription(input: GCalJobInput): string {
  const lines: string[] = [];
  if (input.fromAddress) lines.push(`📦 From: ${input.fromAddress}`);
  if (input.toAddress) lines.push(`📍 To: ${input.toAddress}`);
  if (input.crewName) lines.push(`👥 Crew: ${input.crewName}`);
  const dur = input.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  lines.push(`⏱ Est. duration: ${h > 0 ? `${h}h` : ""}${m > 0 ? ` ${m}m` : ""}`.trim());
  if (input.notes) lines.push(`\nNotes: ${input.notes}`);
  lines.push(`\nOPS+ ${input.jobType === "move" ? "Move" : "Delivery"}: ${input.jobCode}`);
  return lines.join("\n");
}

function buildDateTimeISO(date: string, timeStr: string | null, tz: string): string {
  if (timeStr) {
    const t = timeStr.slice(0, 5);
    return `${date}T${t}:00`;
  }
  return `${date}T${String(DEFAULT_START_HOUR).padStart(2, "0")}:00:00`;
}

function buildGCalEvent(input: GCalJobInput, tz: string): Record<string, unknown> {
  const date = input.scheduledDate!;
  const startDt = buildDateTimeISO(date, input.startTime, tz);
  const durMin = input.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
  const startMs = new Date(`${startDt}+00:00`).getTime();
  const endDate = new Date(
    new Date(`${startDt}`).getTime() + durMin * 60_000,
  );
  const pad = (n: number) => String(n).padStart(2, "0");
  const endDt = `${endDate.getFullYear()}-${pad(endDate.getMonth() + 1)}-${pad(endDate.getDate())}T${pad(endDate.getHours())}:${pad(endDate.getMinutes())}:00`;

  // Suppress unused startMs — used only to verify date parses
  void startMs;

  return {
    summary: buildEventTitle(input),
    description: buildDescription(input),
    location: input.fromAddress ?? undefined,
    start: { dateTime: startDt, timeZone: tz },
    end: { dateTime: endDt, timeZone: tz },
    extendedProperties: {
      private: {
        yugoSource: "ops-plus",
        yugoJobType: input.jobType,
        yugoJobId: input.jobId,
        yugoJobCode: input.jobCode,
      },
    },
  };
}

/* ── Main sync function ──────────────────────────────────────────────────────── */

export async function syncJobToGCal(input: GCalJobInput): Promise<GCalSyncResult> {
  if (!isGCalConfigured()) {
    return { eventId: null, action: "skipped", error: "Google Calendar not configured" };
  }

  const calId = encodeURIComponent(getGCalId());
  const tz = getAppTimezone();
  const statusKey = input.status.toLowerCase().replace(/-/g, "_");

  if (CANCELLED_STATUSES.has(statusKey)) {
    if (!input.existingEventId) return { eventId: null, action: "skipped" };
    const del = await callGCal(`/calendars/${calId}/events/${input.existingEventId}`, "DELETE");
    if (!del.ok && del.status !== 404 && del.status !== 410) {
      return { eventId: null, action: "error", error: del.error };
    }
    return { eventId: null, action: "deleted" };
  }

  if (!BOOKABLE_STATUSES.has(statusKey)) {
    return { eventId: null, action: "skipped" };
  }

  if (!input.scheduledDate) {
    return { eventId: null, action: "skipped", error: "No scheduled date" };
  }

  const eventBody = buildGCalEvent(input, tz);

  if (input.existingEventId) {
    const upd = await callGCal(
      `/calendars/${calId}/events/${input.existingEventId}`,
      "PUT",
      eventBody,
    );
    if (!upd.ok) {
      if (upd.status === 404 || upd.status === 410) {
        // Event was deleted externally — recreate it
        const ins = await callGCal(`/calendars/${calId}/events`, "POST", eventBody);
        if (!ins.ok) return { eventId: null, action: "error", error: ins.error };
        const newId = (ins.data as { id?: string })?.id ?? null;
        return { eventId: newId, action: "created" };
      }
      return { eventId: null, action: "error", error: upd.error };
    }
    const updatedId = (upd.data as { id?: string })?.id ?? input.existingEventId;
    return { eventId: updatedId, action: "updated" };
  }

  const ins = await callGCal(`/calendars/${calId}/events`, "POST", eventBody);
  if (!ins.ok) return { eventId: null, action: "error", error: ins.error };
  const newId = (ins.data as { id?: string })?.id ?? null;
  return { eventId: newId, action: "created" };
}

export async function deleteGCalEvent(eventId: string): Promise<void> {
  if (!isGCalConfigured() || !eventId) return;
  const calId = encodeURIComponent(getGCalId());
  await callGCal(`/calendars/${calId}/events/${eventId}`, "DELETE");
}

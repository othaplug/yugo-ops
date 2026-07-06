import "server-only";
import { callGCal, getGCalId, isGCalConfigured } from "./client";
import { getAppTimezone } from "@/lib/business-timezone";
import {
  portfolioPmMoveServiceLabel,
  pmReasonShortLabel,
  serviceTypeDisplayLabel,
} from "@/lib/displayLabels";

/* ── Types ─────────────────────────────────────────────────────────────────── */

export type GCalJobType = "move" | "delivery";

export interface GCalJobInput {
  jobType: GCalJobType;
  jobId: string;
  jobCode: string;
  clientName: string;
  clientPhone?: string | null;
  clientEmail?: string | null;
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
  // PM context — used to route the event title through the PM label helper
  // ("PM Reno Move-In") instead of the raw service_type ("B2B Delivery")
  // and to enrich the event body with building / reason / packing / tier
  // so the crew reading the invite gets the full picture.
  isPmMove?: boolean;
  pmReasonCode?: string | null;
  pmMoveKind?: string | null;
  pmBuildingCode?: string | null;
  pmZone?: string | null;
  pmUrgency?: string | null;
  pmPackingRequired?: boolean | null;
  tierSelected?: string | null;
  totalPrice?: number | null;
  crewSize?: number | null;
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
  "completed",
  // Deliveries (B2B jobs) spend most of their life as "delivered"; without it
  // here the calendar sync skipped every delivered job, so B2B jobs never
  // landed on the calendar.
  "delivered",
  "no_show",
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

/**
 * Resolve the service label shown in the calendar title.
 * PM moves route through portfolioPmMoveServiceLabel so is_pm_move quotes
 * (typically stored as service_type=b2b_oneoff) render as
 * "PM Reno Move-In" / "PM Suite Transfer" / etc., not "B2B Delivery" —
 * property-management residential moves are NOT deliveries, and calling
 * them one on the crew's calendar was misleading them for months
 * (MV-30323 / MV-30324 shipped as B2B Delivery on 2026-06-27).
 */
function resolveTitleLabel(input: GCalJobInput): string {
  if (input.isPmMove) {
    const label = portfolioPmMoveServiceLabel({
      service_type: input.serviceType,
      is_pm_move: true,
      pm_reason_code: input.pmReasonCode ?? null,
    });
    if (label && label.trim() && label !== "—") return label;
  }
  return serviceTypeDisplayLabel(input.serviceType) || input.serviceType;
}

function buildEventTitle(input: GCalJobInput): string {
  const svcLabel = resolveTitleLabel(input);
  const prefix = input.jobType === "move" ? "MV" : "DLV";
  const code = input.jobCode.replace(/^(MV-|DLV-|YG-)/, "");
  // PM moves lead with the reason/kind, so the client_name (often a unit
  // number like "301") reads as "Unit 301" not the free-floating "301".
  const namePart = input.isPmMove && input.clientName
    ? `Unit ${input.clientName}`
    : input.clientName;
  return `${prefix}-${code} · ${namePart} | ${svcLabel}`;
}

/**
 * PM-move description body. Front-loads the ops information the crew
 * needs when they open the invite: what kind of PM move, at which
 * building, moving which unit(s), what packing / crew scope applies.
 */
function buildPmDescription(input: GCalJobInput): string {
  const lines: string[] = [];

  const reasonShort =
    pmReasonShortLabel(input.pmReasonCode) ??
    pmReasonShortLabel(input.pmMoveKind) ??
    null;
  if (reasonShort) lines.push(`🏢 ${reasonShort} · PM Residential Move`);
  else lines.push("🏢 PM Residential Move");

  if (input.pmBuildingCode) lines.push(`   Building: ${input.pmBuildingCode}`);
  if (input.pmZone) lines.push(`   Zone: ${input.pmZone}`);
  if (input.pmUrgency && input.pmUrgency !== "standard") {
    lines.push(`   Urgency: ${input.pmUrgency}`);
  }
  if (input.pmPackingRequired) {
    lines.push("   Packing: required (Yugo packs)");
  }

  lines.push("");
  if (input.fromAddress) lines.push(`📦 From: ${input.fromAddress}`);
  if (input.toAddress) lines.push(`📍 To: ${input.toAddress}`);

  const dur = input.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  lines.push(`⏱ Duration: ${h > 0 ? `${h}h` : ""}${m > 0 ? ` ${m}m` : ""}`.trim());

  if (input.crewSize) lines.push(`👥 Crew size: ${input.crewSize}`);
  if (input.crewName) lines.push(`👥 Assigned crew: ${input.crewName}`);
  if (input.tierSelected) lines.push(`🏷 Tier: ${input.tierSelected}`);

  const contactBits: string[] = [];
  if (input.clientName) contactBits.push(input.clientName);
  if (input.clientPhone) contactBits.push(String(input.clientPhone));
  if (input.clientEmail) contactBits.push(String(input.clientEmail));
  if (contactBits.length) lines.push(`👤 Tenant contact: ${contactBits.join(" · ")}`);

  if (input.totalPrice && input.totalPrice > 0) {
    lines.push(`💰 Price: $${input.totalPrice.toLocaleString("en-CA")}`);
  }

  if (input.notes) lines.push(`\nNotes: ${input.notes}`);
  lines.push(`\nOPS+ Move: ${input.jobCode}`);
  return lines.join("\n");
}

function buildDescription(input: GCalJobInput): string {
  if (input.isPmMove) return buildPmDescription(input);
  const lines: string[] = [];
  if (input.fromAddress) lines.push(`📦 From: ${input.fromAddress}`);
  if (input.toAddress) lines.push(`📍 To: ${input.toAddress}`);
  if (input.crewName) lines.push(`👥 Crew: ${input.crewName}`);
  if (input.crewSize) lines.push(`👥 Crew size: ${input.crewSize}`);
  const dur = input.estimatedDurationMinutes ?? DEFAULT_DURATION_MINUTES;
  const h = Math.floor(dur / 60);
  const m = dur % 60;
  lines.push(`⏱ Est. duration: ${h > 0 ? `${h}h` : ""}${m > 0 ? ` ${m}m` : ""}`.trim());
  if (input.tierSelected) lines.push(`🏷 Tier: ${input.tierSelected}`);
  const contactBits: string[] = [];
  if (input.clientName) contactBits.push(input.clientName);
  if (input.clientPhone) contactBits.push(String(input.clientPhone));
  if (contactBits.length) lines.push(`👤 Client: ${contactBits.join(" · ")}`);
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

import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { sendSMS } from "@/lib/sms/sendSMS";
import { adminNotificationLayout } from "@/lib/email/admin-templates";

/** Roles that may receive internal admin/coordinator notification emails (excludes viewer, client, crew, partner). */
export const STAFF_NOTIFICATION_EMAIL_ROLES = [
  "owner",
  "admin",
  "manager",
  "coordinator",
  "dispatcher",
  "sales",
] as const;

export type StaffNotificationEmailRole = (typeof STAFF_NOTIFICATION_EMAIL_ROLES)[number];

function isStaffNotificationEmailRole(role: string | null | undefined): role is StaffNotificationEmailRole {
  return (
    !!role &&
    (STAFF_NOTIFICATION_EMAIL_ROLES as readonly string[]).includes(role)
  );
}

function normalizeRecipientEmail(raw: string | null | undefined): string | null {
  const t = (raw || "").trim().toLowerCase();
  return t.length > 0 ? t : null;
}

function parseExcludedRecipientEmails(data: NotificationData): Set<string> {
  const raw = data.excludeRecipientEmails;
  const out = new Set<string>();
  if (Array.isArray(raw)) {
    for (const x of raw) {
      const n = normalizeRecipientEmail(typeof x === "string" ? x : String(x));
      if (n) out.add(n);
    }
  }
  return out;
}

interface NotificationData {
  subject?: string;
  body?: string;
  /** When set, used as the full HTML email body (no wrapper). Use for premium admin emails. */
  html?: string;
  sourceId?: string;
  quoteId?: string;
  deliveryId?: string;
  moveId?: string;
  claimId?: string;
  clientName?: string;
  partnerName?: string;
  stopCount?: number;
  totalPrice?: number;
  amount?: number;
  tierClicked?: string;
  description?: string;
  /** Lowercased emails that must never receive this notification email (e.g. quote contact). */
  excludeRecipientEmails?: string[];
  [key: string]: unknown;
}

export async function sendNotification(
  eventSlug: string,
  recipientUserId: string,
  data: NotificationData
) {
  const supabase = createAdminClient();

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("email, name, phone, role")
    .eq("user_id", recipientUserId)
    .maybeSingle();

  if (!platformUser || !isStaffNotificationEmailRole(platformUser.role as string)) {
    return { email: false, sms: false, push: false };
  }

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_enabled, sms_enabled, push_enabled")
    .eq("user_id", recipientUserId)
    .eq("event_slug", eventSlug)
    .maybeSingle();

  const emailEnabled = prefs?.email_enabled ?? true;
  const smsEnabled = prefs?.sms_enabled ?? false;
  const pushEnabled = prefs?.push_enabled ?? true;

  let email: string | null = platformUser.email ?? null;
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      recipientUserId
    );
    email = authUser?.user?.email ?? null;
  }

  const excludedEmails = parseExcludedRecipientEmails(data);
  const normalizedTo = normalizeRecipientEmail(email);
  const skipEmailForExcluded =
    normalizedTo != null && excludedEmails.has(normalizedTo);

  const results: { email?: boolean; sms?: boolean; push?: boolean } = {};

  if (emailEnabled && email && data.subject && !skipEmailForExcluded) {
    try {
      let html: string;
      if (data.html && typeof data.html === "string" && data.html.trimStart().startsWith("<!DOCTYPE")) {
        html = data.html;
      } else {
        const bodyText =
          (data.body as string) ||
          buildNotificationBody(eventSlug, data) ||
          "";
        const safeBody = bodyText
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\n/g, "<br/>");
        html = adminNotificationLayout(
          safeBody ? `<p style="margin:0;">${safeBody}</p>` : "<p style=\"margin:0;color:#666;\">No details.</p>",
          data.subject as string
        );
      }
      const result = await sendEmail({
        to: email,
        subject: data.subject,
        html,
      });
      results.email = result.success;
    } catch {
      results.email = false;
    }
  }

  if (pushEnabled) {
    try {
      const webPush = await import("@/lib/web-push").catch(() => null);
      if (webPush?.sendPushToUser) {
        await webPush.sendPushToUser(recipientUserId, {
          title: (data.subject as string) || "Notification",
          body: (data.body as string) || "",
        });
        results.push = true;
      }
    } catch {
      results.push = false;
    }
  }

  if (smsEnabled) {
    const phoneRaw =
      platformUser?.phone ??
      (await supabase.auth.admin.getUserById(recipientUserId).then((r) => r.data?.user?.phone ?? null));
    const hasOpenPhone = process.env.OPENPHONE_API_KEY && process.env.OPENPHONE_PHONE_NUMBER_ID;

    if (phoneRaw && hasOpenPhone) {
      const digits = (phoneRaw as string).replace(/\D/g, "");
      if (digits.length >= 10) {
        const toE164 = digits.startsWith("1") && digits.length === 11 ? `+${digits}` : `+1${digits.slice(-10)}`;
        const title = buildNotificationTitle(eventSlug, data);
        const body = buildNotificationBody(eventSlug, data);
        const smsBody = [title, body].filter(Boolean).join("\n\n").slice(0, 1600);

        const smsResult = await sendSMS(toE164, smsBody);
        results.sms = smsResult.success;
        if (!smsResult.success) {
          console.error("[dispatch] SMS send failed:", smsResult.error);
        }
      } else {
        results.sms = false;
      }
    } else {
      results.sms = false;
    }
  }

  // Always create an in-app notification regardless of channel preferences
  try {
    await supabase.from("in_app_notifications").insert({
      user_id: recipientUserId,
      event_slug: eventSlug,
      title: buildNotificationTitle(eventSlug, data),
      body: buildNotificationBody(eventSlug, data),
      icon: getNotificationIcon(eventSlug),
      link: buildNotificationLink(eventSlug, data),
      source_type: getSourceType(eventSlug, data),
      source_id: data.sourceId || null,
      is_read: false,
    });
  } catch (e) {
    console.error("Failed to create in-app notification:", e);
  }

  return results;
}

/**
 * Send a notification to all platform admins/coordinators for an event.
 */
export async function notifyAdmins(
  eventSlug: string,
  data: NotificationData
) {
  const supabase = createAdminClient();
  const { data: admins } = await supabase
    .from("platform_users")
    .select("user_id")
    .in("role", [...STAFF_NOTIFICATION_EMAIL_ROLES]);

  if (!admins?.length) return;

  const results = await Promise.allSettled(
    admins.map((a: { user_id: string }) =>
      sendNotification(eventSlug, a.user_id, data)
    )
  );

  return results;
}

// ---------------------------------------------------------------------------
// Builder helpers – map event slugs to human-readable notification content
// ---------------------------------------------------------------------------

export function buildNotificationTitle(
  slug: string,
  data: NotificationData
): string {
  if (
    slug === "building_profile_pending" &&
    typeof data.subject === "string" &&
    data.subject.trim()
  ) {
    return data.subject.trim();
  }
  const titles: Record<string, string> = {
    quote_requested: "New quote request",
    quote_viewed: "Quote viewed",
    quote_accepted: "New booking",
    quote_expiring_soon: "Quote expiring soon",
    quote_expired: "Quote expired",
    quote_declined: "Quote declined",
    quote_cold: "Quote went cold",
    quote_hot: "Hot quote — multiple views",
    payment_received: "Payment received",
    payment_failed: "Payment failed",
    quote_comparison_signal: "Quote comparison signal",
    deposit_received: "Deposit received",
    tip_received: "Tip received",
    partner_job_request: "New delivery request",
    partner_job_complete: "Delivery completed",
    move_tomorrow: "Move tomorrow",
    move_started: "Move started",
    move_completed: "Move completed",
    move_scheduled: "Move scheduled",
    scheduling_conflict: "Scheduling conflict",
    no_availability: "No availability",
    move_issue: "Move issue reported",
    move_waiver_signed: "On-site waiver signed",
    move_waiver_declined: "On-site waiver declined",
    crew_checkin: "Crew checked in",
    crew_no_checkin: "Crew no-show alert",
    checklist_incomplete: "Readiness check failed",
    claim_submitted: "New claim submitted",
    low_margin_alert: "Low margin alert",
    in_job_margin_alert: "In-job margin alert",
    in_job_schedule_alert: "In-job schedule risk",
    high_value_move: "High-value move flag",
    system_error: "System error",
    crew_gps_offline: "Crew GPS offline",
    crew_idle_off_route: "Crew idle off job stops",
    lead_new: "New lead",
    partner_pm_booking: "PM booking request",
    partner_pm_batch: "PM batch created",
    building_profile_pending: "Building profile review",
    move_project_day_completed: "Multi-day move day finished",
    move_project_day_started: "Multi-day move day underway",
  };
  return titles[slug] || "Notification";
}

export function buildNotificationBody(
  slug: string,
  data: NotificationData
): string {
  if (slug === "building_profile_pending") {
    const b = (data.body as string | undefined)?.trim();
    if (b) return b.slice(0, 500);
    return typeof data.description === "string"
      ? data.description
      : "A building access report needs verification";
  }
  if (slug === "partner_job_request") {
    const parts: string[] = [];
    if (data.partnerName) parts.push(String(data.partnerName));
    if (data.stopCount) parts.push(`${data.stopCount} stops`);
    if (data.totalPrice) parts.push(`$${Number(data.totalPrice).toLocaleString()}`);
    return parts.join(" \u00b7 ") || "";
  }
  if (slug === "quote_viewed") {
    const base = data.clientName ? `${data.clientName} viewed their quote` : "Quote was viewed";
    return data.tierClicked ? `${base} (${data.tierClicked} clicked)` : base;
  }
  if (slug === "quote_declined" || slug === "quote_cold" || slug === "quote_hot") {
    return (data.description as string) || "";
  }
  if (slug === "payment_received" || slug === "deposit_received") {
    const amt = data.amount ? `$${Number(data.amount).toLocaleString()}` : "";
    return data.clientName ? `${amt} from ${data.clientName}`.trim() : amt;
  }
  if (slug === "tip_received") {
    const amt = data.amount ? `$${Number(data.amount).toLocaleString()}` : "Tip";
    return data.clientName ? `${amt} from ${data.clientName}` : amt;
  }
  if (slug === "crew_gps_offline") {
    return (data.body as string) || (data.description as string) || "";
  }
  if (slug === "crew_idle_off_route") {
    return (data.description as string) || "";
  }
  if (slug === "partner_pm_batch") {
    const b = (data.body as string)?.trim();
    if (b) return b.slice(0, 4000);
    const short = `${data.partnerName ? String(data.partnerName) : "Partner"} PM batch`;
    return (data.description as string) || short;
  }
  if (slug === "partner_pm_booking") {
    return (data.body as string) || "";
  }
  if (slug === "quote_comparison_signal") {
    return (data.description as string) || "";
  }
  return (data.description as string) || "";
}

export function getNotificationIcon(slug: string): string {
  const icons: Record<string, string> = {
    quote_requested: "file",
    quote_viewed: "eye",
    quote_accepted: "party",
    quote_expiring_soon: "clock",
    quote_expired: "clock",
    quote_declined: "file",
    quote_cold: "clock",
    quote_hot: "flag",
    payment_received: "dollar",
    payment_failed: "alertTriangle",
    deposit_received: "dollar",
    tip_received: "creditCard",
    partner_job_request: "truck",
    partner_job_complete: "check",
    move_tomorrow: "calendar",
    move_started: "flag",
    move_completed: "check",
    move_scheduled: "calendar",
    scheduling_conflict: "alertTriangle",
    no_availability: "alertTriangle",
    move_issue: "alertTriangle",
    move_waiver_signed: "file",
    move_waiver_declined: "file",
    crew_checkin: "check",
    crew_no_checkin: "alertTriangle",
    checklist_incomplete: "clipboard",
    claim_submitted: "alertTriangle",
    low_margin_alert: "alertTriangle",
    in_job_margin_alert: "alertTriangle",
    in_job_schedule_alert: "clock",
    high_value_move: "dollar",
    system_error: "alertTriangle",
    crew_gps_offline: "mapPin",
    crew_idle_off_route: "mapPin",
    lead_new: "lightning",
    partner_pm_booking: "truck",
    partner_pm_batch: "truck",
    quote_comparison_signal: "eye",
    building_profile_pending: "building",
    move_project_day_completed: "check",
    move_project_day_started: "flag",
  };
  return icons[slug] || "bell";
}

export function buildNotificationLink(
  slug: string,
  data: NotificationData
): string {
  if ((slug.startsWith("quote_") || slug === "quote_comparison_signal") && data.quoteId)
    return `/admin/quotes/${data.quoteId}`;
  if (slug === "partner_pm_batch" && data.moveId)
    return `/admin/moves/${data.moveId}`;
  if (slug.startsWith("partner_") && data.deliveryId)
    return `/admin/deliveries/${data.deliveryId}`;
  if (
    (slug.startsWith("move_") ||
      slug === "scheduling_conflict" ||
      slug === "no_availability" ||
      slug === "crew_checkin" ||
      slug === "crew_no_checkin" ||
      slug === "checklist_incomplete" ||
      slug === "crew_gps_offline" ||
      slug === "crew_idle_off_route" ||
      slug === "move_project_day_completed" ||
      slug === "move_project_day_started") &&
    data.moveId
  )
    return `/admin/moves/${data.moveId}`;
  if (slug === "crew_idle_off_route" && data.deliveryId)
    return `/admin/deliveries/${data.deliveryId}`;
  if (slug === "claim_submitted" && data.claimId)
    return `/admin/claims/${data.claimId}`;
  if (slug === "payment_failed" && data.quoteId) return `/admin/quotes/${data.quoteId}`;
  if (slug === "payment_received" || slug === "deposit_received") return "/admin/invoices";
  if (slug === "tip_received") return "/admin/tips";
  if (slug === "building_profile_pending" && data.sourceId)
    return `/admin/buildings/${data.sourceId}`;
  if (slug === "lead_new" && data.sourceId) return `/admin/leads/${data.sourceId}`;
  if (slug === "partner_pm_booking" && data.moveId) return `/admin/moves/${data.moveId}`;
  if (slug === "in_job_margin_alert" || slug === "in_job_schedule_alert") {
    if (data.moveId) return `/admin/moves/${data.moveId}`;
    if (data.deliveryId) return `/admin/deliveries/${data.deliveryId}`;
  }
  return "/admin";
}

export function getSourceType(slug: string, data?: NotificationData): string {
  if (slug.startsWith("quote_") || slug === "quote_comparison_signal") return "quote";
  if (
    slug.startsWith("move_") ||
    slug === "scheduling_conflict" ||
    slug === "no_availability" ||
    slug === "crew_checkin" ||
    slug === "crew_no_checkin" ||
    slug === "checklist_incomplete" ||
    slug === "crew_gps_offline" ||
    slug === "move_project_day_completed" ||
    slug === "move_project_day_started"
  )
    return "move";
  if (
    slug.startsWith("payment_") ||
    slug === "deposit_received" ||
    slug === "tip_received"
  )
    return "payment";
  if (slug === "partner_pm_batch") return "move";
  if (slug.startsWith("partner_")) return "delivery";
  if (slug === "claim_submitted") return "claim";
  if (slug === "lead_new") return "lead";
  if (slug === "building_profile_pending") return "building";
  if (slug === "partner_pm_booking") return "move";
  if (slug === "crew_idle_off_route") return "system";
  if (slug === "in_job_margin_alert" || slug === "in_job_schedule_alert") {
    if (data?.moveId) return "move";
    if (data?.deliveryId) return "delivery";
  }
  return "system";
}

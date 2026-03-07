import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

interface NotificationData {
  subject?: string;
  body?: string;
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
  [key: string]: unknown;
}

export async function sendNotification(
  eventSlug: string,
  recipientUserId: string,
  data: NotificationData
) {
  const supabase = createAdminClient();

  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_enabled, sms_enabled, push_enabled")
    .eq("user_id", recipientUserId)
    .eq("event_slug", eventSlug)
    .single();

  const emailEnabled = prefs?.email_enabled ?? true;
  const smsEnabled = prefs?.sms_enabled ?? false;
  const pushEnabled = prefs?.push_enabled ?? true;

  const { data: platformUser } = await supabase
    .from("platform_users")
    .select("email, name")
    .eq("user_id", recipientUserId)
    .single();

  let email: string | null = platformUser?.email ?? null;
  if (!email) {
    const { data: authUser } = await supabase.auth.admin.getUserById(
      recipientUserId
    );
    email = authUser?.user?.email ?? null;
  }

  const results: { email?: boolean; sms?: boolean; push?: boolean } = {};

  if (emailEnabled && email && data.subject) {
    try {
      const result = await sendEmail({
        to: email,
        subject: data.subject,
        html: (data.body as string) || "",
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

  // Always create an in-app notification regardless of channel preferences
  try {
    await supabase.from("in_app_notifications").insert({
      user_id: recipientUserId,
      event_slug: eventSlug,
      title: buildNotificationTitle(eventSlug, data),
      body: buildNotificationBody(eventSlug, data),
      icon: getNotificationIcon(eventSlug),
      link: buildNotificationLink(eventSlug, data),
      source_type: getSourceType(eventSlug),
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
    .in("role", ["owner", "admin", "manager", "coordinator"]);

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
  _data: NotificationData
): string {
  const titles: Record<string, string> = {
    quote_requested: "New quote request",
    quote_viewed: "Quote viewed",
    quote_accepted: "New booking",
    quote_expiring_soon: "Quote expiring soon",
    quote_expired: "Quote expired",
    payment_received: "Payment received",
    payment_failed: "Payment failed",
    deposit_received: "Deposit received",
    tip_received: "Tip received",
    partner_job_request: "New delivery request",
    partner_job_complete: "Delivery completed",
    move_tomorrow: "Move tomorrow",
    move_started: "Move started",
    move_completed: "Move completed",
    move_issue: "Move issue reported",
    crew_checkin: "Crew checked in",
    crew_no_checkin: "Crew no-show alert",
    checklist_incomplete: "Readiness check failed",
    claim_submitted: "New claim submitted",
    low_margin_alert: "Low margin alert",
    high_value_move: "High-value move flag",
    system_error: "System error",
  };
  return titles[slug] || "Notification";
}

export function buildNotificationBody(
  slug: string,
  data: NotificationData
): string {
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
  if (slug === "payment_received" || slug === "deposit_received") {
    const amt = data.amount ? `$${Number(data.amount).toLocaleString()}` : "";
    return data.clientName ? `${amt} from ${data.clientName}`.trim() : amt;
  }
  if (slug === "tip_received") {
    const amt = data.amount ? `$${Number(data.amount).toLocaleString()}` : "Tip";
    return data.clientName ? `${amt} from ${data.clientName}` : amt;
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
    payment_received: "dollar",
    payment_failed: "alertTriangle",
    deposit_received: "dollar",
    tip_received: "creditCard",
    partner_job_request: "truck",
    partner_job_complete: "check",
    move_tomorrow: "calendar",
    move_started: "flag",
    move_completed: "check",
    move_issue: "alertTriangle",
    crew_checkin: "check",
    crew_no_checkin: "alertTriangle",
    checklist_incomplete: "clipboard",
    claim_submitted: "alertTriangle",
    low_margin_alert: "alertTriangle",
    high_value_move: "dollar",
    system_error: "alertTriangle",
  };
  return icons[slug] || "bell";
}

export function buildNotificationLink(
  slug: string,
  data: NotificationData
): string {
  if (slug.startsWith("quote_") && data.quoteId)
    return `/admin/quotes/${data.quoteId}`;
  if (slug.startsWith("partner_") && data.deliveryId)
    return `/admin/deliveries/${data.deliveryId}`;
  if (
    (slug.startsWith("move_") ||
      slug === "crew_checkin" ||
      slug === "crew_no_checkin" ||
      slug === "checklist_incomplete") &&
    data.moveId
  )
    return `/admin/moves/${data.moveId}`;
  if (slug === "claim_submitted" && data.claimId)
    return `/admin/claims/${data.claimId}`;
  if (slug === "payment_received" || slug === "payment_failed" || slug === "deposit_received")
    return "/admin/invoices";
  if (slug === "tip_received") return "/admin/tips";
  return "/admin";
}

export function getSourceType(slug: string): string {
  if (slug.startsWith("quote_")) return "quote";
  if (
    slug.startsWith("move_") ||
    slug === "crew_checkin" ||
    slug === "crew_no_checkin" ||
    slug === "checklist_incomplete"
  )
    return "move";
  if (
    slug.startsWith("payment_") ||
    slug === "deposit_received" ||
    slug === "tip_received"
  )
    return "payment";
  if (slug.startsWith("partner_")) return "delivery";
  if (slug === "claim_submitted") return "claim";
  return "system";
}

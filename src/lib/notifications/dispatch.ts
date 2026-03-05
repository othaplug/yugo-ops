import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";

interface NotificationData {
  subject?: string;
  body?: string;
  [key: string]: unknown;
}

export async function sendNotification(
  eventSlug: string,
  recipientUserId: string,
  data: NotificationData
) {
  const supabase = createAdminClient();

  // Get user's preferences for this event
  const { data: prefs } = await supabase
    .from("notification_preferences")
    .select("email_enabled, sms_enabled, push_enabled")
    .eq("user_id", recipientUserId)
    .eq("event_slug", eventSlug)
    .single();

  // Default to email ON, sms OFF, push ON if no prefs exist
  const emailEnabled = prefs?.email_enabled ?? true;
  const smsEnabled = prefs?.sms_enabled ?? false;
  const pushEnabled = prefs?.push_enabled ?? true;

  // Get user's contact info from platform_users (admins) or auth.users
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

import { createAdminClient } from "@/lib/supabase/admin";

interface CreatePartnerNotificationParams {
  orgId: string;
  title: string;
  body?: string;
  icon?: string;
  link?: string;
  deliveryId?: string;
}

/**
 * Create an in-app notification for every partner user in the given org.
 * Also keeps a row in partner_notifications for backward compatibility.
 */
export async function createPartnerNotification(params: CreatePartnerNotificationParams) {
  const db = createAdminClient();

  // Legacy insert so existing partner_notifications data stays consistent
  await db
    .from("partner_notifications")
    .insert({
      org_id: params.orgId,
      title: params.title,
      body: params.body || null,
      icon: params.icon || "bell",
      link: params.link || null,
      delivery_id: params.deliveryId || null,
    })
    .select()
    .single();

  // Look up all partner users for this org
  const { data: partnerUsers } = await db
    .from("partner_users")
    .select("user_id")
    .eq("org_id", params.orgId);

  if (!partnerUsers?.length) return { data: null, error: null };

  const rows = partnerUsers.map((pu) => ({
    user_id: pu.user_id,
    title: params.title,
    body: params.body || null,
    icon: params.icon || "bell",
    link: params.link || null,
    source_type: "delivery" as const,
    source_id: params.deliveryId || null,
    is_read: false,
  }));

  const { data, error } = await db
    .from("in_app_notifications")
    .insert(rows)
    .select();

  if (error) {
    console.error("Failed to create partner in-app notification:", error.message);
  }
  return { data, error };
}

interface CreateAdminNotificationParams {
  userId: string;
  title: string;
  body?: string;
  icon?: string;
  link?: string;
  sourceType?: string;
  sourceId?: string;
  eventSlug?: string;
}

export async function createAdminNotification(params: CreateAdminNotificationParams) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("in_app_notifications")
    .insert({
      user_id: params.userId,
      event_slug: params.eventSlug || null,
      title: params.title,
      body: params.body || null,
      icon: params.icon || "bell",
      link: params.link || null,
      source_type: params.sourceType || null,
      source_id: params.sourceId || null,
      is_read: false,
    })
    .select()
    .single();

  if (error) {
    console.error("Failed to create admin notification:", error.message);
  }
  return { data, error };
}

/** Notify all admin/coordinator-level users about something. */
export async function notifyAllAdmins(params: Omit<CreateAdminNotificationParams, "userId">) {
  const db = createAdminClient();
  const { data: admins } = await db
    .from("platform_users")
    .select("user_id")
    .in("role", ["owner", "admin", "manager", "dispatcher", "coordinator"]);

  if (!admins?.length) return;

  const rows = admins.map((a) => ({
    user_id: a.user_id,
    event_slug: params.eventSlug || null,
    title: params.title,
    body: params.body || null,
    icon: params.icon || "bell",
    link: params.link || null,
    source_type: params.sourceType || null,
    source_id: params.sourceId || null,
    is_read: false,
  }));

  const { error } = await db.from("in_app_notifications").insert(rows);
  if (error) {
    console.error("Failed to notify admins:", error.message);
  }
}

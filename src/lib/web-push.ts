import webPush from "web-push";

const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const privateKey = process.env.VAPID_PRIVATE_KEY;

export function isPushConfigured(): boolean {
  return !!(publicKey && privateKey);
}

export function getVapidPublicKey(): string | null {
  return publicKey || null;
}

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string }
): Promise<void> {
  if (!privateKey || !publicKey) return;

  webPush.setVapidDetails("mailto:notifications@opsplus.co", publicKey, privateKey);

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs?.length) return;

  const sendPromises = subs.map(async (sub) => {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
        { TTL: 86400 }
      );
    } catch (err) {
      if (err && typeof err === "object" && "statusCode" in err && (err.statusCode === 410 || err.statusCode === 404)) {
        await admin.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
      }
    }
  });

  await Promise.allSettled(sendPromises);
}
